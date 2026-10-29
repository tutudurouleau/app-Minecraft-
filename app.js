/* ============================================================
   BlocNav : point d'entrée de l'application
   ------------------------------------------------------------
   1. lit les réglages et le pack de textures éventuel
   2. prépare les textures en pixel-art
   3. crée la carte, la recherche, l'itinéraire et les réglages
   ============================================================ */

import { $, debounce, toast } from './js/util.js';
import { loadSettings, saveSettings as persistSettings } from './js/storage.js';
import { buildMapImages, applyPackIconsToPage } from './js/textures.js';
import { buildStyle } from './js/map-style.js';
import { loadPack } from './js/texture-pack.js';
import { Position, gpsErrorMessage } from './js/position.js';
import { SearchBox, photonReverse } from './js/search.js';
import { Router } from './js/routing.js';
import { Navigation } from './js/navigation.js';
import { initSettings } from './js/settings.js';

const C = self.CONFIG;

// Taille d'un bloc de texture à l'écran (px), selon le réglage.
const BLOCK_SIZES = { small: 14, medium: 20, large: 28 };
// La carte est calculée en plus basse résolution puis agrandie :
// 3 = gros pixels, 2 = moyen, 1 = résolution normale de l'écran.
const PIXEL_DIVISORS = { strong: 3, medium: 2, off: 1 };

// Chrome propose d'installer l'app : on garde l'événement pour le bouton des réglages.
const installPrompt = { event: null, onChange: null };
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt.event = e;
  installPrompt.onChange?.();
});

function fatal(message) {
  $('#splash').hidden = false;
  $('#splash').classList.remove('hide');
  $('#splash-text').textContent = message;
}

function hideSplash() {
  const splash = $('#splash');
  splash.classList.add('hide');
  setTimeout(() => { splash.hidden = true; }, 400);
}

