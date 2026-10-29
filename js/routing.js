/* ============================================================
   Itinéraire : calcul (OSRM), tracé rouge, panneau du bas.
   ============================================================ */

import { $, el, fetchJSON, formatDistance, formatDuration, formatClock, pushLayer, popLayer } from './util.js';
import { iconURL } from './textures.js';
import { instructionText, maneuverIcon } from './instructions.js';
import { gpsErrorMessage } from './position.js';

const C = self.CONFIG;
const EMPTY = { type: 'FeatureCollection', features: [] };
const MODE_NAMES = { car: 'en voiture', bike: 'à vélo', foot: 'à pied' };

/** Demande un itinéraire à OSRM. from/to = [lng, lat]. */
export async function fetchRoute(mode, from, to, signal) {
  const base = C.ROUTING[mode];
  const coords = `${from[0].toFixed(6)},${from[1].toFixed(6)};${to[0].toFixed(6)},${to[1].toFixed(6)}`;
  const url = `${base}/${coords}?overview=full&geometries=geojson&steps=true&alternatives=false`;
  let data;
  try {
    data = await fetchJSON(url, { signal });
  } catch (e) {
    if (e.kind === 'http' && e.body?.code) data = e.body; // OSRM explique l'erreur
    else throw e;
  }
  if (data.code !== 'Ok' || !data.routes?.length) {
    const err = new Error(data.code || 'NoRoute');
    err.kind = 'noroute';
    throw err;
  }
  return data.routes[0];
}

function routeErrorMessage(e) {
  if (e.kind === 'noroute') return 'Aucun itinéraire trouvé entre ces deux points.';
  if (!navigator.onLine) return 'Pas de connexion Internet.';
  if (e.kind === 'timeout') return 'Le service d\'itinéraire met trop de temps à répondre.';
  return 'Le service d\'itinéraire ne répond pas. Réessaie, ou change son adresse dans config.js.';
}

export class Router {
  constructor(map, { position, settings, saveSettings, search }) {
    this.map = map;
    this.position = position;
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.search = search;
    this.dest = null;     // { lngLat, title, sub }
    this.origin = null;   // null = ma position GPS
    this.route = null;
    this.ctrl = null;

    this.panel = $('#route-panel');
    this.summary = $('#route-summary');
    this.stepsList = $('#steps');
    this.stepsBtn = $('#btn-steps');

    $('#route-close').addEventListener('click', () => this.clear());
    $('#origin-change').addEventListener('click', () => this.search.enterOriginMode());
    this.stepsBtn.addEventListener('click', () => this.toggleSteps());
    for (const btn of document.querySelectorAll('.modes .mode')) {
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
    }
    this.updateModeButtons();
  }

  get mode() {
    return this.settings.mode;
  }

  setMode(mode) {
    if (!C.ROUTING[mode] || mode === this.mode) return;
    this.settings.mode = mode;
    this.saveSettings();
    this.updateModeButtons();
    if (this.dest) this.compute();
  }

  updateModeButtons() {
    for (const btn of document.querySelectorAll('.modes .mode')) {
      const on = btn.dataset.mode === this.mode;
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-checked', String(on));
    }
  }

  setDestination(place) {
    this.dest = place;
    $('#dest-name').textContent = place.title;
    $('#dest-sub').textContent = place.sub || '';
    this.showPanel();
    this.compute();
  }

  /** place = null pour « Ma position ». */
  setOrigin(place) {
    this.origin = place;
    $('#origin-name').textContent = place ? place.title : 'Ma position';
    if (this.dest) this.compute();
  }

  /** Met à jour les noms affichés (ex. après avoir trouvé l'adresse d'un point). */
  refreshLabels() {
    if (this.dest) {
      $('#dest-name').textContent = this.dest.title;
      $('#dest-sub').textContent = this.dest.sub || '';
    }
    $('#origin-name').textContent = this.origin ? this.origin.title : 'Ma position';
  }

  showPanel() {
    if (this.panel.hidden) {
      this.panel.hidden = false;
      document.body.classList.add('has-sheet');
      pushLayer('route', () => this.clear(true));
    }
  }

  /** Ferme l'itinéraire et efface le tracé. */
  clear(fromBack = false) {
    this.ctrl?.abort();
    this.dest = null;
    this.route = null;
    this.panel.hidden = true;
    document.body.classList.remove('has-sheet');
    this.stepsList.hidden = true;
    $('#btn-start-nav').hidden = true;
    this.map.getSource('route')?.setData(EMPTY);
    this.map.getSource('markers')?.setData(EMPTY);
    this.search.clearText();
    if (!fromBack) popLayer('route');
  }

