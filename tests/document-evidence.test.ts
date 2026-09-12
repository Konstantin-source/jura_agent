import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "@/lib/db/database";
import { getOwnedAttachmentReferences } from "@/lib/data/persistence";

describe("server-owned correction evidence", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrateDatabase(db);
    const insertUser = db.prepare("INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    insertUser.run("user-1", "eins@example.test", "Eins", "hash", "2026-09-12", "2026-09-12");
    insertUser.run("user-2", "zwei@example.test", "Zwei", "hash", "2026-09-12", "2026-09-12");
    db.prepare(`
      INSERT INTO documents (
        id, user_id, filename, mime_type, size_bytes, storage_path, page_count,
        extraction_status, extracted_text, document_type, legibility,
        extraction_warnings_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)
    `).run(
      "document-1", "user-1", "bearbeitung.pdf", "application/pdf", 100, "user-1/document-1.pdf", 4,
      "Originaler serverseitiger Text mit § 280 Abs. 1 BGB.", "bearbeitung", "teilweise",
      JSON.stringify(["Seite 2 teilweise unleserlich"]), "2026-09-12", "2026-09-12",
    );
  });

  afterEach(() => db.close());

  it("ignores browser-supplied document text but accepts an explicit role correction", () => {
    const [document] = getOwnedAttachmentReferences("user-1", [{
      id: "document-1",
      name: "manipuliert.pdf",
      mimeType: "text/plain",
      extractedText: "Vom Browser eingeschleuster Text",
      documentType: "sachverhalt",
    }], db);

    expect(document.name).toBe("bearbeitung.pdf");
    expect(document.extractedText).toContain("serverseitiger Text");
    expect(document.extractedText).not.toContain("eingeschleuster Text");
    expect(document.documentType).toBe("sachverhalt");
    expect(document.legibility).toBe("teilweise");
    expect(document.warnings).toEqual(["Seite 2 teilweise unleserlich"]);
  });

  it("does not expose another account's document", () => {
    expect(() => getOwnedAttachmentReferences("user-2", [{
      id: "document-1",
      name: "bearbeitung.pdf",
      mimeType: "application/pdf",
      extractedText: "",
    }], db)).toThrow("gehört nicht zu diesem Konto");
  });

  it("migrates the database to the document-metadata schema", () => {
    const version = db.prepare("PRAGMA user_version").get() as { user_version: number };
    const columns = db.prepare("PRAGMA table_info(documents)").all() as Array<{ name: string }>;
    expect(version.user_version).toBe(2);
    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "document_type", "legibility", "extraction_warnings_json",
    ]));
  });

  it("upgrades an existing version-1 document table without deleting rows", () => {
    const legacy = new DatabaseSync(":memory:");
    try {
      legacy.exec(`
        CREATE TABLE documents (id TEXT PRIMARY KEY, extracted_text TEXT NOT NULL) STRICT;
        INSERT INTO documents (id, extracted_text) VALUES ('legacy-document', 'Bestehender Text');
        PRAGMA user_version = 1;
      `);
      migrateDatabase(legacy);
      const row = legacy.prepare("SELECT id, extracted_text, document_type, extraction_warnings_json FROM documents").get() as {
        id: string;
        extracted_text: string;
        document_type: string;
        extraction_warnings_json: string;
      };
      expect(row).toEqual({
        id: "legacy-document",
        extracted_text: "Bestehender Text",
        document_type: "sonstiges",
        extraction_warnings_json: "[]",
      });
      expect((legacy.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(2);
    } finally {
      legacy.close();
    }
  });
});
