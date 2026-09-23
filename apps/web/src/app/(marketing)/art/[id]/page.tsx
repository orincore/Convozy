import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { InstagramShareButton } from '@/components/marketing/instagram-share-button';
import { getCommentArt } from '@/lib/comment-art';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const art = getCommentArt(id);
  if (!art) return { title: 'Not found', robots: { index: false } };

  const title = `Comment art for @${art.handle} | Created by Convozy`;
  const description = 'Created by Convozy. Turn the comments on your Instagram posts into shareable art.';
  const ogImage = `/art/${art.id}/og`;

  return {
    title,
    description,
    alternates: { canonical: `/art/${art.id}` },
    openGraph: {
      title,
      description,
      siteName: 'Created by Convozy',
      type: 'article',
      url: `/art/${art.id}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Comment art for @${art.handle}` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  };
}

export default async function ArtPage({ params }: Props) {
  const { id } = await params;
  const art = getCommentArt(id);
  if (!art) notFound();

  const imageUrl = `/art/${art.id}/image`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Breadcrumbs
        baseUrl={SITE_URL}
        items={[
          { name: 'Home', href: '/' },
          { name: 'Comment art', href: `/art/${art.id}` },
        ]}
      />

      <div className="mt-10 flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center lg:gap-16">
        <div className="w-full max-w-[19rem] shrink-0 rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5 sm:max-w-xs">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[calc(2rem-0.375rem)]">
            <Image
              src={imageUrl}
              alt={`Comment art for @${art.handle}: ${art.comments.length} comments on a post`}
              fill
              sizes="320px"
              unoptimized
              priority
              className="object-cover"
            />
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center lg:items-start lg:pt-10 lg:text-left">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Your comments, as art
            </h1>
            <p className="mt-3 text-muted-foreground">
              Share this to your Instagram Story. It carries a &ldquo;Created by Convozy&rdquo; credit so your
              followers can find us.
            </p>
          </div>
          <InstagramShareButton artId={art.id} imageUrl={imageUrl} />
        </div>
      </div>
    </div>
  );
}
