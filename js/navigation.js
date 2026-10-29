/* ============================================================
   Guidage en direct (étape 2)
   ------------------------------------------------------------
   - Caméra qui suit la position et tourne selon le cap
   - Bandeau d'instruction + distance avant la prochaine manœuvre
   - Annonces vocales en français
   - Détection de sortie d'itinéraire + recalcul automatique
   - Écran toujours allumé (Wake Lock)
   ============================================================ */

import { $, formatDistance, formatClock, toast, pushLayer, popLayer } from './util.js';
import { iconURL } from './textures.js';
import { instructionText, maneuverIcon } from './instructions.js';
import { distance as pointDistance, buildCumulative, projectOnRoute } from './geo.js';
import { Voice } from './voice.js';
import { fetchRoute } from './routing.js';
import { gpsErrorMessage } from './position.js';

const OFF_ROUTE_BASE_M = 40;      // distance perpendiculaire déclenchant un recalcul
const OFF_ROUTE_TICKS = 3;        // nombre de positions GPS hors route avant de recalculer
const REROUTE_COOLDOWN_MS = 12000;
const ARRIVE_M = 15;              // distance pour considérer qu'on est arrivé

// Paliers d'annonce vocale (m), du plus proche au plus loin, selon le mode.
const ANNOUNCE = { car: [20, 100, 400], bike: [20, 40, 150], foot: [15, 50] };
const NAV_ZOOM = { car: 17.3, bike: 17.8, foot: 18.3 };

export class Navigation {
  constructor(map, { position, router, settings }) {
    this.map = map;
    this.position = position;
    this.router = router;
    this.settings = settings;
    this.voice = new Voice(settings);
    this.active = false;
    this.follow = true;
    this.wakeLock = null;
    this.lastHeading = 0;
    this.offRouteCount = 0;
    this.lastRerouteAt = 0;
    this.announced = new Set();

    this._onPosition = (pos) => this.onPosition(pos);
    this._onPauseFollow = (e) => { if (e.originalEvent) this.setFollow(false); };
    this._onVisibility = () => {
      if (this.active && document.visibilityState === 'visible' && !this.wakeLock) this.requestWakeLock();
    };

    $('#nav-exit').addEventListener('click', () => this.stop());
    $('#nav-recenter').addEventListener('click', () => {
      this.setFollow(true);
      if (this.position.last) this.recenter(this.position.last);
    });
  }

  /** Démarre le guidage pour l'itinéraire actuellement affiché. */
  start() {
    if (this.active || !this.router.route) return;
    if (!this.position.supported) { toast('Le GPS n\'est pas disponible sur cet appareil.'); return; }
    if (this.position.denied) { toast(gpsErrorMessage({ code: 1 })); return; }

    this.active = true;
    this.loadRoute(this.router.route);
    this.announced.clear();
    this.offRouteCount = 0;
    this.follow = true;

    $('#route-panel').hidden = true;
    $('#toast').hidden = true; // ne pas cacher le bandeau de guidage qui arrive
    document.body.classList.add('navigating');
    $('#nav-bar').hidden = false;
    $('#nav-bottom').hidden = false;
    $('#nav-recenter').hidden = true;
    $('#nav-icon').src = iconURL('locate');
    $('#nav-dist').textContent = '';
    $('#nav-text').textContent = 'Recherche du signal GPS…';
    pushLayer('nav', () => this.stop(true));

    this.requestWakeLock();
    document.addEventListener('visibilitychange', this._onVisibility);
    this.map.on('dragstart', this._onPauseFollow);
    this.map.on('rotatestart', this._onPauseFollow);
    this.map.on('zoomstart', this._onPauseFollow);
    this.position.listeners.add(this._onPosition);
    this.position.start();

    this.voice.speak(`Départ. ${instructionText(this.steps[0])}.`, { interrupt: true });
    if (this.position.last) this.onPosition(this.position.last);
  }

  /** Arrête le guidage et revient à l'affichage normal de l'itinéraire. */
  stop(fromBack = false) {
    if (!this.active) return;
    this.active = false;
    document.body.classList.remove('navigating');
    $('#nav-bar').hidden = true;
    $('#nav-bottom').hidden = true;
    $('#nav-recenter').hidden = true;
    if (this.router.dest) $('#route-panel').hidden = false;

    this.releaseWakeLock();
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.map.off('dragstart', this._onPauseFollow);
    this.map.off('rotatestart', this._onPauseFollow);
    this.map.off('zoomstart', this._onPauseFollow);
    this.position.listeners.delete(this._onPosition);
    this.voice.stop();
    if (!fromBack) popLayer('nav');
  }

  loadRoute(route) {
    this.steps = route.legs.flatMap((leg) => leg.steps);
    this.coords = route.geometry.coordinates;
    this.cumulative = buildCumulative(this.coords);
    this.stepStart = [];
    let acc = 0;
    for (const step of this.steps) { this.stepStart.push(acc); acc += step.distance; }
    this.totalDistance = acc;
    this.totalDuration = route.duration;
  }

  setFollow(on) {
    this.follow = on;
    $('#nav-recenter').hidden = on;
  }

