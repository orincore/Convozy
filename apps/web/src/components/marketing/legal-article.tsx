import type { ReactNode } from 'react';

/** Shared typographic wrapper for reference pages (privacy, terms, data deletion). */
export function LegalArticle({
  breadcrumb,
  children,
}: {
  breadcrumb: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      {breadcrumb}
      <article className="prose prose-invert prose-zinc mt-8 max-w-none prose-headings:font-semibold prose-a:text-foreground prose-a:underline prose-a:underline-offset-2 prose-hr:border-border">
        {children}
      </article>
    </div>
  );
}
