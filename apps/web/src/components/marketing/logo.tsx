import Image from 'next/image';
import Link from 'next/link';

/** Brand mark (white logo on the dark theme) plus the wordmark. */
export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-foreground">
      <Image
        src="/brand/logo-white.png"
        alt=""
        width={28}
        height={27}
        priority
        className="h-7 w-auto"
      />
      <span className="text-[1.05rem] font-semibold tracking-tight">Convozy</span>
    </Link>
  );
}
