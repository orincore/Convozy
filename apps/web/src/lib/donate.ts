/**
 * Donation settings (build-time NEXT_PUBLIC_* env). The /donate page shows only
 * the payment methods that are configured, and falls back to email so nobody
 * hits a dead end:
 * - NEXT_PUBLIC_DONATE_UPI: a UPI ID; builds a upi:// link with the chosen amount.
 * - NEXT_PUBLIC_DONATE_URL: a hosted pay-what-you-wish page for cards and other currencies.
 */
export const DONATE_UPI = process.env.NEXT_PUBLIC_DONATE_UPI ?? '';
export const DONATE_URL = process.env.NEXT_PUBLIC_DONATE_URL ?? '';
export const DONATE_EMAIL = 'support@orincore.com';
export const DONATE_PAGE = '/donate';
