export const DOCUMENT_TYPES = [
  "bearbeitung",
  "sachverhalt",
  "bearbeitervermerk",
  "lösungsskizze",
  "bewertungsbogen",
  "kombiniertes-klausurdokument",
  "skript",
  "notiz",
  "sonstiges",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  bearbeitung: "studentische Bearbeitung",
  sachverhalt: "Sachverhalt",
  bearbeitervermerk: "Bearbeitervermerk",
  lösungsskizze: "Lösungsskizze",
  bewertungsbogen: "Bewertungsbogen/Punkteschema",
  "kombiniertes-klausurdokument": "kombiniertes Klausurdokument",
  skript: "Kursunterlage/Skript",
  notiz: "Notiz",
  sonstiges: "sonstige Unterlage",
};
