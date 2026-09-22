import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { runInNewContext } from 'node:vm';
import {
  Action,
  ActionBranch,
  ActionType,
  Automation,
  AutomationScopeType,
  AutomationStatus,
  CommentEvent,
  CommentEventStatus,
  Condition,
  ConditionField,
  Prisma,
  Trigger,
  TriggerMatchType,
  TriggerSource,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException, ForbiddenAppException, NotFoundAppException } from '../../common/utils/app-exception';
import { InstagramService } from '../instagram/instagram.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { FEATURE_KEYS } from '../billing/entitlements.constants';
import { QueueName } from '../../queues/constants';
import { MessageSendJobData } from '../../queues/processors/message-send.processor';
import { AiProcessingJobData } from '../../queues/processors/ai-processing.processor';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { ActionDto, ActionPayloadDto } from './dto/action.dto';
import { ConditionDto } from './dto/condition.dto';
import { TriggerDto } from './dto/trigger.dto';

// A CONDITION action's THEN/ELSE children, recursively — each child can
// itself be a CONDITION, bounded at write time by MAX_ACTION_TREE_DEPTH.
type ActionWithTree = Action & { condition: Condition | null; children: ActionWithTree[] };
type AutomationWithRelations = Automation & { triggers: Trigger[]; actions: ActionWithTree[] };

const REGEX_TIMEOUT_MS = 50;
// A sane recursion bound for nested condition branches (Milestone 1,
// condition/branching) — an explicit, documented scoping decision, not a
// silent truncation. Enforced both at write time (validateActionTree) and
// read time (buildActionsInclude), so the two always agree on what "deep
// enough" means.
const MAX_ACTION_TREE_DEPTH = 5;

