export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" aria-label="Jura Agent">
      <span className="brand-mark" aria-hidden="true">
        <span>§</span>
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>Jura</strong>
          <span>Agent</span>
        </span>
      )}
    </span>
  );
}
