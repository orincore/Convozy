'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle } from '@phosphor-icons/react';

const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];
const SPRING = { type: 'spring', stiffness: 380, damping: 30 } as const;

interface TocItem {
  id: string;
  text: string;
}

const slug = (t: string) =>
  t
    .toLowerCase()
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Shared layout for reference pages (privacy, terms, data deletion): a hero with
 * the title, date and an "In short" summary, a sticky contents list that
 * highlights the section you are reading with a sliding pill (after Spectrum
 * UI's Tree Nav), and the full text in a double-bezel card. The legal text
 * itself is rendered as-is on the server, so it stays fully readable and
 * indexable; the contents list is built from its headings after load.
 */
export function LegalArticle({
  breadcrumb,
  title,
  updated,
  summary,
  children,
}: {
  breadcrumb: ReactNode;
  title: string;
  updated: string;
  summary: string[];
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const body = useRef<HTMLElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    const root = body.current;
    if (!root) return;
    const heads = Array.from(root.querySelectorAll<HTMLHeadingElement>('h2'));
    const items = heads.map((h) => {
      const id = slug(h.textContent ?? '');
      h.id = id;
      return { id, text: h.textContent ?? '' };
    });
    const t = setTimeout(() => {
      setToc(items);
      setActive(items[0]?.id ?? '');
    }, 0);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    heads.forEach((h) => observer.observe(h));
    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {breadcrumb}

      <motion.header
        initial={reduce ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end"
      >
        <div className="lg:col-span-7">
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">{title}</h1>
          <p className="mt-4 text-muted-foreground">Last updated: {updated}</p>
        </div>
        <div className="lg:col-span-5">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
            <div className="rounded-[calc(2rem-0.375rem)] bg-card p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
              <p className="text-sm font-medium">In short</p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {summary.map((s, i) => (
                  <motion.li
                    key={s}
                    initial={reduce ? false : { opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 + i * 0.08, ease: EASE }}
                    className="flex items-start gap-2.5 text-sm text-muted-foreground"
                  >
                    <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-foreground" />
                    {s}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="mt-14 grid gap-10 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          {toc.length > 0 && (
            <nav aria-label="On this page" className="sticky top-28">
              <p className="mb-3 px-3 text-xs font-medium text-muted-foreground">On this page</p>
              <ul className="flex flex-col gap-0.5">
                {toc.map((item) => {
                  const on = item.id === active;
                  return (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(item.id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
                          history.replaceState(null, '', `#${item.id}`);
                          setActive(item.id);
                        }}
                        className={`relative block rounded-xl px-3 py-2 text-sm transition-colors ${on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {on && <motion.span layoutId="toc-pill" transition={SPRING} className="absolute inset-0 rounded-xl bg-white/10" />}
                        <span className="relative">{item.text}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </aside>

        <div className="lg:col-span-9">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
            <article
              ref={body}
              className="prose prose-invert prose-zinc max-w-none rounded-[calc(2rem-0.375rem)] bg-card p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] sm:p-10 prose-headings:font-display prose-headings:font-semibold prose-h2:mt-12 prose-h2:scroll-mt-28 prose-h2:text-2xl first:prose-h2:mt-0 prose-a:text-foreground prose-a:underline prose-a:underline-offset-2 prose-hr:border-border"
            >
              {children}
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
