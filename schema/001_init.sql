-- migration-demo baseline schema (payments database)
-- Three customers, no email column yet — the migration adds it.

CREATE TABLE IF NOT EXISTS customers (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS migration_log (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO customers (name) VALUES ('Acme Corp'), ('Globex'), ('Initech')
  ON CONFLICT DO NOTHING;
