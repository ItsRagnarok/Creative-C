export default function InfoTip({ text, align }: { text: string; align?: "right" }) {
  return (
    <span className={`info-tip ${align === "right" ? "right" : ""}`}>
      <span className="dot" tabIndex={0}>?</span>
      <span className="bubble">{text}</span>
    </span>
  );
}
