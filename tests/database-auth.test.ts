import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "@/lib/db/database";
import {
  clearRateLimit,
  countUsers,
  createInitialUsers,
  createSessionRecord,
  findUserByEmail,
  findUserForSession,
  getRateLimit,
  recordRateLimitFailure,
} from "@/lib/auth/repository";

describe("local database authentication", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrateDatabase(db);
  });

  afterEach(() => db.close());

  function createUsers() {
    createInitialUsers([
      { email: "Eins@Example.test", displayName: "Erste Person", passwordHash: "hash-1" },
      { email: "zwei@example.test", displayName: "Zweite Person", passwordHash: "hash-2" },
    ], db);
  }

  it("creates exactly two normalized accounts only once", () => {
    createUsers();
    expect(countUsers(db)).toBe(2);
    expect(findUserByEmail("EINS@example.test", db)?.email).toBe("eins@example.test");
    expect(() => createUsers()).toThrow("bereits abgeschlossen");
  });

  it("refuses duplicate identities", () => {
    expect(() => createInitialUsers([
      { email: "gleich@example.test", displayName: "A", passwordHash: "hash-a" },
      { email: "GLEICH@example.test", displayName: "B", passwordHash: "hash-b" },
    ], db)).toThrow("unterschiedliche Konten");
  });

  it("keeps at most ten active sessions and ignores expired sessions", () => {
    createUsers();
    const user = findUserByEmail("eins@example.test", db);
    expect(user).not.toBeNull();
    for (let index = 0; index < 11; index += 1) {
      createSessionRecord(`token-${index}`, user!.id, Date.now() + 60_000, db);
    }
    const row = db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?").get(user!.id) as { count: number };
    expect(Number(row.count)).toBe(10);
    expect(findUserForSession("token-10", db)?.id).toBe(user!.id);
    createSessionRecord("expired", user!.id, Date.now() - 1, db);
    expect(findUserForSession("expired", db)).toBeNull();
  });

  it("blocks repeated failures and can clear the counter", () => {
    for (let index = 0; index < 3; index += 1) {
      recordRateLimitFailure("test-key", { limit: 3, blockMs: 10_000 }, db);
    }
    expect(getRateLimit("test-key", db).blocked).toBe(true);
    clearRateLimit("test-key", db);
    expect(getRateLimit("test-key", db).blocked).toBe(false);
  });
});
