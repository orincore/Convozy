import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { LegalArticle } from '@/components/marketing/legal-article';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';
const LAST_UPDATED = '2026-09-22';

/**
 * Required for Meta App Review (Basic Settings → Terms of Service URL).
 * Not a substitute for legal review in your jurisdiction — treat this as a
 * solid working draft to have reviewed before relying on it for compliance.
 */
export const metadata: Metadata = {
  title: 'Terms of Service | Convozy',
  description: 'The terms that govern your use of Convozy.',
  robots: { index: true, follow: true },
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsOfServicePage() {
  return (
    <LegalArticle
      breadcrumb={
        <Breadcrumbs
          baseUrl={SITE_URL}
          items={[
            { name: 'Home', href: '/' },
            { name: 'Terms of Service', href: '/terms' },
          ]}
        />
      }
    >
      <h1>Terms of Service</h1>
      <p>Last updated: {LAST_UPDATED}</p>

      <h2>1. Acceptance</h2>
      <p>
        By creating an account or connecting an Instagram Business Account to Convozy
        (convozy.orincore.com, a product of Orincore), you agree to these terms.
      </p>

      <h2>2. The service</h2>
      <p>
        Convozy lets you configure automations that watch comments, direct messages, and story
        replies on your connected Instagram Business Account(s) and automatically send a reply or
        direct message when a keyword rule you define is matched. We provide a free tier with
        usage limits and paid plans with higher limits and additional features.
      </p>

      <h2>3. Your account and Instagram connection</h2>
      <ul>
        <li>You must have the right to connect the Instagram Business Account(s) you link to Convozy.</li>
        <li>You&rsquo;re responsible for the automations you configure and the content they send.</li>
        <li>You can disconnect an Instagram account at any time, which immediately stops Convozy from acting on it.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree not to use Convozy to:</p>
      <ul>
        <li>Violate Instagram&rsquo;s or Meta&rsquo;s Platform Terms, Community Standards, or any applicable law.</li>
        <li>Send spam, unsolicited bulk messages, or deceptive content to Instagram users.</li>
        <li>Collect or process Instagram users&rsquo; data beyond what&rsquo;s needed to run the automations you&rsquo;ve configured.</li>
        <li>Attempt to circumvent Instagram/Meta rate limits or platform policies.</li>
      </ul>
      <p>We may suspend or terminate accounts that violate this section.</p>

      <h2>5. Plans and billing</h2>
      <p>
        Free-tier limits and paid-plan pricing are shown at{' '}
        <a href="/pricing">convozy.orincore.com/pricing</a>. Paid subscriptions are billed via
        Stripe or Razorpay depending on your billing region and renew automatically until
        cancelled. You can cancel at any time from your account settings; cancellation takes
        effect at the end of the current billing period.
      </p>

      <h2>6. Service availability</h2>
      <p>
        We aim for high availability but don&rsquo;t guarantee uninterrupted service. Convozy also
        depends on the Meta Graph API being available and within its own rate limits. We&rsquo;re
        not responsible for delays or failures caused by Meta&rsquo;s platform.
      </p>

      <h2>7. Termination</h2>
      <p>
        You may stop using Convozy and delete your account at any time. See our{' '}
        <a href="/data-deletion">Data Deletion Instructions</a>. We may suspend or terminate
        accounts that violate these terms or Instagram/Meta&rsquo;s platform policies.
      </p>

      <h2>8. Disclaimer and limitation of liability</h2>
      <p>
        Convozy is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum extent
        permitted by law, Orincore is not liable for indirect, incidental, or consequential
        damages arising from your use of Convozy.
      </p>

      <h2>9. Changes</h2>
      <p>We&rsquo;ll update the &ldquo;Last updated&rdquo; date above when these terms change.</p>

      <h2>10. Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:support@orincore.com">support@orincore.com</a>
      </p>
    </LegalArticle>
  );
}
