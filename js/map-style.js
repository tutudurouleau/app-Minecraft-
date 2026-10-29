/* ============================================================
   Style de la carte (format MapLibre)
   ------------------------------------------------------------
   Les données viennent d'OpenFreeMap (schéma « OpenMapTiles ») :
   landcover (forêts, champs…), water, building, transportation…
   Chaque type de terrain reçoit une texture « tex-… » (voir textures.js).
   ============================================================ */

import { POI_GROUPS } from './textures.js';

const EMPTY = { type: 'FeatureCollection', features: [] };

// Interpolation de largeur de ligne selon le zoom
const zoomWidth = (...stops) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops];

// Classe de route -> valeur (pour les largeurs)
function byClass(motorway, primary, secondary, minor, service) {
  return ['match', ['get', 'class'],
    ['motorway', 'trunk'], motorway,
    ['primary'], primary,
    ['secondary', 'tertiary'], secondary,
    ['minor', 'busway'], minor,
    service];
}

const CAR_ROADS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'busway', 'raceway'];
const ROAD_WIDTH = zoomWidth(
  8, byClass(1.6, 1, 0.6, 0, 0),
  12, byClass(3.5, 2.6, 1.6, 0.8, 0.5),
  14, byClass(7, 5.5, 4.5, 3, 1.8),
  16, byClass(14, 11, 9, 7, 4.5),
  18, byClass(36, 30, 24, 18, 12),
);
const CASING_WIDTH = zoomWidth(
  8, byClass(2.6, 1.8, 1.2, 0, 0),
  12, byClass(5, 4, 2.8, 1.6, 1),
  14, byClass(9, 7.5, 6.5, 4.6, 3.2),
  16, byClass(17, 14, 12, 9.5, 6.5),
  18, byClass(40, 34, 28, 22, 15),
);
// Ordre de dessin : les grandes routes par-dessus les petites, ponts au-dessus.
const ROAD_SORT = ['+',
  ['*', 10, ['coalesce', ['get', 'layer'], 0]],
  ['match', ['get', 'class'], ['motorway', 'trunk'], 4, 'primary', 3, ['secondary', 'tertiary'], 2, 1]];
const TUNNEL_OPACITY = ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.45, 1];

// Icône de lieu (images « ico-poi-… » préparées dans textures.js) :
// on regarde la catégorie (class), puis le type précis (subclass).
const poiMatch = (key, fallback) => ['match', ['get', key],
  ...Object.entries(POI_GROUPS).flatMap(([icon, values]) => [values, `ico-${icon}`]),
  fallback];
const poiIcon = poiMatch('class', poiMatch('subclass', 'ico-poi-generic'));

