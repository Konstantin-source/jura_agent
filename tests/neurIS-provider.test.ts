import { afterEach, describe, expect, it, vi } from "vitest";
import { checkNeurisConnection, NeurisProvider } from "@/lib/legal/neuris-provider";

afterEach(() => vi.restoreAllMocks());

describe("NeurisProvider", () => {
  it("maps the public API response to internal source records", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            member: [
              {
                item: {
                  name: "Beispielgesetz",
                  documentNumber: "BJNR1",
                  "@id": "/v1/legislation/eli/bund/bgbl-1/2020/s1",
                  workExample: { "@id": "/v1/legislation/eli/bund/bgbl-1/2020/s1/2026-01-01/1/deu" },
                },
                textMatches: [{ text: "§ 1 Beispieltext" }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const provider = new NeurisProvider();
    const [result] = await provider.searchLegislation("Beispiel", { limit: 1 });
    expect(result.provider).toBe("NeuRIS");
    expect(result.url).toContain("/norms/eli/bund/");
    expect(result.excerpt).toContain("§ 1");
    expect(result.verifiedAt).not.toBeNull();
  });

  it("reports reachability only after validating the live response shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ member: [] }), { status: 200, headers: { "Content-Type": "application/json" } }),
      ),
    );
    await expect(checkNeurisConnection("https://testphase.rechtsinformationen.bund.de/v1", { force: true }))
      .resolves.toMatchObject({ reachable: true, message: "Live-Abruf erfolgreich" });
  });

  it("does not mistake a configured URL for a working integration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Fehler", { status: 503 })));
    await expect(checkNeurisConnection("https://example.test/v1", { force: true }))
      .resolves.toMatchObject({ reachable: false, message: "HTTP 503" });
  });
});
