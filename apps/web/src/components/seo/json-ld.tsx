/**
 * Renders a JSON-LD <script> tag for structured data (schema.org). Used for
 * Organization, FAQPage, BreadcrumbList, Article, Product/Offer, etc. per
 * CLAUDE.md §11. Every marketing page should include at least the relevant
 * schema type(s) for its content.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
