export interface CommentArtComment {
  user: string;
  text: string;
}

export interface CommentArt {
  id: string;
  handle: string;
  postTitle: string;
  comments: CommentArtComment[];
}

/**
 * Sample data only. No backend generates Comment Art yet (nothing in the API
 * reads comments into art), so `/art/sample` is the one piece that exists.
 * Swap this lookup for a real query once art is generated server-side.
 */
const SAMPLES: Record<string, CommentArt> = {
  sample: {
    id: 'sample',
    handle: 'your.handle',
    postTitle: 'Comment PRICE and I will send it over',
    comments: [
      { user: 'jordan.k', text: 'Love this so much' },
      { user: 'maya.creates', text: 'PRICE please, send it over!' },
      { user: 'sam.builds', text: 'LINK? Yes please' },
      { user: 'a.follower', text: 'GUIDE me, I am just starting out' },
    ],
  },
};

export function getCommentArt(id: string): CommentArt | null {
  return SAMPLES[id] ?? null;
}
