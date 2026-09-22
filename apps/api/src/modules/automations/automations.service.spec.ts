// @nestjs/common, @nestjs/config and @nestjs/bullmq ship ESM-only in this
// NestJS 12 line, which ts-jest's CommonJS transform can't load — see
// jest.config.js history / TRACKER.md. These tests construct
// AutomationsService directly (bypassing Nest's DI container), so the
// decorators/classes only need to be harmless stand-ins.
jest.mock('@nestjs/common', () => {
  class HttpException extends Error {
    constructor(
      public response: unknown,
      public status: number,
    ) {
      super(typeof response === 'string' ? response : JSON.stringify(response));
    }
  }
  class Logger {
    log = jest.fn();
    debug = jest.fn();
    warn = jest.fn();
    error = jest.fn();
  }
  return {
    Injectable: () => () => {},
    Inject: () => () => {},
    Global: () => () => {},
    Module: () => () => {},
    Logger,
    HttpException,
    HttpStatus: { BAD_REQUEST: 400, NOT_FOUND: 404, CONFLICT: 409, FORBIDDEN: 403 },
  };
});
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('@nestjs/bullmq', () => ({ InjectQueue: () => () => {} }));

import {
  ActionBranch,
  ActionType,
  AutomationScopeType,
  AutomationStatus,
  CommentEventStatus,
  ConditionField,
  TriggerMatchType,
  TriggerSource,
} from '@prisma/client';
import { AutomationsService } from './automations.service';
import { AppException, ForbiddenAppException, NotFoundAppException } from '../../common/utils/app-exception';

function makeCommentEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comment-event-1',
    workspaceId: 'workspace-1',
    instagramAccountId: 'ig-account-1',
    externalEventId: 'evt-1',
    source: TriggerSource.COMMENT,
    mediaId: 'media-1',
    fromUsername: 'viewer123',
    text: 'PRICE please',
    status: CommentEventStatus.PENDING,
    matchedAutomationId: null,
    receivedAt: new Date(),
    processedAt: null,
    ...overrides,
  };
}

function makeAutomation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'automation-1',
    workspaceId: 'workspace-1',
    instagramAccountId: 'ig-account-1',
    name: 'Price DM',
    status: AutomationStatus.ACTIVE,
    scopeType: AutomationScopeType.ALL_POSTS,
    scopeMediaIds: [] as string[],
    priority: 0,
    createdAt: new Date(),
    triggers: [
      {
        id: 'trigger-1',
        automationId: 'automation-1',
        source: TriggerSource.COMMENT,
        matchType: TriggerMatchType.CONTAINS,
        keywords: ['price'],
        caseSensitive: false,
        aiIntentLabel: null,
      },
    ],
    actions: [
      {
        id: 'action-1',
        automationId: 'automation-1',
        type: ActionType.SEND_DM,
        order: 0,
        delaySeconds: 0,
        payload: { text: 'Hi {{username}}, here is the link!' },
      },
    ],
    ...overrides,
  };
}

/**
 * A CONDITION action with a THEN and an ELSE child, in the fully-loaded
 * shape AutomationsService reads back from Prisma (condition + recursive
 * children) — used to test dispatchActionTree/conditionMatches directly via
 * matchCommentEvent, mirroring how makeAutomation()'s flat SEND_DM action
 * exercises dispatchAction.
 */
function makeConditionAction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'condition-action-1',
    automationId: 'automation-1',
    type: ActionType.CONDITION,
    order: 0,
    delaySeconds: 0,
    payload: null,
    parentActionId: null,
    branch: null,
    condition: {
      id: 'condition-1',
      actionId: 'condition-action-1',
      matchType: TriggerMatchType.CONTAINS,
      field: ConditionField.COMMENT_TEXT,
      keywords: ['price'],
      caseSensitive: false,
      aiIntentLabel: null,
    },
    children: [
      {
        id: 'then-action-1',
        automationId: 'automation-1',
        type: ActionType.SEND_DM,
        order: 0,
        delaySeconds: 0,
        payload: { text: 'THEN branch fired' },
        parentActionId: 'condition-action-1',
        branch: ActionBranch.THEN,
        condition: null,
        children: [],
      },
      {
        id: 'else-action-1',
        automationId: 'automation-1',
        type: ActionType.SEND_DM,
        order: 0,
        delaySeconds: 0,
        payload: { text: 'ELSE branch fired' },
        parentActionId: 'condition-action-1',
        branch: ActionBranch.ELSE,
        condition: null,
        children: [],
      },
    ],
    ...overrides,
  };
}

