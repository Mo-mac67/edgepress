import { Icon, type IconName } from "./Icon";
import type { SiteSettings } from "@/lib/cms-types";

/**
 * Company social links, rendered as thin line-icons in the same design
 * language as the menu strokes. Each icon only shows when its URL is set in
 * the CMS (Site info → Social), so there are never dead links.
 */
export function SocialLinks({
  settings,
  size = 19,
  className = "",
}: {
  settings: SiteSettings;
  size?: number;
  className?: string;
}) {
  const items: { key: keyof SiteSettings["social"]; icon: IconName; label: string }[] = [
    { key: "instagram", icon: "instagram", label: "Instagram" },
    { key: "youtube", icon: "youtube", label: "YouTube" },
    { key: "linkedin", icon: "linkedin", label: "LinkedIn" },
    { key: "facebook", icon: "facebook", label: "Facebook" },
  ];
  const active = items.filter((i) => settings.social[i.key]);
  if (active.length === 0) return null;
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {active.map((i) => (
        <a
          key={i.key}
          href={settings.social[i.key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={i.label}
          className="opacity-70 transition hover:opacity-100 hover:text-accent"
        >
          <Icon name={i.icon} size={size} />
        </a>
      ))}
    </div>
  );
}
