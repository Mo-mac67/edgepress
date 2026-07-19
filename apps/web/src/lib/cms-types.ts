/**
 * CMS content model — shared between server (store/render) and client (editor).
 * NO "server-only" import here so the block editor can use the schema too.
 */
import type { Locale } from "@/i18n/config";

export type Localized = { en: string; fr: string };

export interface Block {
  id: string;
  type: BlockType;
  /** Field values keyed by field key. Localized fields hold {en,fr}; lists hold arrays. */
  data: Record<string, unknown>;
}

export interface Page {
  id: string;
  slug: string; // "" = home
  status: "published" | "draft";
  title: Localized;
  /** SEO description. */
  description: Localized;
  blocks: Block[];
  /** "blocks" (default) renders the block list; "html" renders rawHtml as-is. */
  mode?: "blocks" | "html";
  /** Full HTML document or fragment for mode:"html" (drag-and-drop imports). */
  rawHtml?: string;
  /** For mode:"html": hide the site header/footer so the page is standalone. */
  hideChrome?: boolean;
  /** System pages (home, contact) can't be deleted but are fully editable. */
  system?: boolean;
  /** Per-page SEO overrides (managed in the editor + SEO tab). */
  seo?: {
    ogImage?: string;
    keywords?: string;
    noindex?: boolean;
  };
  updatedAt: string;
}

export interface NavItem {
  id: string;
  label: Localized;
  /** Internal slug (relative, no locale) or full external URL. */
  href: string;
  external?: boolean;
}

export interface Post {
  id: string;
  slug: string;
  status: "published" | "draft";
  title: Localized;
  excerpt: Localized;
  cover: string;
  body: Localized; // rich HTML
  date: string;
  author: string;
}

export interface MediaItem {
  id: string;
  key: string; // R2 object key
  url: string; // public path (/api/media/<key>)
  filename: string;
  size: number;
  /** "image" (default) or "video" — drives previews and pickers. */
  kind?: "image" | "video";
  /** AI-generated (or hand-written) alt text. */
  alt?: string;
  uploadedAt: string;
}

export interface SiteSettings {
  brandName: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
  /** Short kicker shown beside the header wordmark on wide screens. */
  headerTagline: Localized;
  footerTagline: Localized;
  licenseNote: Localized;
  serviceAreas: string[];
  social: { facebook: string; instagram: string; linkedin: string; youtube: string };
}

export function tx(v: unknown, locale: Locale): string {
  if (v && typeof v === "object" && locale in (v as Localized)) return (v as Localized)[locale] ?? "";
  return typeof v === "string" ? v : "";
}

// ─── Block schema (drives the generic editor + defaults) ────────────────
export type FieldType = "text" | "textarea" | "richtext" | "image" | "url" | "select" | "toggle" | "list";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  localized?: boolean;
  options?: { value: string; label: string }[];
  /** For list fields: the schema of each item. */
  itemFields?: FieldDef[];
  addLabel?: string;
}

export interface BlockDef {
  label: string;
  /** Icon name from components/Icon. */
  icon: string;
  fields: FieldDef[];
  defaults: () => Record<string, unknown>;
}

export type BlockType =
  | "slideshow"
  | "hero"
  | "header"
  | "richtext"
  | "image"
  | "imageText"
  | "cards"
  | "stats"
  | "steps"
  | "gallery"
  | "testimonials"
  | "cta"
  | "faq"
  | "contactForm"
  | "video"
  | "embed"
  | "beforeAfter"
  | "featuredProject"
  | "youtubeFeed"
  | "html"
  | "spacer";

const L = (en = "", fr = ""): Localized => ({ en, fr });

const ICON_OPTIONS = [
  "check", "shield", "hammer", "award", "home", "building", "tools", "star", "phone", "clock", "ruler", "hard-hat",
].map((v) => ({ value: v, label: v }));

