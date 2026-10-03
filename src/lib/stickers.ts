// Built-in stickers: big emoji + a loud one-liner on a coloured card (no image files to load).
// Message body for a sticker: "::sticker::builtin:<key>" or "::sticker::custom:<id>".
export type BuiltinSticker = { key: string; emoji: string; text: string; from: string; to: string };

export const BUILTIN_STICKERS: BuiltinSticker[] = [
  { key: "respect", emoji: "🫡", text: "RESPECT, ȘEFU!", from: "#2b6cff", to: "#0b2a7a" },
  { key: "deadline", emoji: "💀", text: "DEADLINE-UL: ȘI-A LUAT ADIO", from: "#ff3b3b", to: "#7a0b0b" },
  { key: "cafea", emoji: "☕", text: "FĂRĂ CAFEA NU MERGE", from: "#a0642a", to: "#4a2a0b" },
  { key: "flow", emoji: "🚀", text: "SUNT ÎN FLOW", from: "#8a3bff", to: "#2a0b7a" },
  { key: "clovn", emoji: "🤡", text: "AM VRUT SĂ FIU SERIOS", from: "#ff7a1a", to: "#7a2a0b" },
  { key: "foc", emoji: "🔥", text: "ARDE TOT! (în sens bun)", from: "#ff5a1a", to: "#7a0b2a" },
  { key: "obosit", emoji: "😮‍💨", text: "OBOSIT, DAR PROFESIONIST", from: "#3b8aa0", to: "#0b3a4a" },
  { key: "cinci", emoji: "🙏", text: "MAI DĂ-MI 5 MINUTE", from: "#d4a017", to: "#6a4a0b" },
  { key: "error", emoji: "🧠", text: "CREIERUL: ERROR 404", from: "#1aa05a", to: "#0b4a2a" },
  { key: "goat", emoji: "🐐", text: "G.O.A.T. LA EDITAT", from: "#555e6e", to: "#1a1e26" },
  { key: "taiat", emoji: "🎬", text: "ȘI... TĂIAT!", from: "#444", to: "#111" },
  { key: "popcorn", emoji: "🍿", text: "STAU AICI, DOAR MĂ UIT", from: "#e8b21a", to: "#7a540b" },
  { key: "livrat", emoji: "🥳", text: "CLIP LIVRAT! SĂRBĂTOARE!", from: "#ff3bb0", to: "#7a0b50" },
  { key: "luni", emoji: "😴", text: "LUNI? SIGUR?", from: "#5a6aa0", to: "#1a2a4a" },
  { key: "bani", emoji: "💸", text: "BANII NU DORM", from: "#1aa07a", to: "#0b4a3a" },
  { key: "unicorn", emoji: "🦄", text: "UNICORN DE EDITOR", from: "#c03bff", to: "#4a0b7a" },
  { key: "foc2", emoji: "🧯", text: "STING FOCUL DIN PROIECT", from: "#d02a2a", to: "#5a0b0b" },
  { key: "ochi", emoji: "👀", text: "VĂD CĂ NU AI ÎNCĂRCAT…", from: "#2aa0d0", to: "#0b3a5a" },
];

export const stickerKey = (body: string) => (body.startsWith("::sticker::") ? body.slice("::sticker::".length) : null);
export const builtinSticker = (key: string) => BUILTIN_STICKERS.find((s) => s.key === key) ?? null;
