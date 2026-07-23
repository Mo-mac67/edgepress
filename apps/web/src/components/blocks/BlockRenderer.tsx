import Image from "next/image";
import Link from "next/link";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { BusinessHours } from "@/components/BusinessHours";
import { Slideshow } from "@/components/Slideshow";
import { YouTubeFeed } from "@/components/YouTubeFeed";
import { Icon, type IconName } from "@/components/Icon";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { PayButton } from "@/components/PayButton";
import { QuoteForm } from "@/components/QuoteForm";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { embedSrc, tx, type Block, type SiteSettings } from "@/lib/cms-types";

function href(raw: string, locale: Locale): string {
  if (!raw) return `/${locale}`;
  if (/^https?:\/\//.test(raw) || raw.startsWith("mailto:") || raw.startsWith("tel:")) return raw;
  const clean = raw.replace(/^\//, "");
  return `/${locale}${clean ? `/${clean}` : ""}`;
}

function Img({ src, alt, className, sizes, priority }: { src: string; alt: string; className?: string; sizes?: string; priority?: boolean }) {
  if (!src) return <div className="h-full w-full bg-brand-soft" />;
  return <Image src={src} alt={alt} fill sizes={sizes ?? "100vw"} priority={priority} className={className ?? "object-cover"} />;
}

export function BlockRenderer({
  blocks,
  locale,
  dict,
  settings,
  first,
  pageDate,
  pageId,
}: {
  blocks: Block[];
  locale: Locale;
  dict: Dictionary;
  settings: SiteSettings;
  first?: boolean;
  /** Page updatedAt — used as uploadDate in VideoObject structured data. */
  pageDate?: string;
  /** Page id — payment blocks reference it so prices are read server-side. */
  pageId?: string;
}) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={block.id} block={block} locale={locale} dict={dict} settings={settings} priority={first && i === 0} pageDate={pageDate} pageId={pageId} />
      ))}
    </>
  );
}

/**
 * JSON-LD VideoObject for embedded YouTube videos, so Google can show video
 * rich results for project videos. Thumbnail/embed URLs are derived from the
 * video id; uploadDate comes from the page's updatedAt.
 */
