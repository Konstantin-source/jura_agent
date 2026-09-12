import "server-only";

import { chmodSync, constants, mkdirSync, accessSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getServerEnvironment } from "@/lib/config/env";

const SCHEMA_VERSION = 2;
let database: DatabaseSync | null = null;

function runMigration(db: DatabaseSync, sql: string): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(sql);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function migrateDatabase(db: DatabaseSync): void {
  const versionRow = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (versionRow.user_version > SCHEMA_VERSION) {
    throw new Error(`Die lokale Datenbankversion ${versionRow.user_version} ist neuer als die App unterstützt.`);
  }
  if (versionRow.user_version < 1) {
    runMigration(db, `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS auth_rate_limits (
        key_hash TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        window_started_at INTEGER NOT NULL,
        blocked_until INTEGER NOT NULL DEFAULT 0
      ) STRICT;

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
        mode TEXT NOT NULL CHECK (mode IN ('explanation', 'socratic', 'correction')),
        subject TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content_json TEXT NOT NULL CHECK (json_valid(content_json)),
        citations_json TEXT NOT NULL CHECK (json_valid(citations_json)),
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),
        storage_path TEXT NOT NULL UNIQUE,
        page_count INTEGER CHECK (page_count IS NULL OR page_count BETWEEN 1 AND 150),
        extraction_status TEXT NOT NULL CHECK (extraction_status IN ('pending', 'completed', 'failed')),
        extracted_text TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS correction_reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
        document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
        central_score REAL NOT NULL CHECK (central_score BETWEEN 0 AND 18),
        min_score REAL NOT NULL CHECK (min_score BETWEEN 0 AND 18),
        max_score REAL NOT NULL CHECK (max_score BETWEEN 0 AND 18),
        confidence TEXT NOT NULL CHECK (confidence IN ('niedrig', 'mittel', 'hoch')),
        report_json TEXT NOT NULL CHECK (json_valid(report_json)),
        created_at TEXT NOT NULL,
        CHECK (min_score <= central_score AND central_score <= max_score)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS ai_runs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        mode TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
        output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
        cost_eur REAL NOT NULL DEFAULT 0 CHECK (cost_eur >= 0),
        duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
        response_id TEXT,
        source_count INTEGER NOT NULL DEFAULT 0 CHECK (source_count >= 0),
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS sessions_user_expiry_idx ON sessions(user_id, expires_at);
      CREATE INDEX IF NOT EXISTS conversations_user_updated_idx ON conversations(user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages(conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS documents_user_created_idx ON documents(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS ai_runs_created_idx ON ai_runs(created_at DESC);

      PRAGMA user_version = 1;
    `);
  }

  if (versionRow.user_version < 2) {
    runMigration(db, `
      ALTER TABLE documents ADD COLUMN document_type TEXT NOT NULL DEFAULT 'sonstiges'
        CHECK (document_type IN (
          'bearbeitung', 'sachverhalt', 'bearbeitervermerk', 'lösungsskizze',
          'bewertungsbogen', 'kombiniertes-klausurdokument', 'skript', 'notiz', 'sonstiges'
        ));
      ALTER TABLE documents ADD COLUMN legibility TEXT
        CHECK (legibility IS NULL OR legibility IN ('gut', 'teilweise', 'schlecht'));
      ALTER TABLE documents ADD COLUMN extraction_warnings_json TEXT NOT NULL DEFAULT '[]'
        CHECK (json_valid(extraction_warnings_json));
      PRAGMA user_version = 2;
    `);
  }
}
function initializeDatabase(): DatabaseSync {
  const dataDirectory = getDataDirectory();
  const uploadsDirectory = path.join(dataDirectory, "uploads");
  mkdirSync(uploadsDirectory, { recursive: true, mode: 0o700 });
  chmodSync(dataDirectory, 0o700);
  chmodSync(uploadsDirectory, 0o700);

  const databasePath = path.join(dataDirectory, "jura-agent.db");
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA trusted_schema = OFF");
  migrateDatabase(db);
  chmodSync(databasePath, 0o600);
  db.enableDefensive(true);
  return db;
}

export function getDatabase(): DatabaseSync {
  database ??= initializeDatabase();
  return database;
}

export function getDataDirectory(): string {
  return path.resolve(getServerEnvironment().DATA_DIR);
}

export function getUploadsDirectory(): string {
  return path.join(getDataDirectory(), "uploads");
}

export function resolveStoredFile(relativePath: string): string {
  const root = getUploadsDirectory();
  const resolved = path.resolve(root, relativePath);
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Ungültiger lokaler Speicherpfad.");
  }
  return resolved;
}

export function checkLocalStorage(): boolean {
  const db = getDatabase();
  const row = db.prepare("SELECT 1 AS ok").get() as { ok: number };
  accessSync(getDataDirectory(), constants.R_OK | constants.W_OK);
  accessSync(getUploadsDirectory(), constants.R_OK | constants.W_OK);
  return row.ok === 1;
}

export function withImmediateTransaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
