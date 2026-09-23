import type { Metadata } from 'next';
import { ChatCircleText, Eye, PaperPlaneTilt, TextAa, Code, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { CtaButton } from '@/components/marketing/cta-button';
import { Reveal } from '@/components/marketing/reveal';
import { AutomationPreview } from '@/components/marketing/automation-preview';
import { Bezel } from '@/components/marketing/bezel';
import { LiveDemo } from '@/components/marketing/live-demo';
import { ActivityFeed } from '@/components/marketing/activity-feed';
import { JsonLd } from '@/components/seo/json-ld';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  title: 'Comment-to-DM Automation for Instagram | Convozy',
  description:
    'Automatically DM anyone who comments a keyword on your Instagram post or Reel. Set it up in minutes, free to start.',
  alternates: {
    canonical: '/features/comment-to-dm',
  },
};

const DETAILS = [
  {
    icon: ChatCircleText,
    title: 'Pick your keyword',
    body: 'Choose a word like "PRICE" or "LINK" for one post, one Reel, or everything you post.',
  },
  {
    icon: Eye,
    title: 'Watched in real time',
    body: 'Every comment is checked the second it arrives, even on posts from months ago.',
  },
  {
    icon: PaperPlaneTilt,
    title: 'Instant, automatic DM',
    body: 'The commenter gets your reply or link the moment they comment, with no manual step.',
  },
];

const MATCH_TYPES = [
  {
    icon: TextAa,
    title: 'Exact word',
    body: 'Only comments that are exactly your keyword get the DM.',
  },
  {
    icon: MagnifyingGlass,
    title: 'Anywhere in the comment',
    body: 'Your keyword counts even inside a longer comment.',
  },
  {
    icon: Code,
    title: 'Custom',
    body: 'Want it very specific? Make your own rule. Most creators never need it.',
  },
];

const FAQS = [
  {
    question: 'Does this work on Reels as well as regular posts?',
    answer: 'Yes. Set a keyword for one post or Reel, or keep it active across everything you post.',
  },
  {
    question: 'How fast does the DM actually send?',
    answer:
      'Within seconds. The moment Instagram tells us about a new comment, we send your DM.',
  },
  {
    question: 'Can I use more than one keyword at a time?',
    answer: 'Yes. Run as many keywords as you like across different posts, and choose which one goes first if two match.',
  },
];

export default function CommentToDmFeaturePage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <JsonLd data={faqJsonLd} />
      <Breadcrumbs
        baseUrl={SITE_URL}
        items={[
          { name: 'Home', href: '/' },
          { name: 'Features', href: '/features' },
          { name: 'Comment to DM', href: '/features/comment-to-dm' },
        ]}
      />

      <div className="mt-8 grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Comment-to-DM automation for Instagram
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            When someone comments your chosen keyword, Convozy instantly sends them a DM: a link
            or a reply you write once.
          </p>
          <div className="mt-8">
            <CtaButton href="/app/login">Start free</CtaButton>
          </div>
        </div>

        <AutomationPreview />
      </div>

      <div className="mt-24 border-t border-border pt-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Watch a comment turn into a DM</h2>
        <p className="mt-2 text-muted-foreground">Pick a keyword. This is an example of what happens on your account.</p>
        <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal className="h-full">
              <Bezel className="h-full">
                <LiveDemo />
              </Bezel>
            </Reveal>
          </div>
          <div className="lg:col-span-5">
            <Reveal delay={0.1} className="h-full">
              <Bezel className="h-full">
                <ActivityFeed />
              </Bezel>
            </Reveal>
          </div>
        </div>
      </div>

      <div className="mt-24 grid gap-10 border-t border-border pt-16 md:grid-cols-3 md:gap-8">
        {DETAILS.map((detail, index) => (
          <Reveal key={detail.title} delay={index * 0.08}>
            <div className="flex flex-col gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/12 text-accent">
                <detail.icon size={22} weight="bold" />
              </div>
              <h2 className="text-lg font-semibold">{detail.title}</h2>
              <p className="text-muted-foreground">{detail.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-24 border-t border-border pt-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Three ways to catch a comment</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {MATCH_TYPES.map((match, index) => (
            <Reveal key={match.title} delay={index * 0.06}>
              <div className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-6">
                <match.icon size={22} className="text-accent" weight="bold" />
                <h3 className="font-semibold">{match.title}</h3>
                <p className="text-sm text-muted-foreground">{match.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="mt-24 border-t border-border pt-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Common questions</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {FAQS.map((faq, index) => (
            <Reveal key={faq.question} delay={index * 0.06}>
              <div>
                <h3 className="font-semibold">{faq.question}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
