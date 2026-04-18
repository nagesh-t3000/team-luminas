import { useState } from "react";
import { Link } from "react-router-dom";
import { IconBookmark, IconComment, IconHeart, IconMore, IconShare } from "@/components/Icons";
import type { Post } from "@/data/mockData";
import { roleLabel, userById } from "@/data/mockData";

function formatLikes(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function PostCard({ post }: { post: Post }) {
  const author = userById(post.userId);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <article className="mb-4 border border-ig-border bg-ig-surface md:mb-6 md:rounded-lg">
      <header className="flex h-[44px] items-center justify-between px-3 md:h-[48px] md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`/profile/${author.username}`} className="shrink-0">
            <span className="story-ring inline-block">
              <span className="story-ring-inner inline-block">
                <img src={author.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" width={32} height={32} />
              </span>
            </span>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1 truncate">
              <Link to={`/profile/${author.username}`} className="truncate text-[14px] font-semibold hover:text-ig-muted">
                {author.username}
              </Link>
              {author.verified ? (
                <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-ig-link text-[10px] text-white" title="Verified">
                  ✓
                </span>
              ) : null}
            </div>
            <div className="truncate text-[12px] text-ig-muted">
              {roleLabel[author.role]}
              {post.location ? ` · ${post.location}` : ""}
            </div>
          </div>
        </div>
        <button type="button" className="p-2 text-ig-text" aria-label="More options">
          <IconMore />
        </button>
      </header>
      <div className="aspect-square w-full bg-black">
        <img src={post.imageUrl} alt="" className="h-full w-full object-cover" width={1080} height={1080} loading="lazy" />
      </div>
      <div className="px-3 py-2 md:px-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button type="button" className="p-0" aria-label="Like" onClick={() => setLiked((v) => !v)}>
              <IconHeart filled={liked} />
            </button>
            <button type="button" className="p-0" aria-label="Comment">
              <IconComment />
            </button>
            <button type="button" className="p-0" aria-label="Share">
              <IconShare />
            </button>
          </div>
          <button type="button" className="p-0" aria-label="Save" onClick={() => setSaved((v) => !v)}>
            <IconBookmark filled={saved} />
          </button>
        </div>
        <p className="mb-1 text-[14px] font-semibold">{formatLikes(post.likes + (liked ? 1 : 0))} likes</p>
        <p className="text-[14px] leading-snug">
          <Link to={`/profile/${author.username}`} className="mr-1 font-semibold hover:text-ig-muted">
            {author.username}
          </Link>
          <span className="text-ig-text">{post.caption}</span>
        </p>
        {post.comments.length > 0 ? (
          <Link to="#" className="mt-1 block text-[14px] text-ig-muted hover:text-ig-text">
            View all {post.comments.length} comments
          </Link>
        ) : null}
        <p className="mt-2 text-[10px] uppercase tracking-wide text-ig-muted">{post.timestamp} ago</p>
      </div>
    </article>
  );
}
