import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { LegalArticle } from '@/components/marketing/legal-article';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';
const LAST_UPDATED = '2026-09-22';

/**
 * Required for Meta App Review (Basic Settings → Data Deletion Instructions
 * URL). This is the "instructions" form of the requirement (a page
 * explaining the manual process) rather than the automated Data Deletion
 * Callback URL form — either satisfies Meta's requirement. If this becomes
 * high-volume, consider building the callback endpoint instead (Phase 8+).
 */
export const metadata: Metadata = {
  title: 'Data Deletion Instructions | Convozy',
  description: 'How to request deletion of your data, or your Instagram audience’s data, from Convozy.',
  robots: { index: true, follow: true },
  alternates: {
    canonical: '/data-deletion',
  },
};

export default function DataDeletionPage() {
  return (
    <LegalArticle
      breadcrumb={
        <Breadcrumbs
          baseUrl={SITE_URL}
          items={[
            { name: 'Home', href: '/' },
            { name: 'Data Deletion Instructions', href: '/data-deletion' },
          ]}
        />
      }
    >
      <h1>Data Deletion Instructions</h1>
      <p>Last updated: {LAST_UPDATED}</p>

      <h2>If you&rsquo;re a Convozy creator</h2>
      <p>You can remove your data in two ways:</p>
      <ul>
        <li>
          <strong>Disconnect an Instagram account:</strong> from your Convozy dashboard, go to
          Settings → Connected Accounts and disconnect it. This immediately stops Convozy from
          making any further calls to Meta on your behalf and revokes our stored access token
          for that account.
        </li>
        <li>
          <strong>Delete your Convozy account entirely:</strong> email{' '}
          <a href="mailto:privacy@orincore.com">privacy@orincore.com</a> from the email address on
          your account requesting deletion. We&rsquo;ll delete your account, connected Instagram
          account records, stored access tokens, and associated automation configurations within
          30 days, except where we&rsquo;re required to retain billing records for legal/tax
          purposes.
        </li>
      </ul>

      <h2>If you&rsquo;re someone who commented on or messaged a Convozy user&rsquo;s Instagram account</h2>
      <p>
        Convozy only stores the minimum data needed to run the creator&rsquo;s automation (your
        Instagram-scoped user ID, username, and the text of the relevant comment/message) and does
        not use it for any purpose beyond that. To request deletion of this data, email{' '}
        <a href="mailto:privacy@orincore.com">privacy@orincore.com</a> with the Instagram username
        involved and the creator&rsquo;s account (if known); we&rsquo;ll locate and delete matching
        records within 30 days.
      </p>

      <h2>Questions</h2>
      <p>
        <a href="mailto:privacy@orincore.com">privacy@orincore.com</a>. See also our{' '}
        <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalArticle>
  );
}