async function main() {
  if (!window.maplibregl) {
    fatal('Le moteur de carte n\'a pas pu se charger. Vérifie ta connexion puis recharge la page.');
    return;
  }

  const settings = loadSettings();
  const save = () => persistSettings(settings);
  const dpr = window.devicePixelRatio || 1;
  const pixelRatio = Math.max(0.5, dpr / (PIXEL_DIVISORS[settings.pixelation] || 2));
  document.documentElement.dataset.pixel = settings.pixelation;

  // ---- Textures (originales ou pack importé) ----
  const pack = await loadPack().catch(() => null);
  const { images, fromPack, packIcons } = await buildMapImages({
    blockCss: BLOCK_SIZES[settings.blockSize] || BLOCK_SIZES.medium,
    pixelRatio,
    pack,
  });
  // Icônes du pack aussi dans les boutons (loupe, boussole, « Démarrer »…).
  applyPackIconsToPage();

  // ---- Carte ----
  const view = settings.lastView;
  let map;
  try {
    map = new maplibregl.Map({
      container: 'map',
      style: buildStyle(C),
      center: view?.center || C.DEFAULT_CENTER,
      zoom: view?.zoom ?? C.DEFAULT_ZOOM,
      pixelRatio,
      fadeDuration: 0,
      attributionControl: false,
      maxZoom: 19,
      maxPitch: 0,          // vue de dessus (la vue inclinée arrive à l'étape 3)
      touchPitch: false,
      refreshExpiredTiles: false,
      cancelPendingTileRequestsWhileZooming: true,
    });
  } catch (e) {
    console.error(e);
    fatal('Ce navigateur ne peut pas afficher la carte (WebGL indisponible).');
    return;
  }

  const addImage = (id) => {
    const img = images.get(id);
    if (img && !map.hasImage(id)) map.addImage(id, img.data, { pixelRatio: img.pixelRatio });
  };
  map.on('styleimagemissing', (e) => addImage(e.id));
  map.on('style.load', () => images.forEach((_, id) => addImage(id)));

  map.once('load', hideSplash);
  setTimeout(hideSplash, 8000);

  let lastMapError = 0;
  map.on('error', (e) => {
    console.warn('Carte :', e.error?.message || e);
    if (Date.now() - lastMapError < 30000) return;
    lastMapError = Date.now();
    toast(navigator.onLine
      ? 'La carte se charge mal (serveur de tuiles). Réessaie plus tard ou change TILES_URL dans config.js.'
      : 'Hors connexion : seules les zones déjà vues s\'affichent.', 6000);
  });

  // ---- Position GPS ----
  const position = new Position(map);
  let userMoved = false;
  map.on('dragstart', () => { userMoved = true; });
  map.on('zoomstart', (e) => { if (e.originalEvent) userMoved = true; });
  let centeredOnce = false;
  position.onUpdate((pos) => {
    if (centeredOnce) return;
    centeredOnce = true;
    if (!userMoved && !router.dest) map.jumpTo({ center: pos.lngLat, zoom: Math.max(map.getZoom(), 16) });
  });
  let gpsWarned = false;
  position.onError((e) => {
    if (e.code === 1 && !gpsWarned) {
      gpsWarned = true;
      toast(gpsErrorMessage(e), 6000);
    }
  });
  position.start();

  $('#btn-locate').addEventListener('click', async () => {
    try {
      const pos = await position.get();
      map.flyTo({ center: pos.lngLat, zoom: Math.max(map.getZoom(), 16), duration: 900 });
    } catch (e) {
      toast(gpsErrorMessage(e), 5000);
    }
  });

  // ---- Boussole : visible quand la carte est tournée ----
  const compassBtn = $('#btn-compass');
  const compassImg = $('#compass-img');
  map.on('rotate', () => {
    const b = map.getBearing();
    compassBtn.hidden = Math.abs(b) < 0.5;
    compassImg.style.transform = `rotate(${-b}deg)`;
  });
  compassBtn.addEventListener('click', () => map.easeTo({ bearing: 0, duration: 400 }));

  // ---- Recherche + itinéraire ----
  const search = new SearchBox({
    getBias: () => position.last?.lngLat || map.getCenter().toArray(),
    onPick: (place, target) => {
      if (target === 'origin') router.setOrigin(place);
      else router.setDestination(place);
    },
  });
  const router = new Router(map, { position, settings, saveSettings: save, search });
  map.on('click', () => search.close());

  // ---- Guidage en direct (étape 2) ----
  const navigation = new Navigation(map, { position, router, settings });
  $('#btn-start-nav').addEventListener('click', () => navigation.start());

  // Appui long sur la carte : choisir ce point (destination ou départ).
  let lastPick = 0;
  async function pickPoint(lngLat) {
    if (Date.now() - lastPick < 1500) return;
    lastPick = Date.now();
    navigator.vibrate?.(25);
    const place = {
      lngLat,
      title: 'Point sur la carte',
      sub: `${lngLat[1].toFixed(5)}, ${lngLat[0].toFixed(5)}`,
    };
    if (search.target === 'origin') {
      search.exitOriginMode();
      router.setOrigin(place);
    } else {
      router.setDestination(place);
    }
    try {
      const named = await photonReverse(lngLat);
      if (named) {
        place.title = named.title;
        place.sub = named.sub;
        router.refreshLabels();
      }
    } catch { /* on garde « Point sur la carte » */ }
  }
  setupLongPress(map, pickPoint);

  // ---- Réglages ----
  initSettings({ settings, saveSettings: save, pack, packStats: { fromPack, packIcons }, installPrompt });

  // ---- Mémorise la dernière vue ----
  map.on('moveend', debounce(() => {
    settings.lastView = { center: map.getCenter().toArray(), zoom: Math.round(map.getZoom() * 10) / 10 };
    save();
  }, 1500));

  window.addEventListener('offline', () => toast('Hors connexion : la carte montre les zones déjà vues.'));
  window.addEventListener('online', () => toast('Connexion retrouvée.'));

  try {
    if (!localStorage.getItem('blocnav.hint')) {
      localStorage.setItem('blocnav.hint', '1');
      setTimeout(() => {
        if (!document.body.classList.contains('navigating')) toast('Astuce : appui long sur la carte pour y aller.', 5000);
      }, 2500);
    }
  } catch { /* pas grave */ }

  // Accès pratique pour le débogage depuis la console.
  window.blocnav = { map, router, position, search, settings, navigation };
}

/** Détecte un appui long (doigt immobile 0,6 s) sur la carte. */
function setupLongPress(map, onLongPress) {
  const box = map.getCanvasContainer();
  let timer = null;
  let start = null;
  const cancel = () => { clearTimeout(timer); timer = null; };
  box.addEventListener('touchstart', (e) => {
    cancel();
    if (e.touches.length !== 1) return;
    start = [e.touches[0].clientX, e.touches[0].clientY];
    timer = setTimeout(() => {
      const r = box.getBoundingClientRect();
      const ll = map.unproject([start[0] - r.left, start[1] - r.top]);
      onLongPress([ll.lng, ll.lat]);
    }, 600);
  }, { passive: true });
  box.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (start && t && Math.hypot(t.clientX - start[0], t.clientY - start[1]) > 10) cancel();
  }, { passive: true });
  box.addEventListener('touchend', cancel);
  box.addEventListener('touchcancel', cancel);
  // Clic droit (ordinateur) ou appui long reconnu par le navigateur
  map.on('contextmenu', (e) => onLongPress(e.lngLat.toArray()));
}

/* ---- Service worker : mode hors-ligne ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(async () => {
      const reg = await navigator.serviceWorker.ready;
      // Demande au service worker de garder tous les fichiers de l'app déjà chargés.
      setTimeout(() => {
        const urls = performance.getEntriesByType('resource')
          .map((r) => r.name)
          .filter((u) => u.startsWith(location.origin));
        reg.active?.postMessage({ type: 'cache-app-files', urls: [location.href.split('#')[0], ...urls] });
      }, 4000);
    }).catch((e) => console.warn('Service worker :', e));
  });
}

main().catch((e) => {
  console.error(e);
  fatal(`Erreur au démarrage : ${e.message}`);
});
