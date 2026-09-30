import { Gift, InstagramLogo, Lightbulb, VideoCamera } from '@phosphor-icons/react/dist/ssr';
import { Bezel } from '@/components/marketing/bezel';
import { CtaButton } from '@/components/marketing/cta-button';
import { Reveal } from '@/components/marketing/reveal';

export const INSTAGRAM_URL = 'https://www.instagram.com/orincore.official/';

const IDEAS = [
  {
    icon: VideoCamera,
    title: 'Screen-record your setup',
    body: 'Show a keyword comment turning into a DM, start to finish, on your own account.',
  },
  {
    icon: Gift,
    title: 'Run a giveaway or freebie',
    body: 'Post a Reel that says "comment GUIDE" and let Convozy send the link while you sleep.',
  },
  {
    icon: Lightbulb,
    title: 'Teach a quick tutorial',
    body: 'Walk your followers through building their first automation in a few minutes.',
  },
  {
    icon: InstagramLogo,
    title: 'Share your honest take',
    body: 'Tried other tools first? Tell people what switching was like, good and bad.',
  },
];

/**
 * Invites creators to make content about Convozy and tag the brand account.
 * Server component: static copy, real external link, no invented numbers or
 * testimonials (CLAUDE.md §12d honest-copy lock).
 */
export function CommunitySection() {
  return (
    <section aria-labelledby="community-heading" className="mx-auto max-w-7xl px-4 py-28 sm:px-6">
      <Reveal>
        <Bezel coreClassName="p-7 sm:p-12">
          <div className="max-w-2xl">
            <h2
              id="community-heading"
              className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
            >
              Make a Reel with Convozy. We&apos;d love to share it.
            </h2>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Made something with Convozy? Post it and tag{' '}
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
              >
                @orincore.official
              </a>{' '}
              on Instagram. We&apos;d love to reshare your content.
            </p>
          </div>

          <ul className="mt-12 grid gap-x-12 gap-y-9 sm:grid-cols-2">
            {IDEAS.map((idea) => (
              <li key={idea.title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
                  <idea.icon size={22} weight="light" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-semibold">{idea.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{idea.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-12">
            <CtaButton href={INSTAGRAM_URL}>Tag @orincore.official</CtaButton>
          </div>
        </Bezel>
      </Reveal>
    </section>
  );
}
