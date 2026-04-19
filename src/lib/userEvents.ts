import { createAuthoredEvent, type ExploreUpdate } from "@/lib/exploreUpdates";
import { getStoredAuthUser, isVerifiedProfile } from "@/lib/appAuth";

const STORAGE_KEY = "luminas.userEvents";

type StoredUserEvent = ExploreUpdate & {
  author_id: string;
};

type CreateUserEventInput = {
  authorId: string;
  sourceName: string;
  title: string;
  summary: string;
  location: string;
  externalUrl?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  startsAt: string;
};

function readStoredUserEvents() {
  if (typeof window === "undefined") {
    return [] as StoredUserEvent[];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [] as StoredUserEvent[];
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue)
      ? parsedValue.map(normalizeStoredUserEvent).filter(isStoredUserEvent)
      : [];
  } catch {
    return [] as StoredUserEvent[];
  }
}

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

function isStoredUserEvent(value: StoredUserEvent | null): value is StoredUserEvent {
  return value !== null;
}

function normalizeStoredUserEvent(value: unknown): StoredUserEvent | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const event = value as Partial<StoredUserEvent>;
  const id = normalizeString(event.id);
  const authorId = normalizeString(event.author_id);
  const title = normalizeString(event.title);
  const summary = normalizeString(event.summary);
  const sourceName = normalizeString(event.source_name);
  const location = normalizeString(event.location) || "Remote";
  const createdAt = normalizeString(event.created_at);
  const publishedAt = normalizeString(event.published_at);

  if (!id || !authorId || !title || !summary || !sourceName || !createdAt || !publishedAt) {
    return null;
  }

  return {
    id,
    author_id: authorId,
    category: "event",
    source_name: sourceName,
    title,
    summary,
    location,
    external_url: normalizeString(event.external_url) || null,
    image_url: normalizeString(event.image_url) || null,
    tags: normalizeStringArray(event.tags),
    raw_payload:
      typeof event.raw_payload === "object" && event.raw_payload !== null
        ? event.raw_payload
        : {},
    published_at: publishedAt,
    created_at: createdAt,
  };
}

function sortNewestFirst(events: StoredUserEvent[]) {
  return [...events].sort((left, right) => {
    const leftTime = new Date(left.published_at).getTime();
    const rightTime = new Date(right.published_at).getTime();
    return rightTime - leftTime;
  });
}

export function listUserEvents() {
  const authUser = getStoredAuthUser();

  if (!authUser || !isVerifiedProfile(authUser)) {
    return [];
  }

  return sortNewestFirst(readStoredUserEvents().filter((event) => event.author_id === authUser.id));
}

export async function createUserEvent({
  authorId,
  sourceName,
  title,
  summary,
  location,
  externalUrl,
  imageUrl,
  tags = [],
  startsAt,
}: CreateUserEventInput) {
  const authUser = getStoredAuthUser();
  const normalizedAuthorId = authorId.trim();

  if (!authUser || authUser.id !== normalizedAuthorId || !isVerifiedProfile(authUser)) {
    throw new Error("Only verified profiles can create events.");
  }

  return createAuthoredEvent({
    authorId: normalizedAuthorId,
    sourceName: sourceName.trim(),
    title: title.trim(),
    summary: summary.trim(),
    location: location.trim() || "Remote",
    externalUrl: externalUrl?.trim() || null,
    imageUrl: imageUrl?.trim() || null,
    tags: normalizeStringArray(tags),
    publishedAt: startsAt,
  });
}
