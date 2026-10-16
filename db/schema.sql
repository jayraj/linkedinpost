-- Agile Post of the Week — Neon Postgres schema
-- Run this in the Neon SQL editor (or `psql "$DATABASE_URL" -f db/schema.sql`)

CREATE TABLE IF NOT EXISTS drafts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_of       date NOT NULL,                       -- Monday of the scheduled week
  topics        jsonb NOT NULL,                      -- [{title, why, source, sourceUrl}] x3
  chosen_topic  text NOT NULL,
  content       text NOT NULL,                       -- the LinkedIn post body
  status        text NOT NULL DEFAULT 'pending',     -- pending | approved | posted | expired | failed
  token_expires timestamptz NOT NULL,                -- approval-link validity (7 days)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_log (
  id         bigserial PRIMARY KEY,
  draft_id   uuid REFERENCES drafts(id) ON DELETE SET NULL,
  action     text NOT NULL,        -- emailed | approved | feedback | posted | expired | failed | token_warning | dry_run
  detail     jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_log_action_created_idx ON post_log (action, created_at DESC);

-- Single-row store for rotated LinkedIn tokens (survives serverless invocations)
CREATE TABLE IF NOT EXISTS linkedin_tokens (
  id            int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token  text NOT NULL,
  refresh_token text,
  expires_at    timestamptz NOT NULL,
  person_urn    text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
