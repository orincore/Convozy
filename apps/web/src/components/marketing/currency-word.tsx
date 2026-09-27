'use client';

import { useEffect, useState } from 'react';

/**
 * Region (from the browser's own locale, not a geo-IP guess) -> the local
 * word for "smallest unit of money", so the "you won't pay a single X" line
 * reads naturally for the market it's read in instead of listing currencies.
 * Falls back to "cent" (the initial SSR render, so there's no hydration
 * mismatch) for any region not in this list.
 */
const CURRENCY_WORD_BY_REGION: Record<string, string> = {
  US: 'dollar',
  CA: 'dollar',
  AU: 'dollar',
  NZ: 'dollar',
  GB: 'pound',
  IE: 'cent',
  AE: 'dirham',
  SA: 'riyal',
  IN: 'rupee',
  PK: 'rupee',
  BD: 'taka',
  EU: 'cent',
};

function regionFromLocale(locale: string): string | null {
  // navigator.language is a BCP 47 tag like "en-US", "en-GB", "ar-AE" - the
  // region subtag is what tells us the market, not the language itself.
  const region = locale.split('-')[1]?.toUpperCase();
  return region ?? null;
}

export function CurrencyWord() {
  const [word, setWord] = useState('cent');

  useEffect(() => {
    try {
      const region = regionFromLocale(navigator.language);
      if (region && CURRENCY_WORD_BY_REGION[region]) {
        setWord(CURRENCY_WORD_BY_REGION[region]);
      }
    } catch {
      // navigator.language can throw in exotic environments - default word already set.
    }
  }, []);

  return <>{word}</>;
}
