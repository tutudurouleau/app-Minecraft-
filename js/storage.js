/* Sauvegarde locale : réglages (localStorage) et pack de textures (IndexedDB).
   Rien n'est envoyé sur Internet. */

const SETTINGS_KEY = 'blocnav.settings';

export const DEFAULT_SETTINGS = {
  mode: 'car',            // car | bike | foot
  pixelation: 'medium',   // strong | medium | off
  blockSize: 'medium',    // small | medium | large
  voice: true,            // guidage vocal activé
  volume: 1,              // volume de la voix, de 0 à 1
  lastView: null,         // { center: [lng, lat], zoom }
};

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* navigation privée : tant pis */ }
}

/* ---------------- IndexedDB (petite base clé -> valeur) ---------------- */

let dbPromise;
function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('blocnav', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

function run(mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const idbGet = (key) => run('readonly', (s) => s.get(key)).catch(() => undefined);
export const idbSet = (key, value) => run('readwrite', (s) => s.put(value, key));
export const idbDel = (key) => run('readwrite', (s) => s.delete(key));
