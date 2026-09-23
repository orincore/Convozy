import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AutomationTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenAppException, NotFoundAppException } from '../../common/utils/app-exception';
import { EntitlementsService } from '../billing/entitlements.service';
import { FEATURE_KEYS } from '../billing/entitlements.constants';
import { AutomationsService, AutomationWithRelations } from './automations.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { SEED_TEMPLATES } from './templates.seed';

/**
 * Global, curated starter automations (MANYCHAT_FEATURE_AUDIT.md §13 —
 * "Ready-to-Go flow templates"), install() just deserializes a template's
 * triggers/actions into a real CreateAutomationDto and hands off to
 * AutomationsService.create — reuses all of its validation/entitlement
 * logic rather than duplicating any of it (CLAUDE.md §3 rule 1).
 */
@Injectable()
export class TemplatesService implements OnModuleInit {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly automationsService: AutomationsService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  /** Idempotent — upsert by slug on every boot, same pattern as EntitlementsService.bootstrapFreePlan. */
  async onModuleInit(): Promise<void> {
    for (const template of SEED_TEMPLATES) {
      await this.prisma.automationTemplate.upsert({
        where: { slug: template.slug },
        create: {
          slug: template.slug,
          name: template.name,
          description: template.description,
          triggers: template.triggers,
          actions: template.actions,
        },
        update: {
          name: template.name,
          description: template.description,
          triggers: template.triggers,
          actions: template.actions,
        },
      });
    }
    this.logger.log(`Automation templates seeded/refreshed (${SEED_TEMPLATES.length})`);
  }

  list(): Promise<AutomationTemplate[]> {
    return this.prisma.automationTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  async install(workspaceId: string, templateId: string, instagramAccountId: string): Promise<AutomationWithRelations> {
    const enabled = await this.entitlementsService.isEnabled(workspaceId, FEATURE_KEYS.AUTOMATION_TEMPLATES);
    if (!enabled) {
      throw new ForbiddenAppException(
        'FEATURE_NOT_AVAILABLE',
        'Automation templates are not available on your current plan.',
      );
    }

    const template = await this.prisma.automationTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundAppException('TEMPLATE_NOT_FOUND', 'Automation template not found.');
    }

    const dto: CreateAutomationDto = {
      name: template.name,
      instagramAccountId,
      triggers: template.triggers as unknown as CreateAutomationDto['triggers'],
      actions: template.actions as unknown as CreateAutomationDto['actions'],
    };
    // AutomationsService.create does the real work: workspace ownership
    // check on instagramAccountId, trigger/action validation (regex
    // parseability, depth bound), and the LIVE_COMMENT entitlement check
    // for the live-comment-welcome template — none of that is duplicated
    // here.
    return this.automationsService.create(workspaceId, dto);
  }
}
