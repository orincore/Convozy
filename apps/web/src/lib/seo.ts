/**
 * Every marketing page is the same English content served to every market -
 * there are no region-specific URLs or translations. These are honest
 * self-referencing hreflang hints (same URL for every tag) that tell Google
 * this single page is relevant to each of these English-speaking markets,
 * per the "target USA, UAE, Canada and other markets" product direction -
 * not a claim of localized content. Add a real locale variant's own URL here
 * if one is ever built instead of self-referencing.
 */
export function hreflangAlternates(canonicalPath: string): Record<string, string> {
  const path = canonicalPath === '/' ? '' : canonicalPath;
  return {
    'en-US': path || '/',
    'en-GB': path || '/',
    'en-CA': path || '/',
    'en-AU': path || '/',
    'en-AE': path || '/',
    en: path || '/',
    'x-default': path || '/',
  };
}
