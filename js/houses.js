/* ============================================================
   Maisons de village en 3D (étape 3)
   ------------------------------------------------------------
   Chaque bâtiment de la carte (à moins de 300 m environ) devient
   une maison en blocs : soubassement en pierre, murs, poteaux en
   rondins aux angles, porte, fenêtres et toit en escalier.
   Les grands bâtiments deviennent des immeubles en briques.

   Dessin en WebGL « brut » (sans bibliothèque 3D) pour rester
   léger sur le téléphone : une seule passe par texture.
   ============================================================ */

import { TEXTURES, HOUSE_TEXTURES } from './textures.js';

const RADIUS_M = 320;          // rayon autour du centre de la carte
const MAX_BUILDINGS = 500;     // limite pour garder la carte fluide
const MIN_ZOOM = 15;           // en dessous, pas de maisons 3D
const REBUILD_MOVE_M = 90;     // on reconstruit quand la carte a bougé de ça

/* Styles de village (inspirés des villages du jeu, selon le biome). */
export const HOUSE_STYLES = {
  plains: { base: 'cobble', wall: 'planks', pillar: 'oak_log', roof: 'planks', roofKind: 'auto' },
  taiga: { base: 'cobble', wall: 'cobble', pillar: 'spruce_log', roof: 'spruce_planks', roofKind: 'auto' },
  snowy: { base: 'cobble', wall: 'spruce_planks', pillar: 'spruce_log', roof: 'spruce_planks', roofTop: 'snow', roofKind: 'auto' },
  savanna: { base: 'cobble', wall: 'acacia_planks', pillar: 'acacia_log', roof: 'acacia_planks', roofKind: 'hip' },
  desert: { base: 'sandstone', wall: 'sandstone', pillar: 'terracotta', roof: 'sandstone', roofKind: 'flat' },
};

// Lumière simple façon jeu : dessus clair, côtés plus sombres.
const SHADE_TOP = 1.0;
const SHADE_Y = 0.8;
const SHADE_X = 0.64;

/* ---------------- Construction des formes ---------------- */

/** Accumule les triangles, rangés par texture. */
class Builder {
  constructor() { this.parts = {}; }

  quad(tex, a, b, c, d, ua, ub, uc, ud, s) {
    const arr = this.parts[tex] || (this.parts[tex] = []);
    for (const [p, u] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]) {
      arr.push(p[0], p[1], p[2], u[0], u[1], s);
    }
  }
}

/**
 * Repère d'un bâtiment : coordonnées en blocs (x le long du grand côté,
 * y en travers, z vers le haut) -> mètres autour de l'origine.
 */
function frame(cx, cy, theta, B, W, D) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return (x, y, z) => {
    const lx = (x - W / 2) * B;
    const ly = (y - D / 2) * B;
    return [cx + c * lx - s * ly, cy + s * lx + c * ly, z * B];
  };
}

/** Pavé droit (sans le dessous). top = texture du dessus (ou null). */
function box(b, P, side, top, x0, y0, z0, x1, y1, z1) {
  if (top) {
    b.quad(top, P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1),
      [x0, y0], [x1, y0], [x1, y1], [x0, y1], SHADE_TOP);
  }
  for (const y of [y0, y1]) {
    b.quad(side, P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1),
      [x0, -z0], [x1, -z0], [x1, -z1], [x0, -z1], SHADE_Y);
  }
  for (const x of [x0, x1]) {
    b.quad(side, P(x, y0, z0), P(x, y1, z0), P(x, y1, z1), P(x, y0, z1),
      [y0, -z0], [y1, -z0], [y1, -z1], [y0, -z1], SHADE_X);
  }
}

/** Image posée sur un mur (fenêtre, porte), une seule fois, sans répétition. */
function decal(b, P, tex, wall, pos, z0, W, D) {
  const e = 0.04; // juste devant le mur
  const uv = [[0, 1], [1, 1], [1, 0], [0, 0]];
  let pts;
  if (wall === 'y0') pts = [P(pos, -e, z0), P(pos + 1, -e, z0), P(pos + 1, -e, z0 + 1), P(pos, -e, z0 + 1)];
  else if (wall === 'y1') pts = [P(pos + 1, D + e, z0), P(pos, D + e, z0), P(pos, D + e, z0 + 1), P(pos + 1, D + e, z0 + 1)];
  else if (wall === 'x0') pts = [P(-e, pos + 1, z0), P(-e, pos, z0), P(-e, pos, z0 + 1), P(-e, pos + 1, z0 + 1)];
  else pts = [P(W + e, pos, z0), P(W + e, pos + 1, z0), P(W + e, pos + 1, z0 + 1), P(W + e, pos, z0 + 1)];
  const s = wall[0] === 'y' ? SHADE_Y : SHADE_X;
  b.quad(tex, pts[0], pts[1], pts[2], pts[3], uv[0], uv[1], uv[2], uv[3], s);
}

