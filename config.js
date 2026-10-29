/*
 * ============================================================
 *  BlocNav : configuration des services
 * ============================================================
 *  Tous ces services sont gratuits et sans clé.
 *  Si l'un d'eux ne marche plus, remplace son adresse ici
 *  (directement depuis l'interface web de GitHub : bouton ✏️).
 *
 *  Ce fichier est lu par la page ET par le service worker (sw.js).
 */
self.CONFIG = {
  APP_NAME: 'BlocNav',
  VERSION: '1.0.0 (étape 1)',

  // --- Carte : tuiles vectorielles OpenStreetMap (OpenFreeMap) ---
  TILES_URL: 'https://tiles.openfreemap.org/planet',
  GLYPHS_URL: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  FONT_REGULAR: ['Noto Sans Regular'],
  FONT_BOLD: ['Noto Sans Bold'],
  FONT_ITALIC: ['Noto Sans Italic'],

  // --- Recherche d'adresse (Photon, de komoot) ---
  PHOTON_URL: 'https://photon.komoot.io',

  // --- Itinéraires (OSRM, serveurs de FOSSGIS) : un serveur par mode ---
  ROUTING: {
    car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
    bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving',
    foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
  },

  // --- Météo (servira à l'étape 3) ---
  WEATHER_URL: 'https://api.open-meteo.com/v1/forecast',

  // --- Divers ---
  DEFAULT_CENTER: [2.35, 46.6], // centre de la France [longitude, latitude]
  DEFAULT_ZOOM: 5,
  REQUEST_TIMEOUT_MS: 12000, // délai max d'attente d'un service (ms)

  // Cache hors-ligne : nombre maximum de morceaux de carte gardés
  // (environ 30 à 60 Mo pour 1500 morceaux).
  TILE_CACHE_MAX: 1500,
};
