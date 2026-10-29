/* ============================================================
   Instructions de guidage en français, à partir des étapes OSRM.
   Ex. « Tournez à droite sur Rue de la Paix »,
       « Au rond-point, prenez la 2e sortie sur D906 »
   (Servira aussi pour la voix à l'étape 2.)
   ============================================================ */

const TURN = {
  uturn: 'faites demi-tour',
  'sharp right': 'tournez franchement à droite',
  right: 'tournez à droite',
  'slight right': 'tournez légèrement à droite',
  straight: 'continuez tout droit',
  'slight left': 'tournez légèrement à gauche',
  left: 'tournez à gauche',
  'sharp left': 'tournez franchement à gauche',
};

const SIDE = {
  'sharp right': 'à droite', right: 'à droite', 'slight right': 'à droite',
  'sharp left': 'à gauche', left: 'à gauche', 'slight left': 'à gauche',
  straight: 'tout droit', uturn: '',
};

const CARDINAL = ['le nord', 'le nord-est', "l'est", 'le sud-est', 'le sud', 'le sud-ouest', "l'ouest", 'le nord-ouest'];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ordinal = (n) => (n === 1 ? '1re' : `${n}e`);

/** Nom de la route : « Avenue Foch », « D906 », ou « Avenue Foch (D906) ». */
export function roadName(step) {
  const name = (step.name || '').trim();
  const ref = (step.ref || '').trim();
  if (name && ref && !name.includes(ref)) return `${name} (${ref})`;
  return name || ref;
}

/** Texte d'une étape, ex. « Tournez à gauche sur Rue Victor Hugo ». */
export function instructionText(step) {
  const m = step.maneuver || {};
  const mod = m.modifier || 'straight';
  const road = roadName(step);
  const on = road ? ` sur ${road}` : '';
  const toward = step.destinations ? ` vers ${step.destinations.split(':').pop().trim()}` : '';
  const side = SIDE[mod] || '';

  switch (m.type) {
    case 'depart': {
      const dir = CARDINAL[Math.round(((m.bearing_after || 0) % 360) / 45) % 8];
      return `Partez vers ${dir}${on}`;
    }
    case 'arrive':
      if (mod.includes('right')) return 'Vous êtes arrivé, destination sur votre droite';
      if (mod.includes('left')) return 'Vous êtes arrivé, destination sur votre gauche';
      return 'Vous êtes arrivé à destination';
    case 'end of road':
      return `Au bout de la route, ${TURN[mod] || 'continuez'}${on}`;
    case 'turn':
      return cap(`${TURN[mod] || 'continuez'}${on}`);
    case 'new name':
    case 'continue':
      if (mod === 'uturn') return `Faites demi-tour${on}`;
      if (mod === 'straight') return road ? `Continuez sur ${road}` : 'Continuez tout droit';
      return `Continuez ${side}${on}`;
    case 'merge': {
      const s = side && side !== 'tout droit' ? ` ${side}` : '';
      return `Insérez-vous${s}${road ? ` sur ${road}` : ''}`;
    }
    case 'on ramp':
      return `Prenez la bretelle${side && side !== 'tout droit' ? ` ${side}` : ''}${toward || on}`;
    case 'off ramp':
      return `Prenez la sortie${side && side !== 'tout droit' ? ` ${side}` : ''}${toward || on}`;
    case 'fork':
      return `À l'embranchement, restez ${side === 'tout droit' ? 'au centre' : side}${toward || on}`;
    case 'roundabout':
    case 'rotary':
      return m.exit
        ? `Au rond-point, prenez la ${ordinal(m.exit)} sortie${on}`
        : `Entrez dans le rond-point${on}`;
    case 'roundabout turn':
      return `Au rond-point, ${TURN[mod] || 'continuez'}${on}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Sortez du rond-point${on}`;
    case 'use lane':
      return mod === 'straight' ? 'Continuez tout droit' : `Restez sur la voie de ${side.replace('à ', '')}`;
    default:
      return road ? `Continuez sur ${road}` : 'Continuez';
  }
}

/** Nom de l'icône de flèche à afficher pour une étape. */
export function maneuverIcon(step) {
  const m = step.maneuver || {};
  const mod = m.modifier || 'straight';
  if (m.type === 'arrive') return 'flag-end';
  if (m.type === 'depart') return 'turn-straight';
  if (['roundabout', 'rotary', 'roundabout turn', 'exit roundabout', 'exit rotary'].includes(m.type)) return 'turn-roundabout';
  const gentle = ['fork', 'on ramp', 'off ramp', 'merge'].includes(m.type);
  if (mod === 'uturn') return 'turn-uturn';
  if (mod === 'straight') return 'turn-straight';
  if (mod.includes('right')) return gentle || mod === 'slight right' ? 'turn-slight-right' : 'turn-right';
  if (mod.includes('left')) return gentle || mod === 'slight left' ? 'turn-slight-left' : 'turn-left';
  return 'turn-straight';
}
