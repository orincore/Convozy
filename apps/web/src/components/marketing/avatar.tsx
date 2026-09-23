import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * Placeholder portraits for the illustrated examples. Every name maps to a
 * different photo so no face repeats. These are stock placeholders for mock UI,
 * not real Convozy users.
 */
const PHOTOS: Record<string, string> = {
  'mira.makes': 'women/44',
  'jordan.k': 'men/32',
  'maya.creates': 'women/68',
  'sam.builds': 'men/75',
  'a.follower': 'women/12',
  'lena.fit': 'women/26',
  Maya: 'women/68',
  Jordan: 'men/32',
  Sam: 'men/75',
  Lena: 'women/26',
  Anna: 'women/5',
  Leo: 'men/41',
  Ivy: 'women/90',
  Kai: 'men/52',
  Zoe: 'women/33',
  Max: 'men/64',
  Eli: 'men/18',
  Nia: 'women/55',
  Sol: 'men/86',
  'order.q': 'women/21',
  'price.q': 'men/11',
  'collab.q': 'women/79',
  'viewer.1': 'men/22',
  'viewer.2': 'women/47',
  'viewer.3': 'men/58',
};

export function avatarSrc(who: string): string {
  return `https://randomuser.me/api/portraits/med/${PHOTOS[who] ?? 'men/1'}.jpg`;
}

export function Avatar({ who, size = 28, className }: { who: string; size?: number; className?: string }) {
  return (
    <Image
      src={avatarSrc(who)}
      alt=""
      width={size}
      height={size}
      unoptimized
      style={{ width: size, height: size }}
      className={cn('shrink-0 rounded-full object-cover ring-1 ring-white/20', className)}
    />
  );
}
