import type { Metadata } from 'next';
import Link from 'next/link';
import { ChatCircleText, Eye, PaperPlaneTilt } from '@phosphor-icons/react/dist/ssr';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/marketing/reveal';
import { HeroVisual } from '@/components/marketing/hero-visual';

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
    title: 'Pick a trigger word',
    body: 'Tie a keyword like "PRICE" or "LINK" to a specific post, Reel, or all of your content.',
  },
  {
    icon: Eye,
    title: 'Watched in real time',
    body: 'Every comment is checked the moment it lands, whether you posted seconds or months ago.',
  },
  {
    icon: PaperPlaneTilt,
    title: 'Instant, automatic DM',
    body: 'The commenter gets your reply, link, or an AI-personalized message, with no manual step.',
  },
];

export default function CommentToDmFeaturePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
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
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Comment-to-DM automation for Instagram
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            When someone comments your chosen keyword, Convozy instantly sends them a DM: a link,
            a reply, or an AI-personalized message.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/app/login">Start free</Link>
          </Button>
        </div>

        <HeroVisual />
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
    </div>
  );
}
