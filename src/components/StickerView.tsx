import type { BuiltinSticker } from "@/lib/stickers";

export function BuiltinStickerView({ s, size = 150 }: { s: BuiltinSticker; size?: number }) {
  return (
    <div
      title={s.text}
      style={{
        width: size, height: size, borderRadius: 18, padding: 10, boxSizing: "border-box",
        background: `linear-gradient(145deg, ${s.from}, ${s.to})`, color: "#fff",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
        textAlign: "center", boxShadow: "0 6px 18px rgba(0,0,0,.35)", transform: "rotate(-2deg)", userSelect: "none",
      }}
    >
      <div style={{ fontSize: size * 0.38, lineHeight: 1 }}>{s.emoji}</div>
      <div style={{ fontSize: Math.max(9, size * 0.085), fontWeight: 800, letterSpacing: ".02em", lineHeight: 1.15, textShadow: "0 1px 2px rgba(0,0,0,.5)" }}>{s.text}</div>
    </div>
  );
}