function makeService(prismaOverrides: Record<string, any> = {}) {
  let actionCreateCounter = 0;
  const prisma = {
    commentEvent: { findUnique: jest.fn(), update: jest.fn() },
    automation: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      $transaction: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(prisma)),
    trigger: { deleteMany: jest.fn() },
    action: {
      deleteMany: jest.fn(),
      create: jest.fn((args: any) =>
        Promise.resolve({ id: `action-created-${++actionCreateCounter}`, ...args.data }),
      ),
    },
    ...prismaOverrides,
  } as any;

  const instagramService = {
    accountBelongsToWorkspace: jest.fn().mockResolvedValue(true),
  } as any;

  const entitlementsService = {
    isEnabled: jest.fn().mockResolvedValue(true),
  } as any;

  const messageSendQueue = { add: jest.fn() } as any;
  const aiProcessingQueue = { add: jest.fn() } as any;

  const service = new AutomationsService(
    prisma,
    instagramService,
    entitlementsService,
    messageSendQueue,
    aiProcessingQueue,
  );
  return { service, prisma, instagramService, entitlementsService, messageSendQueue, aiProcessingQueue };
}

describe('AutomationsService.matchCommentEvent', () => {
  it('is a no-op when the CommentEvent no longer exists', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(null);

    await service.matchCommentEvent('missing');

    expect(prisma.automation.findMany).not.toHaveBeenCalled();
  });

  it('is a no-op when the CommentEvent was already processed (retry safety)', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeCommentEvent({ status: CommentEventStatus.MATCHED }));

    await service.matchCommentEvent('comment-event-1');

    expect(prisma.automation.findMany).not.toHaveBeenCalled();
  });

  it('matches a CONTAINS trigger, marks MATCHED, and enqueues the DM with the template rendered', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeCommentEvent());
    prisma.automation.findMany.mockResolvedValue([makeAutomation()]);

    await service.matchCommentEvent('comment-event-1');

    expect(prisma.commentEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CommentEventStatus.MATCHED,
          matchedAutomationId: 'automation-1',
        }),
      }),
    );
    expect(messageSendQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        recipientId: 'evt-1', // comment ID, not a separate user ID
        actionType: ActionType.SEND_DM,
        content: expect.objectContaining({ text: 'Hi viewer123, here is the link!' }),
      }),
      expect.objectContaining({ delay: 0 }),
    );
    // Regression test: BullMQ 5.x rejects custom job IDs containing ":"
    // ("Custom Id cannot contain :") - this silently failed every real
    // match (5 retries, then dropped) until caught in production.
    const [, , jobOptions] = messageSendQueue.add.mock.calls[0];
    expect(jobOptions.jobId).not.toContain(':');
  });

  it('marks NO_MATCH and enqueues nothing when no automation matches', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeCommentEvent({ text: 'unrelated comment' }));
    prisma.automation.findMany.mockResolvedValue([makeAutomation()]);

    await service.matchCommentEvent('comment-event-1');

    expect(prisma.commentEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: CommentEventStatus.NO_MATCH }) }),
    );
    expect(messageSendQueue.add).not.toHaveBeenCalled();
  });

  it('does not match when scoped to specific posts and the comment is on a different post', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeCommentEvent({ mediaId: 'other-media' }));
    prisma.automation.findMany.mockResolvedValue([
      makeAutomation({ scopeType: AutomationScopeType.SPECIFIC_POSTS, scopeMediaIds: ['media-1'] }),
    ]);

    await service.matchCommentEvent('comment-event-1');

    expect(messageSendQueue.add).not.toHaveBeenCalled();
  });

  it('matches a REGEX trigger', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeCommentEvent({ text: 'PRICE123' }));
    prisma.automation.findMany.mockResolvedValue([
      makeAutomation({
        triggers: [
          {
            id: 'trigger-1',
            automationId: 'automation-1',
            source: TriggerSource.COMMENT,
            matchType: TriggerMatchType.REGEX,
            keywords: ['^PRICE\\d+$'],
            caseSensitive: false,
          },
        ],
      }),
    ]);

    await service.matchCommentEvent('comment-event-1');

    expect(messageSendQueue.add).toHaveBeenCalled();
  });

  it('treats a pathological regex as a non-match instead of hanging the worker', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    // Classic catastrophic-backtracking pattern against a string with no
    // trailing match — would hang without the vm timeout guard.
    prisma.commentEvent.findUnique.mockResolvedValue(
      makeCommentEvent({ text: 'a'.repeat(30) + '!' }),
    );
    prisma.automation.findMany.mockResolvedValue([
      makeAutomation({
        triggers: [
          {
            id: 'trigger-1',
            automationId: 'automation-1',
            source: TriggerSource.COMMENT,
            matchType: TriggerMatchType.REGEX,
            keywords: ['^(a+)+$'],
            caseSensitive: false,
          },
        ],
      }),
    ]);

    await service.matchCommentEvent('comment-event-1');

    expect(messageSendQueue.add).not.toHaveBeenCalled();
    expect(prisma.commentEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: CommentEventStatus.NO_MATCH }) }),
    );
  }, 10000);

  it('routes SEND_AI_REPLY actions to the AI processing queue instead of message-send', async () => {
    const { service, prisma, messageSendQueue, aiProcessingQueue } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeCommentEvent());
    prisma.automation.findMany.mockResolvedValue([
      makeAutomation({
        actions: [
          {
            id: 'action-1',
            automationId: 'automation-1',
            type: ActionType.SEND_AI_REPLY,
            order: 0,
            delaySeconds: 0,
            payload: { text: 'ignored for AI replies' },
          },
        ],
      }),
    ]);

    await service.matchCommentEvent('comment-event-1');

    expect(aiProcessingQueue.add).toHaveBeenCalledWith(
      'generate-reply',
      { commentEventId: 'comment-event-1', automationId: 'automation-1', kind: 'GENERATE_REPLY' },
      expect.any(Object),
    );
    expect(messageSendQueue.add).not.toHaveBeenCalled();
  });

  it('sends a story-reply-sourced SEND_DM with recipientType "user" and the sender id as recipientId', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(
      makeCommentEvent({ source: TriggerSource.STORY_REPLY, fromUsername: 'ig-scoped-user-1', text: 'love it' }),
    );
    prisma.automation.findMany.mockResolvedValue([
      makeAutomation({
        triggers: [
          {
            id: 'trigger-1',
            automationId: 'automation-1',
            source: TriggerSource.STORY_REPLY,
            matchType: TriggerMatchType.CONTAINS,
            keywords: ['love'],
            caseSensitive: false,
          },
        ],
      }),
    ]);

    await service.matchCommentEvent('comment-event-1');

    expect(messageSendQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ recipientId: 'ig-scoped-user-1', recipientType: 'user' }),
      expect.any(Object),
    );
  });

  it('skips a REPLY_COMMENT action on a story-reply-sourced event instead of sending a malformed request', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(
      makeCommentEvent({ source: TriggerSource.STORY_REPLY, text: 'love it' }),
    );
    prisma.automation.findMany.mockResolvedValue([
      makeAutomation({
        triggers: [
          {
            id: 'trigger-1',
            automationId: 'automation-1',
            source: TriggerSource.STORY_REPLY,
            matchType: TriggerMatchType.CONTAINS,
            keywords: ['love'],
            caseSensitive: false,
          },
        ],
        actions: [
          {
            id: 'action-1',
            automationId: 'automation-1',
            type: ActionType.REPLY_COMMENT,
            order: 0,
            delaySeconds: 0,
            payload: { text: 'thanks!' },
          },
        ],
      }),
    ]);

    await service.matchCommentEvent('comment-event-1');

    expect(messageSendQueue.add).not.toHaveBeenCalled();
  });
});

