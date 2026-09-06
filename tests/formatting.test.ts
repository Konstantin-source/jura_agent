import { describe, expect, it } from "vitest";
import { parseNumberedList } from "@/components/formatted-text";

describe("answer formatting", () => {
  it("recognizes numbered model output even without line breaks", () => {
    expect(parseNumberedList("1. **Anwendungsbereich:** Verwaltungsakt. 2. **Rechtsfolge:** Ermessen.")).toEqual([
      "**Anwendungsbereich:** Verwaltungsakt.",
      "**Rechtsfolge:** Ermessen.",
    ]);
  });

  it("does not split ordinary prose at isolated numbers", () => {
    expect(parseNumberedList("Nach § 48 Abs. 1. Danach folgt die Rechtsfolge.")).toBeNull();
  });
});
