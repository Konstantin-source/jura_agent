import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("local password hashing", () => {
  it("uses a random salt and verifies only the correct password", async () => {
    const first = await hashPassword("Ein-langes-Testpasswort-1");
    const second = await hashPassword("Ein-langes-Testpasswort-1");
    expect(first).not.toBe(second);
    await expect(verifyPassword("Ein-langes-Testpasswort-1", first)).resolves.toBe(true);
    await expect(verifyPassword("Falsches-Passwort-2", first)).resolves.toBe(false);
  });

  it("rejects malformed or downgraded hashes", async () => {
    await expect(verifyPassword("beliebig", "plaintext")).resolves.toBe(false);
    await expect(verifyPassword("beliebig", "scrypt$1$8$1$c2FsdA$a2V5")).resolves.toBe(false);
  });
});