  recenter(pos) {
    this.map.easeTo({ center: pos.lngLat, bearing: this.lastHeading, zoom: this.navZoom(), pitch: this.navPitch(), duration: 500 });
  }

  /** Vue inclinée façon Waze quand les maisons 3D sont activées. */
  navPitch() {
    return this.settings.houses !== 'off' ? 50 : 0;
  }

  navZoom() {
    return NAV_ZOOM[this.router.mode] || NAV_ZOOM.car;
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
      }
    } catch { /* refusé (ex. batterie faible) : tant pis, l'écran pourra s'éteindre */ }
  }

  releaseWakeLock() {
    this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }

  onPosition(pos) {
    if (!this.active) return;
    const { distanceToLine, distanceAlong } = projectOnRoute(pos.lngLat, this.coords, this.cumulative);

    // --- Hors itinéraire : recalcul automatique ---
    const tolerance = pos.accuracy > 30 ? pos.accuracy - 30 : 0; // tolère un GPS imprécis
    if (distanceToLine > OFF_ROUTE_BASE_M + tolerance) {
      this.offRouteCount++;
      if (this.offRouteCount >= OFF_ROUTE_TICKS && Date.now() - this.lastRerouteAt > REROUTE_COOLDOWN_MS) {
        this.reroute(pos);
        return;
      }
    } else {
      this.offRouteCount = 0;
    }

    // --- Étape actuelle et prochaine manœuvre ---
    const progress = Math.max(0, Math.min(this.totalDistance, distanceAlong));
    let i = 0;
    while (i < this.stepStart.length - 1 && this.stepStart[i + 1] <= progress) i++;
    const upcoming = this.steps[i + 1] || this.steps[i];
    const distToManeuver = Math.max(0, (this.stepStart[i + 1] ?? this.totalDistance) - progress);
    const remaining = Math.max(0, this.totalDistance - progress);

    this.renderBanner(upcoming, distToManeuver);
    this.renderBottom(remaining, pos);
    this.maybeAnnounce(i, upcoming, distToManeuver);

    // --- Caméra qui suit et tourne selon le cap ---
    if (this.follow) {
      const heading = (pos.heading != null && !Number.isNaN(pos.heading) && (pos.speed ?? 0) > 0.8)
        ? pos.heading : this.lastHeading;
      this.lastHeading = heading;
      this.map.easeTo({ center: pos.lngLat, bearing: heading, zoom: this.navZoom(), pitch: this.navPitch(), duration: 700 });
    }

    // Arrivée : distance réelle au point final (et non la progression projetée,
    // qui peut se retrouver à 100 % si on est loin mais "au-delà" de l'arrivée).
    const destPoint = this.coords[this.coords.length - 1];
    if (pointDistance(pos.lngLat, destPoint) < ARRIVE_M && progress > 10) this.arrive();
  }

  renderBanner(step, dist) {
    $('#nav-icon').src = iconURL(maneuverIcon(step));
    $('#nav-dist').textContent = formatDistance(dist);
    $('#nav-text').textContent = instructionText(step);
  }

  renderBottom(remaining, pos) {
    const fraction = this.totalDistance > 0 ? remaining / this.totalDistance : 0;
    const eta = new Date(Date.now() + this.totalDuration * fraction * 1000);
    $('#nav-eta').textContent = formatClock(eta);
    $('#nav-remaining').textContent = formatDistance(remaining);
    const kmh = pos.speed != null && !Number.isNaN(pos.speed) ? Math.max(0, Math.round(pos.speed * 3.6)) : null;
    $('#nav-speed').textContent = kmh != null ? `${kmh} km/h` : '--';
  }

  /** Annonce vocalement la prochaine manœuvre au bon moment (plus près = plus court). */
  maybeAnnounce(stepIndex, step, dist) {
    const thresholds = ANNOUNCE[this.router.mode] || ANNOUNCE.car;
    for (let idx = 0; idx < thresholds.length; idx++) {
      const t = thresholds[idx];
      const key = `${stepIndex}-${t}`;
      if (dist <= t && !this.announced.has(key)) {
        this.announced.add(key);
        const text = idx === 0 ? instructionText(step) : `Dans ${formatDistance(dist)}, ${instructionText(step)}`;
        this.voice.speak(text);
        break;
      }
    }
  }

  async reroute(pos) {
    this.lastRerouteAt = Date.now();
    this.offRouteCount = 0;
    toast('Hors itinéraire : recalcul…');
    this.voice.speak('Recalcul de l\'itinéraire.', { interrupt: true });
    try {
      const route = await fetchRoute(this.router.mode, pos.lngLat, this.router.dest.lngLat);
      this.router.route = route;
      this.map.getSource('route')?.setData({ type: 'Feature', properties: {}, geometry: route.geometry });
      this.router.renderSummary(route);
      this.router.renderSteps(route);
      this.loadRoute(route);
      this.announced.clear();
    } catch {
      toast('Recalcul impossible : connexion ou service indisponible.');
    }
  }

  arrive() {
    this.voice.speak('Vous êtes arrivé à destination.', { interrupt: true });
    toast('Vous êtes arrivé à destination.');
    this.stop();
  }
}
