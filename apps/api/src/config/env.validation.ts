import { z } from 'zod';

/**
 * dotenv gives an unset-but-present `KEY=` line as `""`, not `undefined` —
 * so a plain `.optional()` field would reject a blank line as an invalid
 * value instead of treating it as "not configured." Wrap optional fields
 * with this so blank env vars behave as absent.
 */
function optional<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

/**
 * Every environment variable the app depends on, validated once at boot.
 * CLAUDE.md §3: "the app must fail fast on missing/invalid env vars instead of
 * failing at first use." Add new vars here, not just in .env.example.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: optional(z.string()),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // Encryption for Instagram access tokens at rest (CLAUDE.md §5)
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64, 'TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)'),

  // Meta app - used for webhook signature verification (see webhooks module).
  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  META_GRAPH_API_VERSION: z.string().default('v21.0'),
  META_OAUTH_REDIRECT_URI: z.string().url(),
  // Business Login for Instagram has its OWN App ID/Secret, distinct from
  // META_APP_ID above - found at App Dashboard > Instagram > "API setup
  // with Instagram login" > 3. Set up Instagram business login > Business
  // login settings. Confirmed via Meta's current docs (see
  // instagram.service.ts and TRACKER.md "Meta App audit").
  META_INSTAGRAM_APP_ID: optional(z.string()),
  META_INSTAGRAM_APP_SECRET: optional(z.string()),

  // Google OAuth (account login/signup — see auth module)
  GOOGLE_CLIENT_ID: optional(z.string()),
  GOOGLE_CLIENT_SECRET: optional(z.string()),
  GOOGLE_OAUTH_REDIRECT_URI: optional(z.string().url()),
  // Where the frontend's OAuth-callback page lives; the API redirects here
  // with a short-lived exchange code after a successful OAuth login.
  FRONTEND_OAUTH_CALLBACK_URL: optional(z.string().url()),

  // Stripe
  STRIPE_SECRET_KEY: optional(z.string()),
  STRIPE_WEBHOOK_SECRET: optional(z.string()),

  // Razorpay
  RAZORPAY_KEY_ID: optional(z.string()),
  RAZORPAY_KEY_SECRET: optional(z.string()),
  RAZORPAY_WEBHOOK_SECRET: optional(z.string()),

  // AI provider (provider-agnostic — see ai module)
  AI_PROVIDER_API_KEY: optional(z.string()),
  AI_PROVIDER_BASE_URL: optional(z.string().url()),

  // Worker tuning (ARCHITECTURE.md §5)
  QUEUE_CONCURRENCY_WEBHOOK: z.coerce.number().default(20),
  QUEUE_CONCURRENCY_MESSAGE_SEND: z.coerce.number().default(10),
  QUEUE_CONCURRENCY_AI: z.coerce.number().default(5),

  APP_BASE_URL: z.string().url(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
