import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckAttempt, HealthIndicatorService } from '@nestjs/terminus';
import Redis from 'ioredis';
import { AppConfig } from '../../config/configuration';

@Injectable()
export class RedisHealthIndicator {
  private readonly client: Redis;

  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {
    const redisConfig = configService.get('redis', { infer: true });
    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  pingCheck(key: string): HealthCheckAttempt<string> {
    return this.healthIndicatorService.check(key).attempt(async () => {
      if (this.client.status !== 'ready' && this.client.status !== 'connecting') {
        await this.client.connect();
      }
      const pong = await this.client.ping();
      if (pong !== 'PONG') {
        throw new Error('Unexpected Redis PING response');
      }
    });
  }
}
