"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Video = { id: string; title: string; published: string; thumbnail: string; url: string };

/**
 * Auto-updating strip of the channel's latest videos. Fetches our
 * /api/youtube-feed proxy in the browser (the public pages are static, so
 * this is how the strip stays current between deploys). Renders nothing at
 * all until videos arrive — no skeleton flash on a channel that's empty.
 */
export function YouTubeFeed({
  channelId,
  count = 3,
  locale = "en",
  channelUrl,
}: {
  channelId: string;
  count?: number;
  locale?: "en" | "fr";
  channelUrl?: string;
}) {
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    if (!channelId) return;
    let alive = true;
    fetch(`/api/youtube-feed?channel=${encodeURIComponent(channelId)}`)
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((d) => alive && setVideos((d.videos ?? []).slice(0, count)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [channelId, count]);

  if (videos.length === 0) return null;

  return (
    <div>
      <div className={`grid gap-6 sm:grid-cols-2 ${videos.length >= 3 ? "lg:grid-cols-3" : ""}`}>
        {videos.map((v) => (
          <a
            key={v.id}
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            className="tile group card relative bg-white"
          >
            <div className="relative aspect-video overflow-hidden bg-brand-dark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.thumbnail}
                alt={v.title}
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
              />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-dark/70 text-white backdrop-blur-sm transition group-hover:bg-accent group-hover:text-brand-dark">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                </span>
              </span>
            </div>
            <div className="p-5">
              <h3 className="line-clamp-2 font-display text-base font-bold tracking-[-0.01em] text-brand">{v.title}</h3>
              <p className="mt-1.5 text-xs text-ink-soft">
                {new Date(v.published).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </a>
        ))}
      </div>
      {channelUrl && (
        <a
          href={channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent-dark hover:text-brand"
        >
          <Icon name="youtube" size={18} />
          {locale === "fr" ? "Voir la chaîne" : "Visit our channel"}
          <Icon name="arrow-right" size={15} />
        </a>
      )}
    </div>
  );
}