/** Maison de village (dimensions W x D en blocs). */
export function buildHouse(b, P, W, D, st) {
  const flat = st.roofKind === 'flat';
  const H = flat ? 4 : (D >= 6 ? 5 : 4); // hauteur des murs
  box(b, P, st.base, null, 0, 0, 0, W, D, 1);                   // soubassement
  box(b, P, st.wall, flat ? st.roof : null, 0, 0, 1, W, D, H);  // murs

  // Poteaux aux quatre coins
  const pillarTop = H + (flat ? 1 : 0);
  for (const [x, y] of [[0, 0], [W - 1, 0], [0, D - 1], [W - 1, D - 1]]) {
    box(b, P, st.pillar, st.pillar, x - 0.05, y - 0.05, 0, x + 1.05, y + 1.05, pillarTop);
  }

  // Porte au milieu d'un grand mur, fenêtres régulières
  const door = Math.floor(W / 2);
  decal(b, P, 'door_bottom', 'y0', door, 1, W, D);
  decal(b, P, 'door_top', 'y0', door, 2, W, D);
  for (let x = 2; x <= W - 3; x += 3) {
    if (x !== door) decal(b, P, 'glass', 'y0', x, 2, W, D);
    decal(b, P, 'glass', 'y1', x, 2, W, D);
  }
  if (D >= 5) {
    const y = Math.floor(D / 2);
    decal(b, P, 'glass', 'x0', y, 2, W, D);
    decal(b, P, 'glass', 'x1', y, 2, W, D);
  }

  if (flat) {
    // Toit plat avec un petit muret (maisons du désert)
    const z = H;
    box(b, P, st.wall, st.wall, 0, 0, z, W, 0.5, z + 0.6);
    box(b, P, st.wall, st.wall, 0, D - 0.5, z, W, D, z + 0.6);
    box(b, P, st.wall, st.wall, 0, 0, z, 0.5, D, z + 0.6);
    box(b, P, st.wall, st.wall, W - 0.5, 0, z, W, D, z + 0.6);
    return;
  }

  // Toit en escalier : à deux pans (maison allongée) ou en pyramide
  const hip = st.roofKind === 'hip' || W - D < 2;
  const roofTop = st.roofTop || st.roof;
  for (let k = 0; k < 20; k++) {
    const y0 = k - 1;
    const y1 = D - k + 1;
    const x0 = hip ? k - 1 : -0.5;
    const x1 = hip ? W - k + 1 : W + 0.5;
    if (y1 - y0 <= 0 || x1 - x0 <= 0) break;
    box(b, P, st.roof, roofTop, x0, y0, H + k, x1, y1, H + k + 1);
  }
}

/** Grand bâtiment : un bloc simple (immeuble ou entrepôt). */
function buildBlock(b, P, W, D, Hb, tall) {
  box(b, P, tall ? 'tower' : 'bricks', tall ? 'stone' : 'gravel', 0, 0, 0, W, D, Hb);
}

/** Rectangle orienté qui entoure un contour (le long de son plus grand côté). */
function orientedBox(pts) {
  let best = 0;
  let theta = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const len = dx * dx + dy * dy;
    if (len > best) { best = len; theta = Math.atan2(dy, dx); }
  }
  const c = Math.cos(-theta);
  const s = Math.sin(-theta);
  let minx = Infinity; let maxx = -Infinity; let miny = Infinity; let maxy = -Infinity;
  for (const [x, y] of pts) {
    const rx = x * c - y * s;
    const ry = x * s + y * c;
    minx = Math.min(minx, rx); maxx = Math.max(maxx, rx);
    miny = Math.min(miny, ry); maxy = Math.max(maxy, ry);
  }
  let w = maxx - minx;
  let d = maxy - miny;
  const mx = (minx + maxx) / 2;
  const my = (miny + maxy) / 2;
  const cx = mx * Math.cos(theta) - my * Math.sin(theta);
  const cy = mx * Math.sin(theta) + my * Math.cos(theta);
  if (d > w) { [w, d] = [d, w]; theta += Math.PI / 2; }
  return { cx, cy, w, d, theta };
}

