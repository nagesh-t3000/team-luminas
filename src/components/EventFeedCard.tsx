import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconBookmark } from "@/components/Icons";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { buildFallbackAvatar } from "@/lib/publicUsers";
import { type ExploreUpdate } from "@/lib/exploreUpdates";
import { isEventSaved, subscribeToSavedProfileItems, toggleSavedEvent } from "@/lib/savedItems";
import { formatRelativePostTime } from "@/lib/skillPosts";

function getCallToAction(update: ExploreUpdate) {
  return typeof update.raw_payload.cta === "string" && update.raw_payload.cta.trim()
    ? update.raw_payload.cta.trim()
    : "View details";
}

function formatEventDate(value: string) {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return "Date coming soon";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function EventFeedCard({ update }: { update: ExploreUpdate }) {
  const [isSaved, setIsSaved] = useState(() => isEventSaved(update.id));
  const authorUsername = update.author_username?.trim() || null;
  const authorDisplayName = update.author_full_name?.trim() || update.source_name || authorUsername || "Luminas member";
  const roleText = update.author_professional_role?.trim() || "Luminas member";
  const avatarUrl = update.author_profile_photo_url || buildFallbackAvatar(authorDisplayName);
  const eventDate = formatEventDate(update.published_at);
  const relativeTime = formatRelativePostTime(update.published_at);
  const callToAction = getCallToAction(update);

  useEffect(() => {
    setIsSaved(isEventSaved(update.id));
  }, [update.id]);

  useEffect(() => {
    const unsubscribe = subscribeToSavedProfileItems(() => {
      setIsSaved(isEventSaved(update.id));
    });

    return unsubscribe;
  }, [update.id]);

  function handleSaveToggle() {
    setIsSaved(toggleSavedEvent(update));
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-ig-border bg-ig-surface shadow-sm">
      {update.image_url ? (
        <div className="aspect-[16/9] bg-ig-bg">
          <img
            src={update.image_url}
            alt={update.title}
            className="h-full w-full object-cover"
            width={960}
            height={540}
            loading="lazy"
          />
        </div>
      ) : null}

      <div className="p-5">
        <header className="flex items-start gap-3">
          {authorUsername ? (
            <Link to={`/profile/${authorUsername}`} className="shrink-0">
              <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" width={48} height={48} />
            </Link>
          ) : (
            <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" width={48} height={48} />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {authorUsername ? (
                <span className="flex items-center gap-1.5">
                  <Link to={`/profile/${authorUsername}`} className="text-[15px] font-semibold text-ig-text hover:text-ig-muted">
                    {authorUsername}
                  </Link>
                  {update.author_is_verified ? <VerifiedBadge /> : null}
                </span>
              ) : (
                <span className="text-[15px] font-semibold text-ig-text">{authorDisplayName}</span>
              )}
              <span className="rounded-full border border-ig-border bg-ig-bg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Event
              </span>
            </div>
            <p className="text-[13px] text-ig-muted">
              {authorDisplayName} · {roleText}
            </p>
          </div>
        </header>

        <div className="mt-4 rounded-2xl bg-ig-bg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Upcoming event</p>
          <h2 className="mt-3 text-lg font-semibold leading-6 text-ig-text">{update.title}</h2>
          <p className="mt-2 text-[15px] leading-7 text-ig-muted">{update.summary}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ig-muted">
            <span className="rounded-full border border-ig-border bg-white px-3 py-1">{update.location}</span>
            <span className="rounded-full border border-ig-border bg-white px-3 py-1">{eventDate}</span>
            {update.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-ig-border bg-white px-3 py-1 text-[13px]">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] font-medium uppercase tracking-wide text-ig-muted">Starts {relativeTime}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveToggle}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isSaved
                  ? "border-ig-text bg-ig-text text-white"
                  : "border-ig-border bg-white text-ig-text hover:bg-ig-bg"
              }`}
              aria-label={isSaved ? "Unsave event" : "Save event"}
            >
              <IconBookmark filled={isSaved} />
              {isSaved ? "Saved" : "Save"}
            </button>
            {update.external_url ? (
              <a
                href={update.external_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full bg-ig-link px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                {callToAction}
              </a>
            ) : null}
          </div>
        </footer>
      </div>
    </article>
  );
}
