import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { currentUser } from "@/data/mockData";
import { EventFeedCard } from "@/components/EventFeedCard";
import { getAuthUserAvatarUrl, getStoredAuthUser, isVerifiedProfile } from "@/lib/appAuth";
import type { PublicUser } from "@/lib/publicUsers";
import type { ExploreUpdate } from "@/lib/exploreUpdates";

type StoryRailProps = {
  users?: PublicUser[];
  events?: ExploreUpdate[];
  orientation?: "horizontal" | "vertical";
};

type StoryEventItem = {
  event: ExploreUpdate;
  username: string;
  previewImageUrl: string;
};

function normalizeLookupKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function readRawPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

export function StoryRail({ users = [], events = [], orientation = "horizontal" }: StoryRailProps) {
  const authUser = getStoredAuthUser();
  const canCreateEvents = isVerifiedProfile(authUser);
  const avatarUrl = getAuthUserAvatarUrl(authUser) || currentUser.avatarUrl;
  const [selectedEvent, setSelectedEvent] = useState<ExploreUpdate | null>(null);
  const isVertical = orientation === "vertical";
  const storyRingClass = "rounded-2xl bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] p-[2px]";
  const storyRingInnerClass = "rounded-[14px] bg-white p-[2px]";
  const storyImageClass = "h-14 w-14 rounded-xl object-cover";
  const usersByUsername = useMemo(() => {
    return new Map(users.map((user) => [normalizeLookupKey(user.username), user]));
  }, [users]);
  const usersByFullName = useMemo(() => {
    return new Map(
      users
        .filter((user) => user.full_name?.trim())
        .map((user) => [normalizeLookupKey(user.full_name), user]),
    );
  }, [users]);
  const usersById = useMemo(() => {
    return new Map(users.map((user) => [user.id, user]));
  }, [users]);
  const visibleEventStories = useMemo(() => {
    const seenUsernames = new Set<string>();
    const nextStories: StoryEventItem[] = [];

    for (const event of events) {
      const rawPayloadUsername =
        readRawPayloadString(event.raw_payload, "author_username") ||
        readRawPayloadString(event.raw_payload, "authorUsername");
      const rawPayloadFullName =
        readRawPayloadString(event.raw_payload, "author_full_name") ||
        readRawPayloadString(event.raw_payload, "authorFullName");

      const matchingUser =
        (event.author_id ? usersById.get(event.author_id) : undefined) ||
        usersByUsername.get(normalizeLookupKey(event.author_username)) ||
        usersByUsername.get(normalizeLookupKey(rawPayloadUsername)) ||
        usersByUsername.get(normalizeLookupKey(event.source_name)) ||
        usersByFullName.get(normalizeLookupKey(event.author_full_name)) ||
        usersByFullName.get(normalizeLookupKey(rawPayloadFullName)) ||
        usersByFullName.get(normalizeLookupKey(event.source_name));

      const username =
        matchingUser?.username ||
        event.author_username?.trim() ||
        rawPayloadUsername ||
        event.source_name?.trim();

      if (!username || seenUsernames.has(username)) {
        continue;
      }

      seenUsernames.add(username);
      const resolvedEvent: ExploreUpdate = {
        ...event,
        author_id: event.author_id || matchingUser?.id || null,
        author_username: event.author_username?.trim() || matchingUser?.username || rawPayloadUsername || null,
        author_full_name: event.author_full_name?.trim() || matchingUser?.full_name || rawPayloadFullName || null,
        author_professional_role:
          event.author_professional_role?.trim() || matchingUser?.professional_role || null,
        author_profile_photo_url: event.author_profile_photo_url || matchingUser?.avatar_url || null,
      };

      nextStories.push({
        event: resolvedEvent,
        username,
        previewImageUrl: resolvedEvent.image_url || resolvedEvent.author_profile_photo_url || matchingUser?.avatar_url || currentUser.avatarUrl,
      });

      if (nextStories.length >= 8) {
        break;
      }
    }

    return nextStories;
  }, [events, usersByUsername]);

  return (
    <>
      <div
        className={
          isVertical
            ? "rounded-3xl border border-ig-border bg-ig-surface p-4 shadow-sm"
            : "mb-3 rounded-lg border border-ig-border bg-ig-surface px-4 py-3 md:border-0 md:bg-transparent md:px-0 md:py-0"
        }
      >
        <div className={isVertical ? "flex flex-col gap-4" : "scrollbar-hide flex gap-4 overflow-x-auto pb-1"}>
          {canCreateEvents ? (
            <Link
              to="/create/event"
              className={`flex shrink-0 flex-col items-center gap-1 ${isVertical ? "w-full" : "w-[72px]"}`}
              aria-label="Create event"
            >
              <div className="relative transition-transform hover:scale-[1.02]">
                <div className={storyRingClass}>
                  <div className={storyRingInnerClass}>
                    <img src={avatarUrl} alt="" className={storyImageClass} width={56} height={56} />
                  </div>
                </div>
                <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-ig-link text-xs font-bold text-white">
                  +
                </span>
              </div>
              <span
                className={`text-center text-[12px] text-ig-text ${
                  isVertical ? "w-full overflow-hidden text-ellipsis whitespace-nowrap" : "max-w-[72px] truncate"
                }`}
              >
                Create event
              </span>
            </Link>
          ) : (
            <Link
              to="/create"
              className={`flex shrink-0 flex-col items-center gap-1 opacity-80 ${isVertical ? "w-full" : "w-[72px]"}`}
              aria-label="Verified profiles only"
            >
              <div className="relative">
                <div className={`${storyRingClass} grayscale`}>
                  <div className={storyRingInnerClass}>
                    <img src={avatarUrl} alt="" className={storyImageClass} width={56} height={56} />
                  </div>
                </div>
              </div>
              <span
                className={`text-center text-[12px] leading-4 text-ig-muted ${
                  isVertical ? "w-full overflow-hidden text-ellipsis whitespace-nowrap" : "max-w-[72px] truncate"
                }`}
              >
                Verified only
              </span>
            </Link>
          )}
          {visibleEventStories.map((story) => (
            <button
              key={story.event.id}
              type="button"
              onClick={() => setSelectedEvent(story.event)}
              className={`flex shrink-0 flex-col items-center gap-1 text-left ${isVertical ? "w-full" : "w-[72px]"}`}
              aria-label={`Open ${story.username}'s event`}
            >
              <div className={storyRingClass}>
                <div className={storyRingInnerClass}>
                  <img src={story.previewImageUrl} alt="" className={storyImageClass} width={56} height={56} />
                </div>
              </div>
              <span
                className={`text-center text-[12px] text-ig-text ${
                  isVertical ? "w-full overflow-hidden text-ellipsis whitespace-nowrap" : "max-w-[72px] truncate"
                }`}
              >
                {story.username}
              </span>
            </button>
          ))}
          {visibleEventStories.length === 0 ? (
            <div className={`flex items-center text-sm text-ig-muted ${isVertical ? "justify-center py-6" : "min-h-[72px]"}`}>
              No events yet.
            </div>
          ) : null}
        </div>
      </div>
      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-6 md:px-6" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close event"
            className="absolute inset-0"
            onClick={() => setSelectedEvent(null)}
          />
          <div className="relative z-10 w-full max-w-2xl">
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="mb-3 ml-auto flex rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold text-ig-text shadow-sm"
            >
              Close
            </button>
            <EventFeedCard update={selectedEvent} />
          </div>
        </div>
      ) : null}
    </>
  );
}
