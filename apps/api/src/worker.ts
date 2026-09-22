import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

/**
 * Worker process entrypoint — no HTTP server, just BullMQ processors.
 * Run multiple replicas of this process to scale send throughput
 * horizontally (ARCHITECTURE.md §5). Started via `pnpm start:worker` /
 * the `worker` service in docker-compose.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down worker gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.log('Worker process started');
}

bootstrap();
