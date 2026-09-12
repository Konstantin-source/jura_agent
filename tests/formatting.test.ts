import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormattedText, parseFormattedBlocks, parseNumberedList } from "@/components/formatted-text";

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

  it("formats an inline exam checklist after an introductory sentence", () => {
    const text = "In der Klausur prüfst du typischerweise: 1. Besteht ein Schuldverhältnis? 2. Liegt eine Pflichtverletzung vor? 3. Hat der Schuldner sie zu vertreten? 4. Ist ein Schaden entstanden? Je nach Störung gelten weitere Voraussetzungen.";

    expect(parseFormattedBlocks(text)).toEqual([
      { type: "paragraph", text: "In der Klausur prüfst du typischerweise:" },
      {
        type: "numbered-list",
        items: [
          "Besteht ein Schuldverhältnis?",
          "Liegt eine Pflichtverletzung vor?",
          "Hat der Schuldner sie zu vertreten?",
          "Ist ein Schaden entstanden?",
        ],
      },
      { type: "paragraph", text: "Je nach Störung gelten weitere Voraussetzungen." },
    ]);

    const markup = renderToStaticMarkup(createElement(FormattedText, { text }));
    expect(markup).toContain("<p>In der Klausur prüfst du typischerweise:</p><ol");
    expect(markup.match(/<li>/g)).toHaveLength(4);
    expect(markup).toContain("</ol><p>Je nach Störung gelten weitere Voraussetzungen.</p>");
  });

  it("does not turn ordinary version-like prose into a list", () => {
    expect(parseFormattedBlocks("Das ist Version 1. Danach folgt Option 2. Ohne echte Aufzählung.")).toEqual([
      { type: "paragraph", text: "Das ist Version 1. Danach folgt Option 2. Ohne echte Aufzählung." },
    ]);
  });
});
