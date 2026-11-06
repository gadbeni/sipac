/**
 * Aviso sonoro y por voz de la pantalla de llamado. Sin archivos ni servicios externos:
 * el timbre se sintetiza con Web Audio y la voz usa la Web Speech API si el navegador la tiene.
 * Los navegadores bloquean el audio hasta la primera interacción: `unlockAudio()` se llama
 * en el primer toque/clic sobre la pantalla.
 */
let ctx = null;

function audioContext() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** `true` si el navegador todavía no permite reproducir sonido. */
export const audioBlocked = () => {
  const c = audioContext();
  return !c || c.state !== 'running';
};

export async function unlockAudio() {
  const c = audioContext();
  if (c && c.state !== 'running') {
    try {
      await c.resume();
    } catch {
      /* sigue bloqueado */
    }
  }
  return !audioBlocked();
}

/** Timbre de dos tonos ("din-don"), ~1,2 s. */
export function playChime() {
  const c = audioContext();
  if (!c || c.state !== 'running') return false;
  const t0 = c.currentTime + 0.02;
  [
    [880, 0],
    [660, 0.45],
  ].forEach(([freq, at]) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.75);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + 0.8);
  });
  return true;
}

export const speechAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** "MG-005" → "M G 5": se lee letra por letra y el número sin ceros a la izquierda. */
export function spokenCode(codigo) {
  const [letras = '', num = ''] = String(codigo || '').split('-');
  const n = Number.parseInt(num, 10);
  return `${letras.split('').join(' ')} ${Number.isNaN(n) ? num : n}`.trim();
}

export const callPhrase = (codigo, consultorio) => `Ficha ${spokenCode(codigo)}. Diríjase a ${consultorio}.`;

export function speak(text) {
  if (!speechAvailable()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-419';
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('es'));
    if (voice) u.voice = voice;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch {
    /* voz no disponible */
  }
}
