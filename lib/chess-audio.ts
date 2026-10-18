/**
 * Web Audio API synthesized sounds for Chess Dungeon
 * Includes crisp moves, captures, checkmates, and dramatic killer moves
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playMoveSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch (_) {}
}

export function playCaptureSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.16);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.17);
  } catch (_) {}
}

/**
 * Synchronized dramatic Killer Move audio:
 * Deep anime bass impact gong + resonant tension chime
 */
export function playKillerMoveSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    // 1. Heavy Sub-Bass Slam
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.45);

    subGain.gain.setValueAtTime(0.9, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.52);

    // 2. Piercing Crimson Eye Chime / Metallic Sting
    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chimeOsc.type = 'sawtooth';
    chimeOsc.frequency.setValueAtTime(880, now + 0.05);
    chimeOsc.frequency.exponentialRampToValueAtTime(1760, now + 0.2);
    chimeOsc.frequency.exponentialRampToValueAtTime(440, now + 0.7);

    chimeGain.gain.setValueAtTime(0.01, now);
    chimeGain.gain.setValueAtTime(0.4, now + 0.05);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    chimeOsc.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chimeOsc.start(now + 0.05);
    chimeOsc.stop(now + 0.78);

    // 3. Vibration if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 220]);
      } catch (_) {}
    }
  } catch (_) {}
}

export function playChipClackSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [0, 0.07, 0.14].forEach((delay, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400 + idx * 240, now + delay);
      osc.frequency.exponentialRampToValueAtTime(600, now + delay + 0.04);

      gain.gain.setValueAtTime(0.3 - idx * 0.06, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.05);
    });
  } catch (_) {}
}
