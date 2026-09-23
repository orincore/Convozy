import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ChatsCircle, PaperPlaneTilt, Broadcast } from '@phosphor-icons/react/dist/ssr';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Reveal } from '@/components/marketing/reveal';
import { SpotlightCard } from '@/components/marketing/spotlight-card';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  title: 'Features | Convozy',
  description:
    'What Convozy automates on Instagram today, and what is next: comment-to-DM automation, live now, with DM and story-reply automation in active development.',
  alternates: {
    canonical: '/features',
  },
};

const LIVE_FEATURE = {
  href: '/features/comment-to-dm',
  title: 'Comment to DM',
  description:
    'Someone comments your keyword on a post or Reel and gets your DM straight away. You never type a reply.',
};

const ROADMAP = [
  {
    icon: PaperPlaneTilt,
    title: 'DM keyword automation',
    body: 'Reply automatically when someone DMs you a keyword, not just when they comment.',
  },
  {
    icon: ChatsCircle,
    title: 'Story reply automation',
    body: 'Reply automatically when people respond to your Story.',
  },
  {
    icon: Broadcast,
    title: 'Live comment automation',
    body: 'Answer keyword comments while you are live.',
  },
];

/**
 * Only one automation type is actually built (comment-to-DM, Phase 1-3 in
 * TRACKER.md). The roadmap section is labeled "in development" rather than
 * fabricated as shipped, per CLAUDE.md §14 (no silent partial claims) and
 * the product scope in CLAUDE.md §1 (comments, DMs, story replies, live
 * comments are the intended surface area).
 */
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

      <h1 className="font-display mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">
        What Convozy automates
      </h1>
      <p className="mt-4 max-w-lg text-lg text-muted-foreground">
        One automation is live today, and free to use. More are on the way.
      </p>

      <Reveal>
        <Link href={LIVE_FEATURE.href} className="mt-10 block">
          <SpotlightCard className="flex flex-col items-start justify-between gap-6 rounded-[var(--radius-card)] border border-foreground bg-card p-8 sm:flex-row sm:items-center">
            <div>
              <Badge variant="solid">Live now</Badge>
              <h2 className="mt-3 text-2xl font-semibold">{LIVE_FEATURE.title}</h2>
              <p className="mt-2 max-w-md text-muted-foreground">{LIVE_FEATURE.description}</p>
            </div>
            <ArrowRight
              size={24}
              className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground"
            />
          </SpotlightCard>
        </Link>
      </Reveal>

      <div className="mt-20">
        <h2 className="font-display text-xl font-semibold">In development</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {ROADMAP.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.06}>
              <div className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-dashed border-border p-6">
                <item.icon size={22} className="text-muted-foreground" weight="bold" />
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.body}</p>
                <Badge variant="outline" className="mt-auto w-fit">
                  In development
                </Badge>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
