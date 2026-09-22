import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { LegalArticle } from '@/components/marketing/legal-article';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';
const LAST_UPDATED = '2026-09-22';

/**
 * Required for Meta App Review (Basic Settings → Privacy Policy URL) before
 * any permission beyond Standard Access can be requested. Content reflects
 * the actual data flows in ARCHITECTURE.md §4/§6/§8 — keep it in sync as
 * those change. Not a substitute for legal review in your jurisdiction.
 */
export const metadata: Metadata = {
  title: 'Privacy Policy | Convozy',
  description:
    'How Convozy collects, uses, and protects your data and your Instagram audience’s data.',
  robots: { index: true, follow: true },
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalArticle
      breadcrumb={
        <Breadcrumbs
          baseUrl={SITE_URL}
          items={[
            { name: 'Home', href: '/' },
            { name: 'Privacy Policy', href: '/privacy' },
          ]}
        />
      }
    >
      <h1>Privacy Policy</h1>
      <p>Last updated: {LAST_UPDATED}</p>

      <h2>1. Who we are</h2>
      <p>
        Convozy (&ldquo;Convozy&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a product of Orincore,
        available at convozy.orincore.com. Convozy helps Instagram creators automatically reply to
        comments and send direct messages when a viewer comments a chosen keyword on a post or
        Reel.
      </p>

      <h2>2. What we collect</h2>
      <p>When you (a creator) connect an Instagram Business Account to Convozy, we collect:</p>
      <ul>
        <li>
          Your Instagram Business Account ID, username, and a long-lived access token issued by
          Meta, which we store encrypted at rest (AES-256-GCM) and never in plain text or logs.
        </li>
        <li>Your account details for Convozy itself: email address and a hashed password.</li>
        <li>
          Billing details processed by our payment providers (Stripe, Razorpay). We do not store
          full card numbers ourselves.
        </li>
      </ul>
      <p>
        When someone comments on, or sends a direct message in response to, one of your posts or
        Reels, and that comment matches an automation you&rsquo;ve set up, we process:
      </p>
      <ul>
        <li>The commenter&rsquo;s Instagram-scoped user ID and username.</li>
        <li>The text of the comment or message, only as needed to match it against your automation rules and to send the configured reply.</li>
      </ul>

      <h2>3. How we use it</h2>
      <ul>
        <li>To operate the comment-to-DM automation you configure: matching keywords and sending the reply you set up, via the Instagram Graph API.</li>
        <li>To show you delivery status and basic analytics for your own automations.</li>
        <li>To enforce plan limits (e.g. free-tier monthly send caps) and process billing.</li>
        <li>
          If you explicitly enable an AI-powered feature (e.g. AI-drafted replies), the relevant
          comment/message text is sent to our AI provider solely to generate that reply. This only
          happens for automations where you&rsquo;ve turned an AI feature on.
        </li>
      </ul>
      <p>We do not sell your data, or your audience&rsquo;s data, to third parties.</p>

      <h2>4. Data retention</h2>
      <p>
        We retain comment/message event data and delivery logs for as long as your account is
        active, to power analytics and automation history. You can request deletion of your
        account and associated data at any time. See our{' '}
        <a href="/data-deletion">Data Deletion Instructions</a>.
      </p>

      <h2>5. Your rights</h2>
      <p>
        You can request access to, correction of, or deletion of your data by contacting us at{' '}
        <a href="mailto:privacy@orincore.com">privacy@orincore.com</a>. Disconnecting an Instagram
        account from Convozy immediately stops us from making further Graph API calls on your
        behalf and revokes our use of the associated access token.
      </p>

      <h2>6. Third-party services</h2>
      <p>
        Convozy relies on the Meta Graph API (Instagram), Stripe and Razorpay (payments), and,
        only for opted-in AI features, a third-party AI provider. Each of these processes data
        under their own privacy policy in addition to this one.
      </p>

      <h2>7. Security</h2>
      <p>
        Instagram access tokens are encrypted at rest. All traffic to Convozy is served over TLS.
        See our engineering practices for more detail if you have questions:{' '}
        <a href="mailto:privacy@orincore.com">privacy@orincore.com</a>.
      </p>

      <h2>8. Children&rsquo;s privacy</h2>
      <p>Convozy is not directed at children under 13, and we do not knowingly collect data from them.</p>

      <h2>9. Changes to this policy</h2>
      <p>
        We&rsquo;ll update the &ldquo;Last updated&rdquo; date above when this policy changes, and post
        material changes here.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about this policy: <a href="mailto:privacy@orincore.com">privacy@orincore.com</a>
      </p>
    </LegalArticle>
  );
}
