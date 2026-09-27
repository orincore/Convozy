/**
 * One-off CLI to create/update a platform AdminUser. Deliberately the only
 * way in — there is no self-service admin registration endpoint (2026-09-27
 * decision: admin access is fully separate from customer auth, see
 * modules/admin). Run from apps/api:
 *
 *   DATABASE_URL=... npx ts-node -r tsconfig-paths/register scripts/create-admin-user.ts \
 *     --email you@convozy.app --password 'a strong password' --name "Your Name" --role SUPERADMIN
 */
import { PrismaClient, AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 12;

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      out[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email;
  const password = args.password;
  const name = args.name;
  const role = (args.role as AdminRole) ?? AdminRole.SUPPORT;

  if (!email || !password) {
    console.error('Usage: --email <email> --password <password> [--name <name>] [--role SUPERADMIN|SUPPORT]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  if (!Object.values(AdminRole).includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: ${Object.values(AdminRole).join(', ')}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const admin = await prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash, name, role },
      create: { email, passwordHash, name, role },
    });
    console.log(`Admin user ready: ${admin.email} (${admin.role})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
