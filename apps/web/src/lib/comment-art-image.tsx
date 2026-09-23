import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import type { CommentArt } from './comment-art';

export const STORY_SIZE = { width: 1080, height: 1920 } as const;
export const OG_SIZE = { width: 1200, height: 630 } as const;

const BG = 'linear-gradient(160deg, #18181b 0%, #0a0a0b 55%, #111113 100%)';

function Comment({ user, text, big }: { user: string; text: string; big: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: big ? 28 : 16,
        padding: big ? '34px 40px' : '18px 24px',
        borderRadius: big ? 48 : 28,
        background: 'rgba(250,250,250,0.08)',
        color: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: big ? 84 : 48,
          height: big ? 84 : 48,
          borderRadius: 999,
          background: 'rgba(250,250,250,0.22)',
          fontSize: big ? 38 : 22,
          fontWeight: 700,
        }}
      >
        {user.charAt(0).toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: big ? 30 : 18, color: '#a1a1aa' }}>{user}</div>
        <div style={{ fontSize: big ? 44 : 26, fontWeight: 600 }}>{text}</div>
      </div>
    </div>
  );
}

/** 1080x1920 story graphic, or 1200x630 link-preview card. Flexbox only (Satori). */
async function loadLogo(): Promise<string> {
  const file = await readFile(path.join(process.cwd(), 'public/brand/logo-white-128.png'));
  return `data:image/png;base64,${file.toString('base64')}`;
}

export async function renderCommentArt(art: CommentArt, format: 'story' | 'og') {
  const logo = await loadLogo();
  const big = format === 'story';
  const size = big ? STORY_SIZE : OG_SIZE;
  const list = big ? art.comments : art.comments.slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: big ? '150px 80px 130px' : '56px 64px',
          background: BG,
          color: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 26 : 12 }}>
          <div style={{ fontSize: big ? 34 : 22, color: '#a1a1aa' }}>{`@${art.handle}`}</div>
          <div style={{ fontSize: big ? 92 : 54, fontWeight: 700, lineHeight: 1.05 }}>
            The comment section
          </div>
          <div style={{ fontSize: big ? 38 : 24, color: '#a1a1aa' }}>{art.postTitle}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 28 : 14 }}>
          {list.map((c) => (
            <Comment key={c.text} user={c.user} text={c.text} big={big} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: big ? 28 : 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={big ? 96 : 56} height={big ? 93 : 54} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 10 : 4 }}>
            <div style={{ fontSize: big ? 44 : 28, fontWeight: 700 }}>Created by Convozy</div>
            <div style={{ fontSize: big ? 32 : 20, color: '#a1a1aa' }}>convozy.orincore.com</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    },
  );
}
