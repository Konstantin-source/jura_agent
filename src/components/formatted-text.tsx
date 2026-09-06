import { Fragment, type ReactNode } from "react";

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

export function parseNumberedList(text: string): string[] | null {
  const markers = Array.from(text.matchAll(/(^|\s)(\d+)\.\s+/g)).map((match) => ({
    number: Number(match[2]),
    start: (match.index ?? 0) + match[1].length,
    contentStart: (match.index ?? 0) + match[0].length,
  }));
  if (markers.length < 2 || markers[0].start !== 0) return null;
  if (markers.some((marker, index) => marker.number !== index + 1)) return null;

  return markers.map((marker, index) => {
    const end = markers[index + 1]?.start ?? text.length;
    return text.slice(marker.contentStart, end).trim();
  }).filter(Boolean);
}

export function InlineFormattedText({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}

export function FormattedText({ text }: { text: string }) {
  const normalized = text.trim();
  const numberedItems = parseNumberedList(normalized);
  if (numberedItems) {
    return (
      <ol className="formatted-numbered-list">
        {numberedItems.map((item, index) => <li key={`${index}-${item}`}><InlineFormattedText text={item} /></li>)}
      </ol>
    );
  }

  const paragraphs = normalized.split(/\n{2,}/).filter(Boolean);
  return <>{paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph}`}><InlineFormattedText text={paragraph} /></p>)}</>;
}
