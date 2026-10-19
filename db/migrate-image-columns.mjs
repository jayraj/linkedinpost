// Adds image columns to the live drafts table (idempotent).
// Usage: node db/migrate-image-columns.mjs
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const DATABASE_URL =
  envFile
    .split('\n')
    .find((l) => l.startsWith('DATABASE_URL='))
    ?.slice('DATABASE_URL='.length)
    .trim() ?? process.env.DATABASE_URL;

if (!DATABASE_URL) throw new Error('DATABASE_URL not found');

const sql = neon(DATABASE_URL);
for (const stmt of [
  'ALTER TABLE drafts ADD COLUMN IF NOT EXISTS image_data text',
  'ALTER TABLE drafts ADD COLUMN IF NOT EXISTS image_mime text',
  "ALTER TABLE drafts ADD COLUMN IF NOT EXISTS image_status text NOT NULL DEFAULT 'none'",
]) {
  await sql.query(stmt);
}
console.log('DDL ok');

const rows = await sql`SELECT id, week_of, status, image_status FROM drafts ORDER BY created_at DESC LIMIT 5`;
console.log(rows);
