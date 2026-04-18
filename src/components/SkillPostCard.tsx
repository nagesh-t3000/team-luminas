import { Link } from "react-router-dom";
import { currentUser } from "@/data/mockData";
import type { SkillPost } from "@/lib/skillPosts";
import { formatRelativePostTime } from "@/lib/skillPosts";

export function SkillPostCard({ post }: { post: SkillPost }) {
  const authorDisplayName = post.author_full_name?.trim() || post.author_username;
  const roleText = post.author_professional_role?.trim() || "Luminas member";
  const avatarUrl = post.author_profile_photo_url || currentUser.avatarUrl;
  const hasBody = Boolean(post.content);
  const hasMedia = post.media_items.length > 0;

  return (
    <article className="rounded-3xl border border-ig-border bg-ig-surface p-5 shadow-sm">
      <header className="flex items-start gap-3">
        <Link to={`/profile/${post.author_username}`} className="shrink-0">
          <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" width={48} height={48} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/profile/${post.author_username}`} className="text-[15px] font-semibold text-ig-text hover:text-ig-muted">
              {post.author_username}
            </Link>
            {post.author_is_verified ? (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ig-link text-[10px] text-white" title="Verified">
                ✓
              </span>
            ) : null}
            <span className="rounded-full border border-ig-border bg-ig-bg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ig-link">
              {post.skilled_domain}
            </span>
          </div>
          <p className="text-[13px] text-ig-muted">
            {authorDisplayName} · {roleText}
          </p>
        </div>
      </header>

      <div className="mt-4 rounded-2xl bg-ig-bg p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ig-link">Skill post</p>
        {hasBody ? (
          <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-ig-text">{post.content}</p>
        ) : null}
        {hasMedia ? (
          <div className={`grid gap-3 ${post.media_items.length > 1 ? "mt-4 sm:grid-cols-2" : "mt-3"}`}>
            {post.media_items.map((mediaItem, index) =>
              mediaItem.kind === "image" ? (
                <img
                  key={`${mediaItem.kind}-${index}`}
                  src={mediaItem.url}
                  alt=""
                  className="max-h-[520px] w-full rounded-2xl bg-black object-cover"
                  width={720}
                  height={720}
                  loading="lazy"
                />
              ) : (
                <video
                  key={`${mediaItem.kind}-${index}`}
                  src={mediaItem.url}
                  controls
                  preload="metadata"
                  className="max-h-[520px] w-full rounded-2xl bg-black"
                />
              ),
            )}
          </div>
        ) : null}
      </div>

      <footer className="mt-3 text-[12px] font-medium uppercase tracking-wide text-ig-muted">
        {formatRelativePostTime(post.created_at)}
      </footer>
    </article>
  );
}
