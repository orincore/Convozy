import { DONATE_PAGE } from '@/lib/donate';
import { CtaButton } from './cta-button';

/** "Donate what you wish" call to action; the amount is chosen on the donate page. */
export function DonateButton({ variant = 'primary' }: { variant?: 'primary' | 'ghost' }) {
  return (
    <CtaButton href={DONATE_PAGE} variant={variant}>
      Donate what you wish
    </CtaButton>
  );
}