// Prisma has no infinite-depth `include` — this builds one nested exactly
// MAX_ACTION_TREE_DEPTH levels deep, reused everywhere an Automation's
// actions are loaded (list/findOne/matchCommentEvent).
//
// Typed `any` deliberately: Prisma 5's generic payload-type inference (the
// machinery that would normally give findMany()'s result a precise type
// straight from the `include` argument) can't resolve an arbitrary-depth
// hand-built recursive include — passing it through a named type erases the
// literal structure Prisma's conditional types need. Rather than fight that
// with unstable generic gymnastics, every consumer of a query using this
// constant declares its own real return type (AutomationWithRelations /
// AutomationWithRelations[]) and Action's recursive shape is enforced
// separately by ActionWithTree, so no untyped data actually escapes this file.
function buildActionsInclude(depth: number, isRoot = false): any {
  const include: Record<string, unknown> = { condition: true };
  if (depth > 1) {
    include.children = buildActionsInclude(depth - 1);
  }
  const result: Record<string, unknown> = { orderBy: { order: 'asc' }, include };
  if (isRoot) {
    // The `actions` relation on Automation has no concept of "root-level" on
    // its own — without this filter Prisma returns EVERY Action row for the
    // automation flat in this array (including ones that are also nested
    // under a CONDITION's `children`), which would make dispatchActionTree
    // fire a THEN/ELSE action a second time, unconditionally, as if it were
    // a root action. Only the recursive `children` field (already scoped to
    // one specific parent via the FK) doesn't need this filter.
    result.where = { parentActionId: null };
  }
  return result;
}
const ACTIONS_INCLUDE: any = buildActionsInclude(MAX_ACTION_TREE_DEPTH, true);

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instagramService: InstagramService,
    private readonly entitlementsService: EntitlementsService,
    @InjectQueue(QueueName.MESSAGE_SEND) private readonly messageSendQueue: Queue<MessageSendJobData>,
    @InjectQueue(QueueName.AI_PROCESSING) private readonly aiProcessingQueue: Queue<AiProcessingJobData>,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────

  async list(workspaceId: string): Promise<AutomationWithRelations[]> {
    // Cast justified by the ACTIONS_INCLUDE comment above: Prisma can't
    // statically type an arbitrary-depth recursive include, so it falls
    // back to the base (non-recursive) Action shape here — the real,
    // recursive shape actually returned at runtime is ActionWithTree.
    return this.prisma.automation.findMany({
      where: { workspaceId },
      include: { triggers: true, actions: ACTIONS_INCLUDE },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    }) as unknown as Promise<AutomationWithRelations[]>;
  }

  async findOne(workspaceId: string, id: string): Promise<AutomationWithRelations> {
    return this.getOwnedAutomation(workspaceId, id);
  }

  async create(workspaceId: string, dto: CreateAutomationDto): Promise<AutomationWithRelations> {
    if (!(await this.instagramService.accountBelongsToWorkspace(dto.instagramAccountId, workspaceId))) {
      throw new NotFoundAppException(
        'INSTAGRAM_ACCOUNT_NOT_FOUND',
        'This Instagram account was not found in your workspace.',
      );
    }
    this.validateTriggers(dto.triggers);
    await this.checkTriggerEntitlements(workspaceId, dto.triggers);
    this.validateActionTree(dto.actions);

    const automationId = await this.prisma.$transaction(async (tx) => {
      const automation = await tx.automation.create({
        data: {
          workspaceId,
          instagramAccountId: dto.instagramAccountId,
          name: dto.name,
          status: dto.status ?? AutomationStatus.ACTIVE,
          scopeType: dto.scopeType ?? AutomationScopeType.ALL_POSTS,
          scopeMediaIds: dto.scopeMediaIds ?? [],
          priority: dto.priority ?? 0,
          triggers: { create: dto.triggers.map((t) => this.toTriggerCreateInput(t)) },
        },
      });
      // A separate step, not a nested `actions: { create: [...] }` write:
      // the branching tree's `children` relation is self-referential
      // (Action -> Action via parentActionId), which Prisma can't combine
      // with automatically populating the unrelated `automationId` FK on
      // deeply nested rows. Explicit recursive inserts, still inside this
      // one transaction, are the boring/correct option (CLAUDE.md §13).
      await this.createActionTree(tx, automation.id, null, null, dto.actions);
      return automation.id;
    });

    return this.getOwnedAutomation(workspaceId, automationId);
  }

  async update(workspaceId: string, id: string, dto: UpdateAutomationDto): Promise<AutomationWithRelations> {
    await this.getOwnedAutomation(workspaceId, id);
    if (dto.triggers) {
      this.validateTriggers(dto.triggers);
      await this.checkTriggerEntitlements(workspaceId, dto.triggers);
    }
    if (dto.actions) {
      this.validateActionTree(dto.actions);
    }

    // Triggers/actions are a full replace when provided, not a merge — see
    // UpdateAutomationDto for why. Wrapped in a transaction so a
    // replace-then-fail never leaves an automation with no triggers/actions.
    await this.prisma.$transaction(async (tx) => {
      if (dto.triggers) {
        await tx.trigger.deleteMany({ where: { automationId: id } });
      }
      if (dto.actions) {
        // Root-level actions only — cascades to every descendant (children,
        // condition) via the schema's onDelete: Cascade self-relation.
        await tx.action.deleteMany({ where: { automationId: id, parentActionId: null } });
      }

      await tx.automation.update({
        where: { id },
        data: {
          name: dto.name,
          status: dto.status,
          scopeType: dto.scopeType,
          scopeMediaIds: dto.scopeMediaIds,
          priority: dto.priority,
          triggers: dto.triggers ? { create: dto.triggers.map((t) => this.toTriggerCreateInput(t)) } : undefined,
        },
      });

      if (dto.actions) {
        await this.createActionTree(tx, id, null, null, dto.actions);
      }
    });

    return this.getOwnedAutomation(workspaceId, id);
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    await this.getOwnedAutomation(workspaceId, id);
    await this.prisma.automation.delete({ where: { id } });
  }

  /** 404s rather than leaking whether the id exists in another workspace — CLAUDE.md §5a A01. */
  private async getOwnedAutomation(workspaceId: string, id: string): Promise<AutomationWithRelations> {
    // See the ACTIONS_INCLUDE comment: cast justified by the same Prisma
    // recursive-include typing limitation.
    const automation = (await this.prisma.automation.findUnique({
      where: { id },
      include: { triggers: true, actions: ACTIONS_INCLUDE },
    })) as unknown as AutomationWithRelations | null;
    if (!automation || automation.workspaceId !== workspaceId) {
      throw new NotFoundAppException('AUTOMATION_NOT_FOUND', 'Automation not found.');
    }
    return automation;
  }

  private toTriggerCreateInput(dto: TriggerDto) {
    return {
      source: dto.source,
      matchType: dto.matchType,
      keywords: dto.keywords,
      caseSensitive: dto.caseSensitive ?? false,
      aiIntentLabel: dto.aiIntentLabel,
    };
  }

  /**
   * Recursively inserts a CONDITION action's THEN/ELSE branches as their own
   * Action rows (parentActionId/branch set explicitly), rather than a single
   * nested `actions: { create: [...] }` write — see the comment in create()
   * for why the self-referential `children` relation can't be combined with
   * Prisma auto-populating the unrelated `automationId` FK on nested rows.
   */
  private async createActionTree(
    tx: Prisma.TransactionClient,
    automationId: string,
    parentActionId: string | null,
    branch: ActionBranch | null,
    actions: ActionDto[],
  ): Promise<void> {
    for (const dto of actions) {
      const action = await tx.action.create({
        data: {
          automationId,
          parentActionId,
          branch: branch ?? undefined,
          type: dto.type,
          order: dto.order ?? 0,
          delaySeconds: dto.delaySeconds ?? 0,
          payload: dto.payload ? (dto.payload as unknown as object) : undefined,
          condition: dto.condition ? { create: this.toConditionCreateInput(dto.condition) } : undefined,
        },
      });
      if (dto.children) {
        await this.createActionTree(tx, automationId, action.id, ActionBranch.THEN, dto.children.then);
        await this.createActionTree(tx, automationId, action.id, ActionBranch.ELSE, dto.children.else);
      }
    }
  }

  private toConditionCreateInput(dto: ConditionDto) {
    return {
      matchType: dto.matchType,
      field: dto.field ?? ConditionField.COMMENT_TEXT,
      keywords: dto.keywords,
      caseSensitive: dto.caseSensitive ?? false,
      aiIntentLabel: dto.aiIntentLabel,
    };
  }

  /** Dead code today (Free plan has every FEATURE_KEYS entry on) — proves gating is a Plan.features data flip, not a rewrite. */
  private async checkTriggerEntitlements(workspaceId: string, triggers: TriggerDto[]): Promise<void> {
    if (!triggers.some((t) => t.source === TriggerSource.LIVE_COMMENT)) {
      return;
    }
    const enabled = await this.entitlementsService.isEnabled(workspaceId, FEATURE_KEYS.LIVE_COMMENT_AUTOMATION);
    if (!enabled) {
      throw new ForbiddenAppException(
        'FEATURE_NOT_AVAILABLE',
        'Live comment automations are not available on your current plan.',
      );
    }
  }

  /** Rejects an unparseable REGEX pattern at write time rather than silently never matching. */
  private validateTriggers(triggers: TriggerDto[]): void {
    for (const trigger of triggers) {
      if (trigger.matchType === TriggerMatchType.REGEX) {
        const pattern = trigger.keywords[0];
        if (!pattern) {
          throw new AppException('INVALID_TRIGGER', 'A REGEX trigger needs a pattern in keywords[0].');
        }
        try {
          new RegExp(pattern);
        } catch {
          throw new AppException('INVALID_TRIGGER', `"${pattern}" is not a valid regular expression.`);
        }
      }
    }
  }

  /**
   * Validates a CONDITION action's branches recursively: every REGEX
   * condition needs a parseable pattern (mirrors validateTriggers — CLAUDE.md
   * §14, branching gets the same validation rigor as triggers, not a lighter
   * pass because it's newer code), and the tree can't nest deeper than
   * MAX_ACTION_TREE_DEPTH (an explicit, documented scoping decision, not a
   * silent truncation).
   */
  private validateActionTree(actions: ActionDto[], depth = 1): void {
    if (depth > MAX_ACTION_TREE_DEPTH) {
      throw new AppException(
        'CONDITION_TOO_DEEP',
        `Condition branches can nest at most ${MAX_ACTION_TREE_DEPTH} levels deep.`,
      );
    }
    for (const action of actions) {
      if (action.type !== ActionType.CONDITION) {
        continue;
      }
      if (!action.condition || !action.children) {
        throw new AppException('INVALID_ACTION', 'A CONDITION action needs a condition and then/else children.');
      }
      if (action.condition.matchType === TriggerMatchType.REGEX) {
        const pattern = action.condition.keywords[0];
        if (!pattern) {
          throw new AppException('INVALID_CONDITION', 'A REGEX condition needs a pattern in keywords[0].');
        }
        try {
          new RegExp(pattern);
        } catch {
          throw new AppException('INVALID_CONDITION', `"${pattern}" is not a valid regular expression.`);
        }
      }
      this.validateActionTree(action.children.then, depth + 1);
      this.validateActionTree(action.children.else, depth + 1);
    }
  }

  // ── Matching engine (Phase 2) ────────────────────────────────────────

  /**
   * Called by AutomationMatchProcessor for every enqueued CommentEvent.
   * Loads the account's active automations (highest priority first),
   * finds the first one whose triggers match, updates the CommentEvent,
   * and dispatches its actions. No-ops if the event was already processed
   * (retry safety).
   */
  async matchCommentEvent(commentEventId: string): Promise<void> {
    const commentEvent = await this.prisma.commentEvent.findUnique({ where: { id: commentEventId } });
    if (!commentEvent || commentEvent.status !== CommentEventStatus.PENDING) {
      return;
    }

    // See the ACTIONS_INCLUDE comment: cast justified by the same Prisma
    // recursive-include typing limitation.
    const automations = (await this.prisma.automation.findMany({
      where: { instagramAccountId: commentEvent.instagramAccountId, status: AutomationStatus.ACTIVE },
      include: { triggers: true, actions: ACTIONS_INCLUDE },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })) as unknown as AutomationWithRelations[];

    const matched = automations.find((automation) => this.automationMatches(automation, commentEvent));

    if (!matched) {
      await this.prisma.commentEvent.update({
        where: { id: commentEvent.id },
        data: { status: CommentEventStatus.NO_MATCH, processedAt: new Date() },
      });
      return;
    }

    // Dispatch BEFORE marking MATCHED, not after: if this throws partway
    // through (e.g. Redis hiccup on the 2nd of 3 actions), BullMQ retries
    // the whole job. Because the CommentEvent is still PENDING, the retry
    // reprocesses fully rather than being skipped by the PENDING-only guard
    // above — and dispatchAction's per-action stable jobId makes re-enqueuing
    // an already-enqueued action a safe no-op instead of a duplicate send.
    await this.dispatchActionTree(matched.actions, commentEvent);

    await this.prisma.commentEvent.update({
      where: { id: commentEvent.id },
      data: { status: CommentEventStatus.MATCHED, matchedAutomationId: matched.id, processedAt: new Date() },
    });
  }

  private automationMatches(automation: AutomationWithRelations, commentEvent: CommentEvent): boolean {
    if (automation.scopeType === AutomationScopeType.SPECIFIC_POSTS) {
      if (!commentEvent.mediaId || !automation.scopeMediaIds.includes(commentEvent.mediaId)) {
        return false;
      }
    }
    return automation.triggers.some((trigger) => this.triggerMatches(trigger, commentEvent));
  }

  private triggerMatches(trigger: Trigger, commentEvent: CommentEvent): boolean {
    if (trigger.source !== commentEvent.source) {
      return false;
    }
    return this.matchesKeywords(trigger.matchType, trigger.keywords, trigger.caseSensitive, commentEvent.text, trigger.id);
  }

  /**
   * A CONDITION action's test, evaluated against the CommentEvent that
   * matched the automation — same match-type semantics as a Trigger
   * (COMMENT_TEXT/SENDER_USERNAME select which field is tested), including
   * the AI_INTENT stub (CLAUDE.md §14: every option a trigger supports,
   * branching supports too, not a simplified subset).
   */
  private conditionMatches(condition: Condition, commentEvent: CommentEvent): boolean {
    const text = condition.field === ConditionField.SENDER_USERNAME ? commentEvent.fromUsername : commentEvent.text;
    return this.matchesKeywords(condition.matchType, condition.keywords, condition.caseSensitive, text, condition.id);
  }

  /** Shared by triggerMatches and conditionMatches — identical match semantics either way. */
  private matchesKeywords(
    matchType: TriggerMatchType,
    keywords: string[],
    caseSensitive: boolean,
    text: string,
    entityId: string,
  ): boolean {
    switch (matchType) {
      case TriggerMatchType.EXACT:
      case TriggerMatchType.CONTAINS:
        // No keyword configured = nothing to check against, so treat it as
        // "run on every comment" rather than "never matches" (user
        // directive, 2026-09-24) — an empty keyword list is a deliberate
        // unconditional trigger/condition, not a misconfiguration. REGEX
        // has no equivalent fallback (there's no sensible "match anything"
        // pattern to assume) and is rejected at write time instead — see
        // validateTriggers/validateActionTree.
        if (keywords.length === 0) {
          return true;
        }
        return matchType === TriggerMatchType.EXACT
          ? keywords.some((kw) => this.normalize(kw, caseSensitive) === this.normalize(text.trim(), caseSensitive))
          : keywords.some((kw) => this.normalize(text, caseSensitive).includes(this.normalize(kw, caseSensitive)));
      case TriggerMatchType.REGEX:
        return this.regexMatches(keywords, caseSensitive, text, entityId);
      case TriggerMatchType.AI_INTENT:
        // Phase 6 (AI features) isn't built yet — never matches until then.
        return false;
      default:
        return false;
    }
  }

  private normalize(value: string, caseSensitive: boolean): string {
    return caseSensitive ? value : value.toLowerCase();
  }

  /**
   * Trigger/condition patterns are creator-authored and run in the shared
   * worker process on every incoming event for their account. A pathological
   * pattern (catastrophic backtracking) would otherwise block the event
   * loop for every other workspace's jobs too — ARCHITECTURE.md: "one
   * customer's spike must never throttle another." Bounded with a hard
   * wall-clock timeout via `vm` rather than trusting the pattern; the
   * pattern itself is already validated at write time (validateTriggers /
   * validateActionTree).
   */
  private regexMatches(keywords: string[], caseSensitive: boolean, text: string, entityId: string): boolean {
    const pattern = keywords[0];
    if (!pattern) {
      return false;
    }
    try {
      return runInNewContext(
        'regex.test(text)',
        { regex: new RegExp(pattern, caseSensitive ? '' : 'i'), text },
        { timeout: REGEX_TIMEOUT_MS },
      );
    } catch (err) {
      this.logger.warn(`Regex pattern for ${entityId} rejected (invalid or timed out): ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Walks the matched automation's action tree depth-first. A CONDITION
   * action never sends anything itself: it evaluates its Condition against
   * the CommentEvent, then recurses into whichever branch's children
   * (THEN on a match, ELSE otherwise) — those children can themselves be
   * further CONDITIONs, up to MAX_ACTION_TREE_DEPTH.
   */
  private async dispatchActionTree(actions: ActionWithTree[], commentEvent: CommentEvent): Promise<void> {
    for (const action of actions) {
      if (action.type === ActionType.CONDITION) {
        if (!action.condition) {
          this.logger.warn(`CONDITION action ${action.id} has no Condition row — skipping`);
          continue;
        }
        const branch = this.conditionMatches(action.condition, commentEvent) ? ActionBranch.THEN : ActionBranch.ELSE;
        await this.dispatchActionTree(
          action.children.filter((child) => child.branch === branch),
          commentEvent,
        );
        continue;
      }
      await this.dispatchAction(action, commentEvent);
    }
  }

  private async dispatchAction(action: Action, commentEvent: CommentEvent): Promise<void> {
    const delay = action.delaySeconds * 1000;
    // Stable per-(event, action) id: if matchCommentEvent's job is retried
    // (see the comment above its call site), re-adding a job that was
    // already enqueued is a safe no-op in BullMQ instead of a duplicate send.
    // BullMQ (5.x) rejects custom job IDs containing ":" ("Custom Id cannot
    // contain :") - found the hard way when this was the first automation
    // to ever actually match in production. Hyphen instead; cuid()-based
    // ids never contain one, so this stays collision-safe.
    const jobId = `${commentEvent.id}-${action.id}`;

    if (action.type === ActionType.SEND_AI_REPLY) {
      const jobData: AiProcessingJobData = {
        commentEventId: commentEvent.id,
        automationId: action.automationId,
        kind: 'GENERATE_REPLY',
      };
      await this.aiProcessingQueue.add('generate-reply', jobData, { delay, jobId });
      return;
    }

    const isConversationSourced =
      commentEvent.source === TriggerSource.STORY_REPLY || commentEvent.source === TriggerSource.DM;
    if (isConversationSourced && action.type === ActionType.REPLY_COMMENT) {
      // There's no comment thread to publicly reply into for a DM/story
      // reply — this combination is only reachable if someone builds an
      // automation pairing a STORY_REPLY/DM trigger with a REPLY_COMMENT
      // action, which the UI doesn't currently offer but the API doesn't
      // reject either (see TRACKER.md). Fail loudly rather than send a
      // malformed request.
      this.logger.warn(
        `Skipping REPLY_COMMENT action ${action.id}: source ${commentEvent.source} has no comment to reply to`,
      );
      return;
    }

    const payload = action.payload as unknown as ActionPayloadDto;
    const jobData: MessageSendJobData = {
      workspaceId: commentEvent.workspaceId,
      instagramAccountId: commentEvent.instagramAccountId,
      // Comment-sourced events (COMMENT/LIVE_COMMENT): Meta's Private/Public
      // Reply APIs key off the comment ID itself. Conversation-sourced
      // events (STORY_REPLY, and DM once its webhook mapping exists): the
      // reply goes to the sender's IG-scoped user ID instead — that's what
      // WebhooksController stored in fromUsername for these sources (see
      // its mapMessagingEventToJobData). See MessageSendJobData /
      // MessagingService.callGraphApi for the two different request shapes
      // this drives.
      recipientId: isConversationSourced ? commentEvent.fromUsername : commentEvent.externalEventId,
      recipientType: isConversationSourced ? 'user' : 'comment',
      actionType: action.type,
      content: { text: this.renderText(payload.text, commentEvent), buttons: payload.buttons },
      commentEventId: commentEvent.id,
    };
    await this.messageSendQueue.add('send', jobData, { delay, jobId });
  }

  private renderText(template: string, commentEvent: CommentEvent): string {
    return template.replace(/\{\{\s*username\s*\}\}/g, commentEvent.fromUsername);
  }
}