describe('AutomationsService CRUD ownership', () => {
  it('create() rejects when the Instagram account is not in the caller workspace', async () => {
    const { service, instagramService } = makeService();
    instagramService.accountBelongsToWorkspace.mockResolvedValue(false);

    await expect(
      service.create('workspace-1', {
        name: 'x',
        instagramAccountId: 'someone-elses-account',
        triggers: [{ source: TriggerSource.COMMENT, matchType: TriggerMatchType.CONTAINS, keywords: ['x'] }],
        actions: [{ type: ActionType.SEND_DM, payload: { text: 'hi' } }],
      } as any),
    ).rejects.toThrow(NotFoundAppException);
  });

  it('create() rejects an unparseable REGEX pattern', async () => {
    const { service } = makeService();

    await expect(
      service.create('workspace-1', {
        name: 'x',
        instagramAccountId: 'ig-account-1',
        triggers: [{ source: TriggerSource.COMMENT, matchType: TriggerMatchType.REGEX, keywords: ['('] }],
        actions: [{ type: ActionType.SEND_DM, payload: { text: 'hi' } }],
      } as any),
    ).rejects.toThrow(AppException);
  });

  it('findOne() 404s (not leaks) when the automation belongs to a different workspace', async () => {
    const { service, prisma } = makeService();
    prisma.automation.findUnique.mockResolvedValue(makeAutomation({ workspaceId: 'someone-elses-workspace' }));

    await expect(service.findOne('workspace-1', 'automation-1')).rejects.toThrow(NotFoundAppException);
  });

  it('findOne() 404s when the automation does not exist at all', async () => {
    const { service, prisma } = makeService();
    prisma.automation.findUnique.mockResolvedValue(null);

    await expect(service.findOne('workspace-1', 'missing')).rejects.toThrow(NotFoundAppException);
  });

  it('queries the actions relation scoped to root-level actions only (parentActionId: null)', async () => {
    // Regression test: without this filter, Prisma's `actions` relation on
    // Automation returns EVERY Action row (including ones nested under a
    // CONDITION's `children`) flat in the same array — a THEN/ELSE action
    // would then appear both correctly nested AND, indistinguishably to
    // dispatchActionTree, as if it were also a root-level action, causing it
    // to fire a second time unconditionally. Caught live via a browser test
    // during Milestone 1 (2026-09-23) before this filter was added.
    const { service, prisma } = makeService();
    prisma.automation.findUnique.mockResolvedValue(makeAutomation());

    await service.findOne('workspace-1', 'automation-1');

    const includeArg = prisma.automation.findUnique.mock.calls[0][0].include;
    expect(includeArg.actions.where).toEqual({ parentActionId: null });
  });
});