export function buildStyle(C) {
  const name = ['coalesce', ['get', 'name:fr'], ['get', 'name']];
  const white = '#ffffff';
  const halo = '#1f1f1f';

  return {
    version: 8,
    // Ciel bleu façon jeu, visible quand la carte est inclinée
    sky: {
      'sky-color': '#78A7FF',
      'horizon-color': '#C3DAFF',
      'fog-color': '#C3DAFF',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.5,
      'fog-ground-blend': 0.85,
    },
    name: 'BlocNav',
    glyphs: C.GLYPHS_URL,
    sources: {
      omt: { type: 'vector', url: C.TILES_URL },
      route: { type: 'geojson', data: EMPTY },
      markers: { type: 'geojson', data: EMPTY },
    },
    layers: [
      // ---- Sol : de l'herbe partout par défaut ----
      { id: 'background', type: 'background', paint: { 'background-pattern': 'tex-grass' } },

      // ---- Occupation du sol ----
      { id: 'farmland', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'farmland'],
        paint: { 'fill-pattern': 'tex-farmland' } },
      { id: 'landuse-industrial', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['industrial', 'railway', 'garages', 'quarry', 'dam']]],
        paint: { 'fill-pattern': 'tex-gravel' } },
      { id: 'landuse-commercial', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['commercial', 'retail']]],
        paint: { 'fill-pattern': 'tex-stone', 'fill-opacity': 0.55 } },
      { id: 'landuse-cemetery', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'cemetery'],
        paint: { 'fill-pattern': 'tex-dirt', 'fill-opacity': 0.5 } },
      { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-pattern': 'tex-leaves' } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['all', ['==', ['get', 'class'], 'grass'],
          ['in', ['get', 'subclass'], ['literal', ['park', 'garden', 'recreation_ground', 'village_green', 'playground']]]],
        paint: { 'fill-pattern': 'tex-flowers' } },
      { id: 'pitch', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['pitch', 'stadium', 'playground']]],
        paint: { 'fill-pattern': 'tex-flowers' } },
      { id: 'sand', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'sand'],
        paint: { 'fill-pattern': 'tex-sand' } },
      { id: 'rock', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'rock'],
        paint: { 'fill-pattern': 'tex-stone' } },
      { id: 'ice', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'ice'],
        paint: { 'fill-pattern': 'tex-snow' } },
      { id: 'wetland', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wetland'],
        paint: { 'fill-pattern': 'tex-mud' } },

      // ---- Eau ----
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: { 'fill-pattern': 'tex-water' } },
      { id: 'water-edge', type: 'line', source: 'omt', 'source-layer': 'water', minzoom: 13,
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: { 'line-color': '#183766', 'line-width': 1.5, 'line-opacity': 0.6 } },
      { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: {
          'line-color': '#3567C2',
          'line-width': zoomWidth(8, 0.5, 13, ['match', ['get', 'class'], ['river', 'canal'], 3, 1.2],
            18, ['match', ['get', 'class'], ['river', 'canal'], 16, 5]),
        } },

      // ---- Aéroports ----
      { id: 'runway', type: 'line', source: 'omt', 'source-layer': 'aeroway', minzoom: 11,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', ['runway', 'taxiway']]]],
        paint: { 'line-color': '#9a9a9a', 'line-width': zoomWidth(11, 2, 17, ['match', ['get', 'class'], 'runway', 60, 16]) } },

      // ---- Routes ----
      // Chemins piétons / pistes : petits pointillés
      { id: 'paths', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 14,
        filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
        layout: { 'line-cap': 'butt' },
        paint: {
          'line-color': ['match', ['get', 'class'], 'track', '#8C6E3E', '#D9C38F'],
          'line-width': zoomWidth(14, 1, 18, ['match', ['get', 'class'], 'track', 6, 3.5]),
          'line-dasharray': [2, 1],
          'line-opacity': TUNNEL_OPACITY,
        } },
      // Bordure sombre des routes
      { id: 'road-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 8,
        filter: ['in', ['get', 'class'], ['literal', CAR_ROADS]],
        layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ROAD_SORT },
        paint: {
          'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], '#2c2c2c', ['primary', 'secondary'], '#3a332b', '#4a3a22'],
          'line-width': CASING_WIDTH,
          'line-opacity': TUNNEL_OPACITY,
        } },
      // Routes en couleur unie quand on voit de loin
      { id: 'road-far', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 8, maxzoom: 14,
        filter: ['in', ['get', 'class'], ['literal', CAR_ROADS]],
        layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ROAD_SORT },
        paint: {
          'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], '#c9c9c9', ['primary', 'secondary'], '#a8a29a', '#c2a46a'],
          'line-width': ROAD_WIDTH,
        } },
      // Routes texturées quand on est proche : pierre, gravier, chemin de terre
      { id: 'road-near', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 14,
        filter: ['in', ['get', 'class'], ['literal', CAR_ROADS]],
        layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ROAD_SORT },
        paint: {
          'line-pattern': ['match', ['get', 'class'],
            ['motorway', 'trunk'], 'tex-stone',
            ['primary', 'secondary'], 'tex-gravel',
            'tex-path'],
          'line-width': ROAD_WIDTH,
          'line-opacity': TUNNEL_OPACITY,
        } },
      // Voies ferrées
      { id: 'rail-far', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 10, maxzoom: 15,
        filter: ['all', ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], ['!=', ['get', 'brunnel'], 'tunnel']],
        paint: { 'line-color': '#6b5a48', 'line-width': zoomWidth(10, 1, 15, 3), 'line-dasharray': [3, 1] } },
      { id: 'rail-near', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 15,
        filter: ['all', ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], ['!=', ['get', 'brunnel'], 'tunnel']],
        paint: { 'line-pattern': 'tex-rail', 'line-width': zoomWidth(15, 7, 18, 18) } },

      // ---- Bâtiments (vus de dessus) ----
      // Ombre décalée pour donner un effet de bloc en relief
      { id: 'building-shadow', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14,
        paint: { 'fill-color': '#000000', 'fill-opacity': 0.35, 'fill-translate': [3, 3], 'fill-translate-anchor': 'viewport' } },
      // Petites maisons : toit en planches. Grands immeubles : briques de pierre.
      { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14,
        paint: {
          'fill-pattern': ['case', ['>=', ['coalesce', ['get', 'render_height'], 0], 18], 'tex-bricks', 'tex-planks'],
        } },
      { id: 'building-edge', type: 'line', source: 'omt', 'source-layer': 'building', minzoom: 15,
        paint: { 'line-color': '#241a10', 'line-width': 1, 'line-opacity': 0.8 } },

      // ---- Itinéraire (rouge vif) ----
      { id: 'route-casing', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3a0505', 'line-width': zoomWidth(8, 6, 14, 10, 18, 22) } },
      { id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#e8322a', 'line-width': zoomWidth(8, 3, 14, 6, 18, 15) } },

      // ---- Textes ----
      { id: 'water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
        filter: ['==', ['geometry-type'], 'Point'],
        layout: { 'text-field': name, 'text-font': C.FONT_ITALIC, 'text-size': 13, 'text-max-width': 8 },
        paint: { 'text-color': '#d8e6ff', 'text-halo-color': '#17305f', 'text-halo-width': 1.5 } },
      { id: 'water-name-line', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'text-field': name, 'text-font': C.FONT_ITALIC, 'text-size': 13, 'symbol-placement': 'line' },
        paint: { 'text-color': '#d8e6ff', 'text-halo-color': '#17305f', 'text-halo-width': 1.5 } },
      { id: 'waterway-name', type: 'symbol', source: 'omt', 'source-layer': 'waterway', minzoom: 13,
        layout: { 'text-field': name, 'text-font': C.FONT_ITALIC, 'text-size': 12, 'symbol-placement': 'line' },
        paint: { 'text-color': '#d8e6ff', 'text-halo-color': '#17305f', 'text-halo-width': 1.5 } },
      { id: 'road-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14,
        filter: ['in', ['get', 'class'], ['literal', CAR_ROADS]],
        layout: { 'text-field': name, 'text-font': C.FONT_BOLD, 'symbol-placement': 'line',
          'text-size': zoomWidth(14, 10, 18, 15), 'text-max-angle': 30, 'symbol-spacing': 280 },
        paint: { 'text-color': white, 'text-halo-color': halo, 'text-halo-width': 1.6 } },
      { id: 'poi', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 15,
        filter: ['<=', ['coalesce', ['get', 'rank'], 99], 40],
        layout: {
          'icon-image': poiIcon,
          'text-field': ['step', ['zoom'], '', 16.5, name],
          'text-font': C.FONT_BOLD, 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 1.1],
          'text-max-width': 8, 'text-optional': true,
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
        },
        paint: { 'text-color': '#fff6c8', 'text-halo-color': halo, 'text-halo-width': 1.5 } },
      { id: 'place', type: 'symbol', source: 'omt', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood']]],
        layout: {
          'text-field': name, 'text-font': C.FONT_BOLD, 'text-max-width': 9,
          'text-size': ['interpolate', ['linear'], ['zoom'],
            4, ['match', ['get', 'class'], 'city', 12, 'town', 10, 9],
            10, ['match', ['get', 'class'], 'city', 20, 'town', 16, 'village', 13, 11],
            15, ['match', ['get', 'class'], 'city', 24, 'town', 20, 'village', 17, 14]],
          'text-transform': ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood'], 'uppercase', 'none'],
          'text-letter-spacing': ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood'], 0.08, 0],
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
        },
        paint: { 'text-color': white, 'text-halo-color': halo, 'text-halo-width': 2 } },

      // ---- Départ / arrivée ----
      { id: 'markers', type: 'symbol', source: 'markers',
        layout: { 'icon-image': ['get', 'icon'], 'icon-anchor': 'bottom',
          'icon-allow-overlap': true, 'icon-ignore-placement': true } },
    ],
  };
}