function VideoLd({ url, name, description, uploadDate }: { url: string; name?: string; description?: string; uploadDate?: string }) {
  const m = (url ?? "").match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (!m) return null;
  const id = m[1];
  const ld = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: name || "Project video",
    description: description || name || "Construction project video",
    thumbnailUrl: [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
    embedUrl: `https://www.youtube.com/embed/${id}`,
    contentUrl: `https://www.youtube.com/watch?v=${id}`,
    ...(uploadDate ? { uploadDate } : {}),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />;
}

/**
 * Faint accent-tinted grid used on dark bands (hero, CTA). Uses color-mix so
 * it always matches whatever accent color the active theme sets — no
 * hardcoded hue.
 */
function AccentGrid() {
  return (
    <div
      className="absolute inset-0 opacity-[0.18] [mask-image:linear-gradient(90deg,#000_0%,transparent_70%)]"
      style={{
        backgroundImage:
          "linear-gradient(color-mix(in srgb, var(--color-accent) 22%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 18%, transparent) 1px, transparent 1px)",
        backgroundSize: "84px 84px",
      }}
    />
  );
}

function BlockView({
  block,
  locale,
  dict,
  settings,
  priority,
  pageDate,
  pageId,
}: {
  block: Block;
  locale: Locale;
  dict: Dictionary;
  settings: SiteSettings;
  priority?: boolean;
  pageDate?: string;
  pageId?: string;
}) {
  const d = block.data;
  const t = (k: string) => tx(d[k], locale);

  switch (block.type) {
    case "slideshow": {
      const images = ((d.images as { image?: string }[]) ?? []).map((it) => it.image ?? "").filter(Boolean);
      const hasButton = !!(t("buttonLabel") && d.buttonHref);
      const certLogos = ((d.certLogos as { image?: string; label?: string; href?: string }[]) ?? []).filter((l) => l.image);
      const brand = settings.brandName.replace(/\.ca$/i, "");
      const brandMain = brand.replace(/pro$/i, "");
      const brandAccent = brand.slice(brandMain.length);
      return (
        <section className="relative isolate flex h-[100svh] items-center justify-center overflow-hidden bg-brand-dark text-white">
          <Slideshow
            images={images}
            priorityFirst={priority}
            overlay={
              <>
                {/* Slogan — centered, elegant, faded softly into the photo. */}
                {t("title") && (
                  <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-6">
                    <h1 className="hero-slogan max-w-4xl text-center font-display text-4xl font-light italic leading-[1.06] tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.45)] sm:text-6xl md:text-7xl">
                      {t("title")}
                    </h1>
                  </div>
                )}
                {/* Bottom bar: animated brand + certification seals (left), CTA (right). */}
                <div className="absolute inset-x-0 bottom-0 z-[2] pb-9 md:pb-12">
                  <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6 px-6 md:px-10 lg:px-16">
                    <div>
                      <span className="hero-brand font-sans text-[1.65rem] font-semibold uppercase leading-none tracking-[0.14em] text-white md:text-3xl">
                        {brandMain}
                        <span className="text-accent">{brandAccent}</span>
                      </span>
                      {certLogos.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          {certLogos.map((l, i) => {
                            const badge = (
                              <span className="flex h-[3.4rem] items-center justify-center rounded bg-white/95 px-3.5 shadow-sm md:h-[4rem]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={l.image} alt={l.label ?? ""} className="h-[1.9rem] w-auto object-contain md:h-[2.35rem]" />
                              </span>
                            );
                            return (
                              <span key={i} className="hero-cert" style={{ animationDelay: `${3.7 + i * 0.14}s` }}>
                                {l.href ? (
                                  <a href={l.href} target="_blank" rel="noopener noreferrer">
                                    {badge}
                                  </a>
                                ) : (
                                  badge
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {hasButton && (
                      <Link
                        href={href(d.buttonHref as string, locale)}
                        className="hero-cta group inline-flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:text-accent"
                      >
                        {t("buttonLabel")}
                        <span className="h-px w-10 bg-current transition-all duration-300 group-hover:w-16" />
                      </Link>
                    )}
                  </div>
                </div>
              </>
            }
          />
        </section>
      );
    }

    case "hero": {
      const hasButtons = !!(t("primaryLabel") || t("secondaryLabel"));
      const video = (d.video as string) ?? "";
      const image = (d.image as string) ?? "";
      // Full-bleed, bottom-anchored composition: most of the frame stays pure
      // photography (only a bottom scrim, no left-right box), text sits low
      // and quiet. Landing sections get near-full-viewport height; inner
      // "page hero" variants (no buttons) are considerably shorter.
      const heightCls = hasButtons ? "min-h-[88vh]" : "min-h-[46vh]";
      return (
        <section className={`relative isolate flex ${heightCls} items-end overflow-hidden bg-brand-dark text-white`}>
          <div className="absolute inset-0 -z-10">
            {video ? (
              <video
                src={video}
                poster={image || undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              // A gentle translate-only drift (never a zoom) keeps the real
              // photo quietly alive without competing for attention.
              <div className="hero-drift absolute inset-0">
                <Img src={image} alt={t("title")} priority={priority} className="object-cover object-[68%_28%]" />
              </div>
            )}
            {/* Bottom-only scrim — the rest of the photo stays unobstructed. */}
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/25 to-transparent" />
            <div className="hero-vignette absolute inset-0" />
            <div className="hero-grain absolute inset-0" />
          </div>
          <div className="container-page relative w-full pb-14 pt-24 md:pb-20">
            <div className="max-w-3xl">
              {!!d.stars && <div className="mb-3 tracking-[3px] text-accent">★★★★★</div>}
              <div className="rule-accent mb-4" />
              {t("eyebrow") && (
                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-accent">{t("eyebrow")}</span>
              )}
              <h1
                className={`mt-4 max-w-[720px] font-display font-extrabold leading-[0.98] tracking-[-0.03em] ${
                  hasButtons ? "text-4xl md:text-6xl" : "text-3xl md:text-5xl"
                }`}
              >
                {t("title")}
              </h1>
              {t("subtitle") && <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">{t("subtitle")}</p>}
              {hasButtons && (
                <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
                  {t("primaryLabel") && (
                    <Link href={href(d.primaryHref as string, locale)} className="btn-primary">
                      {t("primaryLabel")}
                      <Icon name="arrow-right" size={16} />
                    </Link>
                  )}
                  {t("secondaryLabel") && (
                    <Link
                      href={href(d.secondaryHref as string, locale)}
                      className="group inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-white/85 hover:text-white"
                    >
                      {t("secondaryLabel")}
                      <Icon name="arrow-right" size={14} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      );
    }

    case "header":
      if ((d.align as string) === "left") {
        // Reference "section head": title left, lead paragraph right, baseline-aligned.
        return (
          <section className="bg-white">
            <div className="container-page grid items-end gap-4 pt-16 md:grid-cols-[minmax(0,1fr)_minmax(280px,440px)] md:gap-10">
              <div>
                {t("eyebrow") && <span className="eyebrow">{t("eyebrow")}</span>}
                <h2 className="section-title mt-2">{t("title")}</h2>
              </div>
              {t("subtitle") && <p className="text-[1.05rem] leading-relaxed text-ink-soft md:pb-1.5">{t("subtitle")}</p>}
            </div>
          </section>
        );
      }
      return (
        <section className="bg-white">
          <div className="container-page pt-16 text-center">
            <div className="mx-auto max-w-2xl">
              {t("eyebrow") && <span className="eyebrow">{t("eyebrow")}</span>}
              <h2 className="section-title mt-3">{t("title")}</h2>
              {t("subtitle") && <p className="mt-4 text-ink-soft">{t("subtitle")}</p>}
            </div>
          </div>
        </section>
      );

    case "richtext":
      return (
        <section className="bg-white">
          <div
            className="container-page prose max-w-3xl py-8 prose-headings:font-display prose-headings:text-brand prose-a:text-accent-dark"
            dangerouslySetInnerHTML={{ __html: t("html") }}
          />
        </section>
      );

    case "image":
      return (
        <section className="bg-white">
          <div className="container-page py-8">
            <div className={`relative aspect-[16/9] overflow-hidden ${d.rounded ? "ch-lg" : "ch"}`}>
              <Img src={d.image as string} alt={t("caption")} sizes="100vw" />
            </div>
            {t("caption") && <p className="mt-3 text-center text-sm text-ink-soft">{t("caption")}</p>}
          </div>
        </section>
      );

    case "imageText": {
      const bullets = (d.bullets as { text: unknown }[]) ?? [];
      return (
        <section className="bg-white">
          <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2">
            <div className={`relative aspect-[4/3] overflow-hidden ch-lg ${d.flip ? "lg:order-2" : ""}`}>
              <Img src={d.image as string} alt={t("title")} sizes="(max-width:1024px) 100vw, 50vw" />
            </div>
            <div>
              {t("eyebrow") && <span className="eyebrow"><Icon name="hammer" size={15} />{t("eyebrow")}</span>}
              <h2 className="section-title mt-3">{t("title")}</h2>
              {t("body") && <p className="mt-4 whitespace-pre-line text-ink-soft">{t("body")}</p>}
              {bullets.length > 0 && (
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {bullets.map((it, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <Icon name="check" size={18} className="mt-0.5 shrink-0 text-accent-dark" />
                      <span className="text-ink">{tx(it.text, locale)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {t("linkLabel") && d.linkHref ? (
                <a
                  href={href(d.linkHref as string, locale)}
                  target={/^https?:\/\//.test(d.linkHref as string) ? "_blank" : undefined}
                  rel={/^https?:\/\//.test(d.linkHref as string) ? "noopener noreferrer" : undefined}
                  className="mt-7 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent-dark hover:text-brand"
                >
                  {/^https?:\/\/(www\.)?linkedin/.test(d.linkHref as string) && <Icon name="linkedin" size={17} />}
                  {t("linkLabel")}
                  <Icon name="arrow-right" size={15} />
                </a>
              ) : null}
            </div>
          </div>
        </section>
      );
    }

    case "cards": {
      const items = (d.items as { icon?: string; title: unknown; text: unknown }[]) ?? [];
      return (
        <section className="bg-cream">
          <div className="container-page py-16">
            {(t("title") || t("subtitle")) && (
              <div className="mx-auto mb-10 max-w-2xl text-center">
                {t("title") && <h2 className="section-title">{t("title")}</h2>}
                {t("subtitle") && <p className="mt-4 text-ink-soft">{t("subtitle")}</p>}
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it, i) => (
                <div key={i} className="card p-6">
                  <span className="grid h-11 w-11 place-items-center ch-sm bg-brand-soft text-brand">
                    <Icon name={(it.icon as IconName) || "check"} size={22} />
                  </span>
                  <h3 className="mt-4 font-display font-bold text-brand">{tx(it.title, locale)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{tx(it.text, locale)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "stats": {
      const items = (d.items as { value: string; label: unknown }[]) ?? [];
      const cols = items.length >= 5 ? "md:grid-cols-5" : "md:grid-cols-4";
      if (d.raised) {
        // Signature raised white card overlapping the section above. Negative
        // top margin (not transform) so no phantom gap is left in the flow.
        return (
          <section className="relative z-10">
            <div className="container-page">
              <div className={`grid grid-cols-2 bg-white shadow-[0_24px_60px_rgba(15,20,25,0.14)] md:-mt-[66px] md:divide-x md:divide-line ${cols}`}>
                {items.map((it, i) => (
                  <div key={i} className="border-b border-line px-5 py-7 text-center last:border-b-0 md:border-b-0">
                    <p className="font-display text-[2rem] font-extrabold leading-none text-brand">{it.value}</p>
                    <p className="mt-2 text-[13px] text-ink-soft">{tx(it.label, locale)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }
      return (
        <section className="border-y border-line bg-white">
          <div className={`container-page grid grid-cols-2 gap-6 py-10 ${cols}`}>
            {items.map((it, i) => (
              <div key={i} className="text-center">
                <p className="font-display text-3xl font-extrabold text-brand md:text-4xl">{it.value}</p>
                <p className="mt-1 text-sm text-ink-soft">{tx(it.label, locale)}</p>
              </div>
            ))}
          </div>
        </section>
      );
    }

    case "beforeAfter": {
      const before = (d.beforeImage as string) ?? "";
      const after = (d.afterImage as string) ?? "";
      if (!before && !after) return null;
      return (
        <section className="relative shadow-[inset_0_18px_30px_-24px_rgba(15,20,25,0.5),inset_0_-18px_30px_-24px_rgba(15,20,25,0.5)]">
          <BeforeAfterSlider
            before={before}
            after={after}
            beforeLabel={t("beforeLabel") || "Before"}
            afterLabel={t("afterLabel") || "After"}
          />
        </section>
      );
    }

    case "youtubeFeed": {
      const channelId = ((d.channelId as string) ?? "").trim();
      if (!channelId) return null;
      const count = Number(d.count ?? 3) || 3;
      return (
        <section className="bg-sand">
          <div className="container-page py-16">
            {(t("title") || t("subtitle")) && (
              <div className="mb-10 max-w-2xl">
                {t("title") && <h2 className="section-title">{t("title")}</h2>}
                {t("subtitle") && <p className="mt-4 text-ink-soft">{t("subtitle")}</p>}
              </div>
            )}
            <YouTubeFeed channelId={channelId} count={count} locale={locale} channelUrl={settings.social.youtube || undefined} />
          </div>
        </section>
      );
    }

    case "featuredProject": {
      const video = embedSrc((d.videoUrl as string) ?? "");
      const hasLink = !!(t("ctaLabel") && d.href);
      return (
        <section className="relative isolate overflow-hidden bg-brand-dark text-white">
          {video && <VideoLd url={d.videoUrl as string} name={t("title")} description={t("body")} uploadDate={pageDate} />}
          <AccentGrid />
          <div className="container-page relative py-16 md:py-20">
            <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
              <div className="relative aspect-video overflow-hidden ch-lg shadow-2xl">
                {video ? (
                  <iframe
                    src={video.src}
                    title={t("title")}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                ) : (
                  <Img src={d.image as string} alt={t("title")} sizes="(max-width:1024px) 100vw, 60vw" priority={priority} />
                )}
              </div>
              <div>
                {t("statusLabel") && (
                  <span className="inline-flex items-center gap-2.5 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                    </span>
                    {t("statusLabel")}
                  </span>
                )}
                <h2 className="section-title mt-5 text-white">{t("title")}</h2>
                {t("location") && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-white/60">
                    <Icon name="map-pin" size={16} className="text-accent" />
                    {t("location")}
                  </p>
                )}
                {t("body") && <p className="mt-5 max-w-xl whitespace-pre-line leading-relaxed text-white/75">{t("body")}</p>}
                {hasLink && (
                  <Link
                    href={href(d.href as string, locale)}
                    className="group mt-7 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:text-accent"
                  >
                    {t("ctaLabel")}
                    <span className="h-px w-10 bg-current transition-all duration-300 group-hover:w-16" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      );
    }

    case "steps": {
      const items = (d.items as { step: string; title: unknown; text: unknown }[]) ?? [];
      const cols = items.length >= 5 ? "lg:grid-cols-5" : items.length === 4 ? "lg:grid-cols-4" : items.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";
      return (
        <section className="bg-sand">
          <div className="container-page py-16">
            {(t("title") || t("subtitle")) && (
              <div className="mx-auto mb-10 max-w-2xl text-center">
                {t("title") && <h2 className="section-title">{t("title")}</h2>}
                {t("subtitle") && <p className="mt-4 text-ink-soft">{t("subtitle")}</p>}
              </div>
            )}
            <div className={`grid gap-4 md:grid-cols-2 ${cols}`}>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[58px_1fr] gap-4 border border-line bg-white p-5 ch">
                  <span className="grid h-[58px] w-[58px] place-items-center bg-brand font-display text-lg font-black text-accent">
                    {it.step}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-[-0.02em] text-brand">{tx(it.title, locale)}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{tx(it.text, locale)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "gallery": {
      const items = (d.items as { image: string; title: unknown; caption: unknown; href?: string }[]) ?? [];
      const hasHead = !!(t("title") || t("subtitle"));
      // Stable anchor id from the English title so footer/deep links land on the
      // right card (e.g. /services#kitchen-renovations), independent of locale.
      const anchorId = (title: unknown) => {
        const en = title && typeof title === "object" ? ((title as { en?: string }).en ?? "") : String(title ?? "");
        return en.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      };
      // Column count follows the item count so no row is left with an orphan.
      const cols = items.length % 4 === 0 ? "lg:grid-cols-4" : items.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";
      return (
        <section className="bg-white">
          <div className={`container-page ${hasHead ? "py-16" : "pt-10 pb-16"}`}>
            {hasHead && (
              <div className="mx-auto mb-10 max-w-2xl text-center">
                {t("title") && <h2 className="section-title">{t("title")}</h2>}
                {t("subtitle") && <p className="mt-4 text-ink-soft">{t("subtitle")}</p>}
              </div>
            )}
            <div className={`grid gap-6 sm:grid-cols-2 ${cols}`}>
              {items.map((it, i) => {
                const inner = (
                  <>
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Img src={it.image} alt={tx(it.title, locale)} sizes="(max-width:768px) 100vw, 25vw" className="object-cover transition duration-700 group-hover:scale-[1.06]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/45 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                      <span className="absolute left-0 top-0 bg-brand px-3 py-1.5 font-display text-sm font-black text-accent">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="p-5">
                      <h3 className="font-display text-lg font-bold tracking-[-0.02em] text-brand">{tx(it.title, locale)}</h3>
                      {tx(it.caption, locale) && <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{tx(it.caption, locale)}</p>}
                      {it.href && (
                        <span className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-accent-dark opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          {locale === "fr" ? "Voir le projet" : "View project"} <Icon name="arrow-right" size={14} />
                        </span>
                      )}
                    </div>
                  </>
                );
                return it.href ? (
                  <Link key={i} href={href(it.href, locale)} id={anchorId(it.title)} className="tile group card relative block scroll-mt-28 bg-white">
                    {inner}
                  </Link>
                ) : (
                  <article key={i} id={anchorId(it.title)} className="tile group card relative scroll-mt-28 bg-white">
                    {inner}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    case "testimonials": {
      const items = (d.items as { quote: unknown; author: string; role: unknown; rating?: string }[]) ?? [];
      // Review structured data — only when explicitly enabled (real reviews).
      const rated = items.filter((it) => Number(it.rating) >= 1);
      const reviewLd =
        d.showSchema && rated.length > 0
          ? {
              "@context": "https://schema.org",
              "@type": "GeneralContractor",
              name: settings.brandName,
              review: rated.map((it) => ({
                "@type": "Review",
                author: { "@type": "Person", name: it.author || "Client" },
                reviewBody: tx(it.quote, locale),
                reviewRating: { "@type": "Rating", ratingValue: Number(it.rating), bestRating: 5 },
              })),
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: (rated.reduce((s, it) => s + Number(it.rating), 0) / rated.length).toFixed(1),
                reviewCount: rated.length,
                bestRating: 5,
              },
            }
          : null;
      return (
        <section className="bg-sand">
          {reviewLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewLd) }} />}
          <div className="container-page py-16">
            {(t("title") || t("subtitle")) && (
              <div className="mx-auto mb-10 max-w-2xl text-center">
                <span className="eyebrow">★★★★★</span>
                {t("title") && <h2 className="section-title mt-3">{t("title")}</h2>}
                {t("subtitle") && <p className="mt-4 text-ink-soft">{t("subtitle")}</p>}
              </div>
            )}
            <div className="grid gap-6 md:grid-cols-2">
              {items.map((it, i) => (
                <figure key={i} className="card flex flex-col p-7 shadow-sm">
                  <Icon name="quote" size={30} className="text-accent" />
                  <blockquote className="mt-4 flex-1 text-[1.02rem] leading-relaxed text-ink">“{tx(it.quote, locale)}”</blockquote>
                  <figcaption className="mt-6 border-t border-line pt-4">
                    <p className="font-display font-bold text-brand">{it.author}</p>
                    <p className="text-sm text-ink-soft">{tx(it.role, locale)}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "faq": {
      const items = (d.items as { q: unknown; a: unknown }[]) ?? [];
      return (
        <section className="bg-white">
          <div className="container-page max-w-3xl py-16">
            {t("title") && <h2 className="section-title mb-8 text-center">{t("title")}</h2>}
            <div className="divide-y divide-line ch-lg border border-line">
              {items.map((it, i) => (
                <details key={i} className="group p-5">
                  <summary className="flex cursor-pointer items-center justify-between font-display font-semibold text-brand">
                    {tx(it.q, locale)}
                    <Icon name="chevron-down" size={18} className="transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-ink-soft">{tx(it.a, locale)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "cta": {
      const bg = (d.image as string) ?? "";
      const showContact = !!d.showContact;
      const tel = settings.phone.replace(/[^\d+]/g, "");
      const body = (centered = false) => (
        <>
          {t("eyebrow") && <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-accent">{t("eyebrow")}</span>}
          <h2 className="section-title mt-2 text-white">{t("title")}</h2>
          {t("subtitle") && <p className={`mt-4 max-w-xl text-white/75 ${centered ? "mx-auto" : ""}`}>{t("subtitle")}</p>}
        </>
      );
      const action = (t("buttonLabel") || showContact) && (
        <div>
          {t("buttonLabel") && (
            <Link href={href(d.buttonHref as string, locale)} className="btn-primary">
              {t("buttonLabel")}
              <Icon name="arrow-right" size={16} />
            </Link>
          )}
          {showContact && (
            <div className="mt-6 grid gap-3 text-white/85">
              <a href={`tel:${tel}`} className="inline-flex items-center gap-2.5 hover:text-white">
                <Icon name="phone" size={16} className="text-accent" />
                {settings.phone}
              </a>
              <a href={`mailto:${settings.email}`} className="inline-flex items-center gap-2.5 hover:text-white">
                <Icon name="mail" size={16} className="text-accent" />
                {settings.email}
              </a>
            </div>
          )}
        </div>
      );
      return (
        <section className="relative isolate overflow-hidden bg-brand-dark text-white">
          {bg && (
            <div className="absolute inset-0 -z-10">
              <Img src={bg} alt="" className="object-cover opacity-35" />
            </div>
          )}
          {/* Soft fades so the dark band doesn't cut hard against light sections. */}
          <div className="fade-top-light" />
          <div className="fade-bottom-dark" />
          <AccentGrid />
          {action ? (
            <div className="container-page relative grid items-center gap-10 py-16 md:grid-cols-2 md:py-20">
              <div>{body(false)}</div>
              {action}
            </div>
          ) : (
            <div className="container-page relative py-16 text-center md:py-20">
              <div className="mx-auto max-w-3xl">{body(true)}</div>
            </div>
          )}
        </section>
      );
    }

    case "payment": {
      const amount = String(block.data.amount ?? "");
      const currency = String(block.data.currency ?? "usd").toUpperCase();
      return (
        <section className="bg-white">
          <div className="container-page py-14 text-center md:py-16">
            {t("title") && <h2 className="section-title text-brand">{t("title")}</h2>}
            {t("subtitle") && <p className="mx-auto mt-3 max-w-xl text-ink-soft">{t("subtitle")}</p>}
            <p className="mt-4 font-display text-3xl font-bold text-brand">{amount ? `${amount} ${currency}` : ""}</p>
            {pageId ? (
              <div className="flex justify-center"><PayButton pageId={pageId} blockId={block.id} locale={locale} label={t("buttonLabel") || "Buy now"} /></div>
            ) : (
              <p className="mt-4 text-sm text-ink-soft">Payment buttons work on published pages.</p>
            )}
          </div>
        </section>
      );
    }

    case "newsletter":
      return (
        <section className="bg-cream">
          <div className="container-page py-14 text-center md:py-16">
            {t("title") && <h2 className="section-title text-brand">{t("title")}</h2>}
            {t("subtitle") && <p className="mx-auto mt-3 max-w-xl text-ink-soft">{t("subtitle")}</p>}
            <NewsletterSignup locale={locale} placeholder={t("placeholder")} buttonLabel={t("buttonLabel")} />
          </div>
        </section>
      );

    case "contactForm":
      return (
        <section className="bg-sand">
          <div className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_1.15fr]">
            <div>
              {t("title") && <h2 className="section-title text-brand">{t("title")}</h2>}
              {t("subtitle") && <p className="mt-4 text-ink-soft">{t("subtitle")}</p>}
              <ul className="mt-7 space-y-3.5 text-[15px]">
                <li className="flex items-center gap-2.5"><Icon name="phone" size={17} className="shrink-0 text-accent-dark" /><a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="hover:text-brand">{settings.phone}</a></li>
                <li className="flex items-center gap-2.5"><Icon name="mail" size={17} className="shrink-0 text-accent-dark" /><a href={`mailto:${settings.email}`} className="hover:text-brand">{settings.email}</a></li>
                <li className="flex items-center gap-2.5"><Icon name="map-pin" size={17} className="shrink-0 text-accent-dark" />{settings.address}</li>
                <li><BusinessHours locale={locale} tone="light" /></li>
              </ul>
              {settings.serviceAreas.length > 0 && (
                <div className="mt-7 flex flex-wrap gap-2">
                  {settings.serviceAreas.map((a) => (
                    <span key={a} className="border border-line bg-white px-3 py-1 text-xs font-semibold text-brand">{a}</span>
                  ))}
                </div>
              )}
            </div>
            <QuoteForm locale={locale} form={dict.contact.form} />
          </div>
        </section>
      );

    case "video": {
      const src = (d.src as string) ?? "";
      if (!src) return null;
      const auto = !!d.autoplay;
      return (
        <section className="bg-white">
          <div className="container-page max-w-4xl py-10">
            {t("title") && <h2 className="section-title mb-6 text-center">{t("title")}</h2>}
            <video
              src={src}
              poster={(d.poster as string) || undefined}
              controls
              playsInline
              muted={auto}
              autoPlay={auto}
              loop={!!d.loop}
              className="w-full ch-lg bg-brand-dark"
            />
            {t("caption") && <p className="mt-3 text-center text-sm text-ink-soft">{t("caption")}</p>}
          </div>
        </section>
      );
    }

    case "embed": {
      const embed = embedSrc((d.url as string) ?? "");
      if (!embed) return null;
      const ratio = embed.aspect === "video" ? "aspect-video" : embed.aspect === "tall" ? "aspect-[9/14] max-w-md" : "aspect-square max-w-xl";
      return (
        <section className="bg-white">
          <VideoLd
            url={d.url as string}
            name={t("title") || t("caption") || `${settings.brandName} — project video`}
            description={t("caption")}
            uploadDate={pageDate}
          />
          <div className="container-page max-w-4xl py-10">
            {t("title") && <h2 className="section-title mb-6 text-center">{t("title")}</h2>}
            <div className={`mx-auto ${ratio} overflow-hidden ch-lg border border-line`}>
              <iframe
                src={embed.src}
                title={t("title") || "Embedded content"}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                loading="lazy"
                className="h-full w-full border-0"
              />
            </div>
            {t("caption") && <p className="mt-3 text-center text-sm text-ink-soft">{t("caption")}</p>}
          </div>
        </section>
      );
    }

    case "html":
      return (
        <section className="bg-white">
          <div className="container-page py-8" dangerouslySetInnerHTML={{ __html: (d.code as string) ?? "" }} />
        </section>
      );

    case "spacer": {
      const h = d.size === "sm" ? "h-6" : d.size === "lg" ? "h-24" : "h-14";
      return <div className={h} />;
    }

    default:
      return null;
  }
}
