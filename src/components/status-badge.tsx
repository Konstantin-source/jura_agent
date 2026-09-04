import { Check, CircleAlert, FileCheck2, ShieldCheck } from "lucide-react";
import type { SourceStatus } from "@/lib/ai/schemas";

const statusConfig = {
  "Amtlich verifiziert": { className: "verified", icon: ShieldCheck },
  "Mit Kursunterlage belegt": { className: "course", icon: FileCheck2 },
  "Teilweise verifiziert": { className: "partial", icon: Check },
  "Nicht aktuell verifiziert": { className: "unverified", icon: CircleAlert },
} satisfies Record<SourceStatus, { className: string; icon: typeof Check }>;

export function StatusBadge({ status, compact = false }: { status: SourceStatus; compact?: boolean }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span className={`status-badge ${config.className} ${compact ? "compact" : ""}`}>
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      {status}
    </span>
  );
}
