/* ============================================================
   Petits calculs géométriques pour le guidage :
   distances, cap, position par rapport à l'itinéraire.
   ============================================================ */

const EARTH_R = 6371000; // rayon de la Terre, en mètres
const toRad = (d) => (d * Math.PI) / 180;

/** Distance en mètres entre deux points [lng, lat] (formule haversine). */
export function distance(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cap en degrés (0 = nord, sens horaire) du point a vers le point b. */
export function bearing(a, b) {
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const dLng = toRad(b[0] - a[0]);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Distances cumulées (m) entre le début de la ligne et chaque point. */
export function buildCumulative(coords) {
  const cumulative = [0];
  for (let i = 1; i < coords.length; i++) {
    cumulative.push(cumulative[i - 1] + distance(coords[i - 1], coords[i]));
  }
  return cumulative;
}

/**
 * Projette un point sur une ligne brisée (plan local, assez précis à
 * l'échelle d'un itinéraire routier) : distance perpendiculaire à la
 * ligne, et distance parcourue depuis le début jusqu'au point projeté.
 */
export function projectOnRoute(point, coords, cumulative) {
  const lat0 = point[1];
  const mLat = 111320;
  const mLng = 111320 * Math.cos(toRad(lat0));
  const toXY = (p) => [(p[0] - point[0]) * mLng, (p[1] - lat0) * mLat];

  let best = Infinity;
  let bestAlong = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = toXY(coords[i]);
    const b = toXY(coords[i + 1]);
    const segLen2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    let t = 0;
    if (segLen2 > 1e-9) {
      t = (-a[0] * (b[0] - a[0]) - a[1] * (b[1] - a[1])) / segLen2;
      t = Math.max(0, Math.min(1, t));
    }
    const projX = a[0] + t * (b[0] - a[0]);
    const projY = a[1] + t * (b[1] - a[1]);
    const d = Math.hypot(projX, projY); // le point lui-même est à l'origine (0,0)
    if (d < best) {
      best = d;
      bestAlong = cumulative[i] + t * Math.sqrt(segLen2);
    }
  }
  return { distanceToLine: best === Infinity ? 0 : best, distanceAlong: bestAlong };
}
