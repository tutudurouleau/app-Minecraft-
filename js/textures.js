/* ============================================================
   Textures de la carte
   ------------------------------------------------------------
   Les images originales sont dans le dossier textures/ (16x16).
   Si un pack de textures a été importé (Réglages), ses images
   remplacent les originales, une par une.

   Pour chaque texture :
   - file      : image originale dans textures/
   - tint      : couleur appliquée à l'image originale (si elle est grise)
   - pack      : chemins possibles dans un pack de textures (Java)
   - packTint  : couleur appliquée à l'image du pack (si elle est grise)
   - under     : couleur de fond quand l'image du pack a des trous
   - transparent : la texture garde sa transparence (rails)
   - packRotate  : tourne l'image du pack d'un quart de tour
   ============================================================ */

export const TEXTURES = [
  { id: 'grass', file: 'grass.png', tint: '#84C858', pack: ['block/grass_block_top.png', 'blocks/grass_top.png'], packTint: '#91BD59' },
  { id: 'flowers', file: 'flowers.png', pack: ['block/grass_block_top.png', 'blocks/grass_top.png'], packTint: '#79C05A' },
  { id: 'leaves', file: 'leaves.png', tint: '#4F9A35', pack: ['block/oak_leaves.png', 'blocks/leaves_oak.png'], packTint: '#77AB2F', under: '#26421A' },
  { id: 'farmland', file: 'farmland.png', pack: ['block/farmland_moist.png', 'block/farmland.png', 'blocks/farmland_wet.png', 'blocks/farmland_dry.png'] },
  { id: 'dirt', file: 'dirt.png', pack: ['block/dirt.png', 'blocks/dirt.png'] },
  { id: 'path', file: 'path.png', pack: ['block/dirt_path_top.png', 'block/grass_path_top.png', 'blocks/grass_path_top.png'] },
  { id: 'gravel', file: 'gravel.png', pack: ['block/gravel.png', 'blocks/gravel.png'] },
  { id: 'stone', file: 'stone.png', pack: ['block/stone.png', 'blocks/stone.png'] },
  { id: 'cobble', file: 'cobble.png', pack: ['block/cobblestone.png', 'blocks/cobblestone.png'] },
  { id: 'sand', file: 'sand.png', pack: ['block/sand.png', 'blocks/sand.png'] },
  { id: 'snow', file: 'snow.png', pack: ['block/snow.png', 'blocks/snow.png'] },
  { id: 'ice', file: 'ice.png', pack: ['block/packed_ice.png', 'block/ice.png', 'blocks/ice_packed.png', 'blocks/ice.png'], under: '#8DB4E8' },
  { id: 'water', file: 'water.png', tint: '#3F7FD9', pack: ['block/water_still.png', 'blocks/water_still.png'], packTint: '#3F76E4', under: '#1C3A78' },
  { id: 'mud', file: 'mud.png', pack: ['block/mud.png', 'block/podzol_top.png', 'blocks/dirt_podzol_top.png'] },
  { id: 'planks', file: 'planks.png', pack: ['block/oak_planks.png', 'blocks/planks_oak.png'] },
  { id: 'bricks', file: 'bricks.png', pack: ['block/stone_bricks.png', 'blocks/stonebrick.png'] },
  { id: 'rail', file: 'rail.png', transparent: true, pack: ['block/rail.png', 'blocks/rail_normal.png'], packRotate: true },
];

/* Icônes de lieux : nom de l'icône -> types OpenStreetMap correspondants.
   Sert à la fois pour la carte et pour les résultats de recherche. */
export const POI_GROUPS = {
  'poi-food': ['restaurant', 'fast_food', 'food_court', 'bbq'],
  'poi-cafe': ['cafe', 'bar', 'pub', 'beer', 'biergarten', 'ice_cream'],
  'poi-fuel': ['fuel', 'charging_station'],
  'poi-shop': ['shop', 'grocery', 'supermarket', 'convenience', 'bakery', 'butcher', 'clothing_store', 'clothes', 'alcohol_shop', 'department_store', 'mall', 'marketplace'],
  'poi-parking': ['parking', 'bicycle_parking', 'motorcycle_parking'],
  'poi-hospital': ['hospital', 'clinic', 'doctors', 'dentist'],
  'poi-pharmacy': ['pharmacy', 'chemist'],
  'poi-hotel': ['lodging', 'hotel', 'motel', 'hostel', 'guest_house', 'campsite', 'camp_site'],
  'poi-school': ['school', 'college', 'university', 'kindergarten', 'library'],
  'poi-bank': ['bank', 'atm', 'bureau_de_change'],
  'poi-bus': ['bus', 'bus_station', 'bus_stop'],
  'poi-train': ['railway', 'station', 'train_station', 'halt', 'tram_stop', 'subway'],
  'poi-star': ['attraction', 'museum', 'castle', 'monument', 'memorial', 'art_gallery', 'zoo', 'theatre', 'cinema', 'viewpoint', 'theme_park', 'stadium'],
};

