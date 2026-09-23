import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { FaqAside } from '@/components/marketing/faq-aside';
import { Faq, type FaqTab } from '@/components/marketing/faq';
import { Lattice } from '@/components/marketing/lattice';
import { CtaButton } from '@/components/marketing/cta-button';
import { Reveal } from '@/components/marketing/reveal';
import { DonateButton } from '@/components/marketing/donate-button';
import { Comparison, PlanCards, Section } from '@/components/marketing/pricing-sections';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  title: 'Pricing | Convozy',
  description:
    'Convozy is free for creators: every feature that works today is on the Free plan, with no card needed. Pro is for big audiences and more than one Instagram account.',
  alternates: { canonical: '/pricing' },
};

const FAQ_TABS: FaqTab[] = [
  {
    label: 'Free plan',
    faqs: [
      {
        question: 'Is the Free plan really free?',
        answer:
          'Yes. It is not a trial and needs no card. Every feature that works today is included.',
      },
      {
        question: 'Which features are on the Free plan?',
        answer:
          'Comment to DM, Story replies, live comments, contacts and tags, templates, buttons, timed messages and more. Nothing that works today is locked away.',
      },
      {
        question: 'Are there any hidden charges?',
        answer: 'No. Nothing is charged automatically, and there is no card on file to charge.',
      },
      {
        question: 'Do I need a credit card to start?',
        answer: 'No. Connect your Instagram account and start automating without entering payment details.',
      },
      {
        question: 'Can I use it for my brand or business?',
        answer: 'Yes. It works for creators and brands alike. Shared team and agency tools are coming soon.',
      },
    ],
  },
  {
    label: 'Pro',
    faqs: [],
    note: {
      title: 'Why are you still looking at Pro?',
      text: 'We got you. Almost everything is already free. Go on, start free and enjoy.',
      action: <DonateButton />,
    },
  },
];

export default function PricingPage() {
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Convozy',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free plan: automate Instagram comment replies and DMs',
    },
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_TABS.flatMap((t) => (t.note ? [{ question: t.note.title, answer: t.note.text }] : t.faqs)).map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqJsonLd} />

      <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <Breadcrumbs
          baseUrl={SITE_URL}
          items={[
            { name: 'Home', href: '/' },
            { name: 'Pricing', href: '/pricing' },
          ]}
        />
        <Reveal>
          <h1 className="font-display mt-10 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-7xl">
            Free for creators. Really.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Automating your DMs should not cost a creator a cent. The good stuff is free, and you only pay when
            you are big enough to need more.
          </p>
        </Reveal>
        <div className="mt-14">
          <PlanCards />
        </div>
      </div>

      <Section title="Every feature, side by side" sub="Nothing that works today is locked behind Pro.">
        <Comparison />
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <DonateButton />
          <span className="text-sm text-muted-foreground">Pay whatever you wish, it keeps Convozy free for everyone.</span>
        </div>
      </Section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Why is it free?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Because replying to your own followers should not be a luxury. We keep Convozy lean, so
            creators can have everything that works today without paying a rupee, dollar or cent.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <FaqAside title="Pricing questions" sub="Anything missing, just email us." email="support@orincore.com" />
        </div>
        <Reveal delay={0.1} className="lg:col-span-7">
          <Faq tabs={FAQ_TABS} supportEmail="support@orincore.com" />
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <Reveal>
          <Lattice>
            <div className="px-6 py-20 text-center">
              <h2 className="font-display mx-auto max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Start free, upgrade only if you outgrow it
              </h2>
              <div className="mt-8">
                <CtaButton href="/app/login">Start free</CtaButton>
              </div>
            </div>
          </Lattice>
        </Reveal>
      </section>
    </>
  );
}
