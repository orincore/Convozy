import { Module } from '@nestjs/common';
import { InstagramModule } from '../instagram/instagram.module';
import { MessagingService } from './messaging.service';
import { RateLimiterService } from './rate-limiter.service';
import { CircuitBreakerService } from './circuit-breaker.service';

@Module({
  imports: [InstagramModule],
  providers: [MessagingService, RateLimiterService, CircuitBreakerService],
  exports: [MessagingService],
})
export class MessagingModule {}
