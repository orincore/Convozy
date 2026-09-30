import type { Metadata } from 'next';
import { Check, Clock, Minus } from '@phosphor-icons/react/dist/ssr';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { Bezel } from '@/components/marketing/bezel';
import { CtaButton } from '@/components/marketing/cta-button';
import { Reveal } from '@/components/marketing/reveal';
import { hreflangAlternates } from '@/lib/seo';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

const TITLE = 'Free ManyChat Alternative for Instagram Automation | Convozy';
const DESCRIPTION =
  'Looking for a ManyChat alternative? Convozy sends Instagram comment-to-DM automations on a free plan with unlimited DMs. See an honest side-by-side, including where ManyChat is ahead.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/manychat-alternative', siteName: 'Convozy', type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  alternates: {
    canonical: '/manychat-alternative',
    languages: hreflangAlternates('/manychat-alternative'),
  },
};

type Status = 'yes' | 'no' | 'soon';
interface Cell {
  status: Status;
  text: string;
}
interface Row {
  feature: string;
  convozy: Cell;
  manychat: Cell;
}

const ROWS: Row[] = [
  {
    feature: 'Instagram comment to DM',
    convozy: { status: 'yes', text: 'Yes' },
    manychat: { status: 'yes', text: 'Yes' },
  },
  {
    feature: 'Story replies and live comments',
    convozy: { status: 'yes', text: 'Yes' },
    manychat: { status: 'yes', text: 'Yes' },
  },
  {
    feature: 'Free plan limit',
    convozy: { status: 'yes', text: 'Unlimited DMs, no card' },
    manychat: { status: 'no', text: 'Capped at 25 active contacts' },
  },
  {
    feature: 'Paid plans start at',
    convozy: { status: 'yes', text: 'Pro is only for more than one Instagram account' },
    manychat: { status: 'no', text: '$17 per month' },
  },
  {
    feature: 'If this, then that branching',
    convozy: { status: 'yes', text: 'Yes' },
    manychat: { status: 'yes', text: 'Yes' },
  },
  {
    feature: 'Contacts, tags and segments',
    convozy: { status: 'yes', text: 'Yes' },
    manychat: { status: 'yes', text: 'Yes' },
  },
  {
    feature: 'Ready-made templates',
    convozy: { status: 'yes', text: 'Yes' },
    manychat: { status: 'yes', text: 'Yes' },
  },
  {
    feature: 'Visual drag-and-drop flow builder',
    convozy: { status: 'no', text: 'No, a simple form editor' },
    manychat: { status: 'yes', text: 'Yes' },
  },
  {
    feature: 'Broadcasts and drip sequences',
    convozy: { status: 'soon', text: 'Coming soon' },
    manychat: { status: 'yes', text: 'Yes, on Pro and up' },
  },
  {
    feature: 'Shared inbox to take over chats',
    convozy: { status: 'soon', text: 'Coming soon' },
    manychat: { status: 'yes', text: 'Yes' },
  },
  {
    feature: 'WhatsApp, SMS, email, Messenger',
    convozy: { status: 'no', text: 'No, Instagram only' },
    manychat: { status: 'yes', text: 'Yes, WhatsApp, SMS and email on Pro and up' },
  },
];

const FAQS = [
  {
    question: 'Is Convozy really a free ManyChat alternative?',
    answer:
      'For Instagram comment-to-DM automation, yes. Comment to DM, Story replies, live comments, branching, contacts, tags and templates are all on the Free plan with unlimited DMs and no card. Pro is only for running more than one Instagram account.',
  },
  {
    question: 'What does ManyChat do that Convozy does not?',
    answer:
      'ManyChat has a visual flow builder, broadcasts, drip sequences, a shared inbox, and other channels such as WhatsApp, SMS, email, Messenger and TikTok. Convozy is focused on Instagram and does not have those yet. Broadcasts, sequences and a shared inbox are on our list.',
  },
  {
    question: 'Can I move my ManyChat automations to Convozy?',
    answer:
      'There is no importer, so you rebuild each automation. Most take a few minutes: pick your keyword, write the DM once, and choose which posts it runs on. Templates give you a head start.',
  },
  {
    question: 'Will my followers get two DMs if I run both tools?',
    answer:
      'They can, if both tools watch the same keyword on the same post. Switch off the matching ManyChat automation before you turn the Convozy one on.',
  },
];

function StatusIcon({ status }: { status: Status }) {
  if (status === 'yes') return <Check size={16} weight="bold" aria-hidden="true" />;
  if (status === 'soon') return <Clock size={16} weight="bold" aria-hidden="true" />;
  return <Minus size={16} weight="bold" aria-hidden="true" />;
}

