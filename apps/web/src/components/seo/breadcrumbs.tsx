import Link from 'next/link';
import { CaretRight } from '@phosphor-icons/react/dist/ssr';
import { JsonLd } from './json-ld';

export interface BreadcrumbItem {
  name: string;
  href: string;
}

/**
 * Visible breadcrumb trail + matching BreadcrumbList JSON-LD, per
 * CLAUDE.md §11. `items` must mirror the actual URL hierarchy, ending with
 * the current page. Every non-homepage marketing route should render this.
 */
export function Breadcrumbs({ items, baseUrl }: { items: BreadcrumbItem[]; baseUrl: string }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.href}`,
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.href} className="flex items-center gap-1.5">
                {isLast ? (
                  <span aria-current="page" className="font-medium text-foreground">
                    {item.name}
                  </span>
                ) : (
                  <>
                    <Link href={item.href} className="transition-colors hover:text-foreground">
                      {item.name}
                    </Link>
                    <CaretRight size={12} aria-hidden="true" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
