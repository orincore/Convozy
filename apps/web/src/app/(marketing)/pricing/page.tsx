import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from '@phosphor-icons/react/dist/ssr';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Reveal } from '@/components/marketing/reveal';
import { SpotlightCard } from '@/components/marketing/spotlight-card';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  title: 'Pricing | Convozy',
  description:
    'Convozy pricing: a genuinely usable free tier to get started, and affordable paid plans for higher-volume Instagram automation.',
  alternates: {
    canonical: '/pricing',
  },
};

interface PlanFeature {
  label: string;
  soon?: boolean;
}

const PLANS: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  cta: string;
  highlighted: boolean;
}[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Everything most creators need, on your real account. Not a trial.',
    features: [
      { label: 'One connected Instagram account' },
      { label: 'Comment and DM automations' },
      { label: 'Catch keywords however people type them' },
      { label: 'See every DM that went out' },
    ],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 'Contact us',
    period: 'for current pricing',
    description: 'For creators with a big audience or more than one account.',
    features: [
      { label: 'Everything in Free' },
      { label: 'Send more DMs every month' },
      { label: 'Multiple Instagram accounts' },
      { label: 'Priority support' },
      { label: 'AI-personalized replies', soon: true },
    ],
    cta: 'Get in touch',
    highlighted: true,
  },
];

const FAQS = [
  {
    question: 'What happens if I go over the Free plan\'s send volume?',
    answer:
      'Automations pause until next month, or until you move to Pro. You are never charged automatically, and your automations stay set up.',
  },
  {
    question: 'Do I need a credit card for the Free plan?',
    answer: 'No. Connect your Instagram account and start automating without entering payment details.',
  },
  {
    question: 'Can I connect more than one Instagram account?',
    answer: 'The Free plan covers one connected account. Pro supports multiple accounts under a single workspace.',
  },
  {
    question: 'How does Pro pricing work?',
    answer:
      'Pro pricing depends on how many DMs you send each month, and we are still finalizing it. Get in touch and we will find a fair price for you.',
  },
];

/**
 * TODO(Phase 5, TRACKER.md): wire real Plan data from the API instead of
 * hardcoding, once billing/plan limits are finalized (see TRACKER.md open
 * question on free-tier limits).
 */
export default function PricingPage() {
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Convozy',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free tier: automate Instagram comment replies and DMs',
    },
  };

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
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqJsonLd} />

      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <Breadcrumbs
          baseUrl={SITE_URL}
          items={[
            { name: 'Home', href: '/' },
            { name: 'Pricing', href: '/pricing' },
          ]}
        />

        <div className="mt-8 max-w-xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Free for creators. Really.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Automating your DMs shouldn&apos;t cost a creator a cent. The good stuff is free, and you only pay when you&apos;re big enough to need more.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 0.08}>
              <SpotlightCard
                className={`flex h-full flex-col rounded-[var(--radius-card)] border p-7 ${
                  plan.highlighted ? 'border-foreground bg-card' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground">{plan.name}</h2>
                                  </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>

                <ul className="mt-6 flex flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature.label} className="flex items-start gap-2 text-sm">
                      <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-foreground" />
                      <span className={feature.soon ? 'text-muted-foreground' : undefined}>
                        {feature.label}
                        {feature.soon && (
                          <Badge variant="outline" className="ml-2 align-middle">
                            Coming soon
                          </Badge>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={plan.highlighted ? 'primary' : 'outline'}
                  className="mt-8"
                >
                  <Link href={plan.highlighted ? 'mailto:support@orincore.com' : '/app/login'}>
                    {plan.cta}
                  </Link>
                </Button>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>

        <div className="mt-24 border-t border-border pt-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Pricing questions</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
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
    </>
  );
}
