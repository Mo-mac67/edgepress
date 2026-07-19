import { randomUUID } from "node:crypto";
import type { Block, BlockType, Localized, NavItem, Page, SiteSettings } from "@/lib/cms-types";

const uid = () => randomUUID().slice(0, 8);
const b = (type: BlockType, data: Record<string, unknown>): Block => ({ id: uid(), type, data });

// ─── EdgePress starter content (generic demo — no client branding) ──
const L = (en: string, fr: string): Localized => ({ en, fr });

export function seedNav(): NavItem[] {
  const item = (href: string, en: string, fr: string): NavItem => ({ id: uid(), label: L(en, fr), href });
  return [
    item("", "Home", "Accueil"),
    item("features", "Features", "Fonctionnalités"),
    item("about", "About", "À propos"),
    item("blog", "Blog", "Blogue"),
    item("contact", "Contact", "Contact"),
  ];
}

export function seedSettings(): SiteSettings {
  return {
    brandName: "EdgePress",
    phone: "+1 (555) 010-0000",
    email: "hello@example.com",
    address: "Your address, your city",
    hours: "Mon–Fri 9:00–17:00",
    headerTagline: L("Powered by EdgePress", "Propulsé par EdgePress"),
    footerTagline: L(
      "This site runs on EdgePress — the AI-native CMS that runs free on the edge.",
      "Ce site fonctionne avec EdgePress — le CMS natif IA qui tourne gratuitement sur l'edge.",
    ),
    licenseNote: L("Edit everything in the admin panel at /admin", "Modifiez tout dans le panneau à /admin"),
    serviceAreas: [],
    social: { facebook: "", instagram: "", linkedin: "", youtube: "" },
  };
}

