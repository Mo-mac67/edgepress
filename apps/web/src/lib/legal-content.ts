/**
 * Default legal copy (privacy / terms). New installs get these seeded as
 * EDITABLE system CMS pages; existing installs render them as a built-in
 * fallback until the owner creates a page with the same slug (which then takes
 * over). Generic placeholder copy — owners should review and adapt it.
 */

type LegalSection = readonly [string, string];
interface LegalDoc {
  title: string;
  updated: string;
  sections: readonly LegalSection[];
}

export const LEGAL: Record<"privacy" | "terms", Record<"en" | "fr", LegalDoc>> = {
  privacy: {
    en: {
      title: "Privacy policy",
      updated: "Last updated: July 2026",
      sections: [
        ["What we collect", "When you request a quote or contact us, we collect the information you provide: name, email, phone number, the city or area of your project, project type, budget and timeline, any details you share, and your preferred contact times. We also collect basic analytics (pages viewed, form starts) tied to a random session identifier."],
        ["Why we collect it", "To respond to your enquiry, prepare an estimate, schedule a consultation, and follow up about your project. We rely on your consent, which you give by submitting the quote form or contacting us."],
        ["Who sees it", "Your details are visible to the this site team handling your enquiry. We do not sell your personal information. Service providers we use to operate the site (e.g. hosting, email delivery) process data on our behalf."],
        ["Retention & your rights", "We keep your information while your file is active and delete it on request. Under Canadian privacy law (PIPEDA, and Quebec's Law 25 where applicable) you may ask to access, correct or delete your personal information, or withdraw consent, at any time by contacting us."],
        ["Safeguards", "Data is stored on secured systems with access limited to authorized staff. No method of transmission or storage is 100% secure, but we take reasonable contractual, technical and organizational measures to protect it."],
        ["Contact", "For privacy questions or requests, contact us via the contact details on this site."],
      ],
    },
    fr: {
      title: "Politique de confidentialité",
      updated: "Dernière mise à jour : juillet 2026",
      sections: [
        ["Ce que nous recueillons", "Lorsque vous demandez une soumission ou nous contactez, nous recueillons les renseignements que vous fournissez : nom, courriel, téléphone, ville ou secteur du projet, type de projet, budget et échéancier, tout détail que vous partagez, et vos disponibilités. Nous recueillons aussi des données analytiques de base (pages vues, formulaires entamés) liées à un identifiant de session aléatoire."],
        ["Pourquoi nous les recueillons", "Pour répondre à votre demande, préparer une estimation, planifier une consultation et faire un suivi de votre projet. Nous nous appuyons sur votre consentement, donné lorsque vous soumettez le formulaire de soumission ou nous contactez."],
        ["Qui y a accès", "Vos renseignements sont visibles par l'équipe de this site qui traite votre demande. Nous ne vendons pas vos renseignements personnels. Des fournisseurs de services (hébergement, envoi de courriels) traitent des données pour notre compte."],
        ["Conservation et vos droits", "Nous conservons vos renseignements tant que votre dossier est actif et les supprimons sur demande. En vertu des lois canadiennes (LPRPDE et Loi 25 au Québec, le cas échéant), vous pouvez demander l'accès, la rectification ou la suppression de vos renseignements, ou retirer votre consentement, en tout temps."],
        ["Mesures de protection", "Les données sont stockées sur des systèmes sécurisés à accès restreint. Aucune méthode n'est sûre à 100 %, mais nous prenons des mesures contractuelles, techniques et organisationnelles raisonnables."],
        ["Contact", "Pour toute question ou demande relative à la vie privée, contactez-nous via les coordonnées indiquées sur ce site."],
      ],
    },
  },
  terms: {
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
  },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The doc as rich HTML — used to seed the editable CMS page. */
export function legalHtml(kind: "privacy" | "terms", locale: "en" | "fr"): string {
  const doc = LEGAL[kind][locale];
  return doc.sections.map(([h, body]) => `<h2>${esc(h)}</h2>\n<p>${esc(body)}</p>`).join("\n");
}
