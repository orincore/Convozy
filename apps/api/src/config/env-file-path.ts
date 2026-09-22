import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `.env` lives at the monorepo root (one place for api + worker + web to
 * share), but pnpm runs this package's scripts with cwd = apps/api, and
 * Nest's ConfigModule defaults to looking for `.env` in cwd. Try, in order:
 * a repo-root `.env` two levels up from cwd (the pnpm-workspace layout),
 * then cwd itself (covers Docker, where WORKDIR is the package dir and env
 * vars are usually injected directly via docker-compose rather than a
 * file anyway — ConfigModule falls back to process.env either way).
 */
export function resolveEnvFilePath(): string[] {
  const candidates = [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')];
  return candidates.filter((path) => existsSync(path));
}