function StatusLabel({ status }: { status: Status }) {
  return <span className="sr-only">{status === 'yes' ? 'Included: ' : status === 'soon' ? 'Coming soon: ' : 'Not included: '}</span>;
}

function CellView({ cell }: { cell: Cell }) {
  const tone = cell.status === 'yes' ? 'text-foreground' : 'text-muted-foreground';
  return (
    <span className={`flex items-start gap-2.5 ${tone}`}>
      <span
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
          cell.status === 'yes' ? 'bg-accent text-accent-foreground' : 'bg-foreground/[0.08]'
        }`}
      >
        <StatusIcon status={cell.status} />
      </span>
      <span>
        <StatusLabel status={cell.status} />
        {cell.text}
      </span>
    </span>
  );
}

export default function ManyChatAlternativePage() {
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
          { name: 'ManyChat alternative', href: '/manychat-alternative' },
        ]}
      />

      <header className="mt-10 max-w-3xl">
        <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
          A free ManyChat alternative for Instagram
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          If you mostly use ManyChat to DM people who comment a keyword, Convozy does that on a free plan
          with unlimited DMs. Here is how the two compare, including where ManyChat is ahead.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <CtaButton href="/app/login">Start free</CtaButton>
          <CtaButton href="/pricing" variant="ghost">
            See pricing
          </CtaButton>
        </div>
      </header>

      <section aria-labelledby="compare-heading" className="mt-28">
        <Reveal>
          <h2 id="compare-heading" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Convozy and ManyChat side by side
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <Bezel className="mt-10" coreClassName="overflow-x-auto p-2 sm:p-4">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <caption className="sr-only">Feature comparison between Convozy and ManyChat for Instagram automation</caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="px-4 py-4 font-medium">
                    Feature
                  </th>
                  <th scope="col" className="px-4 py-4 font-semibold text-foreground">
                    Convozy
                  </th>
                  <th scope="col" className="px-4 py-4 font-semibold text-foreground">
                    ManyChat
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.feature} className="border-t border-foreground/10 align-top">
                    <th scope="row" className="px-4 py-4 font-medium">
                      {row.feature}
                    </th>
                    <td className="px-4 py-4">
                      <CellView cell={row.convozy} />
                    </td>
                    <td className="px-4 py-4">
                      <CellView cell={row.manychat} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bezel>
        </Reveal>
        <p className="mt-5 max-w-2xl text-sm text-muted-foreground">
          ManyChat details are from its public plans as checked in September 2026. Plans change, so confirm
          current limits and prices on ManyChat&apos;s own site before you decide.
        </p>
      </section>

      <section aria-labelledby="choose-heading" className="mt-28">
        <Reveal>
          <h2 id="choose-heading" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Which one fits you
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Reveal className="h-full">
            <Bezel className="h-full" coreClassName="p-7 sm:p-9">
              <h3 className="font-display text-2xl font-semibold tracking-tight">Pick Convozy if</h3>
              <ul className="mt-5 flex flex-col gap-3 text-muted-foreground">
                <li>You mainly want comment-to-DM, Story reply and live comment automations.</li>
                <li>You do not want a cap on contacts or a monthly bill for answering your own comments.</li>
                <li>You want to be live in a few minutes, starting from a template.</li>
              </ul>
            </Bezel>
          </Reveal>
          <Reveal delay={0.08} className="h-full">
            <Bezel className="h-full" coreClassName="p-7 sm:p-9">
              <h3 className="font-display text-2xl font-semibold tracking-tight">Pick ManyChat if</h3>
              <ul className="mt-5 flex flex-col gap-3 text-muted-foreground">
                <li>You need WhatsApp, SMS, email, Messenger or TikTok in the same tool.</li>
                <li>You rely on a visual flow builder, broadcasts or drip sequences today.</li>
                <li>Your team needs a shared inbox right now.</li>
              </ul>
            </Bezel>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="mt-28">
        <Reveal>
          <h2 id="faq-heading" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Common questions
          </h2>
        </Reveal>
        <dl className="mt-10 grid gap-x-12 gap-y-9 md:grid-cols-2">
          {FAQS.map((faq, index) => (
            <Reveal key={faq.question} delay={(index % 2) * 0.06}>
              <dt className="font-semibold">{faq.question}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{faq.answer}</dd>
            </Reveal>
          ))}
        </dl>
      </section>

      <div className="mt-28">
        <Reveal>
          <CtaButton href="/app/login">Start free</CtaButton>
        </Reveal>
      </div>
    </div>
  );
}
