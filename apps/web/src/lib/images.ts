import type { LocalizedText } from "./types";

export interface SiteImage {
  src: string;
  alt: LocalizedText;
}

const img = (file: string, en: string, fr: string): SiteImage => ({
  src: `/images/photos/${file}`,
  alt: { en, fr },
});

/** Real construction photography (Pexels, commercial-use). */
export const PHOTOS = {
  heroHome: img("hero-custom-home.jpg", "Modern luxury custom home", "Maison de luxe moderne"),
  heroSite: img("hero-construction-site.jpg", "Active residential construction site", "Chantier de construction résidentielle en cours"),
  framing: img("framing-timber.jpg", "Timber framing of a new home", "Charpente en bois d’une maison neuve"),
  team: img("team-workers.jpg", "Construction team reviewing plans on site", "L’équipe examinant les plans sur le chantier"),
  blueprint: img("blueprint-planning.jpg", "Reviewing building blueprints and plans", "Examen des plans de construction"),
  kitchen: img("kitchen-modern.jpg", "Modern renovated kitchen", "Cuisine moderne rénovée"),
  bathroom: img("bathroom-luxury.jpg", "Luxury renovated bathroom", "Salle de bain de luxe rénovée"),
  basement: img("basement-finished.jpg", "Finished basement living space", "Espace de vie au sous-sol aménagé"),
  livingRoom: img("living-room-luxury.jpg", "Bright upscale living room", "Salon haut de gamme lumineux"),
  addition: img("home-addition.jpg", "Home addition and extension", "Agrandissement et extension de maison"),
  commercial: img("commercial-building.jpg", "Modern commercial building", "Bâtiment commercial moderne"),
  exteriorDetail: img("exterior-detail.jpg", "Architectural exterior craftsmanship detail", "Détail de savoir-faire extérieur"),
  tools: img("contractor-tools.jpg", "Construction tools and craftsmanship", "Outils de construction et savoir-faire"),
  foundation: img("concrete-foundation.jpg", "Concrete foundation work", "Travaux de fondation en béton"),
  roof: img("roof-work.jpg", "Roofing work on a house", "Travaux de toiture sur une maison"),
  aerial: img("neighbourhood-aerial.jpg", "Aerial view of a GTA residential neighbourhood", "Vue aérienne d’un quartier résidentiel de la RGT"),
  staircase: img("interior-staircase.jpg", "Elegant modern interior staircase", "Escalier intérieur moderne et élégant"),
  exteriorNight: img("exterior-night.jpg", "Luxury home exterior at dusk", "Extérieur de maison de luxe au crépuscule"),
  renovation: img("renovation-progress.jpg", "Interior renovation in progress", "Rénovation intérieure en cours"),
  handshake: img("handshake-client.jpg", "Meeting with happy clients", "Rencontre avec des clients satisfaits"),
  skyline: img("toronto-skyline.jpg", "Toronto skyline", "Ligne d’horizon de Toronto"),
  portrait: img("worker-portrait.jpg", "Confident construction foreman", "Contremaître confiant"),
} as const;

/** Maps a service/project category id to a representative photo. */
export const CATEGORY_PHOTOS: Record<string, SiteImage> = {
  custom_home: PHOTOS.heroHome,
  home_addition: PHOTOS.addition,
  renovation: PHOTOS.renovation,
  kitchen_bath: PHOTOS.kitchen,
  basement: PHOTOS.basement,
  commercial: PHOTOS.commercial,
  design_build: PHOTOS.blueprint,
  other: PHOTOS.exteriorDetail,
};

/** Per-project gallery images, keyed by the project id in the dictionaries. */
export const PROJECT_PHOTOS: Record<string, SiteImage> = {
  p1: PHOTOS.heroHome,
  p2: PHOTOS.addition,
  p3: PHOTOS.kitchen,
  p4: PHOTOS.livingRoom,
  p5: PHOTOS.basement,
  p6: PHOTOS.bathroom,
  p7: PHOTOS.commercial,
  p8: PHOTOS.exteriorNight,
};

export function categoryPhoto(id: string): SiteImage {
  return CATEGORY_PHOTOS[id] ?? PHOTOS.exteriorDetail;
}

export function projectPhoto(id: string): SiteImage {
  return PROJECT_PHOTOS[id] ?? PHOTOS.heroHome;
}

export const OG_IMAGE = "/images/photos/hero-custom-home.jpg";
