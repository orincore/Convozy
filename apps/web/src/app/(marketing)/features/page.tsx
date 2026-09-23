import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { Reveal } from '@/components/marketing/reveal';
import { FeatureCard } from '@/components/marketing/feature-card';
import { SpotlightCard } from '@/components/marketing/spotlight-card';
import { FEATURES } from '@/lib/features';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  title: 'Features | Convozy',
  description:
    'Everything Convozy does for Instagram creators: comment to DM, story replies, live comments, tags, templates and more. All free.',
  alternates: { canonical: '/features' },
};

const live = FEATURES.filter((f) => f.status === 'live');
const soon = FEATURES.filter((f) => f.status === 'soon');

export default function FeaturesIndexPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <Breadcrumbs
        baseUrl={SITE_URL}
        items={[
          { name: 'Home', href: '/' },
          { name: 'Features', href: '/features' },
        ]}
      />

      <h1 className="font-display mt-8 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
        Everything you would pay for elsewhere, free
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted-foreground">
        Creators should not pay just to answer their own followers. Every feature that works today is on the free
        plan, and the ones on the way are planned to be free too.
      </p>

      <Reveal>
        <Link href="/features/comment-to-dm" className="mt-12 block">
          <SpotlightCard className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-card p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-2xl font-semibold">Comment to DM</h2>
              <p className="mt-2 max-w-lg text-muted-foreground">
                Someone comments your keyword on a post or Reel and gets your DM straight away. You never type a
                reply. The one that started it all.
              </p>
            </div>
            <ArrowRight size={24} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
          </SpotlightCard>
        </Link>
      </Reveal>

      <h2 className="font-display mt-24 text-3xl font-semibold tracking-tight">Working today</h2>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {live.map((f, i) => (
          <Reveal key={f.id} delay={(i % 3) * 0.07}>
            <FeatureCard feature={f} />
          </Reveal>
        ))}
      </div>

      <h2 className="font-display mt-24 text-3xl font-semibold tracking-tight">On the way</h2>
      <p className="mt-2 text-muted-foreground">Planned, not ready yet.</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {soon.map((f, i) => (
          <Reveal key={f.id} delay={(i % 3) * 0.07}>
            <FeatureCard feature={f} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
