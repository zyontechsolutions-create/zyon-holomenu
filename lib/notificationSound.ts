// A short two-tone chime for new-order alerts, generated with the Web Audio
// API — no audio file to host. Browsers block audio before the user has
// interacted with the page at all, so the very first alert after a fresh
// page load may be silent; every alert after that plays normally.
export function playOrderChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.14;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });

    setTimeout(() => ctx.close(), 700);
  } catch {
    // Autoplay restrictions or unsupported browser — fail silently,
    // the badge count still shows regardless.
  }
}
