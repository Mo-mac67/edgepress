import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";

const CONTENT = {
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
} as const;

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = CONTENT[lang];

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