describe('AutomationsService entitlement gating (LIVE_COMMENT_AUTOMATION)', () => {
  it('create() rejects a LIVE_COMMENT trigger when the feature is disabled for the workspace', async () => {
    const { service, entitlementsService } = makeService();
    entitlementsService.isEnabled.mockResolvedValue(false);

    await expect(
      service.create('workspace-1', {
        name: 'x',
        instagramAccountId: 'ig-account-1',
        triggers: [{ source: TriggerSource.LIVE_COMMENT, matchType: TriggerMatchType.CONTAINS, keywords: ['x'] }],
        actions: [{ type: ActionType.SEND_DM, payload: { text: 'hi' } }],
      } as any),
    ).rejects.toThrow(ForbiddenAppException);
    expect(entitlementsService.isEnabled).toHaveBeenCalledWith('workspace-1', 'live_comment_automation');
  });

  it('create() allows a LIVE_COMMENT trigger when the feature is enabled', async () => {
    const { service, prisma, entitlementsService } = makeService();
    entitlementsService.isEnabled.mockResolvedValue(true);
    prisma.automation.create.mockResolvedValue(makeAutomation());
    prisma.automation.findUnique.mockResolvedValue(makeAutomation());

    await expect(
      service.create('workspace-1', {
        name: 'x',
        instagramAccountId: 'ig-account-1',
        triggers: [{ source: TriggerSource.LIVE_COMMENT, matchType: TriggerMatchType.CONTAINS, keywords: ['x'] }],
        actions: [{ type: ActionType.SEND_DM, payload: { text: 'hi' } }],
      } as any),
    ).resolves.toBeDefined();
  });

  it('create() never checks entitlements for triggers that are not LIVE_COMMENT', async () => {
    const { service, prisma, entitlementsService } = makeService();
    prisma.automation.create.mockResolvedValue(makeAutomation());
    prisma.automation.findUnique.mockResolvedValue(makeAutomation());

    await service.create('workspace-1', {
      name: 'x',
      instagramAccountId: 'ig-account-1',
      triggers: [{ source: TriggerSource.COMMENT, matchType: TriggerMatchType.CONTAINS, keywords: ['x'] }],
      actions: [{ type: ActionType.SEND_DM, payload: { text: 'hi' } }],
    } as any);

    expect(entitlementsService.isEnabled).not.toHaveBeenCalled();
  });

  it('update() rejects switching a trigger to LIVE_COMMENT when the feature is disabled', async () => {
    const { service, prisma, entitlementsService } = makeService();
    prisma.automation.findUnique.mockResolvedValue(makeAutomation());
    entitlementsService.isEnabled.mockResolvedValue(false);

    await expect(
      service.update('workspace-1', 'automation-1', {
        triggers: [{ source: TriggerSource.LIVE_COMMENT, matchType: TriggerMatchType.CONTAINS, keywords: ['x'] }],
      } as any),
    ).rejects.toThrow(ForbiddenAppException);
  });
});

