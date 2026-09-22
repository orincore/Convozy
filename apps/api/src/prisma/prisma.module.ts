import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so every domain module can inject PrismaService without re-importing
 * this module everywhere. Modules still must not reach into another module's
 * models directly — see CLAUDE.md §3.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
