// Real recorded-style bell chimes (small MP3s in /public/sounds), not
// synthesized beeps. Browsers still block audio before the user has
// interacted with the page at all — the very first alert after a fresh
// load may be silent; every alert after that plays normally.

let orderAudio: HTMLAudioElement | null = null;
let waiterAudio: HTMLAudioElement | null = null;

function getAudio(ref: "order" | "waiter"): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (ref === "order") {
    if (!orderAudio) {
      orderAudio = new Audio("/sounds/order-chime.mp3");
      orderAudio.volume = 0.85;
      orderAudio.preload = "auto";
    }
    return orderAudio;
  }
  if (!waiterAudio) {
    waiterAudio = new Audio("/sounds/waiter-chime.mp3");
    waiterAudio.volume = 0.9;
    waiterAudio.preload = "auto";
  }
  return waiterAudio;
}

export function playOrderChime() {
  const audio = getAudio("order");
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay blocked until the user interacts with the page — ignore.
    });
  } catch {
    // ignore
  }
}

// A distinct, brighter three-note chime for waiter calls, so staff can
// tell it apart from a new-order alert by ear without looking.
export function playWaiterChime() {
  const audio = getAudio("waiter");
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}
