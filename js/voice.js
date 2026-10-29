/* ============================================================
   Guidage vocal en français (Web Speech API du navigateur,
   déjà présente sur Chrome mobile : rien à installer).
   ============================================================ */

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

let cachedVoice;
function frenchVoice() {
  if (!speechSupported) return null;
  if (cachedVoice === undefined) {
    const voices = speechSynthesis.getVoices();
    cachedVoice = voices.find((v) => v.lang === 'fr-FR') || voices.find((v) => v.lang?.startsWith('fr')) || null;
  }
  return cachedVoice;
}
if (speechSupported) {
  // La liste des voix arrive parfois après coup : on reprend la recherche.
  speechSynthesis.addEventListener('voiceschanged', () => { cachedVoice = undefined; });
}

export class Voice {
  /** @param {object} settings objet partagé, avec `voice` (bool) et `volume` (0 à 1) */
  constructor(settings) {
    this.settings = settings;
  }

  speak(text, { interrupt = false } = {}) {
    if (!speechSupported || this.settings.voice === false) return;
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.volume = this.settings.volume ?? 1;
    const v = frenchVoice();
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  stop() {
    if (speechSupported) speechSynthesis.cancel();
  }
}
