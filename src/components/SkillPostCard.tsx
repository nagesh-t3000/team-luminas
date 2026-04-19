import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconBookmark, IconComment, IconHeart } from "@/components/Icons";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getStoredAuthUser } from "@/lib/appAuth";
import { buildFallbackAvatar } from "@/lib/publicUsers";
import { isSkillPostSaved, subscribeToSavedProfileItems, toggleSavedSkillPost } from "@/lib/savedItems";
import {
  createSkillPostComment,
  formatRelativePostTime,
  listSkillPostComments,
  toggleSkillPostLike,
  type SkillPost,
  type SkillPostComment,
} from "@/lib/skillPosts";

export function SkillPostCard({ post }: { post: SkillPost }) {
  const authUser = useMemo(() => getStoredAuthUser(), []);
  const authorDisplayName = post.author_full_name?.trim() || post.author_username;
  const roleText = post.author_professional_role?.trim() || "Luminas member";
  const avatarUrl = post.author_profile_photo_url || buildFallbackAvatar(authorDisplayName);
  const hasBody = Boolean(post.content);
  const hasMedia = post.media_items.length > 0;
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [hasLiked, setHasLiked] = useState(post.viewer_has_liked);
  const [isLikePending, setIsLikePending] = useState(false);
  const [comments, setComments] = useState<SkillPostComment[]>([]);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [hasLoadedComments, setHasLoadedComments] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [actionError, setActionError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [isSaved, setIsSaved] = useState(() => isSkillPostSaved(post.id));

  useEffect(() => {
    setLikeCount(post.like_count);
    setCommentCount(post.comment_count);
    setHasLiked(post.viewer_has_liked);
    setComments([]);
    setIsCommentsOpen(false);
    setHasLoadedComments(false);
    setIsCommentsLoading(false);
    setIsCommentSubmitting(false);
    setCommentDraft("");
    setActionError("");
    setCommentError("");
    setIsSaved(isSkillPostSaved(post.id));
  }, [post.comment_count, post.id, post.like_count, post.viewer_has_liked]);

  useEffect(() => {
    const unsubscribe = subscribeToSavedProfileItems(() => {
      setIsSaved(isSkillPostSaved(post.id));
    });

    return unsubscribe;
  }, [post.id]);

  async function loadComments() {
    setIsCommentsLoading(true);
    setCommentError("");

    try {
      const nextComments = await listSkillPostComments(post.id, 40);
      setComments(nextComments);
      setCommentCount((currentCount) => Math.max(currentCount, nextComments.length));
      setHasLoadedComments(true);
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Unable to load comments right now.");
    } finally {
      setIsCommentsLoading(false);
    }
  }

  async function handleLikeToggle() {
    if (!authUser) {
      setActionError("Sign in again to like posts.");
      return;
    }

    if (isLikePending) {
      return;
    }

    const previousLikeState = hasLiked;
    const previousLikeCount = likeCount;
    const optimisticHasLiked = !previousLikeState;

    setActionError("");
    setIsLikePending(true);
    setHasLiked(optimisticHasLiked);
    setLikeCount((currentCount) => Math.max(0, currentCount + (optimisticHasLiked ? 1 : -1)));

    try {
      const result = await toggleSkillPostLike(post.id, authUser.id);
      setHasLiked(result.viewer_has_liked);
      setLikeCount(result.like_count);
    } catch (error) {
      setHasLiked(previousLikeState);
      setLikeCount(previousLikeCount);
      setActionError(error instanceof Error ? error.message : "Unable to update the like right now.");
    } finally {
      setIsLikePending(false);
    }
  }

  async function handleCommentToggle() {
    const nextIsOpen = !isCommentsOpen;
    setIsCommentsOpen(nextIsOpen);
    setActionError("");

    if (nextIsOpen && !hasLoadedComments && !isCommentsLoading) {
      await loadComments();
    }
  }

  async function handleCommentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authUser) {
      setCommentError("Sign in again to comment on posts.");
      return;
    }

    const trimmedDraft = commentDraft.trim();

    if (!trimmedDraft || isCommentSubmitting) {
      return;
    }

    setCommentError("");
    setActionError("");
    setIsCommentSubmitting(true);

    try {
      const createdComment = await createSkillPostComment(post.id, authUser.id, trimmedDraft);
      setComments((currentComments) => [...currentComments, createdComment]);
      setCommentCount((currentCount) => currentCount + 1);
      setCommentDraft("");
      setHasLoadedComments(true);
      setIsCommentsOpen(true);
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Unable to post your comment right now.");
    } finally {
      setIsCommentSubmitting(false);
    }
  }

  function handleSaveToggle() {
    setIsSaved(toggleSavedSkillPost(post));
  }

  return (
    <article className="rounded-3xl border border-ig-border bg-ig-surface p-5 shadow-sm">
      <header className="flex items-start gap-3">
        <Link to={`/profile/${post.author_username}`} className="shrink-0">
          <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" width={48} height={48} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5">
              <Link to={`/profile/${post.author_username}`} className="text-[15px] font-semibold text-ig-text hover:text-ig-muted">
                {post.author_username}
              </Link>
              {post.author_is_verified ? <VerifiedBadge /> : null}
            </span>
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ig-text">
        <div className="flex flex-wrap items-center gap-5">
          <button
            type="button"
            className={`inline-flex items-center gap-2 transition ${hasLiked ? "text-[#ed4956]" : "hover:text-ig-muted"}`}
            onClick={handleLikeToggle}
            disabled={isLikePending}
            aria-label={hasLiked ? "Unlike post" : "Like post"}
          >
            <IconHeart filled={hasLiked} />
            <span className="font-medium">{formatInteractionCount(likeCount, "like")}</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 transition hover:text-ig-muted"
            onClick={() => {
              void handleCommentToggle();
            }}
            aria-expanded={isCommentsOpen}
            aria-label={isCommentsOpen ? "Hide comments" : "Show comments"}
          >
            <IconComment />
            <span className="font-medium">{formatInteractionCount(commentCount, "comment")}</span>
          </button>
        </div>
        <button
          type="button"
          className={`inline-flex items-center gap-2 transition ${isSaved ? "text-ig-text" : "text-ig-muted hover:text-ig-text"}`}
          onClick={handleSaveToggle}
          aria-label={isSaved ? "Unsave post" : "Save post"}
        >
          <IconBookmark filled={isSaved} />
          <span className="font-medium">{isSaved ? "Saved" : "Save"}</span>
        </button>
      </div>

      {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}

      {isCommentsOpen ? (
        <section className="mt-4 rounded-2xl border border-ig-border bg-white p-4">
          <div className="space-y-3">
            {isCommentsLoading ? <p className="text-sm text-ig-muted">Loading comments...</p> : null}
            {!isCommentsLoading && comments.length === 0 ? (
              <p className="text-sm text-ig-muted">No comments yet. Start the conversation.</p>
            ) : null}
            {comments.map((comment) => {
              const commentDisplayName = comment.author_full_name?.trim() || comment.author_username;
              const commentAvatarUrl = comment.author_profile_photo_url || buildFallbackAvatar(commentDisplayName);

              return (
                <div key={comment.id} className="flex items-start gap-3">
                  <Link to={`/profile/${comment.author_username}`} className="shrink-0">
                    <img src={commentAvatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" width={36} height={36} />
                  </Link>
                  <div className="min-w-0 flex-1 rounded-2xl bg-ig-bg px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <Link to={`/profile/${comment.author_username}`} className="font-semibold text-ig-text hover:text-ig-muted">
                        {comment.author_username}
                      </Link>
                      {comment.author_is_verified ? <VerifiedBadge /> : null}
                      <span className="text-xs text-ig-muted">{formatRelativePostTime(comment.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-ig-text">{comment.content}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <form className="mt-4 border-t border-ig-border pt-4" onSubmit={handleCommentSubmit}>
            <label className="sr-only" htmlFor={`comment-${post.id}`}>
              Add a comment
            </label>
            <textarea
              id={`comment-${post.id}`}
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Add a comment..."
              className="w-full resize-none rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-ig-muted">{commentDraft.trim().length}/500</p>
              <button
                type="submit"
                className="rounded-xl bg-ig-link px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCommentSubmitting || !commentDraft.trim()}
              >
                {isCommentSubmitting ? "Posting..." : "Post comment"}
              </button>
            </div>
            {commentError ? <p className="mt-3 text-sm text-red-600">{commentError}</p> : null}
          </form>
        </section>
      ) : null}

      <footer className="mt-3 text-[12px] font-medium uppercase tracking-wide text-ig-muted">
        {formatRelativePostTime(post.created_at)}
      </footer>
    </article>
  );
}

function formatInteractionCount(count: number, label: string) {
  const formattedCount = new Intl.NumberFormat("en-US").format(count);
  return `${formattedCount} ${label}${count === 1 ? "" : "s"}`;
}
