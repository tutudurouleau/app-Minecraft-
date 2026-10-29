# 🧱 BlocNav : GPS au style « blocs »

App de navigation perso, gratuite, au look pixel-art (herbe, eau, forêts, toits en planches…).
C'est une **web app installable** (PWA) : pas d'APK, rien à payer, aucune clé.

**État : étape 1 terminée ✅**
- Carte pixelisée avec textures originales (dossier `textures/`)
- Recherche d'adresse (Photon)
- Itinéraire voiture / vélo / à pied, distance, durée, heure d'arrivée, liste des étapes en français
- Import de ton pack de textures (.zip ou .jar), gardé **uniquement sur le téléphone**
- Mode hors-ligne : l'app et les zones déjà vues restent disponibles

À venir : étape 2 (guidage GPS en direct + voix), étape 3 (3D, maisons de village, biomes, météo).

---

## 🚀 Mettre l'app en ligne (une seule fois, depuis le téléphone)

Tout se fait dans Chrome sur **github.com**. Si un menu n'apparaît pas, active
« Version pour ordinateur » dans le menu ⋮ de Chrome.

**1. Rendre le dépôt public** (obligatoire pour GitHub Pages gratuit)
1. Ouvre https://github.com/tutudurouleau/app-Minecraft-
2. Onglet **Settings** → tout en bas, **Danger Zone** → **Change visibility** → **Public** → confirme.

   Le dépôt ne contient que le code et les textures originales : rien de personnel.

**2. Activer GitHub Pages**
1. Toujours dans **Settings**, menu de gauche : **Pages**.
2. *Build and deployment* → Source : **Deploy from a branch**.
3. Branch : choisis **`ccr-7fee3087-u25h7o`**, dossier **`/ (root)`**, puis **Save**.
4. Attends 1 à 2 minutes et recharge la page : l'adresse de ton app s'affiche en haut :
   **https://tutudurouleau.github.io/app-Minecraft-/**

Les prochaines mises à jour envoyées sur cette branche seront en ligne automatiquement.

## 📲 Installer sur le téléphone

1. Ouvre l'adresse ci-dessus dans **Chrome**.
2. Menu **⋮** → **Ajouter à l'écran d'accueil** → **Installer**.
3. L'icône BlocNav apparaît : l'app s'ouvre en plein écran, comme une vraie app.
4. Autorise la **localisation** quand Chrome la demande.

## 🗺️ Utilisation

- **Barre du haut** : tape une adresse ou un lieu (« boulangerie Lyon »), puis touche un résultat.
- **Appui long sur la carte** : choisit ce point comme destination.
- **Panneau du bas** : mode Voiture / Vélo / À pied, durée, distance, heure d'arrivée.
  « Voir les étapes » liste les virages (touche une étape pour la voir sur la carte).
- **Départ** : par défaut ta position GPS. « Changer » pour partir d'une autre adresse.
- **Boutons à droite** : 🎯 ma position, ⚙️ réglages. La boussole apparaît si tu tournes la carte.
- Le bouton **retour** d'Android ferme le panneau ouvert.

## 🏘️ Village en 3D

Les bâtiments proches (300 m autour) deviennent des maisons de village en blocs :
soubassement en pierre, poteaux en rondins, porte, fenêtres, toit en escalier.
Les grands bâtiments deviennent des immeubles.

- **Incline la carte** en glissant **deux doigts** vers le haut. La boussole remet la carte à plat.
- Pendant le guidage, la vue s'incline toute seule (façon Waze).
- **⚙️ Réglages → Village 3D** : maisons oui/non, et style du village :
  Plaine, Taïga, Neige, Savane ou Désert (« Auto » = Plaine pour l'instant).
- Avec un pack importé, les murs et toits prennent les vraies textures du jeu
  (planches, rondins, pierre, grès, vitres, portes…).

## 🎨 Mettre tes textures Minecraft

Dans **⚙️ Réglages → Importer un pack (.zip / .jar)**, choisis :
- un **resource pack** (.zip), par ex. un pack téléchargé ;
- ou le **fichier du jeu Java** : sur le PC, `%appdata%\.minecraft\versions\<version>\<version>.jar`
  (copie-le sur le téléphone).

L'app n'en garde qu'une vingtaine d'images (herbe, terre, sable, eau, pierre, planches, rails…),
stockées **dans le téléphone uniquement**. « Revenir aux textures originales » les efface.

> ⚠️ **Ne mets jamais les textures du jeu dans ce dépôt GitHub** : il est public,
> n'importe qui pourrait les télécharger. L'import dans l'app suffit.

## ⚙️ Réglages disponibles

- **Pixelisation** : Forte / Moyenne / Aucune. Plus c'est pixelisé, moins le téléphone chauffe.
- **Taille des blocs** : Petits / Moyens / Grands.
- **Hors-ligne** : nombre de morceaux de carte gardés, bouton pour vider le cache.

## 🔧 Si un service ne marche plus

Les adresses des services gratuits sont dans **`config.js`** (carte, recherche, itinéraires).
Pour en changer : ouvre le fichier sur GitHub → crayon ✏️ → modifie l'adresse → **Commit changes**.

## 📁 Organisation des fichiers

| Fichier / dossier | Rôle |
|---|---|
| `index.html` | La page de l'app (boutons, panneaux) |
| `style.css` | Le style « menus en blocs » |
| `app.js` | Démarrage : relie la carte, la recherche, l'itinéraire |
| `config.js` | **Adresses des services** (à modifier si besoin) |
| `js/map-style.js` | Quelle texture pour quel terrain (forêt, eau, routes…) |
| `js/textures.js` | Liste des textures et noms dans un pack |
| `js/texture-pack.js` | Import d'un pack .zip / .jar |
| `js/search.js` | Recherche d'adresse (Photon) |
| `js/routing.js` | Calcul et affichage de l'itinéraire (OSRM) |
| `js/instructions.js` | Phrases de guidage en français |
| `js/position.js` | GPS et flèche de position |
| `js/settings.js` | Panneau de réglages |
| `sw.js` | Mode hors-ligne (service worker) |
| `manifest.webmanifest` | Nom, icône, plein écran de l'app installée |
| `textures/` | Textures originales 16x16 et icônes pixel-art |
| `lib/`, `fonts/` | MapLibre, JSZip et la police Tiny5 (inclus pour marcher hors-ligne) |
| `tools/generate_textures.py` | Script qui a dessiné les textures et icônes |

## ⚠️ Limites connues

- Le GPS ne suit pas **écran éteint** ou app en arrière-plan : garde l'écran allumé (support + chargeur).
  Sous MIUI : Réglages → Applications → Chrome → Économiseur de batterie → **Aucune restriction**.
- **Pas de trafic en direct** : les durées sont théoriques.
- Les serveurs gratuits n'ont pas de garantie : en cas de panne, l'app affiche un message
  et tu peux changer l'adresse dans `config.js`.
- Pas compatible CarPlay / Android Auto (sauf recopie d'écran).

## Crédits

- Données cartographiques : © OpenStreetMap contributors (ODbL), tuiles OpenFreeMap / OpenMapTiles
- Recherche : Photon (komoot). Itinéraires : OSRM, serveurs FOSSGIS (routing.openstreetmap.de)
- MapLibre GL JS (licence BSD-3, `lib/LICENSE-maplibre.txt`), JSZip (MIT, `lib/LICENSE-jszip.md`)
- Police Tiny5 (SIL Open Font License, `fonts/OFL.txt`)
- Textures et icônes : dessinées pour ce projet (`tools/generate_textures.py`), aucune image officielle de Minecraft
