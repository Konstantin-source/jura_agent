import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "@/lib/db/database";
import { getConversationContext } from "@/lib/data/persistence";

const answer = {
  mode: "explanation",
  title: "Rücknahme",
  shortExplanation: "§ 48 VwVfG betrifft rechtswidrige Verwaltungsakte.",
  preciseExplanation: "Vertrauensschutz und Ermessen sind gesondert zu prüfen.",
  example: "",
  examRelevance: "",
  typicalErrors: [],
  connections: [],
  citations: [],
  sourceStatus: "Nicht aktuell verifiziert",
  uncertainties: [],
  nextActions: [],
};

describe("conversation context", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrateDatabase(db);
    db.prepare("INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("user-1", "eins@example.test", "Eins", "hash", "2026-09-06", "2026-09-06");
    db.prepare("INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("user-2", "zwei@example.test", "Zwei", "hash", "2026-09-06", "2026-09-06");
    db.prepare("INSERT INTO conversations (id, user_id, title, mode, subject, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("conversation-1", "user-1", "§ 48 VwVfG", "explanation", "Verwaltungsrecht", "2026-09-06", "2026-09-06");
  });

  afterEach(() => db.close());

  it("returns prior user and assistant messages in stable order", () => {
    const insert = db.prepare("INSERT INTO messages (id, user_id, conversation_id, role, content_json, citations_json, created_at) VALUES (?, ?, ?, ?, ?, '[]', ?)");
    insert.run("message-1", "user-1", "conversation-1", "user", JSON.stringify({ text: "Was regelt § 48 VwVfG?" }), "2026-09-06T12:00:00Z");
    insert.run("message-2", "user-1", "conversation-1", "assistant", JSON.stringify({ answer }), "2026-09-06T12:00:00Z");

    const history = getConversationContext("user-1", "conversation-1", db);
    expect(history.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(history[0].content).toContain("§ 48 VwVfG");
    expect(history[1].content).toContain("Vertrauensschutz");
  });

  it("does not expose another account's chat", () => {
    expect(() => getConversationContext("user-2", "conversation-1", db)).toThrow("gehört nicht zu diesem Konto");
  });
});
