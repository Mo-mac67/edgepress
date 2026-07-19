import Script from "next/script";
import type { SeoSettings, SiteSettings } from "@/lib/cms-types";

/**
 * Site-wide SEO & tracking tags, driven by the admin SEO panel:
 * GA4, Google Tag Manager, Meta Pixel, site-verification metas, and
 * LocalBusiness JSON-LD structured data. Everything is optional — a tag only
 * renders when its ID is filled in.
 */
export function SeoTags({ seo, settings }: { seo: SeoSettings; settings: SiteSettings }) {
  const site = process.env.SITE_URL ?? "";
  const ld = {
    "@context": "https://schema.org",
    "@type": seo.business.type || "GeneralContractor",
    name: settings.brandName,
    url: site,
    telephone: settings.phone,
    email: settings.email,
    address: { "@type": "PostalAddress", streetAddress: settings.address, addressRegion: "ON", addressCountry: "CA" },
    priceRange: seo.business.priceRange || undefined,
    openingHours: seo.business.openingHours || undefined,
    areaServed: settings.serviceAreas?.map((a) => ({ "@type": "City", name: a })),
    image: seo.defaultOgImage ? `${site}${seo.defaultOgImage}` : undefined,
    ...(seo.business.latitude && seo.business.longitude
      ? { geo: { "@type": "GeoCoordinates", latitude: seo.business.latitude, longitude: seo.business.longitude } }
      : {}),
    sameAs: [settings.social.facebook, settings.social.instagram, settings.social.linkedin, settings.social.youtube].filter(Boolean),
  };

  return (
    <>
      {seo.googleVerification && <meta name="google-site-verification" content={seo.googleVerification} />}
      {seo.bingVerification && <meta name="msvalidate.01" content={seo.bingVerification} />}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      {seo.ga4Id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${seo.ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${seo.ga4Id}');`}
          </Script>
        </>
      )}

      {seo.gtmId && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${seo.gtmId}');`}
        </Script>
      )}

      {seo.fbPixelId && (
        <Script id="fb-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${seo.fbPixelId}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
