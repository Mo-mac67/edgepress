import type { LocalizedText } from "./types";

export interface EmailTemplate {
  id: string;
  name: LocalizedText;
  subject: LocalizedText;
  body: LocalizedText;
}

/** Generic CRM reply templates. Placeholders {name} and {city} are filled in
 *  when a template is applied; owners edit the copy in the admin panel. */
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "confirmation",
    name: { en: "Enquiry received", fr: "Demande reçue" },
    subject: {
      en: "We've received your message",
      fr: "Nous avons bien reçu votre message",
    },
    body: {
      en: "Hi {name},\n\nThank you for reaching out. This is a quick note to confirm we've received your message and it's now with our team.\n\nWe'll review the details and get back to you personally within one business day.\n\nWarm regards,\nThe team",
      fr: "Bonjour {name},\n\nMerci de nous avoir contactés. Ce court message confirme que nous avons bien reçu votre demande et qu'elle est maintenant entre les mains de notre équipe.\n\nNous examinerons les détails et vous répondrons personnellement d'ici un jour ouvrable.\n\nCordialement,\nL'équipe",
    },
  },
  {
    id: "followup",
    name: { en: "Follow-up", fr: "Suivi" },
    subject: { en: "Following up on your message", fr: "Suivi de votre message" },
    body: {
      en: "Hi {name},\n\nI wanted to follow up on the message you sent us a few days ago. We'd still be glad to help.\n\nHave you had a chance to think it over? If you have any questions, just reply to this email and we'll take it from there.\n\nWarm regards,\nThe team",
      fr: "Bonjour {name},\n\nJe fais un suivi concernant le message que vous nous avez envoyé il y a quelques jours. Nous serions toujours ravis de vous aider.\n\nAvez-vous eu l'occasion d'y réfléchir? Si vous avez des questions, répondez simplement à ce courriel et nous nous en occuperons.\n\nCordialement,\nL'équipe",
    },
  },
  {
    id: "consultation",
    name: { en: "Book a call", fr: "Planifier un appel" },
    subject: { en: "Let's book a quick call", fr: "Planifions un court appel" },
    body: {
      en: "Hi {name},\n\nI'd like to book a short, no-obligation call to discuss how we can help. We'll review your goals and outline the next steps.\n\nDoes this week work for you?\n\nWarm regards,\nThe team",
      fr: "Bonjour {name},\n\nJ'aimerais planifier un court appel sans engagement pour voir comment nous pouvons vous aider. Nous passerons en revue vos objectifs et définirons les prochaines étapes.\n\nEst-ce que cette semaine vous convient?\n\nCordialement,\nL'équipe",
    },
  },
  {
    id: "proposal",
    name: { en: "Proposal ready", fr: "Proposition prête" },
    subject: { en: "Your proposal is ready", fr: "Votre proposition est prête" },
    body: {
      en: "Hi {name},\n\nWe've prepared a proposal for you. I'd be glad to walk you through the details so everything is clear.\n\nReply with a good time and I'll get in touch.\n\nWarm regards,\nThe team",
      fr: "Bonjour {name},\n\nNous avons préparé une proposition pour vous. Je serais ravi de vous en expliquer les détails afin que tout soit clair.\n\nRépondez avec un bon moment et je vous contacterai.\n\nCordialement,\nL'équipe",
    },
  },
];
