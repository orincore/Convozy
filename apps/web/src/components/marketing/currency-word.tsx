import { getVisitorCountry } from '@/lib/geo';

/**
 * Country -> the local word (or symbol, for India per user direction) for
 * that region's currency, so the "you won't pay a single X" line reads
 * naturally everywhere instead of listing currencies. Detected from the
 * visitor's real IP address (see lib/geo.ts) - not their browser's
 * language setting, which only reflects a preference, not location.
 * Falls back to "cent" for any country not covered here - in practice just
 * uninhabited/disputed territories, this covers every UN member state plus
 * the populated non-member territories with their own currency word.
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
const RUPEE_REGIONS = ['PK', 'LK', 'NP', 'MU', 'SC'];
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
  // India shown as the currency symbol per product direction, not the word.
  IN: '₹',

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
};

export async function CurrencyWord() {
  const country = await getVisitorCountry();
  const word = (country && CURRENCY_WORD_BY_REGION[country]) || 'cent';
  return <>{word}</>;
}