  async compute() {
    this.ctrl?.abort();
    const ctrl = (this.ctrl = new AbortController());
    this.route = null;
    this.stepsBtn.hidden = true;
    this.stepsList.hidden = true;
    $('#btn-start-nav').hidden = true;
    this.map.getSource('route')?.setData(EMPTY);
    this.drawMarkers(null);
    this.summary.replaceChildren(el('span', { class: 'loading', text: 'Calcul de l\'itinéraire' }));

    let from;
    if (this.origin) {
      from = this.origin.lngLat;
    } else {
      try {
        from = (await this.position.get()).lngLat;
      } catch (e) {
        if (ctrl.signal.aborted) return;
        this.showError(`${gpsErrorMessage(e)} Tu peux aussi choisir un départ avec « Changer ».`);
        this.fitTo([this.dest.lngLat]);
        return;
      }
    }
    if (ctrl.signal.aborted) return;
    this.drawMarkers(from);

    try {
      const route = await fetchRoute(this.mode, from, this.dest.lngLat, ctrl.signal);
      if (ctrl.signal.aborted) return;
      this.route = route;
      this.map.getSource('route').setData({ type: 'Feature', properties: {}, geometry: route.geometry });
      this.renderSummary(route);
      this.renderSteps(route);
      this.fitTo(route.geometry.coordinates);
      $('#btn-start-nav').hidden = false;
    } catch (e) {
      if (e.kind === 'abort' || ctrl.signal.aborted) return;
      this.showError(routeErrorMessage(e));
      this.fitTo([from, this.dest.lngLat]);
    }
  }

  showError(msg) {
    $('#btn-start-nav').hidden = true;
    this.summary.replaceChildren(
      el('span', { class: 'err', text: msg }),
      el('button', { class: 'link-btn', text: 'Réessayer', onclick: () => this.compute() }),
    );
  }

  drawMarkers(from) {
    const features = [];
    if (from && this.origin) {
      features.push({ type: 'Feature', properties: { icon: 'ico-flag-start' }, geometry: { type: 'Point', coordinates: from } });
    }
    if (this.dest) {
      features.push({ type: 'Feature', properties: { icon: 'ico-pin' }, geometry: { type: 'Point', coordinates: this.dest.lngLat } });
    }
    this.map.getSource('markers')?.setData({ type: 'FeatureCollection', features });
  }

  renderSummary(route) {
    const eta = new Date(Date.now() + route.duration * 1000);
    this.summary.replaceChildren(
      el('span', { class: 'big', text: formatDuration(route.duration) }),
      el('span', { class: 'mid', text: formatDistance(route.distance) }),
      el('span', { class: 'eta', text: `Arrivée vers ${formatClock(eta)}` }),
      el('span', { class: 'note', text: `Itinéraire ${MODE_NAMES[this.mode]}. Durée théorique, sans trafic.` }),
    );
  }

  renderSteps(route) {
    const steps = route.legs.flatMap((leg) => leg.steps);
    this.stepsList.replaceChildren(...steps.map((step) => el('li', {
      onclick: () => this.map.flyTo({ center: step.maneuver.location, zoom: 17, duration: 900 }),
    }, [
      el('span', { class: 's-icon' }, [el('img', { src: iconURL(maneuverIcon(step)), alt: '', class: 'px' })]),
      el('span', { class: 's-text', text: instructionText(step) }),
      step.distance > 0 ? el('span', { class: 's-dist', text: formatDistance(step.distance) }) : null,
    ])));
    $('#btn-steps-label').textContent = `Voir les étapes (${steps.length})`;
    this.stepsBtn.hidden = false;
  }

  toggleSteps() {
    this.stepsList.hidden = !this.stepsList.hidden;
    $('#btn-steps-label').textContent = this.stepsList.hidden
      ? `Voir les étapes (${this.stepsList.children.length})`
      : 'Cacher les étapes';
  }

  /** Cadre la carte sur des points, sans les cacher sous les panneaux. */
  fitTo(coords) {
    if (!coords?.length) return;
    const bounds = [[Infinity, Infinity], [-Infinity, -Infinity]];
    for (const [lng, lat] of coords) {
      bounds[0][0] = Math.min(bounds[0][0], lng);
      bounds[0][1] = Math.min(bounds[0][1], lat);
      bounds[1][0] = Math.max(bounds[1][0], lng);
      bounds[1][1] = Math.max(bounds[1][1], lat);
    }
    const landscape = window.matchMedia('(orientation: landscape) and (max-height: 560px)').matches;
    const top = $('#top').getBoundingClientRect().bottom + 24;
    const padding = landscape
      ? { top: 40, bottom: 40, left: this.panel.getBoundingClientRect().right + 30, right: 80 }
      : { top, bottom: window.innerHeight - this.panel.getBoundingClientRect().top + 30, left: 40, right: 70 };
    // Évite un cadrage impossible sur un petit écran.
    const maxV = window.innerHeight - 60;
    if (padding.top + padding.bottom > maxV) padding.bottom = Math.max(20, maxV - padding.top);
    this.map.fitBounds(bounds, { padding, maxZoom: 17, duration: 800 });
  }
}
