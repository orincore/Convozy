import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

/**
 * Generated robots.txt (Next.js convention). Marketing routes are indexable;
 * the dashboard app is blocked here as a backstop in addition to the
 * per-route `robots: noindex` metadata in (dashboard)/layout.tsx —
 * CLAUDE.md §11.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/app/', '/api/'] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