/** Transforme une liste de bâtiments (contours en mètres) en triangles. */
export function buildGeometry(buildings, style) {
  const st = HOUSE_STYLES[style] || HOUSE_STYLES.plains;
  const b = new Builder();
  for (const bld of buildings) {
    const { cx, cy, w, d, theta } = orientedBox(bld.pts);
    if (w < 2.5) continue; // abri minuscule
    const h = bld.height || 0;
    if (h >= 15 || w > 30 || w * d > 500) {
      const B = 2; // une texture tous les 2 m
      const Hb = Math.min(80, Math.max(4, h || 8));
      const W = w / B;
      const D = Math.max(1, d / B);
      buildBlock(b, frame(cx, cy, theta, B, W, D), W, D, Hb / B, h >= 15);
    } else {
      // Taille d'un bloc : ~7 blocs sur le grand côté, entre 1 et 2,2 m
      const B = Math.min(2.2, Math.max(1, w / 7));
      const W = Math.max(3, Math.round(w / B));
      const D = Math.max(3, Math.round(d / B));
      buildHouse(b, frame(cx, cy, theta, B, W, D), W, D, st);
    }
  }
  return b.parts;
}

/* ---------------- Textures ---------------- */

const ALL_DEFS = [...TEXTURES, ...HOUSE_TEXTURES];

async function loadTextureCanvas(id, pack) {
  const def = ALL_DEFS.find((d) => d.id === id);
  let bmp = null;
  const blob = pack?.textures?.[id];
  if (blob) {
    try { bmp = await createImageBitmap(blob); } catch { /* image du pack illisible */ }
  }
  if (!bmp) bmp = await createImageBitmap(await (await fetch(`textures/${def.file}`)).blob());
  const n = Math.min(bmp.width, bmp.height); // 1re image si animation
  const size = n >= 32 ? 32 : 16;            // taille puissance de 2 (répétition)
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = def.under || '#6b6b6b'; // sous les parties transparentes
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bmp, 0, 0, n, n, 0, 0, size, size);
  return c;
}

/* ---------------- Couche MapLibre ---------------- */

const VERT = `
attribute vec3 a_pos;
attribute vec2 a_uv;
attribute float a_shade;
uniform mat4 u_matrix;
varying vec2 v_uv;
varying float v_shade;
void main() {
  v_uv = a_uv;
  v_shade = a_shade;
  gl_Position = u_matrix * vec4(a_pos, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
varying vec2 v_uv;
varying float v_shade;
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  gl_FragColor = vec4(c.rgb * v_shade, 1.0);
}`;