export function seedPages(): Page[] {
  const now = new Date().toISOString();
  const page = (slug: string, t: Localized, d: Localized, blocks: Block[]): Page => ({
    id: uid(), slug, status: "published", title: t, description: d, blocks, system: true, updatedAt: now,
  });

  const home = page(
    "",
    L("EdgePress — your new website", "EdgePress — votre nouveau site"),
    L("A starter site you can reshape entirely from the admin panel.", "Un site de départ que vous remodelez depuis le panneau."),
    [
      b("hero", {
        image: "", stars: false,
        eyebrow: L("Welcome to EdgePress", "Bienvenue sur EdgePress"),
        title: L("Your website, ready to shape", "Votre site, prêt à façonner"),
        subtitle: L(
          "Everything on this page is a block. Open the admin panel, edit any block, change the whole theme, or ask the AI to rebuild it for you.",
          "Chaque élément est un bloc. Ouvrez le panneau, modifiez un bloc, changez le thème — ou demandez à l'IA de le reconstruire.",
        ),
        primaryLabel: L("Open the admin panel", "Ouvrir le panneau"),
        primaryHref: "/admin",
        secondaryLabel: L("See features", "Voir les fonctionnalités"),
        secondaryHref: "/features",
      }),
      b("cards", {
        title: L("What you can do", "Ce que vous pouvez faire"),
        subtitle: L("A few of the things EdgePress handles out of the box.", "Quelques capacités incluses dès le départ."),
        items: [
          { icon: "edit", title: L("Block page builder", "Constructeur de pages"), text: L("18+ blocks: heroes, galleries, stats, FAQs, forms, video, embeds.", "18+ blocs : héros, galeries, statistiques, FAQ, formulaires, vidéo.") },
          { icon: "star", title: L("Themes", "Thèmes"), text: L("Recolor and restyle the whole site from one screen — or import any HTML template.", "Rethémez tout le site depuis un écran — ou importez un gabarit HTML.") },
          { icon: "chart", title: L("SEO on autopilot", "SEO automatique"), text: L("Page audits, sitemaps, instant indexing, structured data, tracking tags.", "Audits, sitemaps, indexation instantanée, données structurées.") },
          { icon: "mail", title: L("Leads & CRM", "Prospects & CRM"), text: L("Every form lands in a built-in CRM with statuses, notes and follow-ups.", "Chaque formulaire alimente un CRM avec statuts et suivis.") },
          { icon: "shield", title: L("Modular security", "Sécurité modulaire"), text: L("Auth, roles and 2FA as a module you switch on per deployment.", "Auth, rôles et 2FA en module activable par déploiement.") },
          { icon: "refresh", title: L("Runs anywhere", "Tourne partout"), text: L("Cloudflare's free tier by default — or Docker, Node and Vercel via adapters.", "Le palier gratuit de Cloudflare par défaut — ou Docker, Node, Vercel.") },
        ],
      }),
      b("cta", {
        eyebrow: L("Ready?", "Prêt ?"),
        title: L("Make this site yours", "Faites de ce site le vôtre"),
        subtitle: L("Log in to the panel and start editing — this whole page is yours to keep, remix or delete.", "Connectez-vous au panneau et commencez — cette page est à vous."),
        buttonLabel: L("Go to the panel", "Aller au panneau"),
        buttonHref: "/admin", image: "", showContact: false,
      }),
    ],
  );

  const features = page(
    "features",
    L("Features", "Fonctionnalités"),
    L("Everything EdgePress ships with.", "Tout ce qu'EdgePress inclut."),
    [
      b("hero", {
        image: "", stars: false,
        eyebrow: L("Features", "Fonctionnalités"),
        title: L("Small install. Big toolbox.", "Petite installation. Grande boîte à outils."),
        subtitle: L("Content, design, SEO, CRM and AI — modular, so you enable only what you need.", "Contenu, design, SEO, CRM et IA — en modules."),
        primaryLabel: L("", ""), primaryHref: "", secondaryLabel: L("", ""), secondaryHref: "",
      }),
      b("steps", {
        title: L("How it works", "Comment ça marche"), subtitle: L("", ""),
        items: [
          { step: "01", title: L("Install", "Installer"), text: L("One command or one deploy button — then a 5-minute browser wizard.", "Une commande ou un bouton — puis un assistant de 5 minutes.") },
          { step: "02", title: L("Shape", "Façonner"), text: L("Pick a theme, import a template, or let the AI interview you and build the site.", "Choisissez un thème, importez un gabarit, ou laissez l'IA bâtir le site.") },
          { step: "03", title: L("Publish", "Publier"), text: L("Blocks, blog, media, menus — everything editable and translation-ready.", "Blocs, blogue, médias, menus — tout est éditable.") },
          { step: "04", title: L("Grow", "Croître"), text: L("Automated SEO, lead CRM, analytics and AI reports keep working for you.", "SEO, CRM, analytique et rapports IA travaillent pour vous.") },
        ],
      }),
      b("faq", {
        title: L("FAQ", "FAQ"),
        items: [
          { q: L("Is it really free to run?", "Est-ce vraiment gratuit ?"), a: L("Yes — the default deployment uses Cloudflare's free tier: Workers, KV and R2.", "Oui — le déploiement par défaut utilise le palier gratuit de Cloudflare.") },
          { q: L("Do I need my own AI key?", "Faut-il une clé IA ?"), a: L("AI features are bring-your-own-key (Anthropic, OpenAI, Google) or free via Workers AI / local Ollama.", "Les fonctions IA utilisent votre clé ou Workers AI / Ollama.") },
          { q: L("Can developers use it headless?", "Utilisable en headless ?"), a: L("Yes — every piece of content is also available through the Content API.", "Oui — tout le contenu est servi par la Content API.") },
        ],
      }),
    ],
  );

  const about = page(
    "about",
    L("About", "À propos"),
    L("About this site.", "À propos de ce site."),
    [
      b("hero", {
        image: "", stars: false,
        eyebrow: L("About", "À propos"),
        title: L("Tell your story here", "Racontez votre histoire ici"),
        subtitle: L("Replace this page with who you are — the editor is one click away.", "Remplacez cette page — l'éditeur est à un clic."),
        primaryLabel: L("", ""), primaryHref: "", secondaryLabel: L("", ""), secondaryHref: "",
      }),
      b("richtext", {
        html: L(
          "<h2>Your story</h2><p>This is a starter paragraph. Open the admin panel, click <b>Pages → About → Edit</b>, and make it yours.</p>",
          "<h2>Votre histoire</h2><p>Paragraphe de départ. Ouvrez le panneau, cliquez <b>Pages → À propos → Modifier</b>.</p>",
        ),
      }),
    ],
  );

  const contact = page(
    "contact",
    L("Contact", "Contact"),
    L("Get in touch.", "Contactez-nous."),
    [
      b("hero", {
        image: "", stars: false,
        eyebrow: L("Contact", "Contact"),
        title: L("Get in touch", "Contactez-nous"),
        subtitle: L("Messages land in the built-in CRM.", "Les messages arrivent dans le CRM intégré."),
        primaryLabel: L("", ""), primaryHref: "", secondaryLabel: L("", ""), secondaryHref: "",
      }),
      b("contactForm", {
        title: L("Send a message", "Envoyer un message"),
        subtitle: L("We reply within one business day.", "Réponse en un jour ouvrable."),
      }),
    ],
  );

  return [home, features, about, contact];
}
