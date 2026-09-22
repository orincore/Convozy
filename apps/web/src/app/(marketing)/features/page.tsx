import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  title: 'Features | Convozy',
  description: 'What Convozy automates on Instagram: comments, DMs, and more.',
  alternates: {
    canonical: '/features',
  },
};

const FEATURES = [
  {
    href: '/features/comment-to-dm',
    title: 'Comment to DM',
    description: 'Turn a comment keyword into an instant, automatic direct message.',
  },
];

export default function FeaturesIndexPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <Breadcrumbs
        baseUrl={SITE_URL}
        items={[
          { name: 'Home', href: '/' },
          { name: 'Features', href: '/features' },
        ]}
      />

      <h1 className="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">
        What Convozy automates
      </h1>

      <div className="mt-10 flex flex-col divide-y divide-border border-y border-border">
        {FEATURES.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group flex items-center justify-between gap-6 py-6 transition-colors hover:text-foreground"
          >
            <div>
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
            </div>
            <ArrowRight
              size={20}
              className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
