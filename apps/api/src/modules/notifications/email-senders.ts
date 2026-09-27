/**
 * Every outbound email is sent from one of these aliases, never a raw
 * mailbox string built inline at the call site — keeps the "From" address
 * consistent with what's actually verified in SES and makes it obvious at a
 * glance which mail stream a given send belongs to.
 */
export type EmailSenderKind =
  | 'verify'
  | 'security'
  | 'noreply'
  | 'billing'
  | 'support'
  | 'marketing'
  | 'careers';

const DOMAIN = 'notifications.orincore.com';

export const EMAIL_SENDERS: Record<EmailSenderKind, string> = {
  verify: `Convozy <verify@${DOMAIN}>`,
  security: `Convozy Security <security@${DOMAIN}>`,
  noreply: `Convozy <noreply@${DOMAIN}>`,
  billing: `Convozy Billing <billing@${DOMAIN}>`,
  support: `Convozy Support <support@${DOMAIN}>`,
  marketing: `Convozy <marketing@${DOMAIN}>`,
  careers: `Convozy Careers <careers@${DOMAIN}>`,
};
