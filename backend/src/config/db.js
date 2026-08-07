const { PrismaClient } = require('@prisma/client');

/**
 * Supabase's POOLED connection (port 6543) runs through PgBouncer in
 * "transaction" mode, which does not support Postgres prepared statements
 * shared across different underlying connections — but Prisma uses
 * prepared statements by default. Without `?pgbouncer=true` in the
 * connection string (which tells Prisma to stop doing that), you get
 * intermittent errors like `prepared statement "s1" already exists` under
 * any real concurrency, which is exactly what happens on Vercel where
 * multiple requests can hit different warm function instances sharing the
 * same pooled backend connections.
 *
 * Rather than relying on everyone remembering to add this to their
 * DATABASE_URL by hand, we detect a pooler-style URL and add it
 * automatically if it's missing.
 */
function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;
  const looksLikePooler = raw.includes('pooler.supabase.com') || raw.includes(':6543');
  if (!looksLikePooler || raw.includes('pgbouncer=true')) return raw;

  console.warn('[db] Detected a Supabase pooler connection string missing "pgbouncer=true" — adding it automatically to prevent prepared-statement conflicts.');
  const separator = raw.includes('?') ? '&' : '?';
  return `${raw}${separator}pgbouncer=true&connection_limit=1`;
}

const databaseUrl = resolveDatabaseUrl();

// Cached on `global` unconditionally (not just outside production): on
// Vercel, a "warm" function instance can handle several requests in a row
// within the same module scope, and creating a fresh PrismaClient per
// request against the same pooled connection is itself a source of the
// prepared-statement collisions above. Reusing one client per instance
// avoids that, and each cold start still gets its own clean instance since
// serverless functions don't share `global` across instances.
const prisma = global.__prisma || new PrismaClient({
  datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
});
global.__prisma = prisma;

module.exports = prisma;
