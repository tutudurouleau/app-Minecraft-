/* Position GPS en temps réel + flèche du joueur sur la carte. */

import { iconURL } from './textures.js';

export class Position {
  constructor(map) {
    this.map = map;
    this.last = null;        // { lngLat: [lng, lat], accuracy, heading, speed, time }
    this.denied = false;
    this.watchId = null;
    this.heading = 0;
    this.listeners = new Set();
    this.errorListeners = new Set();
    this.onMap = false;

    const el = document.createElement('div');
    el.className = 'player-marker';
    el.innerHTML = `<img src="${iconURL('player')}" alt="">`;
    this.el = el;
    // rotationAlignment 'map' : la flèche indique le cap par rapport au nord.
    this.marker = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' });

    // Flèche à moitié transparente si le GPS ne donne plus de nouvelles.
    setInterval(() => {
      el.classList.toggle('stale', !!this.last && Date.now() - this.last.time > 30000);
    }, 5000);
  }

  get supported() {
    return 'geolocation' in navigator;
  }

  start() {
    if (!this.supported || this.watchId != null) return;
    this.watchId = navigator.geolocation.watchPosition(
      (p) => this._onPosition(p),
      (e) => this._onError(e),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 },
    );
  }

  _onPosition(p) {
    const { longitude, latitude, accuracy, heading, speed } = p.coords;
    this.last = { lngLat: [longitude, latitude], accuracy, heading, speed, time: Date.now() };
    this.denied = false;
    // Le cap GPS n'est fiable qu'en mouvement.
    if (heading != null && !Number.isNaN(heading) && (speed ?? 0) > 0.8) this.heading = heading;
    this.marker.setLngLat(this.last.lngLat).setRotation(this.heading);
    if (!this.onMap) {
      this.marker.addTo(this.map);
      this.onMap = true;
    }
    this.el.classList.remove('stale');
    this.listeners.forEach((fn) => fn(this.last));
  }

  _onError(e) {
    if (e.code === 1) this.denied = true; // permission refusée
    this.errorListeners.forEach((fn) => fn(e));
  }

  onUpdate(fn) {
    this.listeners.add(fn);
  }

  onError(fn) {
    this.errorListeners.add(fn);
  }

  /** Donne la position actuelle (attend le premier signal GPS si besoin). */
  get(timeoutMs = 15000) {
    if (this.last && Date.now() - this.last.time < 120000) return Promise.resolve(this.last);
    if (!this.supported) return Promise.reject(Object.assign(new Error('unsupported'), { code: 2 }));
    if (this.denied) return Promise.reject(Object.assign(new Error('denied'), { code: 1 }));
    this.start();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.listeners.delete(ok);
        this.errorListeners.delete(ko);
      };
      const ok = (pos) => { cleanup(); resolve(pos); };
      const ko = (err) => { if (err.code === 1) { cleanup(); reject(err); } };
      const timer = setTimeout(() => { cleanup(); reject(Object.assign(new Error('timeout'), { code: 3 })); }, timeoutMs);
      this.listeners.add(ok);
      this.errorListeners.add(ko);
    });
  }
}

/** Message clair pour une erreur de GPS. */
export function gpsErrorMessage(err) {
  if (err?.code === 1) return 'Accès à la position refusé. Autorise la localisation pour ce site dans Chrome.';
  if (err?.code === 3) return 'Le GPS ne répond pas encore. Va près d\'une fenêtre ou dehors, puis réessaie.';
  return 'Position GPS indisponible sur cet appareil.';
}