/** Icône à afficher pour un type de lieu OSM (ex. 'restaurant'). */
export function poiIconFor(value) {
  for (const [icon, values] of Object.entries(POI_GROUPS)) {
    if (values.includes(value)) return icon;
  }
  return null;
}

/** Icônes posées sur la carte, avec leur taille d'affichage (px écran). */
const MAP_ICONS = {
  pin: 34,
  'flag-start': 30,
  'flag-end': 30,
  ...Object.fromEntries([...Object.keys(POI_GROUPS), 'poi-generic'].map((n) => [n, 22])),
};

export const iconURL = (name) => `textures/icons/${name}.png`;

/* ---------------------------------------------------------------- */

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function hexToRgb(hex) {
  if (!hex) return null;
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

async function decode(src) {
  const blob = typeof src === 'string' ? await (await fetch(src)).blob() : src;
  return createImageBitmap(blob);
}

/** Agrandit une petite image en gardant des pixels bien nets. */
function upscale(source, size, factor) {
  const out = canvas(size * factor, size * factor);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return ctx.getImageData(0, 0, out.width, out.height);
}

/**
 * Prépare une texture : 1re image seulement (animations), teinte,
 * fond opaque, puis agrandissement sans lissage.
 */
function processTexture(bmp, def, fromPack, blockCss, mapPixelRatio) {
  const n = Math.min(bmp.width, bmp.height);
  const N = Math.min(n, 64); // les packs « HD » sont réduits à 64x64
  const c = canvas(N, N);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  if (fromPack && def.packRotate) {
    ctx.translate(N, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.drawImage(bmp, 0, 0, n, n, 0, 0, N, N);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const img = ctx.getImageData(0, 0, N, N);
  const d = img.data;
  const tint = hexToRgb(fromPack ? def.packTint : def.tint);
  const under = hexToRgb(def.under || '#3a3a3a');
  for (let i = 0; i < d.length; i += 4) {
    if (tint) {
      d[i] = (d[i] * tint[0]) / 255;
      d[i + 1] = (d[i + 1] * tint[1]) / 255;
      d[i + 2] = (d[i + 2] * tint[2]) / 255;
    }
    if (!def.transparent) {
      const a = d[i + 3] / 255;
      d[i] = d[i] * a + under[0] * (1 - a);
      d[i + 1] = d[i + 1] * a + under[1] * (1 - a);
      d[i + 2] = d[i + 2] * a + under[2] * (1 - a);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Taille d'un « pixel de texture » sur l'écran, x2 pour rester net
  // quand la carte zoome entre deux niveaux.
  const texelPx = (blockCss * mapPixelRatio) / N;
  const factor = Math.max(1, Math.round(texelPx * 2));
  const data = upscale(c, N, factor);
  return { data, pixelRatio: data.width / blockCss };
}

function fallbackTexture() {
  const c = canvas(2, 2);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(0, 0, 2, 2);
  return { data: ctx.getImageData(0, 0, 2, 2), pixelRatio: 0.1 };
}

/**
 * Prépare toutes les images de la carte (textures + icônes).
 * @returns {Promise<{images: Map, fromPack: number}>}
 *   images : id -> { data: ImageData, pixelRatio }
 */
export async function buildMapImages({ blockCss, pixelRatio, pack }) {
  const images = new Map();
  let fromPack = 0;

  await Promise.all(TEXTURES.map(async (def) => {
    let bmp = null;
    let isPack = false;
    const blob = pack?.textures?.[def.id];
    if (blob) {
      try { bmp = await decode(blob); isPack = true; } catch { /* image du pack illisible */ }
    }
    try {
      if (!bmp) bmp = await decode(`textures/${def.file}`);
      images.set(`tex-${def.id}`, processTexture(bmp, def, isPack, blockCss, pixelRatio));
      if (isPack) fromPack++;
    } catch (e) {
      console.warn('Texture introuvable :', def.file, e);
      images.set(`tex-${def.id}`, fallbackTexture());
    }
  }));

  await Promise.all(Object.entries(MAP_ICONS).map(async ([name, cssSize]) => {
    try {
      const bmp = await decode(iconURL(name));
      // Icône dessinée pixel pour pixel : nette quand la carte ne bouge pas.
      const factor = Math.max(1, Math.round((cssSize * pixelRatio) / bmp.width));
      images.set(`ico-${name}`, { data: upscale(bmp, bmp.width, factor), pixelRatio });
    } catch (e) {
      console.warn('Icône introuvable :', name, e);
    }
  }));

  return { images, fromPack };
}
