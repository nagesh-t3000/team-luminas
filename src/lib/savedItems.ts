import type { ExploreUpdate } from "@/lib/exploreUpdates";
import type { SkillPost, SkillPostMediaItem } from "@/lib/skillPosts";

const STORAGE_KEY = "luminas.savedProfileItems";
const STORAGE_EVENT_NAME = "luminas.savedProfileItems.changed";

export type SavedProfileItem =
  | {
      kind: "skill_post";
      saved_at: string;
      post: SkillPost;
    }
  | {
      kind: "event";
      saved_at: string;
      event: ExploreUpdate;
    };

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeCount(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return Math.floor(numericValue);
}

function normalizeMediaItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as SkillPostMediaItem[];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const kind = "kind" in item && typeof item.kind === "string" ? item.kind.trim().toLowerCase() : "";
      const url = "url" in item && typeof item.url === "string" ? item.url.trim() : "";

      if ((kind !== "image" && kind !== "video") || !url) {
        return null;
      }

      return {
        kind: kind as SkillPostMediaItem["kind"],
        url,
      };
    })
    .filter((item): item is SkillPostMediaItem => Boolean(item))
    .slice(0, 4);
}

function normalizeSkillPost(value: unknown): SkillPost | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const post = value as Partial<SkillPost>;
  const id = normalizeString(post.id);
  const authorId = normalizeString(post.author_id);
  const createdAt = normalizeString(post.created_at);
  const authorUsername = normalizeString(post.author_username);

  if (!id || !authorId || !createdAt || !authorUsername) {
    return null;
  }

  return {
    id,
    author_id: authorId,
    skilled_domain: normalizeString(post.skilled_domain),
    content: normalizeString(post.content),
    media_items: normalizeMediaItems(post.media_items),
    created_at: createdAt,
    author_username: authorUsername,
    author_full_name: normalizeString(post.author_full_name) || null,
    author_professional_role: normalizeString(post.author_professional_role) || null,
    author_profile_photo_url: normalizeString(post.author_profile_photo_url) || null,
    author_is_verified: Boolean(post.author_is_verified),
    like_count: normalizeCount(post.like_count),
    comment_count: normalizeCount(post.comment_count),
    viewer_has_liked: Boolean(post.viewer_has_liked),
  };
}

function normalizeExploreUpdate(value: unknown): ExploreUpdate | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const update = value as Partial<ExploreUpdate>;
  const id = normalizeString(update.id);
  const title = normalizeString(update.title);
  const summary = normalizeString(update.summary);
  const sourceName = normalizeString(update.source_name);
  const publishedAt = normalizeString(update.published_at);
  const createdAt = normalizeString(update.created_at);
  const category = normalizeString(update.category).toLowerCase();

  if (!id || !title || !summary || !sourceName || !publishedAt || !createdAt) {
    return null;
  }

  return {
    id,
    category: category === "hackathon" || category === "job" ? category : "event",
    source_name: sourceName,
    title,
    summary,
    location: normalizeString(update.location) || "Remote",
    external_url: normalizeString(update.external_url) || null,
    image_url: normalizeString(update.image_url) || null,
    tags: normalizeStringArray(update.tags),
    raw_payload: typeof update.raw_payload === "object" && update.raw_payload !== null ? update.raw_payload : {},
    published_at: publishedAt,
    created_at: createdAt,
    author_id: normalizeString(update.author_id) || null,
    author_username: normalizeString(update.author_username) || null,
    author_full_name: normalizeString(update.author_full_name) || null,
    author_professional_role: normalizeString(update.author_professional_role) || null,
    author_profile_photo_url: normalizeString(update.author_profile_photo_url) || null,
    author_is_verified: Boolean(update.author_is_verified),
  };
}

function normalizeSavedProfileItem(value: unknown): SavedProfileItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const item = value as Partial<SavedProfileItem> & { post?: unknown; event?: unknown };
  const savedAt = normalizeString(item.saved_at) || new Date(0).toISOString();

  if (item.kind === "skill_post") {
    const post = normalizeSkillPost(item.post);

    if (!post) {
      return null;
    }

    return {
      kind: "skill_post",
      saved_at: savedAt,
      post,
    };
  }

  if (item.kind === "event") {
    const event = normalizeExploreUpdate(item.event);

    if (!event) {
      return null;
    }

    return {
      kind: "event",
      saved_at: savedAt,
      event,
    };
  }

  return null;
}

function sortNewestFirst(items: SavedProfileItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.saved_at).getTime();
    const rightTime = new Date(right.saved_at).getTime();
    return rightTime - leftTime;
  });
}

function readStoredSavedItems() {
  if (typeof window === "undefined") {
    return [] as SavedProfileItem[];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [] as SavedProfileItem[];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [] as SavedProfileItem[];
    }

    return sortNewestFirst(parsedValue.map(normalizeSavedProfileItem).filter((item): item is SavedProfileItem => Boolean(item)));
  } catch {
    return [] as SavedProfileItem[];
  }
}

function writeStoredSavedItems(items: SavedProfileItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortNewestFirst(items)));
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT_NAME));
}

export function listSavedProfileItems() {
  return readStoredSavedItems();
}

export function isSkillPostSaved(postId: string) {
  return readStoredSavedItems().some((item) => item.kind === "skill_post" && item.post.id === postId);
}

export function isEventSaved(eventId: string) {
  return readStoredSavedItems().some((item) => item.kind === "event" && item.event.id === eventId);
}

export function toggleSavedSkillPost(post: SkillPost) {
  const currentItems = readStoredSavedItems();
  const isAlreadySaved = currentItems.some((item) => item.kind === "skill_post" && item.post.id === post.id);

  writeStoredSavedItems(
    isAlreadySaved
      ? currentItems.filter((item) => !(item.kind === "skill_post" && item.post.id === post.id))
      : [{ kind: "skill_post", saved_at: new Date().toISOString(), post }, ...currentItems],
  );

  return !isAlreadySaved;
}

export function toggleSavedEvent(event: ExploreUpdate) {
  const currentItems = readStoredSavedItems();
  const isAlreadySaved = currentItems.some((item) => item.kind === "event" && item.event.id === event.id);

  writeStoredSavedItems(
    isAlreadySaved
      ? currentItems.filter((item) => !(item.kind === "event" && item.event.id === event.id))
      : [{ kind: "event", saved_at: new Date().toISOString(), event }, ...currentItems],
  );

  return !isAlreadySaved;
}

export function subscribeToSavedProfileItems(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener();
    }
  };
  const handleCustomEvent = () => {
    listener();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(STORAGE_EVENT_NAME, handleCustomEvent);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STORAGE_EVENT_NAME, handleCustomEvent);
  };
}
