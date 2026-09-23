import Image from 'next/image';

/**
 * Honest technical-integration strip, not an accreditation claim. Convozy
 * is not a Meta Tech Provider / Business Partner (verified against
 * TRACKER.md - no such status recorded), so this deliberately says "built
 * on" rather than "official partner" (user decision, 2026-09-23). Real
 * brand marks via Simple Icons, single-color variant matching the locked
 * monochrome theme (CLAUDE.md §12a) - not plain text wordmarks. Labels kept
 * to the plain brand name only, no "Graph API"/technical suffix (user
 * directive, 2026-09-24).
 */
const INTEGRATIONS = [
  { slug: 'instagram', label: 'Instagram' },
  { slug: 'meta', label: 'Meta' },
];

export function IntegrationBadges() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
      <span>Built on</span>
      {INTEGRATIONS.map((integration) => (
        <span key={integration.slug} className="inline-flex items-center gap-2">
          <Image
            src={`https://cdn.simpleicons.org/${integration.slug}/a1a1aa`}
            alt={integration.label}
            width={16}
            height={16}
            unoptimized
          />
          {integration.label}
        </span>
      ))}
    </div>
  );
}
