import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ChatCircleText,
  Eye,
  PaperPlaneTilt,
  Lightning,
  MagicWand,
  Robot,
  Gift,
} from '@phosphor-icons/react/dist/ssr';
import { JsonLd } from '@/components/seo/json-ld';
import { Button } from '@/components/ui/button';
import { HeroVisual } from '@/components/marketing/hero-visual';
import { Reveal } from '@/components/marketing/reveal';

/**
 * Homepage - unique title/description per CLAUDE.md §11, targeting real
 * keyword intent ("Instagram auto reply tool", "comment to DM automation").
 * Design per `taste-skill` (CLAUDE.md §12): asymmetric split hero, bento
 * feature grid, distinct layout family per section.
 */
export const metadata: Metadata = {
  title: 'Convozy: Instagram Auto Reply & Comment-to-DM Automation Tool',
  description:
    'Automatically reply to Instagram comments and send DMs when someone comments a keyword on your Reel or post. Free to start, no code required.',
  openGraph: {
    title: 'Convozy: Instagram Auto Reply & Comment-to-DM Automation Tool',
    description: 'Turn "comment X and I\'ll DM you" into a fully automated flow. Free to start.',
    url: '/',
    siteName: 'Convozy',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Convozy: Instagram Auto Reply & Comment-to-DM Automation Tool',
    description: 'Turn "comment X and I\'ll DM you" into a fully automated flow. Free to start.',
  },
  alternates: {
    canonical: '/',
  },
};

const STEPS = [
  {
    icon: ChatCircleText,
    title: 'Set your trigger word',
    body: 'Pick a keyword, like "PRICE" or "LINK", tied to a post or Reel.',
  },
  {
    icon: Eye,
    title: 'Convozy watches for it',
    body: 'Every new comment is checked in real time against your automations.',
  },
  {
    icon: PaperPlaneTilt,
    title: 'They get an instant DM',
    body: 'The reply, link, or AI-personalized message lands in seconds.',
  },
];

export default function HomePage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does Instagram comment-to-DM automation work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Convozy watches comments on your Instagram posts and Reels in real time. When someone comments a keyword you choose, Convozy automatically sends them a DM, instantly and without manual work.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Convozy free to use?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Convozy has a free tier for creators getting started, with paid plans for higher volume and AI-powered features.',
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={faqJsonLd} />

      {/* Hero: asymmetric split */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-24">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Turn Instagram comments into instant DMs
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Comment a keyword, get an instant DM. Convozy automates the reply so you don&apos;t
            have to.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/app/login">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/features/comment-to-dm">See how it works</Link>
            </Button>
          </div>
        </div>

        <HeroVisual />
      </section>

      {/* How it works: numbered horizontal steps, distinct layout family */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Reveal>
            <h2 className="max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
              From comment to conversation in three steps
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.08}>
                <div className="flex flex-col gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/12 text-accent">
                    <step.icon size={22} weight="bold" />
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Feature bento: 4 cells, real visual variation on 2-3 */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal>
          <h2 className="max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for creators, not marketing teams
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
          <Reveal>
            <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[var(--radius-card)] bg-accent p-7 text-accent-foreground md:col-span-2 md:row-span-1">
              <div
                className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
                aria-hidden="true"
              />
              <Lightning size={26} weight="fill" />
              <div>
                <h3 className="text-xl font-semibold">Delivered in seconds</h3>
                <p className="mt-2 max-w-sm text-accent-foreground/90">
                  No queues, no delays. The DM sends the moment a comment matches.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-card p-7">
              <MagicWand size={24} className="text-accent" weight="bold" />
              <div>
                <h3 className="text-lg font-semibold">Exact, partial, or AI matching</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Match a keyword exactly, or let AI understand intent.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-gradient-to-br from-muted to-card p-7">
              <Robot size={24} className="text-accent" weight="bold" />
              <div>
                <h3 className="text-lg font-semibold">AI-personalized replies</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Opt in per automation. Off by default, your call when to use it.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-card p-7 md:col-span-2">
              <Gift size={24} className="text-accent" weight="bold" />
              <div>
                <h3 className="text-lg font-semibold">Free to start</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  A genuinely usable free plan, with paid tiers only for higher volume.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing teaser: distinct layout family */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Simple pricing, free to start
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:max-w-2xl">
            <Reveal>
              <div className="rounded-[var(--radius-card)] border border-border bg-card p-7">
                <h3 className="text-sm font-semibold text-muted-foreground">Free</h3>
                <p className="mt-2 text-3xl font-semibold">$0</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Everything you need to try Convozy on a real account.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="rounded-[var(--radius-card)] border border-accent bg-card p-7">
                <h3 className="text-sm font-semibold text-accent">Pro</h3>
                <p className="mt-2 text-3xl font-semibold">For scale</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Higher volume and AI features, for creators outgrowing Free.
                </p>
              </div>
            </Reveal>
          </div>

          <Button asChild variant="outline" className="mt-8">
            <Link href="/pricing">See full pricing</Link>
          </Button>
        </div>
      </section>

      {/* Final CTA: distinct layout family, centered */}
      <section className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <Reveal>
          <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Set up your first automation in minutes
          </h2>
          <Button asChild size="lg" className="mt-8">
            <Link href="/app/login">Start free</Link>
          </Button>
        </Reveal>
      </section>
    </>
  );
}
