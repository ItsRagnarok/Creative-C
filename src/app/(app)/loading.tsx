// Shown instantly inside the persistent shell while the next page's data loads.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Se încarcă">
      <div className="skeleton" style={{ height: 30, width: 220, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 14, width: 360, marginBottom: 28 }} />
      <div className="grid g-3" style={{ marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 86 }} />
        <div className="skeleton" style={{ height: 86 }} />
        <div className="skeleton" style={{ height: 86 }} />
      </div>
      <div className="skeleton" style={{ height: 320 }} />
    </div>
  );
}
