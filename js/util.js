/* Petits outils partagés : DOM, réseau, formats français, messages. */

export const $ = (sel) => document.querySelector(sel);

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Télécharge du JSON avec un délai maximum.
 * L'erreur renvoyée a un champ `kind` : 'timeout', 'network', 'http' ou 'abort'.
 */
export async function fetchJSON(url, { signal, timeout = self.CONFIG?.REQUEST_TIMEOUT_MS ?? 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('timeout'), timeout);
  const onAbort = () => ctrl.abort('abort');
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.kind = 'http';
      err.status = res.status;
      try { err.body = await res.json(); } catch { /* pas de JSON */ }
      throw err;
    }
    return await res.json();
  } catch (e) {
    if (e.kind) throw e;
    const err = new Error(e.message || String(e));
    err.kind = ctrl.signal.aborted ? (ctrl.signal.reason === 'abort' ? 'abort' : 'timeout') : 'network';
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** 8 m, 450 m, 1,2 km, 8,4 km, 125 km */
export function formatDistance(m) {
  if (m < 100) return `${Math.max(0, Math.round(m / 5) * 5)} m`;
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  if (m < 10000) return `${nf1.format(m / 1000)} km`;
  return `${nf0.format(m / 1000)} km`;
}

/** 45 s -> « 1 min », 12 min, 1 h 05 */
export function formatDuration(s) {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, '0')}`;
}

/** Heure d'arrivée, ex. « 14:32 » */
export function formatClock(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

let toastTimer;
/** Affiche un message quelques secondes en haut de l'écran. */
export function toast(msg, ms = 3800) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/** Charge un script classique une seule fois (ex. JSZip, seulement si besoin). */
const loadedScripts = new Map();
export function loadScript(src) {
  if (!loadedScripts.has(src)) {
    loadedScripts.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { loadedScripts.delete(src); reject(new Error(`Impossible de charger ${src}`)); };
      document.head.append(s);
    }));
  }
  return loadedScripts.get(src);
}

/* ------------------------------------------------------------------
 * Bouton « retour » d'Android : ferme le dernier panneau ouvert
 * au lieu de quitter l'application.
 * ------------------------------------------------------------------ */
const layers = [];
let ignorePops = 0;

/** À appeler quand un panneau s'ouvre. onClose(fromBack) le referme. */
export function pushLayer(name, onClose) {
  if (layers.some((l) => l.name === name)) return;
  layers.push({ name, onClose });
  history.pushState({ layer: name }, '');
}

/** À appeler quand un panneau se ferme par un bouton de l'interface. */
export function popLayer(name) {
  const i = layers.findIndex((l) => l.name === name);
  if (i < 0) return;
  layers.splice(i, 1);
  ignorePops++;
  history.back();
}

window.addEventListener('popstate', () => {
  if (ignorePops > 0) { ignorePops--; return; }
  const layer = layers.pop();
  if (layer) layer.onClose(true);
});
