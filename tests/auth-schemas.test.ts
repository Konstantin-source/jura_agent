import { describe, expect, it } from "vitest";
import { setupSchema } from "@/lib/auth/schemas";
import { isSameOriginRequest } from "@/lib/security/origin";

const validUsers = [
  { displayName: "Erste Person", email: "eins@example.test", password: "langes-passwort-1" },
  { displayName: "Zweite Person", email: "zwei@example.test", password: "langes-passwort-2" },
] as const;

describe("account setup validation", () => {
  it("accepts exactly two distinct accounts", () => {
    expect(setupSchema.safeParse({ setupToken: "token", users: validUsers }).success).toBe(true);
    expect(setupSchema.safeParse({ setupToken: "token", users: [validUsers[0]] }).success).toBe(false);
  });

  it("rejects duplicate emails case-insensitively", () => {
    const duplicate = [validUsers[0], { ...validUsers[1], email: "EINS@example.test" }];
    expect(setupSchema.safeParse({ setupToken: "token", users: duplicate }).success).toBe(false);
  });
});

describe("same-origin protection", () => {
  it("accepts the public forwarded host and rejects foreign origins", () => {
    const valid = new Request("http://jura-agent:3000/api/auth/login", {
      headers: { origin: "https://jura.example.com", "x-forwarded-host": "jura.example.com" },
    });
    const foreign = new Request("https://jura.example.com/api/auth/login", {
      headers: { origin: "https://evil.example", host: "jura.example.com" },
    });
    expect(isSameOriginRequest(valid)).toBe(true);
    expect(isSameOriginRequest(foreign)).toBe(false);
  });
});