describe('AutomationsService condition/branching — dispatch', () => {
  it('dispatches the THEN branch when a CONTAINS/COMMENT_TEXT condition matches', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeCommentEvent({ text: 'what is the PRICE?' }));
    prisma.automation.findMany.mockResolvedValue([makeAutomation({ actions: [makeConditionAction()] })]);

    await service.matchCommentEvent('comment-event-1');

    expect(messageSendQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ content: expect.objectContaining({ text: 'THEN branch fired' }) }),
      expect.any(Object),
    );
  });

  it('dispatches the ELSE branch when the condition does not match', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    // Text must still match the automation's own trigger ('price', the
    // default in makeAutomation) for matchCommentEvent to pick this
    // automation at all — the CONDITION's own keywords are the thing under
    // test here, checking for something the text doesn't contain.
    prisma.commentEvent.findUnique.mockResolvedValue(makeCommentEvent({ text: 'price info please' }));
    prisma.automation.findMany.mockResolvedValue([
      makeAutomation({
        actions: [
          makeConditionAction({
            condition: {
              id: 'condition-1',
              actionId: 'condition-action-1',
              matchType: TriggerMatchType.CONTAINS,
              field: ConditionField.COMMENT_TEXT,
              keywords: ['discount'],
              caseSensitive: false,
              aiIntentLabel: null,
            },
          }),
        ],
      }),
    ]);

    await service.matchCommentEvent('comment-event-1');

    expect(messageSendQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ content: expect.objectContaining({ text: 'ELSE branch fired' }) }),
      expect.any(Object),
    );
  });

  it('evaluates a SENDER_USERNAME condition against fromUsername, not comment text', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(
      makeCommentEvent({ text: 'no price mention here', fromUsername: 'vip_customer' }),
    );
    prisma.automation.findMany.mockResolvedValue([
      makeAutomation({
        actions: [
          makeConditionAction({
            condition: {
              id: 'condition-1',
              actionId: 'condition-action-1',
              matchType: TriggerMatchType.EXACT,
              field: ConditionField.SENDER_USERNAME,
              keywords: ['vip_customer'],
              caseSensitive: false,
              aiIntentLabel: null,
            },
          }),
        ],
      }),
    ]);

    await service.matchCommentEvent('comment-event-1');

    expect(messageSendQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ content: expect.objectContaining({ text: 'THEN branch fired' }) }),
      expect.any(Object),
    );
  });

  it('a REGEX condition matches like a REGEX trigger does', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeCommentEvent({ text: 'PRICE123' }));
    prisma.automation.findMany.mockResolvedValue([
      makeAutomation({
        actions: [
          makeConditionAction({
            condition: {
              id: 'condition-1',
              actionId: 'condition-action-1',
              matchType: TriggerMatchType.REGEX,
              field: ConditionField.COMMENT_TEXT,
              keywords: ['^PRICE\\d+$'],
              caseSensitive: false,
              aiIntentLabel: null,
            },
          }),
        ],
      }),
    ]);

    await service.matchCommentEvent('comment-event-1');

    expect(messageSendQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ content: expect.objectContaining({ text: 'THEN branch fired' }) }),
      expect.any(Object),
    );
  });

  it('an AI_INTENT condition never matches (ai module not built yet) and routes to ELSE', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    // 'price' still needed so the automation's own trigger matches; AI_INTENT
    // is a stub that always returns false regardless of content (Phase 6 not
    // built yet), so it routes to ELSE no matter what the text says.
    prisma.commentEvent.findUnique.mockResolvedValue(makeCommentEvent({ text: 'price please, anything at all' }));
    prisma.automation.findMany.mockResolvedValue([
      makeAutomation({
        actions: [
          makeConditionAction({
            condition: {
              id: 'condition-1',
              actionId: 'condition-action-1',
              matchType: TriggerMatchType.AI_INTENT,
              field: ConditionField.COMMENT_TEXT,
              keywords: [],
              caseSensitive: false,
              aiIntentLabel: 'wants pricing info',
            },
          }),
        ],
      }),
    ]);

    await service.matchCommentEvent('comment-event-1');

    expect(messageSendQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ content: expect.objectContaining({ text: 'ELSE branch fired' }) }),
      expect.any(Object),
    );
  });

  it('supports a CONDITION nested inside a THEN branch', async () => {
    const { service, prisma, messageSendQueue } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeCommentEvent({ text: 'price and vip please' }));

    const nestedThen = {
      id: 'nested-then-1',
      automationId: 'automation-1',
      type: ActionType.SEND_DM,
      order: 0,
      delaySeconds: 0,
      payload: { text: 'nested THEN fired' },
      parentActionId: 'nested-condition-1',
      branch: ActionBranch.THEN,
      condition: null,
      children: [],
    };
    const nestedElse = {
      id: 'nested-else-1',
      automationId: 'automation-1',
      type: ActionType.SEND_DM,
      order: 0,
      delaySeconds: 0,
      payload: { text: 'nested ELSE fired' },
      parentActionId: 'nested-condition-1',
      branch: ActionBranch.ELSE,
      condition: null,
      children: [],
    };
    const nestedCondition = {
      id: 'nested-condition-1',
      automationId: 'automation-1',
      type: ActionType.CONDITION,
      order: 0,
      delaySeconds: 0,
      payload: null,
      parentActionId: 'condition-action-1',
      branch: ActionBranch.THEN,
      condition: {
        id: 'nested-condition-cond-1',
        actionId: 'nested-condition-1',
        matchType: TriggerMatchType.CONTAINS,
        field: ConditionField.COMMENT_TEXT,
        keywords: ['vip'],
        caseSensitive: false,
        aiIntentLabel: null,
      },
      children: [nestedThen, nestedElse],
    };
    const outerElse = {
      id: 'else-action-1',
      automationId: 'automation-1',
      type: ActionType.SEND_DM,
      order: 0,
      delaySeconds: 0,
      payload: { text: 'ELSE branch fired' },
      parentActionId: 'condition-action-1',
      branch: ActionBranch.ELSE,
      condition: null,
      children: [],
    };
    const outerCondition = makeConditionAction({ children: [nestedCondition, outerElse] });

    prisma.automation.findMany.mockResolvedValue([makeAutomation({ actions: [outerCondition] })]);

    // Outer condition matches 'price' -> THEN branch, which contains the
    // nested condition (matches 'vip') -> its own THEN.
    await service.matchCommentEvent('comment-event-1');

    expect(messageSendQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ content: expect.objectContaining({ text: 'nested THEN fired' }) }),
      expect.any(Object),
    );
  });
});

