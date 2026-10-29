/* ============================================================
   Recherche d'adresse avec Photon (komoot), sans clé.
   Deux usages : choisir la destination, ou choisir le départ.
   ============================================================ */

import { $, el, debounce, fetchJSON, pushLayer, popLayer } from './util.js';
import { iconURL, poiIconFor } from './textures.js';

const C = self.CONFIG;

/** Transforme un résultat Photon en { lngLat, title, sub, icon }. */
function toPlace(feature) {
  const p = feature.properties || {};
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const city = p.city || p.town || p.village || p.locality || p.district || p.county || '';
  const title = p.name || street || city || p.state || 'Lieu sans nom';
  const sub = [];
  if (p.name && street) sub.push(street);
  const cityLine = [p.postcode, city].filter(Boolean).join(' ');
  if (cityLine && cityLine !== title) sub.push(cityLine);
  if (p.countrycode && p.countrycode !== 'FR' && p.country) sub.push(p.country);
  return {
    lngLat: feature.geometry.coordinates,
    title,
    sub: sub.join(', '),
    icon: poiIconFor(p.osm_value) || 'pin',
  };
}

export async function photonSearch(query, bias, signal) {
  const params = new URLSearchParams({ q: query, lang: 'fr', limit: '8' });
  if (bias) {
    params.set('lon', bias[0].toFixed(5));
    params.set('lat', bias[1].toFixed(5));
  }
  const data = await fetchJSON(`${C.PHOTON_URL}/api/?${params}`, { signal });
  const seen = new Set();
  return (data.features || []).map(toPlace).filter((pl) => {
    const key = `${pl.title}|${pl.sub}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Nom d'un point touché sur la carte (adresse la plus proche). */
export async function photonReverse(lngLat) {
  const params = new URLSearchParams({ lon: lngLat[0].toFixed(6), lat: lngLat[1].toFixed(6), lang: 'fr', limit: '1' });
  const data = await fetchJSON(`${C.PHOTON_URL}/reverse?${params}`, { timeout: 8000 });
  const f = data.features?.[0];
  return f ? toPlace(f) : null;
}

export class SearchBox {
  /**
   * @param {object} o
   * @param {() => number[]} o.getBias    position autour de laquelle chercher
   * @param {(place, target) => void} o.onPick  target = 'destination' | 'origin'
   */
  constructor({ getBias, onPick }) {
    this.getBias = getBias;
    this.onPick = onPick;
    this.target = 'destination';
    this.results = [];
    this.ctrl = null;

    this.form = $('#search-form');
    this.input = $('#search-input');
    this.list = $('#results');
    this.clearBtn = $('#search-clear');
    this.title = $('#search-title');

    const later = debounce(() => this.run(), 350);
    this.input.addEventListener('input', () => {
      this.clearBtn.hidden = !this.input.value;
      if (this.input.value.trim().length < 3) this.showInfo(this.target === 'origin' ? null : '');
      else later();
    });
    this.input.addEventListener('focus', () => {
      $('#toast').hidden = true; // le message ne doit pas cacher les résultats
      if (this.input.value.trim().length >= 3 && this.results.length) this.render();
      else if (this.target === 'origin') this.showInfo(null);
    });
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.results.length) this.pick(this.results[0]);
      else this.run();
    });
    this.clearBtn.addEventListener('click', () => {
      this.input.value = '';
      this.clearBtn.hidden = true;
      this.results = [];
      this.showInfo(this.target === 'origin' ? null : '');
      this.input.focus();
    });
    $('#search-cancel').addEventListener('click', () => this.exitOriginMode());
  }

  /** Lance la recherche Photon pour le texte tapé. */
  async run() {
    const q = this.input.value.trim();
    if (q.length < 3) return;
    this.ctrl?.abort();
    this.ctrl = new AbortController();
    this.showInfo('Recherche…');
    try {
      this.results = await photonSearch(q, this.getBias(), this.ctrl.signal);
      if (this.input.value.trim() !== q) return; // le texte a changé entre-temps
      if (!this.results.length) this.showInfo('Aucun résultat. Essaie avec la ville, ex. « gare, Lyon ».');
      else this.render();
    } catch (e) {
      if (e.kind === 'abort') return;
      this.results = [];
      this.showInfo(!navigator.onLine
        ? 'Pas de connexion Internet.'
        : 'La recherche ne répond pas (Photon). Réessaie dans un instant.');
    }
  }

  /** Affiche une ligne d'information (texte vide = liste cachée). */
  showInfo(text) {
    this.list.replaceChildren();
    if (this.target === 'origin') this.list.append(this.myPositionItem());
    if (text) this.list.append(el('li', { class: 'info', text }));
    this.list.hidden = this.list.children.length === 0;
  }

  myPositionItem() {
    return el('li', { class: 'clickable', onclick: () => this.pick(null) }, [
      el('img', { src: iconURL('player'), alt: '', class: 'px' }),
      el('div', {}, [el('div', { class: 'r-title', text: 'Ma position' }), el('div', { class: 'r-sub', text: 'Partir d\'où je suis (GPS)' })]),
    ]);
  }

  render() {
    this.list.replaceChildren();
    if (this.target === 'origin') this.list.append(this.myPositionItem());
    for (const place of this.results) {
      this.list.append(el('li', { class: 'clickable', onclick: () => this.pick(place) }, [
        el('img', { src: iconURL(place.icon), alt: '', class: 'px' }),
        el('div', {}, [
          el('div', { class: 'r-title', text: place.title }),
          place.sub ? el('div', { class: 'r-sub', text: place.sub }) : null,
        ]),
      ]));
    }
    this.list.hidden = false;
  }

  pick(place) {
    const target = this.target;
    this.close();
    if (target === 'origin') this.exitOriginMode();
    else this.input.value = place?.title || '';
    this.onPick(place, target);
  }

  /** Cache la liste et le clavier. */
  close() {
    this.ctrl?.abort();
    this.list.hidden = true;
    this.input.blur();
  }

  /** Passe en mode « choisir le départ ». */
  enterOriginMode() {
    this.target = 'origin';
    this.savedText = this.input.value;
    this.input.value = '';
    this.results = [];
    this.clearBtn.hidden = true;
    this.input.placeholder = 'Adresse de départ';
    this.title.hidden = false;
    document.body.classList.add('picking-origin');
    pushLayer('origin', () => this.exitOriginMode(true));
    this.showInfo(null);
    this.input.focus();
  }

  exitOriginMode(fromBack = false) {
    if (this.target !== 'origin') return;
    this.target = 'destination';
    this.input.value = this.savedText || '';
    this.clearBtn.hidden = !this.input.value;
    this.input.placeholder = 'Où va-t-on ?';
    this.title.hidden = true;
    document.body.classList.remove('picking-origin');
    this.close();
    if (!fromBack) popLayer('origin');
  }

  clearText() {
    this.input.value = '';
    this.clearBtn.hidden = true;
    this.results = [];
  }
}