export const BLOCKS: Record<BlockType, BlockDef> = {
  slideshow: {
    label: "Fullscreen slideshow (hero)",
    icon: "image",
    fields: [
      { key: "title", label: "Slogan (centered, faded)", type: "text", localized: true },
      {
        key: "certLogos",
        label: "Certification logos (upload the official badge images)",
        type: "list",
        addLabel: "Add logo",
        itemFields: [
          { key: "image", label: "Logo image (PNG/SVG)", type: "image" },
          { key: "label", label: "Name (accessibility only)", type: "text" },
          { key: "href", label: "Link (optional)", type: "url" },
        ],
      },
      { key: "buttonLabel", label: "Button label", type: "text", localized: true },
      { key: "buttonHref", label: "Button link", type: "url" },
      {
        key: "images",
        label: "Slides (full-screen photos, auto-rotate)",
        type: "list",
        addLabel: "Add slide",
        itemFields: [{ key: "image", label: "Image", type: "image" }],
      },
    ],
    defaults: () => ({ title: L(), certLogos: [], buttonLabel: L(), buttonHref: "", images: [] }),
  },
  hero: {
    label: "Hero banner",
    icon: "star",
    fields: [
      { key: "image", label: "Background image (also the video poster)", type: "image" },
      { key: "video", label: "Background video (optional, MP4/WebM from Media)", type: "image" },
      { key: "stars", label: "Show ★★★★★ rating line", type: "toggle" },
      { key: "eyebrow", label: "Eyebrow", type: "text", localized: true },
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "subtitle", label: "Subtitle", type: "textarea", localized: true },
      { key: "primaryLabel", label: "Primary button", type: "text", localized: true },
      { key: "primaryHref", label: "Primary link", type: "url" },
      { key: "secondaryLabel", label: "Secondary button", type: "text", localized: true },
      { key: "secondaryHref", label: "Secondary link", type: "url" },
    ],
    defaults: () => ({
      image: "",
      video: "",
      stars: false,
      eyebrow: L(),
      title: L("New page"),
      subtitle: L(),
      primaryLabel: L(),
      primaryHref: "",
      secondaryLabel: L(),
      secondaryHref: "",
    }),
  },
  header: {
    label: "Section header",
    icon: "list",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", localized: true },
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "subtitle", label: "Subtitle", type: "textarea", localized: true },
      { key: "align", label: "Alignment", type: "select", options: [{ value: "center", label: "Center" }, { value: "left", label: "Left" }] },
    ],
    defaults: () => ({ eyebrow: L(), title: L("Section title"), subtitle: L(), align: "center" }),
  },
  richtext: {
    label: "Text",
    icon: "edit",
    fields: [{ key: "html", label: "Content", type: "richtext", localized: true }],
    defaults: () => ({ html: L("<p>Write something…</p>") }),
  },
  image: {
    label: "Image",
    icon: "image",
    fields: [
      { key: "image", label: "Image", type: "image" },
      { key: "caption", label: "Caption", type: "text", localized: true },
      { key: "rounded", label: "Rounded corners", type: "toggle" },
    ],
    defaults: () => ({ image: "", caption: L(), rounded: true }),
  },
  imageText: {
    label: "Image + text",
    icon: "building",
    fields: [
      { key: "image", label: "Image", type: "image" },
      { key: "flip", label: "Image on right", type: "toggle" },
      { key: "eyebrow", label: "Eyebrow", type: "text", localized: true },
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "body", label: "Body", type: "textarea", localized: true },
      {
        key: "bullets",
        label: "Bullet points",
        type: "list",
        addLabel: "Add bullet",
        itemFields: [{ key: "text", label: "Text", type: "text", localized: true }],
      },
      { key: "linkLabel", label: "Button label (optional)", type: "text", localized: true },
      { key: "linkHref", label: "Button link (optional)", type: "url" },
    ],
    defaults: () => ({ image: "", flip: false, eyebrow: L(), title: L("Heading"), body: L(), bullets: [], linkLabel: L(), linkHref: "" }),
  },
  cards: {
    label: "Feature cards",
    icon: "check",
    fields: [
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "subtitle", label: "Subtitle", type: "textarea", localized: true },
      {
        key: "items",
        label: "Cards",
        type: "list",
        addLabel: "Add card",
        itemFields: [
          { key: "icon", label: "Icon", type: "select", options: ICON_OPTIONS },
          { key: "title", label: "Title", type: "text", localized: true },
          { key: "text", label: "Text", type: "textarea", localized: true },
        ],
      },
    ],
    defaults: () => ({ title: L(), subtitle: L(), items: [] }),
  },
  stats: {
    label: "Stats bar",
    icon: "chart",
    fields: [
      { key: "raised", label: "Raised card (overlaps the section above)", type: "toggle" },
      {
        key: "items",
        label: "Stats",
        type: "list",
        addLabel: "Add stat",
        itemFields: [
          { key: "value", label: "Value", type: "text" },
          { key: "label", label: "Label", type: "text", localized: true },
        ],
      },
    ],
    defaults: () => ({ raised: false, items: [] }),
  },
  steps: {
    label: "Process steps",
    icon: "refresh",
    fields: [
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "subtitle", label: "Subtitle", type: "textarea", localized: true },
      {
        key: "items",
        label: "Steps",
        type: "list",
        addLabel: "Add step",
        itemFields: [
          { key: "step", label: "Number", type: "text" },
          { key: "title", label: "Title", type: "text", localized: true },
          { key: "text", label: "Text", type: "textarea", localized: true },
        ],
      },
    ],
    defaults: () => ({ title: L(), subtitle: L(), items: [] }),
  },
  gallery: {
    label: "Gallery / projects",
    icon: "image",
    fields: [
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "subtitle", label: "Subtitle", type: "textarea", localized: true },
      {
        key: "items",
        label: "Items",
        type: "list",
        addLabel: "Add item",
        itemFields: [
          { key: "image", label: "Image", type: "image" },
          { key: "title", label: "Title", type: "text", localized: true },
          { key: "caption", label: "Caption / location", type: "text", localized: true },
          { key: "href", label: "Links to (optional)", type: "url" },
        ],
      },
    ],
    defaults: () => ({ title: L(), subtitle: L(), items: [] }),
  },
  testimonials: {
    label: "Testimonials",
    icon: "quote",
    fields: [
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "subtitle", label: "Subtitle", type: "textarea", localized: true },
      { key: "showSchema", label: "Emit review structured data (only for REAL client reviews)", type: "toggle" },
      {
        key: "items",
        label: "Testimonials",
        type: "list",
        addLabel: "Add testimonial",
        itemFields: [
          { key: "quote", label: "Quote", type: "textarea", localized: true },
          { key: "author", label: "Author", type: "text" },
          { key: "role", label: "Role / location", type: "text", localized: true },
          {
            key: "rating",
            label: "Star rating",
            type: "select",
            options: [
              { value: "5", label: "★★★★★" },
              { value: "4", label: "★★★★" },
              { value: "3", label: "★★★" },
            ],
          },
        ],
      },
    ],
    defaults: () => ({ title: L(), subtitle: L(), showSchema: false, items: [] }),
  },
  cta: {
    label: "Call to action",
    icon: "arrow-right",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", localized: true },
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "subtitle", label: "Subtitle", type: "textarea", localized: true },
      { key: "buttonLabel", label: "Button label", type: "text", localized: true },
      { key: "buttonHref", label: "Button link", type: "url" },
      { key: "image", label: "Background image (optional)", type: "image" },
      { key: "showContact", label: "Show phone & email", type: "toggle" },
    ],
    defaults: () => ({ eyebrow: L(), title: L("Ready to start?"), subtitle: L(), buttonLabel: L("Get a quote"), buttonHref: "/contact", image: "", showContact: false }),
  },
  faq: {
    label: "FAQ",
    icon: "info",
    fields: [
      { key: "title", label: "Title", type: "text", localized: true },
      {
        key: "items",
        label: "Questions",
        type: "list",
        addLabel: "Add question",
        itemFields: [
          { key: "q", label: "Question", type: "text", localized: true },
          { key: "a", label: "Answer", type: "textarea", localized: true },
        ],
      },
    ],
    defaults: () => ({ title: L("FAQ"), items: [] }),
  },
  contactForm: {
    label: "Contact form",
    icon: "mail",
    fields: [
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "subtitle", label: "Subtitle", type: "textarea", localized: true },
    ],
    defaults: () => ({ title: L("Get in touch"), subtitle: L() }),
  },
  video: {
    label: "Video",
    icon: "image",
    fields: [
      { key: "src", label: "Video (upload or URL)", type: "image" },
      { key: "poster", label: "Poster image (optional)", type: "image" },
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "caption", label: "Caption", type: "text", localized: true },
      { key: "autoplay", label: "Autoplay (muted)", type: "toggle" },
      { key: "loop", label: "Loop", type: "toggle" },
    ],
    defaults: () => ({ src: "", poster: "", title: L(), caption: L(), autoplay: false, loop: false }),
  },
  beforeAfter: {
    label: "Before / After",
    icon: "image",
    fields: [
      { key: "beforeImage", label: "Before image", type: "image" },
      { key: "afterImage", label: "After image", type: "image" },
      { key: "beforeLabel", label: "Before label", type: "text", localized: true },
      { key: "afterLabel", label: "After label", type: "text", localized: true },
    ],
    defaults: () => ({
      beforeImage: "",
      afterImage: "",
      beforeLabel: L("Before", "Avant"),
      afterLabel: L("After", "Après"),
    }),
  },
  embed: {
    label: "Social embed (YouTube, Instagram, X…)",
    icon: "arrow-up-right",
    fields: [
      { key: "url", label: "Post / video URL", type: "url" },
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "caption", label: "Caption", type: "text", localized: true },
    ],
    defaults: () => ({ url: "", title: L(), caption: L() }),
  },
  youtubeFeed: {
    label: "Latest YouTube videos (auto-updating)",
    icon: "image",
    fields: [
      { key: "title", label: "Title", type: "text", localized: true },
      { key: "subtitle", label: "Subtitle", type: "textarea", localized: true },
      { key: "channelId", label: "YouTube channel ID (starts with UC…)", type: "text" },
      {
        key: "count",
        label: "How many videos",
        type: "select",
        options: [
          { value: "3", label: "3" },
          { value: "6", label: "6" },
        ],
      },
    ],
    defaults: () => ({ title: L("From our YouTube channel"), subtitle: L(), channelId: "", count: "3" }),
  },
  featuredProject: {
    label: "Featured / active project",
    icon: "hard-hat",
    fields: [
      { key: "statusLabel", label: "Status badge (e.g. Active Project · In Progress)", type: "text", localized: true },
      { key: "title", label: "Project title", type: "text", localized: true },
      { key: "location", label: "Location", type: "text", localized: true },
      { key: "body", label: "Storyline", type: "textarea", localized: true },
      { key: "image", label: "Main image", type: "image" },
      { key: "videoUrl", label: "YouTube video URL (optional — shows instead of image)", type: "url" },
      { key: "href", label: "Project link", type: "url" },
      { key: "ctaLabel", label: "Link label", type: "text", localized: true },
    ],
    defaults: () => ({
      statusLabel: L("Active Project · In Progress", "Projet en cours"),
      title: L("Featured project"),
      location: L(),
      body: L(),
      image: "",
      videoUrl: "",
      href: "",
      ctaLabel: L("View project", "Voir le projet"),
    }),
  },
  html: {
    label: "Custom HTML / embed",
    icon: "edit",
    fields: [{ key: "code", label: "HTML code", type: "textarea" }],
    defaults: () => ({ code: "" }),
  },
  spacer: {
    label: "Spacer",
    icon: "chevron-down",
    fields: [
      {
        key: "size",
        label: "Height",
        type: "select",
        options: [
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
        ],
      },
    ],
    defaults: () => ({ size: "md" }),
  },
};

