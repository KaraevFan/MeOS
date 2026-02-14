-- Track markdown migration status per user
ALTER TABLE users ADD COLUMN markdown_migration_status TEXT
  CHECK (markdown_migration_status IN ('pending', 'migrated', 'failed', 'deferred'))
  DEFAULT 'pending';

ALTER TABLE users ADD COLUMN markdown_migrated_at TIMESTAMPTZ;
