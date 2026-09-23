import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/seo/json-ld';
import { Button } from '@/components/ui/button';
import { CtaButton } from '@/components/marketing/cta-button';
import { InkReveal } from '@/components/marketing/ink-reveal';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FEATURES } from '@/lib/features';
import { Audiences } from '@/components/marketing/audiences';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { DonateButton } from '@/components/marketing/donate-button';
import { FaqAside } from '@/components/marketing/faq-aside';
import { Faq, type FaqTab } from '@/components/marketing/faq';
import { Lattice } from '@/components/marketing/lattice';
import { AutomationPreview } from '@/components/marketing/automation-preview';
import { Reveal } from '@/components/marketing/reveal';
import { RotatingLines, type RotatingLine } from '@/components/marketing/rotating-lines';
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

const HERO_LINES: RotatingLine[] = [
  {
    text: "Comment a keyword, get an instant DM. Convozy automates the reply so you don't have to.",
    highlight: ['keyword', 'instant', "don't"],
  },
  { text: 'Your followers ask. Convozy answers. You keep scrolling.', highlight: ['answers'] },
  { text: 'Go to sleep. Your comments still get answered.', highlight: ['sleep'] },
  { text: 'Never leave a "link pls" comment on read again.', highlight: ['Never'] },
  { text: 'Reply to every comment without typing a single word.', highlight: ['every'] },
  { text: 'Like an assistant who never takes a lunch break.', highlight: ['never'] },
];