describe('AutomationsService condition/branching — write-time validation', () => {
  function baseCreateInput(actions: any[]) {
    return {
      name: 'x',
      instagramAccountId: 'ig-account-1',
      triggers: [{ source: TriggerSource.COMMENT, matchType: TriggerMatchType.CONTAINS, keywords: ['x'] }],
      actions,
    } as any;
  }

  it('rejects a CONDITION action missing its condition/children', async () => {
    const { service } = makeService();

    await expect(
      service.create('workspace-1', baseCreateInput([{ type: ActionType.CONDITION }])),
    ).rejects.toThrow(AppException);
  });

  it('rejects an unparseable REGEX pattern inside a condition', async () => {
    const { service } = makeService();

    await expect(
      service.create(
        'workspace-1',
        baseCreateInput([
          {
            type: ActionType.CONDITION,
            condition: { matchType: TriggerMatchType.REGEX, keywords: ['('] },
            children: { then: [{ type: ActionType.SEND_DM, payload: { text: 'hi' } }], else: [] },
          },
        ]),
      ),
    ).rejects.toThrow(AppException);
  });

  it('rejects a condition tree nested deeper than MAX_ACTION_TREE_DEPTH (5)', async () => {
    const { service } = makeService();

    // Build 6 levels of nested CONDITION (depth 1 is the root list itself,
    // so 5 nested CONDITIONs beyond it is already at the limit — a 6th
    // pushes it over).
    let leaf: any = { type: ActionType.SEND_DM, payload: { text: 'hi' } };
    for (let i = 0; i < 6; i++) {
      leaf = {
        type: ActionType.CONDITION,
        condition: { matchType: TriggerMatchType.CONTAINS, keywords: ['x'] },
        children: { then: [leaf], else: [] },
      };
    }

    await expect(service.create('workspace-1', baseCreateInput([leaf]))).rejects.toThrow(AppException);
  });

  it('allows a condition tree exactly at MAX_ACTION_TREE_DEPTH (5)', async () => {
    const { service, prisma } = makeService();
    prisma.automation.create.mockResolvedValue(makeAutomation());
    prisma.automation.findUnique.mockResolvedValue(makeAutomation());

    let leaf: any = { type: ActionType.SEND_DM, payload: { text: 'hi' } };
    for (let i = 0; i < 4; i++) {
      leaf = {
        type: ActionType.CONDITION,
        condition: { matchType: TriggerMatchType.CONTAINS, keywords: ['x'] },
        children: { then: [leaf], else: [] },
      };
    }

    await expect(service.create('workspace-1', baseCreateInput([leaf]))).resolves.toBeDefined();
  });

  it('persists a CONDITION action tree as real Action rows, threading parentActionId/branch correctly', async () => {
    const { service, prisma } = makeService();
    prisma.automation.create.mockResolvedValue(makeAutomation());
    prisma.automation.findUnique.mockResolvedValue(makeAutomation());

    await service.create(
      'workspace-1',
      baseCreateInput([
        {
          type: ActionType.CONDITION,
          condition: { matchType: TriggerMatchType.CONTAINS, keywords: ['price'] },
          children: {
            then: [{ type: ActionType.SEND_DM, payload: { text: 'then' } }],
            else: [{ type: ActionType.SEND_DM, payload: { text: 'else' } }],
          },
        },
      ]),
    );

    expect(prisma.action.create).toHaveBeenCalledTimes(3); // condition + then + else
    const calls = prisma.action.create.mock.calls.map((c: any[]) => c[0].data);
    const conditionCall = calls.find((c: any) => c.type === ActionType.CONDITION);
    expect(conditionCall.parentActionId).toBeNull();
    expect(conditionCall.branch).toBeUndefined();
    expect(conditionCall.condition).toEqual({ create: expect.objectContaining({ keywords: ['price'] }) });

    const conditionActionId = 'action-created-1'; // first action.create call gets this id
    const thenCall = calls.find((c: any) => c.branch === ActionBranch.THEN);
    const elseCall = calls.find((c: any) => c.branch === ActionBranch.ELSE);
    expect(thenCall.parentActionId).toBe(conditionActionId);
    expect(elseCall.parentActionId).toBe(conditionActionId);
  });
});
