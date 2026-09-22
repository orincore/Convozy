import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from '@phosphor-icons/react/dist/ssr';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/marketing/reveal';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  title: 'Pricing | Convozy',
  description:
    'Convozy pricing: a genuinely usable free tier to get started, and affordable paid plans for higher-volume Instagram automation.',
  alternates: {
    canonical: '/pricing',
  },
};

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Everything you need to try Convozy on a real Instagram account.',
    features: [
      'One connected Instagram account',
      'Comment and DM automations',
      'Exact and contains keyword matching',
      'Delivery activity log',
    ],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 'Contact us',
    period: 'for current pricing',
    description: 'For creators sending higher volume or using AI-personalized replies.',
    features: [
      'Everything in Free',
      'Higher monthly send volume',
      'AI-personalized replies',
      'Multiple Instagram accounts',
      'Priority support',
    ],
    cta: 'Get in touch',
    highlighted: true,
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

  return (
    <>
      <JsonLd data={productJsonLd} />

      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <Breadcrumbs
          baseUrl={SITE_URL}
          items={[
            { name: 'Home', href: '/' },
            { name: 'Pricing', href: '/pricing' },
          ]}
        />

        <div className="mt-8 max-w-xl">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Simple, honest pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free. Upgrade only when you outgrow what the free plan covers.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 0.08}>
              <div
                className={`flex h-full flex-col rounded-[var(--radius-card)] border p-7 ${
                  plan.highlighted ? 'border-foreground bg-card' : 'border-border bg-card'
                }`}
              >
                <h2 className="text-sm font-semibold text-muted-foreground">{plan.name}</h2>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>

                <ul className="mt-6 flex flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-foreground" />
                      {feature}
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
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </>
  );
}
