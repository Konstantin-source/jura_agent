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
    expect(result.url).toBe("https://testphase.rechtsinformationen.bund.de/norms/eli/bund/bgbl-1/2020/s1/2026-01-01/1/deu");
    expect(result.url).not.toContain("regelungstext-1.html");
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

  it("maps case-law API IDs to the public reader", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          member: [{ item: { headline: "Beispielbeschluss", "@id": "/v1/case-law/ecli/de/bverwg/2026/010126" } }],
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      ),
    );
    const provider = new NeurisProvider();
    const [result] = await provider.searchCaseLaw("Beispiel", { limit: 1 });
    expect(result.url).toBe("https://testphase.rechtsinformationen.bund.de/case-law/ecli/de/bverwg/2026/010126");
  });

  it("extracts useful text from a concrete NeuRIS document detail response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          name: "Bürgerliches Gesetzbuch",
          hasPart: [{ heading: "§ 280 Schadensersatz wegen Pflichtverletzung", text: "Verletzt der Schuldner eine Pflicht aus dem Schuldverhältnis ..." }],
          "@id": "/v1/legislation/eli/bund/bgbl-1/1896/s195/2026-01-01/1/deu",
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      ),
    );
    const provider = new NeurisProvider();
    const result = await provider.getDocument("/v1/legislation/eli/bund/bgbl-1/1896/s195/2026-01-01/1/deu");
    expect(result?.excerpt).toContain("§ 280 Schadensersatz wegen Pflichtverletzung");
    expect(result?.excerpt).toContain("Verletzt der Schuldner eine Pflicht");
  });

  it("does not mistake a configured URL for a working integration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Fehler", { status: 503 })));
    await expect(checkNeurisConnection("https://example.test/v1", { force: true }))
      .resolves.toMatchObject({ reachable: false, message: "HTTP 503" });
  });
});
