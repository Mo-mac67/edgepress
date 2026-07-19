"use client";

import { Icon, type IconName } from "@/components/Icon";

interface Section {
  icon: IconName;
  title: string;
  intro: string;
  steps: string[];
  tips?: string[];
}

const SECTIONS: Section[] = [
  {
    icon: "list",
    title: "Pages — build & edit every page",
    intro: "Every page of the site (including the homepage) is built from blocks you can edit yourself.",
    steps: [
      "Open Pages and click Edit on any page — or New page to create one.",
      "Each section of a page is a block (Hero, Cards, Gallery, FAQ, Video…). Click a block to open its fields.",
      "Use the arrows to reorder blocks, the copy icon to duplicate, the trash to remove, and Add block for new sections.",
      "Switch EN / FR at the top to fill in both languages — every text field has an English and a French value.",
      "Click Save. The live preview pane on the right reloads with the saved version.",
      "Set Status to Draft to hide a page from visitors while you work — you can still preview it while signed in.",
    ],
    tips: [
      "System pages (Home, Services, Projects, About, Contact) can't be deleted, but everything inside them is editable.",
      "The page Title + SEO description are what Google shows in search results.",
    ],
  },
  {
    icon: "download",
    title: "Import an HTML file (bring your own design)",
    intro: "Have a ready-made page from a designer or another tool? Drop it in — it becomes a page of this site.",
    steps: [
      "Go to Pages and drag a .html file onto the page list (or click Import HTML).",
      "Give it a title and a URL slug. It's created as a Draft.",
      "Open it in the editor: you can edit the HTML source directly or replace it with another file.",
      "Tick “Standalone page” if the file is a full design that should hide the site's header and footer.",
      "Publish when ready. The imported page keeps its own styles and scripts.",
    ],
  },
  {
    icon: "star",
    title: "Appearance — change the whole theme",
    intro: "Recolor and restyle the entire site without touching any page.",
    steps: [
      "Open Appearance. Pick one of the 5 preset themes, or adjust any of the 12 colors individually.",
      "Choose a font pair (Modern / Elegant / Bold), corner roundness, and a light or dark header.",
      "Watch the mini preview update as you change things.",
      "Click Save & apply theme — the whole site (pages, buttons, header, footer) updates instantly.",
    ],
  },
  {
    icon: "image",
    title: "Media — photos & videos",
    intro: "One library for every image and video on the site, stored on the site's own cloud storage.",
    steps: [
      "Open Media and drag & drop files — images up to 8MB, videos (MP4/WebM) up to 90MB.",
      "Anywhere you see an image field in the editor, click “Choose / upload” to pick from the library.",
      "To put a video on a page: add a Video block and select an uploaded video (optional poster image, autoplay, loop).",
    ],
  },
  {
    icon: "arrow-up-right",
    title: "Social content — Instagram, YouTube, X & more",
    intro: "Show your social posts and videos directly on any page.",
    steps: [
      "Add a “Social embed” block to a page.",
      "Paste the link of a YouTube video, Instagram post/reel, TikTok, X (Twitter) post, Facebook post or Vimeo video.",
      "The post renders automatically in the right shape — no code needed.",
      "Your profile links (shown in structured data) live under Site info → Social links.",
    ],
  },
  {
    icon: "chart",
    title: "SEO — get found on Google",
    intro: "The SEO tab automates the technical work and audits your content.",
    steps: [
      "Page health: every published page is scored on 8 checks (title length, description, content, images, CTA…). Open a row to see exactly what to fix.",
      "AI meta: one click writes a professional SEO title + description for a page (needs the ANTHROPIC_API_KEY secret — ask your developer once).",
      "Instant indexing: publishing a page automatically pings Bing/Yandex (IndexNow). Use “Submit all pages” after big changes.",
      "Tracking codes: paste your Google Analytics 4, Tag Manager or Meta Pixel ID — the tags are injected site-wide automatically.",
      "Verification: paste Google/Bing verification values to prove ownership in Search Console / Webmaster Tools.",
      "Business schema: fill in your business type, hours and location — Google uses it for rich results and the map pack.",
      "Google: submit the sitemap (/sitemap.xml) once in Google Search Console; it updates itself whenever you add pages or posts.",
    ],
    tips: ["Aim for a green score (80+) on every page. Title 30–60 chars, description 70–160 chars."],
  },
  {
    icon: "edit",
    title: "Blog — news & articles",
    intro: "Publishing regularly is one of the best things you can do for SEO.",
    steps: [
      "Open Blog → New post. Give it a title and slug.",
      "Add a cover image, an excerpt (shown in the blog list), and write the article in the rich-text editor — in both EN and FR.",
      "Set Status to Published. It appears at /blog and is added to the sitemap and instant indexing automatically.",
    ],
  },
  {
    icon: "menu",
    title: "Menus — the site navigation",
    intro: "Control exactly what appears in the top menu (and footer links).",
    steps: [
      "Open Menus. Each row is one menu item with an EN label, FR label, and a link.",
      "Link to a page slug (e.g. services) or a full external URL (https://…).",
      "Reorder with the arrows, add or remove items, then Save menu.",
    ],
  },
  {
    icon: "user",
    title: "Leads — your customers",
    intro: "Every quote request lands here, with analytics on top.",
    steps: [
      "Dashboard shows totals, conversion and trends; Leads lists every enquiry (unread ones are marked).",
      "Open a lead to see the full request, set its status (New → Contacted → Quoted → Won/Lost), add notes, and send a follow-up email from a template.",
      "Export everything to CSV anytime.",
    ],
  },
  {
    icon: "building",
    title: "Site info & Security",
    intro: "Your business details and account safety.",
    steps: [
      "Site info: phone, email, address, hours, footer text, service areas and social links — used across the site and in SEO schema.",
      "Security: change your admin password (do this after handover!) and check which lead-notification channels are active.",
    ],
  },
];

export function HelpPanel() {
  return (
    <div className="max-w-3xl">
      <div className="card bg-brand p-6 text-white">
        <h2 className="font-display text-xl font-extrabold">How to run your website</h2>
        <p className="mt-2 text-sm text-white/80">
          Everything on this site is yours to manage — pages, design, photos, videos, blog, menu and SEO — with no developer needed.
          Each section below is a two-minute read.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {SECTIONS.map((s) => (
          <details key={s.title} className="card group p-5">
            <summary className="flex cursor-pointer items-center gap-3 font-display font-bold text-brand">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon name={s.icon} size={18} />
              </span>
              {s.title}
              <Icon name="chevron-down" size={16} className="ml-auto shrink-0 transition group-open:rotate-180" />
            </summary>
            <div className="mt-4 pl-12">
              <p className="text-sm text-ink-soft">{s.intro}</p>
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-ink">
                {s.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              {s.tips && (
                <div className="mt-3 rounded-lg bg-accent-soft/50 p-3">
                  {s.tips.map((t, i) => (
                    <p key={i} className="text-xs text-ink">💡 {t}</p>
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>

      <p className="mt-6 text-xs text-ink-soft">
        Need something beyond the panel? Contact your developer —{" "}
        <a href="https://synergion.ca" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-dark hover:underline">Synergion.ca</a>.
      </p>
    </div>
  );
}
