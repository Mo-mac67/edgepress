import Image from "next/image";
import type { Locale } from "@/i18n/config";
import type { SiteImage } from "@/lib/images";

/**
 * Real photography that fills its (relative, sized) parent. Defaults to
 * object-cover so photos crop cleanly into cards, heroes and galleries.
 */
export function Picture({
  image,
  locale,
  className = "object-cover",
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
}: {
  image: SiteImage;
  locale: Locale;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={image.src}
      alt={image.alt[locale]}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}
