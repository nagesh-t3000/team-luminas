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
  like_count: number;
  comment_count: number;
  viewer_has_liked: boolean;
};

export type SkillPostComment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
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

function isMissingSkillPostEngagementRpcError(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("Could not find the function public.toggle_skill_post_like") ||
    message.includes("Could not find the function public.list_skill_post_comments") ||
    message.includes("Could not find the function public.create_skill_post_comment") ||
    message.includes("schema cache")
  );
}

function normalizeCount(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return Math.floor(numericValue);
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
    like_count: normalizeCount((post as SkillPost & { like_count?: unknown }).like_count),
    comment_count: normalizeCount((post as SkillPost & { comment_count?: unknown }).comment_count),
    viewer_has_liked: Boolean((post as SkillPost & { viewer_has_liked?: unknown }).viewer_has_liked),
  };
}

function normalizeSkillPostComment(comment: SkillPostComment) {
  return {
    ...comment,
    content: comment.content?.trim() || "",
    author_username: comment.author_username?.trim() || "",
    author_full_name: comment.author_full_name?.trim() || null,
    author_professional_role: comment.author_professional_role?.trim() || null,
    author_profile_photo_url: comment.author_profile_photo_url?.trim() || null,
    author_is_verified: Boolean(comment.author_is_verified),
  };
}

export async function listSkillPosts(limit = 20, viewerId?: string | null) {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  const args =
    viewerId && viewerId.trim()
      ? {
          limit_count: limit,
          viewer_id_input: viewerId,
        }
      : {
          limit_count: limit,
        };

  let { data, error } = await supabase.rpc("list_skill_posts", args);

  if (error && viewerId && isMissingSkillPostsRpcError(error)) {
    const fallbackResult = await supabase.rpc("list_skill_posts", {
      limit_count: limit,
    });

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    if (isMissingSkillPostsRpcError(error)) {
      return [];
    }

    throw error;
  }

  return Array.isArray(data) ? data.map((post) => normalizeSkillPost(post as SkillPost)) : [];
}

export async function listSkillPostsByUsername(username: string, limit = 20, viewerId?: string | null) {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  const args =
    viewerId && viewerId.trim()
      ? {
          username_input: username,
          limit_count: limit,
          viewer_id_input: viewerId,
        }
      : {
          username_input: username,
          limit_count: limit,
        };

  let { data, error } = await supabase.rpc("list_skill_posts_by_username", args);

  if (error && viewerId && isMissingSkillPostsRpcError(error)) {
    const fallbackResult = await supabase.rpc("list_skill_posts_by_username", {
      username_input: username,
      limit_count: limit,
    });

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

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

export async function toggleSkillPostLike(postId: string, userId: string) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Update the anon key in .env.");
  }

  const { data, error } = await supabase.rpc("toggle_skill_post_like", {
    post_id_input: postId,
    user_id_input: userId,
  });

  if (error) {
    if (isMissingSkillPostEngagementRpcError(error)) {
      throw new Error(
        "Your Supabase SQL is missing the skill post engagement migration. Apply `supabase/sql/014_skill_post_engagement.sql` and try again.",
      );
    }

    throw new Error(getErrorMessage(error));
  }

  const result = Array.isArray(data) ? data[0] : data;

  return {
    like_count: normalizeCount(result?.like_count),
    viewer_has_liked: Boolean(result?.viewer_has_liked),
  };
}

export async function listSkillPostComments(postId: string, limit = 40) {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_skill_post_comments", {
    post_id_input: postId,
    limit_count: limit,
  });

  if (error) {
    if (isMissingSkillPostEngagementRpcError(error)) {
      return [];
    }

    throw new Error(getErrorMessage(error));
  }

  return Array.isArray(data) ? data.map((comment) => normalizeSkillPostComment(comment as SkillPostComment)) : [];
}

export async function createSkillPostComment(postId: string, authorId: string, content: string) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Update the anon key in .env.");
  }

  const { data, error } = await supabase.rpc("create_skill_post_comment", {
    post_id_input: postId,
    author_id_input: authorId,
    content_input: content,
  });

  if (error) {
    if (isMissingSkillPostEngagementRpcError(error)) {
      throw new Error(
        "Your Supabase SQL is missing the skill post engagement migration. Apply `supabase/sql/014_skill_post_engagement.sql` and try again.",
      );
    }

    throw new Error(getErrorMessage(error));
  }

  const createdComment = Array.isArray(data) ? data[0] : data;

  if (!createdComment) {
    throw new Error("No comment was returned from Supabase.");
  }

  return normalizeSkillPostComment(createdComment as SkillPostComment);
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