export const BLOCK_ORDER: BlockType[] = [
  "slideshow", "hero", "header", "richtext", "imageText", "cards", "stats", "steps",
  "featuredProject", "gallery", "beforeAfter", "testimonials", "youtubeFeed", "faq", "cta", "contactForm", "image", "video", "embed", "html", "spacer",
];

/**
 * Converts a social/video URL into an embeddable iframe source.
 * Supports YouTube, Vimeo, Instagram, TikTok, X/Twitter, Facebook, Google Maps.
 */
export function embedSrc(url: string): { src: string; aspect: "video" | "square" | "tall" } | null {
  const u = url.trim();
  if (!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) return { src: `https://www.youtube.com/embed/${m[1]}`, aspect: "video" };
  m = u.match(/vimeo\.com\/(\d+)/);
  if (m) return { src: `https://player.vimeo.com/video/${m[1]}`, aspect: "video" };
  m = u.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/);
  if (m) return { src: `https://www.instagram.com/p/${m[1]}/embed`, aspect: "tall" };
  m = u.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
  if (m) return { src: `https://www.tiktok.com/embed/v2/${m[1]}`, aspect: "tall" };
  if (/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(u))
    return { src: `https://twitframe.com/show?url=${encodeURIComponent(u)}`, aspect: "square" };
  if (/facebook\.com\//.test(u))
    return { src: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(u)}&width=500`, aspect: "square" };
  if (/google\.[a-z.]+\/maps|maps\.app\.goo/.test(u)) return { src: u, aspect: "video" };
  return null;
}

/** True when a media URL points at a video file. */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url);
}

// ─── SEO settings ───────────────────────────────────────
export interface SeoSettings {
  /** Tracking & verification codes — injected site-wide automatically. */
  ga4Id: string; // G-XXXX
  gtmId: string; // GTM-XXXX
  fbPixelId: string;
  googleVerification: string;
  bingVerification: string;
  /** Default social-share image for pages without their own. */
  defaultOgImage: string;
  /** LocalBusiness structured data (JSON-LD), built from these + site settings. */
  business: {
    type: string; // e.g. GeneralContractor, HomeAndConstructionBusiness
    priceRange: string; // e.g. $$$
    latitude: string;
    longitude: string;
    openingHours: string; // e.g. Mo-Fr 08:00-18:00
  };
  /** IndexNow: instant indexing pings to Bing/Yandex/etc. on publish. */
  indexNowKey: string;
  autoIndexNow: boolean;
}

export const DEFAULT_SEO: SeoSettings = {
  ga4Id: "",
  gtmId: "",
  fbPixelId: "",
  googleVerification: "",
  bingVerification: "",
  defaultOgImage: "/images/king2/hero-renovation.jpg",
  business: {
    type: "GeneralContractor",
    priceRange: "$$$",
    latitude: "",
    longitude: "",
    openingHours: "Mo-Fr 08:00-18:00",
  },
  indexNowKey: "",
  autoIndexNow: true,
};

export function newBlock(type: BlockType): Block {
  return { id: Math.random().toString(36).slice(2, 10), type, data: BLOCKS[type].defaults() };
}

// ─── Theme (Appearance) ─────────────────────────────────
export interface ThemeColors {
  brand: string;
  brandDark: string;
  brandSoft: string;
  accent: string;
  accentDark: string;
  accentSoft: string;
  sand: string;
  cream: string;
  ink: string;
  inkSoft: string;
  line: string;
  lineDark: string;
}

export type FontPair = "modern" | "elegant" | "bold" | "minimal" | "editorial";
export type ThemeRadius = "sharp" | "soft" | "round";
export type HeaderStyle = "light" | "dark";

export interface ThemeSettings {
  preset: string;
  colors: ThemeColors;
  fontPair: FontPair;
  radius: ThemeRadius;
  headerStyle: HeaderStyle;
}

export const FONT_PAIRS: Record<FontPair, { label: string; display: string; body: string }> = {
  modern: { label: "Modern (Jakarta + Inter)", display: "var(--font-jakarta)", body: "var(--font-inter)" },
  elegant: { label: "Elegant (Playfair + Lora)", display: "var(--font-playfair)", body: "var(--font-lora)" },
  bold: { label: "Bold (Space Grotesk + Manrope)", display: "var(--font-grotesk)", body: "var(--font-manrope)" },
  minimal: { label: "Minimal (Poppins)", display: "var(--font-poppins)", body: "var(--font-poppins)" },
  editorial: { label: "Editorial (Fraunces + Poppins)", display: "var(--font-fraunces)", body: "var(--font-poppins)" },
};

export const RADII: Record<ThemeRadius, { label: string; btn: string; card: string }> = {
  sharp: { label: "Sharp", btn: "0.25rem", card: "0.4rem" },
  soft: { label: "Soft", btn: "0.6rem", card: "1rem" },
  round: { label: "Round", btn: "999px", card: "1.4rem" },
};

/** EdgePress brand — deep slate + electric indigo: a clean, modern developer-
 *  product palette (near-black slate, vivid indigo accent, soft rounded UI). */
export const DEFAULT_THEME: ThemeSettings = {
  preset: "slate-indigo",
  colors: {
    brand: "#1e243b",
    brandDark: "#141829",
    brandSoft: "#e7e9f5",
    accent: "#6366f1",
    accentDark: "#4f46e5",
    accentSoft: "#e6e7ff",
    sand: "#f5f6fb",
    cream: "#fbfbfe",
    ink: "#1a1c2b",
    inkSoft: "#666b85",
    line: "#e6e7f0",
    lineDark: "#2c3350",
  },
  fontPair: "modern",
  radius: "soft",
  headerStyle: "dark",
};

export const THEME_PRESETS: { id: string; label: string; colors: ThemeColors }[] = [
  { id: "slate-indigo", label: "Slate & Indigo", colors: DEFAULT_THEME.colors },
  {
    id: "stone-mint",
    label: "Stone & Mint",
    colors: {
      brand: "#3a3632", brandDark: "#282521", brandSoft: "#eae6df",
      accent: "#08b892", accentDark: "#067a63", accentSoft: "#dff6ef",
      sand: "#f4f2eb", cream: "#faf9f4", ink: "#3a3632", inkSoft: "#7a736b",
      line: "#e6e1d8", lineDark: "#4a453f",
    },
  },
  {
    id: "mint-ink",
    label: "Mint & Ink",
    colors: {
      brand: "#14181a", brandDark: "#0b0e0f", brandSoft: "#ececea",
      accent: "#00b894", accentDark: "#007a5e", accentSoft: "#e3f9f1",
      sand: "#f6f6f4", cream: "#fbfbfa", ink: "#14181a", inkSoft: "#676d6a",
      line: "#e4e3e0", lineDark: "#262b2c",
    },
  },
  {
    id: "graphite-gold",
    label: "Graphite & Gold",
    colors: {
      brand: "#111820", brandDark: "#0f1419", brandSoft: "#eceae4",
      accent: "#c9942e", accentDark: "#8c6218", accentSoft: "#f5e8cf",
      sand: "#f7f5f0", cream: "#fcfbf8", ink: "#0f1419", inkSoft: "#66717d",
      line: "#e7e2d8", lineDark: "#2a3440",
    },
  },
  {
    id: "navy-gold",
    label: "Navy & Gold",
    colors: {
      brand: "#16324f", brandDark: "#0e2438", brandSoft: "#e9eef4",
      accent: "#e0a52e", accentDark: "#c2861a", accentSoft: "#fbeecd",
      sand: "#f6f4f0", cream: "#fbfaf8", ink: "#17222e", inkSoft: "#5a6571",
      line: "#e6e2db", lineDark: "#24405c",
    },
  },
  {
    id: "forest-copper",
    label: "Forest & Copper",
    colors: {
      brand: "#1e4034", brandDark: "#122b22", brandSoft: "#e8f0ec",
      accent: "#c97e42", accentDark: "#a5602a", accentSoft: "#f7e8da",
      sand: "#f4f3ee", cream: "#fbfaf6", ink: "#1b2620", inkSoft: "#5b6a61",
      line: "#e3e2d8", lineDark: "#2e5245",
    },
  },
  {
    id: "charcoal-red",
    label: "Charcoal & Red",
    colors: {
      brand: "#26282c", brandDark: "#17181b", brandSoft: "#ebecee",
      accent: "#d64545", accentDark: "#b32f2f", accentSoft: "#fbe3e3",
      sand: "#f5f4f3", cream: "#fbfafa", ink: "#1d1f23", inkSoft: "#5f6368",
      line: "#e5e3e1", lineDark: "#3a3d43",
    },
  },
  {
    id: "slate-sky",
    label: "Slate & Sky",
    colors: {
      brand: "#1e293b", brandDark: "#111a2b", brandSoft: "#e8edf5",
      accent: "#2f9dd0", accentDark: "#1f7aa8", accentSoft: "#dcf0f9",
      sand: "#f3f5f7", cream: "#fafbfc", ink: "#182030", inkSoft: "#5a6472",
      line: "#e2e5e9", lineDark: "#2c3c55",
    },
  },
  {
    id: "espresso-cream",
    label: "Espresso & Cream",
    colors: {
      brand: "#3d2f27", brandDark: "#291f19", brandSoft: "#f0eae5",
      accent: "#d9a441", accentDark: "#b58328", accentSoft: "#f9eed6",
      sand: "#f6f2ec", cream: "#fcfaf6", ink: "#28211c", inkSoft: "#6b5f55",
      line: "#e8e1d7", lineDark: "#544236",
    },
  },
];

/** CSS `:root` override string for a theme — injected by the layout. */
export function themeCss(t: ThemeSettings): string {
  const c = t.colors;
  const f = FONT_PAIRS[t.fontPair] ?? FONT_PAIRS.modern;
  const r = RADII[t.radius] ?? RADII.soft;
  // :root:root — higher specificity than Tailwind's @theme `:root` fallback so
  // the live CMS theme always wins regardless of stylesheet load order.
  return `:root:root{--color-brand:${c.brand};--color-brand-dark:${c.brandDark};--color-brand-soft:${c.brandSoft};--color-accent:${c.accent};--color-accent-dark:${c.accentDark};--color-accent-soft:${c.accentSoft};--color-sand:${c.sand};--color-cream:${c.cream};--color-ink:${c.ink};--color-ink-soft:${c.inkSoft};--color-line:${c.line};--color-line-dark:${c.lineDark};--font-display:${f.display};--font-sans:${f.body};--ui-radius:${r.btn};--ui-radius-lg:${r.card}}`;
}
