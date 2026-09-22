import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { json, Request } from 'express';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService<AppConfig, true>);

  app.use(helmet());

  // Capture the raw request body so WebhooksService can verify Meta's
  // X-Hub-Signature-256 against the exact bytes received (CLAUDE.md §5).
  app.use(
    json({
      verify: (req: RawBodyRequest, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.enableCors({ origin: configService.get('appBaseUrl', { infer: true }), credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = configService.get('port', { infer: true });
  await app.listen(port);
  logger.log(`API listening on port ${port} (${configService.get('env', { infer: true })})`);
}

bootstrap();
