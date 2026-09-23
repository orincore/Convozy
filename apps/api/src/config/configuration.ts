import { EnvConfig } from './env.validation';

/**
 * Typed, structured view over the validated env (env.validation.ts).
 * Inject via `ConfigService<AppConfig>` rather than reading `process.env`
 * directly anywhere else in the app.
 */
export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  appBaseUrl: string;
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    secret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  security: {
    tokenEncryptionKey: string;
  };
  meta: {
    appId: string;
    appSecret: string;
    webhookVerifyToken: string;
    graphApiVersion: string;
    oauthRedirectUri: string;
    instagramAppId?: string;
    instagramAppSecret?: string;
  };
  google: {
    clientId?: string;
    clientSecret?: string;
    oauthRedirectUri?: string;
  };
  frontendOAuthCallbackUrl: string;
  stripe: {
    secretKey?: string;
    webhookSecret?: string;
  };
  razorpay: {
    keyId?: string;
    keySecret?: string;
    webhookSecret?: string;
  };
  ai: {
    apiKey?: string;
    baseUrl?: string;
  };
  r2: {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketName?: string;
    publicUrlBase?: string;
  };
  queues: {
    webhookConcurrency: number;
    messageSendConcurrency: number;
    aiConcurrency: number;
  };
}

export default function configuration(): AppConfig {
  const env = process.env as unknown as EnvConfig;

  return {
    env: env.NODE_ENV,
    port: env.PORT,
    appBaseUrl: env.APP_BASE_URL,
    database: {
      url: env.DATABASE_URL,
    },
    redis: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
    },
    jwt: {
      secret: env.JWT_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    security: {
      tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY,
    },
    meta: {
      appId: env.META_APP_ID,
      appSecret: env.META_APP_SECRET,
      webhookVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN,
      graphApiVersion: env.META_GRAPH_API_VERSION,
      oauthRedirectUri: env.META_OAUTH_REDIRECT_URI,
      instagramAppId: env.META_INSTAGRAM_APP_ID,
      instagramAppSecret: env.META_INSTAGRAM_APP_SECRET,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      oauthRedirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
    },
    frontendOAuthCallbackUrl: env.FRONTEND_OAUTH_CALLBACK_URL ?? `${env.APP_BASE_URL}/auth/callback`,
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    },
    razorpay: {
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    },
    ai: {
      apiKey: env.AI_PROVIDER_API_KEY,
      baseUrl: env.AI_PROVIDER_BASE_URL,
    },
    r2: {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucketName: env.R2_BUCKET_NAME,
      publicUrlBase: env.R2_PUBLIC_URL_BASE,
    },
    queues: {
      webhookConcurrency: env.QUEUE_CONCURRENCY_WEBHOOK,
      messageSendConcurrency: env.QUEUE_CONCURRENCY_MESSAGE_SEND,
      aiConcurrency: env.QUEUE_CONCURRENCY_AI,
    },
  };
}
