import { getCommentArt } from '@/lib/comment-art';
import { renderCommentArt } from '@/lib/comment-art-image';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const art = getCommentArt(id);
  if (!art) return new Response('Not found', { status: 404 });
  return await renderCommentArt(art, 'og');
}
