/**
 * Fixed dashboard atmosphere: the marketing site's grid + glow-orb backdrop,
 * toned down to a single static orb with no scroll-parallax, no cursor
 * tracking and no dust — this is a product surface people stare at all day,
 * not a landing page, so the motion budget stays at zero here (taste-skill
 * 6.E: no repaint cost, nothing that competes with the data on screen).
 * Rendered once at the shell root, matching taste-skill 4.11's page-theme
 * lock (one backdrop, not re-declared per page).
 */
export function DashboardBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[60lvh] overflow-hidden [contain:strict]"
    >
      <div className="marketing-backdrop absolute inset-x-0 top-0 h-full opacity-60" />
      <div className="absolute left-1/2 top-[-16%] h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-foreground/[0.05] blur-[110px]" />
    </div>
  );
}