const FAQ_TABS: FaqTab[] = [
  {
    label: 'Start',
    faqs: [
      {
        question: 'How does comment-to-DM automation work?',
        answer:
          'You pick a keyword like PRICE. When someone comments it on your post or Reel, Convozy sends them your DM straight away. You never type a reply.',
      },
      {
        question: 'How long does setup take?',
        answer: 'A few minutes. Connect Instagram, choose a keyword, write your message and switch it on.',
      },
      {
        question: 'Do I need to know how to code?',
        answer: 'Not at all. There is nothing to install or code. You can even start from a ready-made template.',
      },
      {
        question: 'Which Instagram accounts can I use?',
        answer:
          'Instagram Business and Creator accounts. If yours is a personal account, you can switch to a Creator account for free inside Instagram.',
      },
      {
        question: 'Does it work on Stories and live videos?',
        answer: 'Yes. Story replies and live comments can trigger your automations too, not just comments on posts.',
      },
    ],
  },
  {
    label: 'Free plan',
    faqs: [
      {
        question: 'Is it really free?',
        answer:
          'Yes. The Free plan is not a trial and needs no card. Paid plans are only for creators who send a lot of DMs or run more than one account.',
      },
      {
        question: 'Are there any hidden charges?',
        answer: 'No. You only pay if you choose to upgrade, and you are never charged automatically.',
      },
      {
        question: 'What do I get on Pro?',
        answer: 'More DMs every month, more than one Instagram account, and priority support.',
      },
      {
        question: 'Do I need a credit card to start?',
        answer: 'No. Connect your Instagram account and start automating without entering payment details.',
      },
    ],
  },
  {
    label: 'Messages',
    faqs: [
      {
        question: 'Will people get the same DM twice?',
        answer: 'No. Every comment gets one reply, even if Instagram tells us about it more than once.',
      },
      {
        question: 'Can I choose who gets a DM?',
        answer:
          'Yes. Pick which posts an automation runs on, and send different replies depending on things like whether someone follows you.',
      },
      {
        question: 'What if someone replies to my DM?',
        answer:
          'Their reply lands in your Instagram inbox like any other message. A shared inbox inside Convozy is coming soon.',
      },
      {
        question: 'Can I use more than one keyword?',
        answer: 'Yes. Use as many keywords as you like across different posts and Reels.',
      },
      {
        question: 'Can I pause or edit an automation later?',
        answer: 'Any time. Switch it off, change the message or the keyword, and it updates straight away.',
      },
    ],
  },
  {
    label: 'Account',
    faqs: [
      {
        question: 'Do you need my Instagram password?',
        answer:
          'No. You connect through Instagram\'s own login screen, so your password never reaches us.',
      },
      {
        question: 'Is my account safe?',
        answer:
          'Your Instagram connection is stored encrypted, and we never sell your data or your followers\' data.',
      },
      {
        question: 'Do I have to keep the app open?',
        answer: 'No. Convozy runs on our servers around the clock, so replies go out even while you sleep.',
      },
      {
        question: 'Can I disconnect my Instagram account?',
        answer: 'Any time. Disconnecting stops Convozy straight away, and you can ask us to delete your data.',
      },
      {
        question: 'Can my team or clients use it?',
        answer: 'Running more than one account is on Pro. Shared team and agency tools are coming soon.',
      },
    ],
  },
];
const FAQS = FAQ_TABS.flatMap((t) => t.faqs);

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
          <RotatingLines
            lines={HERO_LINES}
            className="mt-6 min-h-[5.25rem] max-w-md text-lg text-muted-foreground sm:min-h-[3.75rem]"
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

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <IntegrationBadges />
      </div>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-28 sm:px-6">
        <Reveal>
          <h2 className="font-display max-w-lg text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            From comment to conversation in three steps
          </h2>
        </Reveal>
        <div className="mt-14">
          <HowItWorks />
        </div>
      </section>

      {/* Every feature, equal weight */}
      <section className="mx-auto max-w-7xl px-4 py-28 sm:px-6">
        <Reveal>
          <h2 className="font-display max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Everything you need, all free
          </h2>
          <p className="mt-4 max-w-lg text-lg text-muted-foreground">
            Every feature below works today on the free plan. No feature is held back for a paid tier.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.filter((f) => f.status === 'live').map((f, i) => (
            <Reveal key={f.id} delay={(i % 3) * 0.07} className="h-full">
              <FeatureCard feature={f} />
            </Reveal>
          ))}
        </div>

        <Reveal>
          <h3 className="font-display mt-20 text-2xl font-semibold tracking-tight">On the way</h3>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {FEATURES.filter((f) => f.status === 'soon').map((f) => (
              <span
                key={f.id}
                className="rounded-full bg-white/[0.06] px-4 py-2 text-sm text-muted-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
              >
                {f.title}
              </span>
            ))}
          </div>
        </Reveal>
        <div className="mt-12">
          <CtaButton href="/features" variant="ghost">
            See every feature
          </CtaButton>
        </div>
      </section>

      {/* Who it is for */}
      <section className="mx-auto max-w-7xl px-4 py-28 sm:px-6">
        <Reveal>
          <h2 className="font-display max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Built for creators, brands and agencies
          </h2>
          <p className="mt-4 max-w-lg text-lg text-muted-foreground">
            Run one profile, or look after many for your clients. Every message and every contact in one place.
          </p>
        </Reveal>
        <div className="mt-14">
          <Audiences />
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
              <div className="flex h-full flex-col rounded-[var(--radius-card)] border border-accent bg-card p-7">
                <h3 className="text-sm font-semibold text-accent">Pro</h3>
                <p className="mt-2 text-3xl font-semibold">When you&apos;re big</p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  More DMs a month and more accounts, once Free isn&apos;t enough for you.
                </p>
                <div className="mt-5">
                  <DonateButton variant="ghost" />
                </div>
              </div>
            </Reveal>
          </div>

          <Button asChild variant="outline" className="mt-8">
            <Link href="/pricing">See full pricing</Link>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-28 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <FaqAside
            title="Questions creators ask"
            sub="Quick answers before you start. Anything missing, just email us."
            email="support@orincore.com"
          />
        </div>
        <Reveal delay={0.1} className="lg:col-span-7">
          <Faq tabs={FAQ_TABS} supportEmail="support@orincore.com" />
        </Reveal>
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
