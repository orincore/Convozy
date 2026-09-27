import 'server-only';
import { headers } from 'next/headers';
import geoip from 'geoip-country';

/**
 * Visitor's country from their real IP address (nginx forwards
 * X-Real-IP/X-Forwarded-For - see infra/nginx), looked up against a bundled
 * MaxMind GeoLite2-Country database (geoip-country: no external API call,
 * no per-request network dependency, no rate limit). Server-only: reading
 * request headers makes any page that calls this dynamic (opts out of
 * static prerendering for that route) - only use it where the per-visitor
 * result is actually needed.
 */
export async function getVisitorCountry(): Promise<string | null> {
  const headerList = await headers();
  const forwardedFor = headerList.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || headerList.get('x-real-ip');
  if (!ip) return null;

  const geo = geoip.lookup(ip);
  return geo?.country ?? null;
}
