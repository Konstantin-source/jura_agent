import { describe, expect, it } from "vitest";
import { parseSkillMarkdown, resolveSkills } from "@/lib/skills/resolver";

const base = parseSkillMarkdown(`---
id: base
title: Basis
subjects: [all]
modes: [all]
priority: 10
---
Immer aktiv.`);

const civil = parseSkillMarkdown(`---
id: civil
title: Schuldrecht
subjects: [Schuldrecht]
modes: [explanation]
priority: 20
---
Nur für Erklärungen im Schuldrecht.`);

describe("skill resolver", () => {
  it("parses frontmatter and resolves deterministically", () => {
    expect(resolveSkills("explanation", "Schuldrecht II", [base, civil]).map((skill) => skill.id)).toEqual([
      "base",
      "civil",
    ]);
    expect(resolveSkills("socratic", "Schuldrecht II", [base, civil]).map((skill) => skill.id)).toEqual(["base"]);
  });
});
