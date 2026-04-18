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
    message.includes("schema cache")
  );
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
