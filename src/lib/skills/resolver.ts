import "server-only";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { LearningMode } from "@/lib/ai/schemas";

export interface ResolvedSkill {
  id: string;
  title: string;
  subjects: string[];
  modes: string[];
  priority: number;
  body: string;
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

export function parseSkillMarkdown(markdown: string): ResolvedSkill {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Skill-Datei benötigt YAML-Frontmatter.");
  const metadata = Object.fromEntries(
    match[1]
      .split("\n")
      .map((line) => line.match(/^([a-zA-Z]+):\s*(.*)$/))
      .filter((entry): entry is RegExpMatchArray => Boolean(entry))
      .map((entry) => [entry[1], entry[2]]),
  );
  if (!metadata.id || !metadata.title) throw new Error("Skill-Datei benötigt id und title.");
  return {
    id: metadata.id,
    title: metadata.title,
    subjects: parseList(metadata.subjects),
    modes: parseList(metadata.modes),
    priority: Number(metadata.priority ?? 50),
    body: match[2].trim(),
  };
}

export function loadSkillCatalog(skillDirectory = join(process.cwd(), "skills")): ResolvedSkill[] {
  return readdirSync(skillDirectory)
    .filter((file) => file.endsWith(".md"))
    .map((file) => parseSkillMarkdown(readFileSync(join(skillDirectory, file), "utf8")))
    .sort((a, b) => a.priority - b.priority);
}

export function resolveSkills(
  mode: LearningMode,
  subject: string,
  catalog = loadSkillCatalog(),
): ResolvedSkill[] {
  const normalizedSubject = subject.toLowerCase();
  return catalog.filter((skill) => {
    const modeMatch = skill.modes.includes("all") || skill.modes.includes(mode);
    const subjectMatch =
      skill.subjects.includes("all") ||
      skill.subjects.some((candidate) => normalizedSubject.includes(candidate.toLowerCase()));
    return modeMatch && subjectMatch;
  });
}

export function renderSkillsForPrompt(skills: ResolvedSkill[]): string {
  return skills.map((skill) => `## ${skill.title}\n${skill.body}`).join("\n\n");
}
