import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { Reveal } from '@/components/marketing/reveal';
import { DonateForm } from '@/components/marketing/donate-form';
import { Check } from '@phosphor-icons/react/dist/ssr';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  title: 'Donate | Convozy',
  description:
    'Convozy is free for creators. Donate any amount you wish to keep the platform alive and free for other creators too.',
  alternates: { canonical: '/donate' },
};

const GOES_TO = [
  'Keeps the platform online and running',
  'Keeps Convozy free for creators who cannot pay',
  'Helps us build the features on the way',
];

export default function DonatePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Breadcrumbs
        baseUrl={SITE_URL}
        items={[
          { name: 'Home', href: '/' },
          { name: 'Donate', href: '/donate' },
        ]}
      />

      <div className="mt-12 grid items-start gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-6">
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Donate what you wish
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            Convozy is free for every creator. If it helps you, give any amount you like. It keeps the platform
            alive and lets other creators use it for nothing too.
          </p>
          <p className="mt-4 max-w-md text-muted-foreground">
            Unlike your ex, we will remember your birthday, and we will say thank you.
          </p>

          <p className="mt-10 text-sm font-medium text-muted-foreground">Where your donation goes</p>
          <ul className="mt-4 flex max-w-md flex-col gap-3">
            {GOES_TO.map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Check size={12} weight="bold" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-6">
          <DonateForm />
        </Reveal>
      </div>
    </div>
  );
}
