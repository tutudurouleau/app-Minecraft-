/* ============================================================
   Import d'un pack de textures (.zip) ou du fichier du jeu (.jar).
   On n'en garde que les quelques images utiles à la carte,
   stockées dans le téléphone (IndexedDB). Rien n'est envoyé en ligne.
   ============================================================ */

import { loadScript } from './util.js';
import { idbGet, idbSet, idbDel } from './storage.js';
import { TEXTURES, ICON_SOURCES } from './textures.js';

const TEXTURE_ROOT = 'assets/minecraft/textures/';

export const loadPack = () => idbGet('pack');
export const removePack = () => idbDel('pack');

/**
 * Lit le fichier choisi et enregistre les textures et icônes trouvées.
 * @returns {Promise<{found: number, total: number, iconsFound: number, iconsTotal: number}>}
 */
export async function importPack(file) {
  await loadScript('lib/jszip.min.js');
  let zip;
  try {
    zip = await self.JSZip.loadAsync(file);
  } catch {
    throw new Error('Ce fichier n\'est pas un pack de textures (.zip ou .jar).');
  }

  // Index : « block/dirt.png » -> fichier dans l'archive (quel que soit le dossier parent).
  const index = new Map();
  let packIcon = null;
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    const lower = path.toLowerCase();
    const i = lower.indexOf(TEXTURE_ROOT);
    if (i >= 0) index.set(lower.slice(i + TEXTURE_ROOT.length), entry);
    if (/(^|\/)pack\.png$/.test(lower) && (!packIcon || path.length < packIcon.name.length)) packIcon = entry;
  });
  if (!index.size) throw new Error('Aucune texture de blocs trouvée dans ce fichier.');

  const textures = {};
  for (const def of TEXTURES) {
    for (const candidate of def.pack || []) {
      const entry = index.get(candidate);
      if (entry) {
        const data = await entry.async('uint8array');
        textures[def.id] = new Blob([data], { type: 'image/png' });
        break;
      }
    }
  }
  const found = Object.keys(textures).length;
  if (!found) throw new Error('Aucune des textures utiles (herbe, terre, eau…) n\'a été trouvée.');

  // Icônes « objets du jeu » (boussole, émeraude, cœurs…) : facultatives,
  // on garde notre dessin si l'image n'est pas dans le pack.
  const icons = {};
  for (const [name, source] of Object.entries(ICON_SOURCES)) {
    for (const candidate of source.pack || []) {
      const entry = index.get(candidate);
      if (entry) {
        const data = await entry.async('uint8array');
        icons[name] = new Blob([data], { type: 'image/png' });
        break;
      }
    }
  }
  const iconsFound = Object.keys(icons).length;

  const icon = packIcon ? new Blob([await packIcon.async('uint8array')], { type: 'image/png' }) : null;
  await idbSet('pack', { name: file.name, date: Date.now(), textures, icons, icon });
  return { found, total: TEXTURES.filter((d) => d.pack).length, iconsFound, iconsTotal: Object.keys(ICON_SOURCES).length };
}