function mul(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

export class HouseLayer {
  constructor({ pack, style }) {
    this.id = 'village-3d';
    this.type = 'custom';
    this.renderingMode = '3d';
    this.pack = pack;
    this.style = style;
    this.visible = false;
    this.origin = null;
    this.parts = null;        // triangles prêts à envoyer à la carte
    this.gpu = [];            // { tex, buffer, count }
    this.textures = {};       // id -> canvas
    this.glTextures = {};     // id -> WebGLTexture
    this.needsRebuild = true;
    this.lastBuild = 0;
  }

  onAdd(map) {
    this.map = map;
    // Les textures se chargent tout de suite ; elles iront à la carte au 1er dessin.
    const ids = new Set(['door_top', 'door_bottom', 'glass', 'tower', 'stone', 'gravel', 'bricks']);
    for (const st of Object.values(HOUSE_STYLES)) {
      for (const k of ['base', 'wall', 'pillar', 'roof', 'roofTop']) if (st[k]) ids.add(st[k]);
    }
    Promise.all([...ids].map(async (id) => { this.textures[id] = await loadTextureCanvas(id, this.pack); }))
      .then(() => map.triggerRepaint())
      .catch((e) => console.warn('Textures des maisons :', e));

    this._onData = (e) => { if (e.sourceId === 'omt' && e.tile) this.needsRebuild = true; };
    this._onIdle = () => this.update();
    map.on('data', this._onData);
    map.on('idle', this._onIdle);
    this.update();
  }

  onRemove(map) {
    map.off('data', this._onData);
    map.off('idle', this._onIdle);
  }

  setStyle(style) {
    this.style = style;
    this.needsRebuild = true;
    this.update(true);
  }

  /** Reconstruit les maisons si la carte a assez bougé ou si de nouvelles données sont arrivées. */
  update(force = false) {
    const map = this.map;
    if (!map) return;
    this.visible = map.getZoom() >= MIN_ZOOM;
    if (!this.visible) return;
    const c = map.getCenter();
    const moved = !this.origin
      || Math.hypot((c.lng - this.origin[0]) * 111320 * Math.cos((c.lat * Math.PI) / 180), (c.lat - this.origin[1]) * 110540) > REBUILD_MOVE_M;
    if (!force && !moved && !(this.needsRebuild && Date.now() - this.lastBuild > 1500)) return;
    this.rebuild();
  }

  rebuild() {
    const map = this.map;
    const c = map.getCenter();
    const lng0 = c.lng;
    const lat0 = c.lat;
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const ky = 110540;
    const found = new Map();
    let features = [];
    try {
      features = map.querySourceFeatures('omt', { sourceLayer: 'building' });
    } catch { return; }
    for (const f of features) {
      if (f.properties?.hide_3d) continue;
      const g = f.geometry;
      const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : [];
      rings.forEach((ring, idx) => {
        if (!ring || ring.length < 4) return;
        const pts = ring.map(([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * ky]);
        let sx = 0; let sy = 0; let area = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          sx += pts[i][0]; sy += pts[i][1];
          area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
        }
        const n = pts.length - 1;
        const dist = Math.hypot(sx / n, sy / n);
        if (dist > RADIUS_M) return;
        // Un bâtiment peut apparaître dans 2 tuiles : on garde le plus grand morceau.
        const key = f.id != null ? `${f.id}-${idx}` : `${Math.round(sx / n)},${Math.round(sy / n)}`;
        const prev = found.get(key);
        if (!prev || Math.abs(area) > prev.area) {
          found.set(key, { pts, dist, area: Math.abs(area), height: f.properties?.render_height || 0 });
        }
      });
    }
    const list = [...found.values()].sort((a, b) => a.dist - b.dist).slice(0, MAX_BUILDINGS);
    this.parts = buildGeometry(list, this.style);
    this.origin = [lng0, lat0];
    this.needsRebuild = false;
    this.lastBuild = Date.now();
    this.uploadNeeded = true;
    map.triggerRepaint();
  }

  initGL(gl) {
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.program = p;
    this.loc = {
      pos: gl.getAttribLocation(p, 'a_pos'),
      uv: gl.getAttribLocation(p, 'a_uv'),
      shade: gl.getAttribLocation(p, 'a_shade'),
      matrix: gl.getUniformLocation(p, 'u_matrix'),
      tex: gl.getUniformLocation(p, 'u_tex'),
    };
  }

  /** Envoie à la carte les textures prêtes et les triangles reconstruits. */
  upload(gl) {
    for (const [id, cnv] of Object.entries(this.textures)) {
      if (this.glTextures[id]) continue;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cnv);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);       // pixels nets de près
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR); // pas de scintillement de loin
      this.glTextures[id] = t;
    }
    if (this.uploadNeeded && this.parts) {
      for (const g of this.gpu) gl.deleteBuffer(g.buffer);
      this.gpu = [];
      for (const [tex, arr] of Object.entries(this.parts)) {
        if (!arr.length) continue;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
        this.gpu.push({ tex, buffer, count: arr.length / 6 });
      }
      this.uploadNeeded = false;
      this.parts = null; // libère la mémoire côté JavaScript
    }
  }

  render(gl, args) {
    if (!this.visible || !this.origin) return;
    if (gl.bindVertexArray) gl.bindVertexArray(null);
    else gl.getExtension('OES_vertex_array_object')?.bindVertexArrayOES(null);
    if (!this.program) this.initGL(gl);
    this.upload(gl);
    if (!this.gpu.length) return;

    // Matrice : mètres autour de l'origine -> écran
    const mc = maplibregl.MercatorCoordinate.fromLngLat(this.origin, 0);
    const s = mc.meterInMercatorCoordinateUnits();
    const model = [s, 0, 0, 0, 0, -s, 0, 0, 0, 0, s, 0, mc.x, mc.y, 0, 1];
    const matrix = mul(args.defaultProjectionData.mainMatrix, model);

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.loc.matrix, false, matrix);
    gl.uniform1i(this.loc.tex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    gl.enableVertexAttribArray(this.loc.pos);
    gl.enableVertexAttribArray(this.loc.uv);
    gl.enableVertexAttribArray(this.loc.shade);
    for (const g of this.gpu) {
      const t = this.glTextures[g.tex];
      if (!t) continue;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.buffer);
      gl.vertexAttribPointer(this.loc.pos, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(this.loc.uv, 2, gl.FLOAT, false, 24, 12);
      gl.vertexAttribPointer(this.loc.shade, 1, gl.FLOAT, false, 24, 20);
      gl.drawArrays(gl.TRIANGLES, 0, g.count);
    }
    gl.disableVertexAttribArray(this.loc.pos);
    gl.disableVertexAttribArray(this.loc.uv);
    gl.disableVertexAttribArray(this.loc.shade);
  }
}
