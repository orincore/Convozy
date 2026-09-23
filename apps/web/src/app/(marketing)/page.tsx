import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ChatCircleText,
  Eye,
  PaperPlaneTilt,
  Lightning,
  MagicWand,
  ShieldCheck,
  Gift,
} from '@phosphor-icons/react/dist/ssr';
import { JsonLd } from '@/components/seo/json-ld';
import { Button } from '@/components/ui/button';
import { Bezel } from '@/components/marketing/bezel';
import { CtaButton } from '@/components/marketing/cta-button';
import { InkReveal } from '@/components/marketing/ink-reveal';
import { LiveDemo } from '@/components/marketing/live-demo';
import { ActivityFeed } from '@/components/marketing/activity-feed';
import { Parallax } from '@/components/marketing/parallax';
import { Faq } from '@/components/marketing/faq';
import { Lattice } from '@/components/marketing/lattice';
import { AutomationPreview } from '@/components/marketing/automation-preview';
import { Reveal } from '@/components/marketing/reveal';
import { SpotlightCard } from '@/components/marketing/spotlight-card';
import { BlurHighlight } from '@/components/marketing/blur-highlight';
import { IntegrationBadges } from '@/components/marketing/integration-badges';

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
    title: 'Pick your keyword',
    body: 'Something like "PRICE" or "LINK", tied to a post or Reel.',
  },
  {
    icon: Eye,
    title: "Convozy keeps watch",
    body: 'Every comment gets checked the second it comes in, day or night.',
  },
  {
    icon: PaperPlaneTilt,
    title: 'They get an instant DM',
    body: 'The reply or link lands in their inbox in seconds. You never lift a finger.',
  },
];

const FAQS = [
  {
    question: 'How does comment-to-DM automation work?',
    answer:
      'You pick a keyword like PRICE. When someone comments it on your post or Reel, Convozy sends them your DM straight away. You never type a reply.',
  },
  {
    question: 'Is it really free?',
    answer:
      'Yes. The Free plan is not a trial and needs no card. Paid plans are only for creators who send a lot of DMs or run more than one account.',
  },
  {
    question: 'Will people get the same DM twice?',
    answer: 'No. Every comment gets one reply, even if Instagram tells us about it more than once.',
  },
  {
    question: 'Do I need to know how to code?',
    answer: 'Not at all. You choose a keyword, write your message and switch it on.',
  },
  {
    question: 'Can I disconnect my Instagram account?',
    answer:
      'Any time. Disconnecting stops Convozy straight away, and you can ask us to delete your data.',
  },
];

