/* Panneau de réglages : pack de textures, affichage, cache hors-ligne. */

import { $, toast, pushLayer, popLayer } from './util.js';
import { importPack, removePack } from './texture-pack.js';
import { Voice } from './voice.js';
import { ICON_SOURCES } from './textures.js';

const C = self.CONFIG;
const TILE_CACHE = 'blocnav-tiles';

export function initSettings({ settings, saveSettings, pack, packStats, installPrompt }) {
  const overlay = $('#settings');

  function open() {
    overlay.hidden = false;
    refreshCacheInfo();
    pushLayer('settings', () => close(true));
  }
  function close(fromBack = false) {
    overlay.hidden = true;
    if (!fromBack) popLayer('settings');
  }

  $('#btn-settings').addEventListener('click', open);
  $('#settings-close').addEventListener('click', () => close());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  $('#osm-credit').addEventListener('click', () => {
    open();
    $('.about').scrollIntoView({ block: 'center' });
  });
  $('#app-version').textContent = C.VERSION;

  // ---- Pack de textures ----
  if (pack) {
    $('#pack-name').textContent = pack.name;
    $('#pack-info').textContent = `${packStats.fromPack} textures et ${packStats.packIcons.length} icônes du pack utilisées`;
    const missing = Object.entries(ICON_SOURCES)
      .filter(([name]) => !packStats.packIcons.includes(name))
      .map(([, s]) => s.label);
    const missingEl = $('#pack-missing');
    missingEl.hidden = !missing.length;
    missingEl.textContent = `Pas trouvées dans ce pack (mes dessins restent) : ${missing.join(', ')}.`;
    $('#btn-pack-reset').hidden = false;
    if (pack.icon) $('#pack-icon').src = URL.createObjectURL(pack.icon);
  }
  const fileInput = $('#pack-file');
  $('#btn-pack-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const btn = $('#btn-pack-import');
    btn.disabled = true;
    btn.textContent = 'Lecture du pack…';
    try {
      const { found, total, iconsFound, iconsTotal } = await importPack(file);
      toast(`Pack importé : ${found}/${total} textures et ${iconsFound}/${iconsTotal} icônes trouvées. Rechargement…`);
      setTimeout(() => location.reload(), 1800);
    } catch (e) {
      toast(e.message || 'Import impossible.', 6000);
      btn.disabled = false;
      btn.textContent = 'Importer un pack (.zip / .jar)';
    }
  });
  $('#btn-pack-reset').addEventListener('click', async () => {
    await removePack();
    toast('Retour aux textures originales…');
    setTimeout(() => location.reload(), 800);
  });

  // ---- Choix à 3 boutons (pixelisation, taille des blocs) ----
  for (const group of document.querySelectorAll('.choice')) {
    const key = group.dataset.setting;
    for (const btn of group.querySelectorAll('button')) {
      btn.classList.toggle('selected', settings[key] === btn.dataset.value);
      btn.addEventListener('click', () => {
        if (settings[key] === btn.dataset.value) return;
        settings[key] = btn.dataset.value;
        saveSettings();
        toast('Réglage enregistré, rechargement…');
        setTimeout(() => location.reload(), 600);
      });
    }
  }

  // ---- Guidage vocal ----
  const voiceBtn = $('#btn-voice-toggle');
  const volumeWrap = $('#voice-volume-wrap');
  const volumeInput = $('#voice-volume');
  const voice = new Voice(settings);
  function refreshVoiceUI() {
    voiceBtn.textContent = settings.voice !== false ? 'Voix : activée 🔊' : 'Voix : désactivée 🔇';
    volumeWrap.hidden = settings.voice === false;
    volumeInput.value = Math.round((settings.volume ?? 1) * 100);
  }
  voiceBtn.addEventListener('click', () => {
    settings.voice = settings.voice === false; // bascule activé/désactivé
    saveSettings();
    refreshVoiceUI();
    if (settings.voice !== false) voice.speak('Guidage vocal activé.', { interrupt: true });
  });
  volumeInput.addEventListener('input', () => {
    settings.volume = Number(volumeInput.value) / 100;
    saveSettings();
  });
  volumeInput.addEventListener('change', () => voice.speak('Volume réglé.', { interrupt: true }));
  refreshVoiceUI();

  // ---- Cache hors-ligne ----
  async function refreshCacheInfo() {
    const info = $('#cache-info');
    try {
      const cache = await caches.open(TILE_CACHE);
      const count = (await cache.keys()).length;
      let text = `${count} morceaux de carte gardés pour le hors-ligne (max ${C.TILE_CACHE_MAX}).`;
      if (navigator.storage?.estimate) {
        const { usage } = await navigator.storage.estimate();
        text += ` Espace utilisé : ${Math.round(usage / 1e6)} Mo.`;
      }
      info.textContent = text;
    } catch {
      info.textContent = 'Cache indisponible sur ce navigateur.';
    }
  }
  $('#btn-cache-clear').addEventListener('click', async () => {
    await caches.delete(TILE_CACHE);
    toast('Cache de la carte vidé.');
    refreshCacheInfo();
  });

  // ---- Installation (si Chrome la propose) ----
  const installBtn = $('#btn-install');
  const showInstall = () => { installBtn.hidden = !installPrompt.event; };
  installPrompt.onChange = showInstall;
  showInstall();
  installBtn.addEventListener('click', async () => {
    const ev = installPrompt.event;
    if (!ev) return;
    ev.prompt();
    await ev.userChoice.catch(() => null);
    installPrompt.event = null;
    showInstall();
  });

  return { open, close };
}
