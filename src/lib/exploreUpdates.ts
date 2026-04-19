import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type ExploreUpdateCategory = "hackathon" | "event" | "job";

export type ExploreUpdate = {
  id: string;
  category: ExploreUpdateCategory;
  source_name: string;
  title: string;
  summary: string;
  location: string;
  external_url: string | null;
  image_url: string | null;
  tags: string[];
  raw_payload: Record<string, unknown>;
  published_at: string;
  created_at: string;
  author_id?: string | null;
  author_username?: string | null;
  author_full_name?: string | null;
  author_professional_role?: string | null;
  author_profile_photo_url?: string | null;
  author_is_verified?: boolean;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Unable to load explore updates right now.";
}

function isMissingExploreUpdatesRpcError(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("Could not find the function public.list_explore_updates") ||
    message.includes("Could not find the function public.list_authored_explore_updates") ||
    message.includes("Could not find the function public.create_authored_event") ||
    message.includes("schema cache")
  );
}

type CreateAuthoredEventInput = {
  authorId: string;
  sourceName: string;
  title: string;
  summary: string;
  location: string;
  externalUrl?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  publishedAt: string;
};

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

function normalizeCategory(value: unknown): ExploreUpdateCategory {
  const category = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (category === "hackathon" || category === "event" || category === "job") {
    return category;
  }

  return "event";
}

function normalizeExploreUpdate(update: ExploreUpdate) {
  return {
    ...update,
    category: normalizeCategory(update.category),
    source_name: update.source_name?.trim() || "",
    title: update.title?.trim() || "",
    summary: update.summary?.trim() || "",
    location: update.location?.trim() || "Remote",
    external_url: update.external_url?.trim() || null,
    image_url: update.image_url?.trim() || null,
    tags: normalizeStringArray(update.tags),
    raw_payload:
      typeof update.raw_payload === "object" && update.raw_payload !== null
        ? update.raw_payload
        : {},
    author_id: update.author_id?.trim() || null,
    author_username: update.author_username?.trim() || null,
    author_full_name: update.author_full_name?.trim() || null,
    author_professional_role: update.author_professional_role?.trim() || null,
    author_profile_photo_url: update.author_profile_photo_url?.trim() || null,
    author_is_verified: Boolean(update.author_is_verified),
  };
}

export async function listExploreUpdates(
  limit = 24,
  category?: ExploreUpdateCategory,
  searchQuery?: string,
) {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_explore_updates", {
    limit_count: limit,
    category_input: category ?? null,
    search_input: searchQuery?.trim() || null,
  });

  if (error) {
    if (isMissingExploreUpdatesRpcError(error)) {
      return [];
    }

    throw new Error(getErrorMessage(error));
  }

  return Array.isArray(data)
    ? data.map((update) => normalizeExploreUpdate(update as ExploreUpdate))
    : [];
}

export async function listAuthoredExploreUpdates(
  authorId: string,
  category?: ExploreUpdateCategory,
  limit = 24,
) {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_authored_explore_updates", {
    author_id_input: authorId,
    category_input: category ?? null,
    limit_count: limit,
  });

  if (error) {
    if (isMissingExploreUpdatesRpcError(error)) {
      return [];
    }

    throw new Error(getErrorMessage(error));
  }

  return Array.isArray(data)
    ? data.map((update) => normalizeExploreUpdate(update as ExploreUpdate))
    : [];
}

export async function createAuthoredEvent({
  authorId,
  sourceName,
  title,
  summary,
  location,
  externalUrl,
  imageUrl,
  tags = [],
  publishedAt,
}: CreateAuthoredEventInput) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Update the anon key in .env.");
  }

  const { data, error } = await supabase.rpc("create_authored_event", {
    author_id_input: authorId,
    source_name_input: sourceName,
    title_input: title,
    summary_input: summary,
    location_input: location,
    external_url_input: externalUrl ?? null,
    image_url_input: imageUrl ?? null,
    tags_input: tags,
    published_at_input: publishedAt,
  });

  if (error) {
    if (isMissingExploreUpdatesRpcError(error)) {
      throw new Error(
        "Your Supabase SQL is missing the authored events creation migration. Apply `supabase/sql/020_create_authored_events.sql` and try again.",
      );
    }

    throw new Error(getErrorMessage(error));
  }

  const createdEvent = Array.isArray(data) ? data[0] : data;

  if (!createdEvent) {
    throw new Error("No event was returned from Supabase.");
  }

  return normalizeExploreUpdate(createdEvent as ExploreUpdate);
}