export default function HomePage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <>
      <JsonLd data={faqJsonLd} />

      {/* Hero: asymmetric split */}
      <section className="mx-auto grid max-w-7xl items-center gap-16 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-20">
        <div>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Turn Instagram comments into <InkReveal text="instant DMs" />
          </h1>
          <BlurHighlight
            as="p"
            text="Comment a keyword, get an instant DM. Convozy automates the reply so you don't have to."
            highlight={['keyword', 'instant', "don't"]}
            className="mt-6 max-w-md text-lg text-muted-foreground"
          />
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <CtaButton href="/app/login">Start free</CtaButton>
            <CtaButton href="/features/comment-to-dm" variant="ghost">
              See how it works
            </CtaButton>
          </div>
        </div>

        <div className="relative">
          <AutomationPreview />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <IntegrationBadges />
      </div>

      {/* Live examples */}
      <section className="mx-auto max-w-7xl px-4 py-28 sm:px-6">
        <Reveal>
          <h2 className="font-display max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Watch a comment turn into a DM
          </h2>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            Pick a keyword below. This is an example of what happens on your account, on its own.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Parallax from={30} to={-30}>
              <Reveal>
                <Bezel>
                  <LiveDemo />
                </Bezel>
              </Reveal>
            </Parallax>
          </div>
          <div className="lg:col-span-5">
            <Parallax from={-30} to={30}>
              <Reveal delay={0.1}>
                <Bezel>
                  <ActivityFeed />
                </Bezel>
              </Reveal>
            </Parallax>
          </div>
        </div>
      </section>

      {/* How it works: numbered horizontal steps, distinct layout family */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6">
          <Reveal>
            <h2 className="font-display max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
              From comment to conversation in three steps
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.08}>
                <div className="flex flex-col gap-4">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-accent/12 text-accent">
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-accent/20 motion-safe:animate-ping"
                      style={{ animationDelay: `${index * 0.9}s`, animationDuration: '3.2s' }}
                    />
                    <step.icon size={22} weight="bold" className="relative" />
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
      <section className="mx-auto max-w-7xl px-4 py-28 sm:px-6">
        <Reveal>
          <h2 className="font-display max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for creators, not marketing teams
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
          <Reveal>
            <SpotlightCard className="flex h-full flex-col justify-between rounded-[var(--radius-card)] bg-accent p-7 text-accent-foreground md:col-span-2 md:row-span-1">
              <div
                className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
                aria-hidden="true"
              />
              <Lightning size={26} weight="fill" className="float-y" />
              <div>
                <h3 className="text-xl font-semibold">Delivered in seconds</h3>
                <p className="mt-2 max-w-sm text-accent-foreground/90">
                  No queues, no delays. The DM sends the moment a comment matches.
                </p>
              </div>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={0.06}>
            <SpotlightCard className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-card p-7">
              <MagicWand size={24} className="float-y text-accent [animation-delay:-1s]" weight="bold" />
              <div>
                <h3 className="text-lg font-semibold">Catches it however they type it</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Word for word, hidden in a longer comment, or your own custom rule if you want
                  to get specific.
                </p>
              </div>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={0.12}>
            <SpotlightCard className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-gradient-to-br from-muted to-card p-7">
              <ShieldCheck size={24} className="float-y text-accent [animation-delay:-2s]" weight="bold" />
              <div>
                <h3 className="text-lg font-semibold">Nobody gets double-DM&apos;d</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Every comment only gets one reply, ever, even if Instagram sends it to us twice.
                </p>
              </div>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={0.18}>
            <SpotlightCard className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-card p-7 md:col-span-2">
              <Gift size={24} className="float-y text-accent [animation-delay:-3s]" weight="bold" />
              <div>
                <h3 className="text-lg font-semibold">Actually free, not a trial</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  No card on file, no 14-day countdown. You only pay once you outgrow it.
                </p>
              </div>
            </SpotlightCard>
          </Reveal>
        </div>
      </section>

      {/* Pricing teaser: distinct layout family */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              You built the audience. Replying to them shouldn&apos;t cost you.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Most tools charge creators just to answer their own comments. We think that&apos;s
              backwards, so the features that matter are free here. Every day you wait is
              another pile of comments nobody answered.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:max-w-2xl">
            <Reveal>
              <div className="rounded-[var(--radius-card)] border border-border bg-card p-7">
                <h3 className="text-sm font-semibold text-muted-foreground">Free</h3>
                <p className="mt-2 text-3xl font-semibold">$0</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Real automations on your real account. Not a trial, and no card needed.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="rounded-[var(--radius-card)] border border-accent bg-card p-7">
                <h3 className="text-sm font-semibold text-accent">Pro</h3>
                <p className="mt-2 text-3xl font-semibold">When you&apos;re big</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  More DMs a month and more accounts, once Free isn&apos;t enough for you.
                </p>
              </div>
            </Reveal>
          </div>

          <Button asChild variant="outline" className="mt-8">
            <Link href="/pricing">See full pricing</Link>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-28 sm:px-6">
        <Reveal>
          <h2 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Questions creators ask
          </h2>
        </Reveal>
        <div className="mt-12">
          <Faq items={FAQS} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <Reveal>
          <Lattice>
            <div className="px-6 py-24 text-center">
              <h2 className="font-display mx-auto max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Your next viral post shouldn&apos;t go unanswered
              </h2>
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">
                Set up your first automation in a few minutes, free.
              </p>
              <div className="mt-10">
                <CtaButton href="/app/login">Start free</CtaButton>
              </div>
            </div>
          </Lattice>
        </Reveal>
      </section>
    </>
  );
}
