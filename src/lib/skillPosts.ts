import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type SkillPostMediaItem = {
  kind: "image" | "video";
  url: string;
};

export type SkillPost = {
  id: string;
  author_id: string;
  skilled_domain: string;
  content: string;
  media_items: SkillPostMediaItem[];
  created_at: string;
  author_username: string;
  author_full_name: string | null;
  author_professional_role: string | null;
  author_profile_photo_url: string | null;
  author_is_verified: boolean;
};

type CreateSkillPostInput = {
  authorId: string;
  skilledDomain: string;
  content: string;
  mediaItems?: SkillPostMediaItem[];
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

  return "Unable to load or publish skill posts right now.";
}

function isMissingSkillPostsRpcError(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("Could not find the function public.create_skill_post") ||
    message.includes("Could not find the function public.list_skill_posts") ||
    message.includes("Could not find the function public.list_skill_posts_by_username") ||
    message.includes("schema cache")
  );
}

function normalizeSkillPostMediaItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
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

function normalizeSkillPost(post: SkillPost) {
  return {
    ...post,
    skilled_domain: post.skilled_domain?.trim() || "",
    content: post.content?.trim() || "",
    media_items: normalizeSkillPostMediaItems(post.media_items),
    author_username: post.author_username?.trim() || "",
    author_full_name: post.author_full_name?.trim() || null,
    author_professional_role: post.author_professional_role?.trim() || null,
    author_profile_photo_url: post.author_profile_photo_url?.trim() || null,
    author_is_verified: Boolean(post.author_is_verified),
  };
}

export async function listSkillPosts(limit = 20) {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_skill_posts", {
    limit_count: limit,
  });

  if (error) {
    if (isMissingSkillPostsRpcError(error)) {
      return [];
    }

    throw error;
  }

  return Array.isArray(data) ? data.map((post) => normalizeSkillPost(post as SkillPost)) : [];
}

export async function listSkillPostsByUsername(username: string, limit = 20) {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_skill_posts_by_username", {
    username_input: username,
    limit_count: limit,
  });

  if (error) {
    if (isMissingSkillPostsRpcError(error)) {
      return [];
    }

    throw error;
  }

  return Array.isArray(data) ? data.map((post) => normalizeSkillPost(post as SkillPost)) : [];
}

export async function createSkillPost({ authorId, skilledDomain, content, mediaItems = [] }: CreateSkillPostInput) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Update the anon key in .env.");
  }

  const { data, error } = await supabase.rpc("create_skill_post", {
    author_id_input: authorId,
    skilled_domain_input: skilledDomain,
    content_input: content,
    media_items_input: mediaItems,
  });

  if (error) {
    if (isMissingSkillPostsRpcError(error)) {
      throw new Error(
        "Your Supabase SQL is missing the skill posts migration. Apply `supabase/sql/004_skill_posts.sql` and try again.",
      );
    }

    throw new Error(getErrorMessage(error));
  }

  const createdPost = Array.isArray(data) ? data[0] : data;

  if (!createdPost) {
    throw new Error("No post was returned from Supabase.");
  }

  return normalizeSkillPost(createdPost as SkillPost);
}

export function formatRelativePostTime(value: string) {
  const timestamp = new Date(value);
  const diffInSeconds = Math.round((timestamp.getTime() - Date.now()) / 1000);

  if (Number.isNaN(timestamp.getTime())) {
    return "Just now";
  }

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const intervals = [
    { unit: "year", seconds: 60 * 60 * 24 * 365 },
    { unit: "month", seconds: 60 * 60 * 24 * 30 },
    { unit: "week", seconds: 60 * 60 * 24 * 7 },
    { unit: "day", seconds: 60 * 60 * 24 },
    { unit: "hour", seconds: 60 * 60 },
    { unit: "minute", seconds: 60 },
  ] as const;

  for (const interval of intervals) {
    if (Math.abs(diffInSeconds) >= interval.seconds) {
      return formatter.format(Math.round(diffInSeconds / interval.seconds), interval.unit);
    }
  }

  return formatter.format(diffInSeconds, "second");
}
