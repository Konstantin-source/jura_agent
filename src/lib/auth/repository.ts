import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDatabase, withImmediateTransaction } from "@/lib/db/database";

export interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

export interface NewLocalUser {
  email: string;
  displayName: string;
  passwordHash: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
}

function mapUser(row: UserRow | undefined): StoredUser | null {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
  };
}

export function countUsers(db: DatabaseSync = getDatabase()): number {
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  return Number(row.count);
}

export function hasExactlyTwoUsers(db: DatabaseSync = getDatabase()): boolean {
  return countUsers(db) === 2;
}

export function createInitialUsers(users: NewLocalUser[], db: DatabaseSync = getDatabase()): void {
  if (
    users.length !== 2 ||
    users[0].email.trim().toLowerCase() === users[1].email.trim().toLowerCase()
  ) {
    throw new Error("Es müssen genau zwei unterschiedliche Konten angelegt werden.");
  }

  withImmediateTransaction(db, () => {
    if (countUsers(db) !== 0) throw new Error("Die Ersteinrichtung wurde bereits abgeschlossen.");
    const insert = db.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const user of users) {
      insert.run(
        randomUUID(),
        user.email.trim().toLowerCase(),
        user.displayName.trim(),
        user.passwordHash,
        now,
        now,
      );
    }
  });
}

export function findUserByEmail(email: string, db: DatabaseSync = getDatabase()): StoredUser | null {
  const row = db
    .prepare("SELECT id, email, display_name, password_hash FROM users WHERE email = ? COLLATE NOCASE")
    .get(email.trim().toLowerCase()) as UserRow | undefined;
  return mapUser(row);
}

export function findUserById(id: string, db: DatabaseSync = getDatabase()): StoredUser | null {
  const row = db
    .prepare("SELECT id, email, display_name, password_hash FROM users WHERE id = ?")
    .get(id) as UserRow | undefined;
  return mapUser(row);
}

export function createSessionRecord(
  tokenHash: string,
  userId: string,
  expiresAt: number,
  db: DatabaseSync = getDatabase(),
): void {
  const now = Date.now();
  withImmediateTransaction(db, () => {
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
    db.prepare(`
      DELETE FROM sessions
      WHERE token_hash IN (
        SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 9
      )
    `).run(userId);
    db.prepare(`
      INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(tokenHash, userId, expiresAt, now, now);
  });
}

export function findUserForSession(
  tokenHash: string,
  db: DatabaseSync = getDatabase(),
): StoredUser | null {
  const now = Date.now();
  const row = db.prepare(`
    SELECT u.id, u.email, u.display_name, u.password_hash
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash, now) as UserRow | undefined;
  if (!row) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ? OR expires_at <= ?").run(tokenHash, now);
    return null;
  }
  db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ? AND last_seen_at < ?")
    .run(now, tokenHash, now - 5 * 60 * 1000);
  return mapUser(row);
}

export function deleteSessionRecord(tokenHash: string, db: DatabaseSync = getDatabase()): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function rateLimitKey(scope: string, clientKey: string): string {
  return createHash("sha256").update(`${scope}:${clientKey}`).digest("hex");
}

export function getRateLimit(
  keyHash: string,
  db: DatabaseSync = getDatabase(),
): { blocked: boolean; retryAfterSeconds: number } {
  const row = db
    .prepare("SELECT blocked_until FROM auth_rate_limits WHERE key_hash = ?")
    .get(keyHash) as { blocked_until: number } | undefined;
  const remaining = Math.max(0, Number(row?.blocked_until ?? 0) - Date.now());
  return { blocked: remaining > 0, retryAfterSeconds: Math.ceil(remaining / 1000) };
}

export function recordRateLimitFailure(
  keyHash: string,
  options: { limit?: number; windowMs?: number; blockMs?: number } = {},
  db: DatabaseSync = getDatabase(),
): void {
  const limit = options.limit ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const blockMs = options.blockMs ?? 15 * 60 * 1000;
  const now = Date.now();
  const row = db
    .prepare("SELECT attempts, window_started_at FROM auth_rate_limits WHERE key_hash = ?")
    .get(keyHash) as { attempts: number; window_started_at: number } | undefined;
  const withinWindow = row && now - row.window_started_at < windowMs;
  const attempts = withinWindow ? row.attempts + 1 : 1;
  const windowStartedAt = withinWindow ? row.window_started_at : now;
  const blockedUntil = attempts >= limit ? now + blockMs : 0;
  db.prepare(`
    INSERT INTO auth_rate_limits (key_hash, attempts, window_started_at, blocked_until)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key_hash) DO UPDATE SET
      attempts = excluded.attempts,
      window_started_at = excluded.window_started_at,
      blocked_until = excluded.blocked_until
  `).run(keyHash, attempts, windowStartedAt, blockedUntil);
}

export function clearRateLimit(keyHash: string, db: DatabaseSync = getDatabase()): void {
  db.prepare("DELETE FROM auth_rate_limits WHERE key_hash = ?").run(keyHash);
}
