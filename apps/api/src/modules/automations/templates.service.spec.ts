// AutomationsService now pulls in ContactsService (merge tags) →
// segment-rule.dto.ts's @Type() decorators, which need Reflect.getMetadata
// at class-definition time — same fix as contacts.service.spec.ts.
import 'reflect-metadata';

// templates.service.ts imports AutomationsService (for reuse, per CLAUDE.md
// §3 rule 1), which transitively imports @nestjs/bullmq — ESM-only in this
// NestJS 12 line, which ts-jest's CommonJS transform can't load. Neither
// this spec nor automations.service.spec.ts goes through Nest's DI
// container (classes are constructed directly), so the decorators only
// need to be harmless stand-ins.
jest.mock('@nestjs/bullmq', () => ({ InjectQueue: () => () => {} }));
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
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

import { TemplatesService } from './templates.service';
import { AppException, ForbiddenAppException, NotFoundAppException } from '../../common/utils/app-exception';
import { SEED_TEMPLATES } from './templates.seed';
import { FEATURE_KEYS } from '../billing/entitlements.constants';

function makeService() {
  const prisma = {
    automationTemplate: {
      upsert: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
  } as any;

  const automationsService = {
    create: jest.fn().mockResolvedValue({ id: 'automation-1' }),
  } as any;

  const entitlementsService = {
    isEnabled: jest.fn().mockResolvedValue(true),
  } as any;

  const service = new TemplatesService(prisma, automationsService, entitlementsService);
  return { service, prisma, automationsService, entitlementsService };
}

describe('TemplatesService.onModuleInit', () => {
  it('upserts every seed template by slug, idempotently', async () => {
    const { service, prisma } = makeService();

    await service.onModuleInit();

    expect(prisma.automationTemplate.upsert).toHaveBeenCalledTimes(SEED_TEMPLATES.length);
    for (const template of SEED_TEMPLATES) {
      expect(prisma.automationTemplate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: template.slug },
          create: expect.objectContaining({ slug: template.slug, name: template.name }),
          update: expect.objectContaining({ name: template.name }),
        }),
      );
    }
  });

  it('seeds at least 5 distinct, real templates covering different sources', async () => {
    const sources = new Set(SEED_TEMPLATES.flatMap((t) => t.triggers.map((trig) => trig.source)));
    expect(SEED_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    // Not near-duplicates of each other — spans COMMENT, STORY_REPLY, LIVE_COMMENT.
    expect(sources.size).toBeGreaterThanOrEqual(3);
  });

  it('every "match anything" template (empty keywords) uses CONTAINS, which is the only match type that treats an empty keyword list as unconditional', () => {
    for (const template of SEED_TEMPLATES) {
      for (const trigger of template.triggers) {
        if (trigger.keywords.length === 0) {
          expect(trigger.matchType).toBe('CONTAINS');
        }
      }
    }
  });
});

describe('TemplatesService.list', () => {
  it('lists templates ordered by name', async () => {
    const { service, prisma } = makeService();

    await service.list();

    expect(prisma.automationTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } }),
    );
  });
});

describe('TemplatesService.install', () => {
  it('rejects when the AUTOMATION_TEMPLATES feature is disabled for the workspace', async () => {
    const { service, entitlementsService, prisma } = makeService();
    entitlementsService.isEnabled.mockResolvedValue(false);

    await expect(service.install('workspace-1', 'template-1', 'ig-account-1')).rejects.toThrow(
      ForbiddenAppException,
    );
    expect(entitlementsService.isEnabled).toHaveBeenCalledWith('workspace-1', FEATURE_KEYS.AUTOMATION_TEMPLATES);
    expect(prisma.automationTemplate.findUnique).not.toHaveBeenCalled();
  });

  it('404s when the template does not exist', async () => {
    const { service, prisma } = makeService();
    prisma.automationTemplate.findUnique.mockResolvedValue(null);

    await expect(service.install('workspace-1', 'missing', 'ig-account-1')).rejects.toThrow(NotFoundAppException);
  });

  it('maps the template into a CreateAutomationDto and delegates to AutomationsService.create', async () => {
    const { service, prisma, automationsService } = makeService();
    const template = SEED_TEMPLATES.find((t) => t.slug === 'pricing-dm')!;
    prisma.automationTemplate.findUnique.mockResolvedValue({
      id: 'template-1',
      slug: template.slug,
      name: template.name,
      description: template.description,
      triggers: template.triggers,
      actions: template.actions,
    });

    const result = await service.install('workspace-1', 'template-1', 'ig-account-1');

    expect(automationsService.create).toHaveBeenCalledWith('workspace-1', {
      name: template.name,
      instagramAccountId: 'ig-account-1',
      triggers: template.triggers,
      actions: template.actions,
    });
    expect(result).toEqual({ id: 'automation-1' });
  });

  it('propagates AutomationsService.create validation errors (e.g. ownership) unchanged', async () => {
    const { service, prisma, automationsService } = makeService();
    prisma.automationTemplate.findUnique.mockResolvedValue({
      id: 'template-1',
      slug: 'x',
      name: 'x',
      description: 'x',
      triggers: [],
      actions: [],
    });
    automationsService.create.mockRejectedValue(new AppException('INSTAGRAM_ACCOUNT_NOT_FOUND', 'nope'));

    await expect(service.install('workspace-1', 'template-1', 'ig-account-1')).rejects.toThrow(AppException);
  });
});
