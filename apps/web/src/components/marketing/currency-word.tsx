'use client';

import { useEffect, useState } from 'react';

/**
 * Region (from the browser's own locale, not a geo-IP guess) -> the local
 * word for that region's currency, so the "you won't pay a single X" line
 * reads naturally everywhere instead of listing currencies. Falls back to
 * "cent" (the initial SSR render, so there's no hydration mismatch) for any
 * region not covered - in practice just uninhabited/disputed territories,
 * this covers every UN member state plus the populated non-member
 * territories with their own currency word.
 */
const DOLLAR_REGIONS = [
  'US', 'CA', 'AU', 'NZ', 'SG', 'HK', 'TW', 'LR', 'NA', 'ZW',
  'EC', 'SV', 'PA', 'TL', 'MH', 'FM', 'PW',
  // Eastern Caribbean dollar
  'AG', 'DM', 'GD', 'KN', 'LC', 'VC',
  // Other national dollars
  'BZ', 'BS', 'BB', 'BM', 'BN', 'FJ', 'GY', 'JM', 'KY', 'SB', 'SR', 'TT', 'TC',
  'CK', 'NU', 'KI', 'TV', 'NR',
];

const EURO_REGIONS = [
  'AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'HR',
  'AD', 'MC', 'SM', 'VA', 'ME', 'XK',
];

const POUND_REGIONS = ['GB', 'GI', 'FK', 'SH', 'IM', 'JE', 'GG'];
const RUPEE_REGIONS = ['IN', 'PK', 'LK', 'NP', 'MU', 'SC'];
const DINAR_REGIONS = ['KW', 'BH', 'JO', 'IQ', 'LY', 'DZ', 'TN', 'RS'];
const RIYAL_REGIONS = ['SA', 'QA', 'YE'];
const FRANC_REGIONS = [
  'CH', 'LI', 'KM', 'DJ', 'GN', 'RW', 'BI', 'CD',
  // West African CFA franc
  'SN', 'CI', 'ML', 'NE', 'BF', 'GW', 'TG', 'BJ',
  // Central African CFA franc
  'CM', 'TD', 'CF', 'CG', 'GQ', 'GA',
];
const PESO_REGIONS = ['MX', 'AR', 'CO', 'CL', 'PH', 'UY', 'CU', 'DO'];
const KRONA_REGIONS = ['SE', 'NO', 'DK', 'IS', 'FO', 'GL'];
const SHILLING_REGIONS = ['KE', 'TZ', 'UG', 'SO'];

const CURRENCY_WORD_BY_REGION: Record<string, string> = {
  ...Object.fromEntries(DOLLAR_REGIONS.map((r) => [r, 'dollar'])),
  ...Object.fromEntries(EURO_REGIONS.map((r) => [r, 'euro'])),
  ...Object.fromEntries(POUND_REGIONS.map((r) => [r, 'pound'])),
  ...Object.fromEntries(RUPEE_REGIONS.map((r) => [r, 'rupee'])),
  ...Object.fromEntries(DINAR_REGIONS.map((r) => [r, 'dinar'])),
  ...Object.fromEntries(RIYAL_REGIONS.map((r) => [r, 'riyal'])),
  ...Object.fromEntries(FRANC_REGIONS.map((r) => [r, 'franc'])),
  ...Object.fromEntries(PESO_REGIONS.map((r) => [r, 'peso'])),
  ...Object.fromEntries(KRONA_REGIONS.map((r) => [r, 'krona'])),
  ...Object.fromEntries(SHILLING_REGIONS.map((r) => [r, 'shilling'])),

  JP: 'yen',
  CN: 'yuan',
  KR: 'won',
  KP: 'won',
  BR: 'real',
  ZA: 'rand',
  MY: 'ringgit',
  TH: 'baht',
  ID: 'rupiah',
  VN: 'dong',
  AE: 'dirham',
  MA: 'dirham',
  IL: 'new shekel',
  TR: 'lira',
  PL: 'zloty',
  HU: 'forint',
  CZ: 'koruna',
  RO: 'leu',
  MD: 'leu',
  BG: 'lev',
  UA: 'hryvnia',
  RU: 'ruble',
  BY: 'ruble',
  KZ: 'tenge',
  KG: 'som',
  UZ: 'som',
  TJ: 'somoni',
  AZ: 'manat',
  TM: 'manat',
  GE: 'lari',
  AM: 'dram',
  BD: 'taka',
  MM: 'kyat',
  KH: 'riel',
  LA: 'kip',
  MO: 'pataca',
  NG: 'naira',
  GH: 'cedi',
  ET: 'birr',
  GM: 'dalasi',
  SL: 'leone',
  MG: 'ariary',
  ZM: 'kwacha',
  MW: 'kwacha',
  MZ: 'metical',
  BW: 'pula',
  LS: 'loti',
  SZ: 'lilangeni',
  AO: 'kwanza',
  CV: 'escudo',
  ST: 'dobra',
  MR: 'ouguiya',
  ER: 'nakfa',
  PE: 'sol',
  PY: 'guarani',
  BO: 'boliviano',
  NI: 'cordoba',
  HN: 'lempira',
  GT: 'quetzal',
  CR: 'colon',
  VE: 'bolivar',
  HT: 'gourde',
  AF: 'afghani',
  MN: 'tugrik',
  VU: 'vatu',
  WS: 'tala',
  TO: 'pa’anga',
  PG: 'kina',
  BT: 'ngultrum',
  MV: 'rufiyaa',
  OM: 'rial',
  IR: 'rial',
  EU: 'euro',
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
