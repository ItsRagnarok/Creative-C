// A short, soft two-note chime made with the Web Audio API (no sound file to load).
// Browsers only allow audio after the user has interacted with the page once, so the context is armed on the first click/key.
let ctx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

if (typeof window !== "undefined") {
  const arm = () => {
    getCtx()?.resume().catch(() => {});
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("keydown", arm);
  };
  window.addEventListener("pointerdown", arm);
  window.addEventListener("keydown", arm);
}

export function playMessageSound() {
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const now = c.currentTime;
  [660, 880].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + i * 0.11;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}
