import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Convozy: Instagram Auto Reply & Comment-to-DM Automation Tool';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Default share-card image for every marketing page that doesn't define its
 * own opengraph-image (Next.js file-convention fallback, applies to nested
 * segments too - see CLAUDE.md §11 "Open Graph + Twitter Card tags on every
 * public page"). Locked dark monochrome brand (CLAUDE.md §12a), no invented
 * stats or screenshots - just the wordmark and the one honest claim.
 */
export default async function Image() {
  const logo = await readFile(join(process.cwd(), 'public/brand/logo-white.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          background: '#0a0a0b',
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={56} height={54} alt="" />
          <span style={{ fontSize: 42, fontWeight: 600, letterSpacing: '-0.02em' }}>Convozy</span>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 54,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            textAlign: 'center',
            maxWidth: 980,
            lineHeight: 1.15,
          }}
        >
          Turn Instagram comments into instant DMs
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#a1a1aa' }}>
          Free Instagram auto reply &amp; comment-to-DM automation
        </div>
      </div>
    ),
    { ...size },
  );
}
