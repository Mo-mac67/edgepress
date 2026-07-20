import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";

const CONTENT = {
  en: {
    title: "Terms of use",
    updated: "Last updated: July 2026",
    sections: [
      ["The service", "This website presents information about this site and lets you request a quote or consultation. It is operated by this site."],
      ["Estimates are not contracts", "Any figures, timelines or descriptions shown on this site are for general information only. A binding price and scope are provided only in a written contract signed after an on-site consultation. Photographs are representative and may include past or sample projects."],
      ["Requesting a quote", "When you submit the quote form you consent to us contacting you about your enquiry. Please provide accurate information so we can respond appropriately. Submitting a request does not create a contract or obligation on either side."],
      ["Intellectual property", "The content, branding and images on this site may not be copied or reused without permission. Stock photography is used under licence from its providers."],
      ["Liability", "The site is provided \"as is\". To the maximum extent permitted by law, this site is not liable for decisions made in reliance on general information on this site. Nothing here limits your rights under applicable consumer-protection or warranty law."],
      ["Contact", "Questions about these terms? Contact us using the details on this site."],
    ],
  },
  fr: {
    title: "Conditions d'utilisation",
    updated: "Dernière mise à jour : juillet 2026",
    sections: [
      ["Le service", "Ce site présente de l'information sur this site et vous permet de demander une soumission ou une consultation. Il est exploité par this site."],
      ["Des estimations, pas des contrats", "Les chiffres, délais ou descriptions affichés sur ce site sont fournis à titre informatif seulement. Un prix et une portée contractuels ne sont établis que dans un contrat écrit signé après une consultation sur place. Les photographies sont représentatives et peuvent inclure des projets antérieurs ou types."],
      ["Demande de soumission", "En soumettant le formulaire, vous consentez à ce que nous vous contactions au sujet de votre demande. Veuillez fournir des renseignements exacts afin que nous puissions répondre adéquatement. Une demande ne crée aucun contrat ni obligation de part et d'autre."],
      ["Propriété intellectuelle", "Le contenu, l'image de marque et les images de ce site ne peuvent être copiés ou réutilisés sans autorisation. Les photographies de banque d'images sont utilisées sous licence de leurs fournisseurs."],
      ["Responsabilité", "Le site est fourni « tel quel ». Dans la mesure permise par la loi, this site décline toute responsabilité quant aux décisions fondées sur l'information générale de ce site. Rien ici ne limite vos droits en vertu des lois applicables sur la protection du consommateur ou la garantie."],
      ["Contact", "Des questions sur ces conditions? Contactez-nous à l'aide des coordonnées indiquées sur ce site."],
    ],
  },
} as const;

export default async function TermsPage({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = CONTENT[lang as keyof typeof CONTENT] ?? CONTENT.en;

  return (
    <article className="container-page max-w-3xl pt-32 pb-12">
      <h1 className="text-3xl font-bold">{c.title}</h1>
      <p className="mt-2 text-sm text-ink-soft">{c.updated}</p>
      {c.sections.map(([h, body]) => (
        <section key={h} className="mt-8">
          <h2 className="text-xl font-semibold">{h}</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">{body}</p>
        </section>
      ))}
    </article>
  );
}
