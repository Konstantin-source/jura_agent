import { Fragment, type ReactNode } from "react";

export type FormattedBlock =
  | { type: "paragraph"; text: string }
  | { type: "numbered-list"; items: string[] };

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g).filter(Boolean).map((part, index) => {
    if (part === "\n") return <br key={`break-${index}`} />;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`strong-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`code-${index}`}>{part.slice(1, -1)}</code>;
    }
    return <Fragment key={`text-${index}`}>{part}</Fragment>;
  });
}

function parseNumberedSection(text: string) {
  const markers = Array.from(text.matchAll(/(^|\s)(\d+)\.\s+/g)).map((match) => ({
    number: Number(match[2]),
    start: (match.index ?? 0) + match[1].length,
    contentStart: (match.index ?? 0) + match[0].length,
  }));
  if (markers.length < 2 || markers[0].number !== 1) return null;
  if (markers.some((marker, index) => marker.number !== index + 1)) return null;

  const prefix = text.slice(0, markers[0].start).trim();
  if (prefix && !prefix.endsWith(":")) return null;

  const items = markers.map((marker, index) => {
    const end = markers[index + 1]?.start ?? text.length;
    return text.slice(marker.contentStart, end).trim();
  }).filter(Boolean);

  let suffix = "";
  const earlierItemsAreQuestions = items.slice(0, -1).every((item) => item.replace(/\*\*$/, "").trimEnd().endsWith("?"));
  const finalItem = items.at(-1);
  if (earlierItemsAreQuestions && finalItem) {
    const questionEnd = finalItem.indexOf("?");
    const possibleSuffix = finalItem.slice(questionEnd + 1).trim();
    if (questionEnd >= 0 && /^[A-ZÄÖÜ]/.test(possibleSuffix)) {
      items[items.length - 1] = finalItem.slice(0, questionEnd + 1).trim();
      suffix = possibleSuffix;
    }
  }

  return { prefix, items, suffix };
}

export function parseNumberedList(text: string): string[] | null {
  return parseNumberedSection(text)?.items ?? null;
}

export function parseFormattedBlocks(text: string): FormattedBlock[] {
  return text.trim().split(/\n{2,}/).filter(Boolean).flatMap<FormattedBlock>((paragraph) => {
    const section = parseNumberedSection(paragraph.trim());
    if (!section) return [{ type: "paragraph", text: paragraph }];

    return [
      ...(section.prefix ? [{ type: "paragraph" as const, text: section.prefix }] : []),
      { type: "numbered-list" as const, items: section.items },
      ...(section.suffix ? [{ type: "paragraph" as const, text: section.suffix }] : []),
    ];
  });
}

export function InlineFormattedText({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}

export function FormattedText({ text }: { text: string }) {
  const blocks = parseFormattedBlocks(text);
  return <>{blocks.map((block, index) => block.type === "numbered-list" ? (
    <ol className="formatted-numbered-list" key={`list-${index}`}>
      {block.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}><InlineFormattedText text={item} /></li>)}
    </ol>
  ) : (
    <p key={`paragraph-${index}`}><InlineFormattedText text={block.text} /></p>
  ))}</>;
}
