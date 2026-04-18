import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type PublicUserRecord = {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  bio: string | null;
  professional_role: string | null;
  created_at: string;
};

export type PublicUser = PublicUserRecord & {
  avatar_url: string;
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

  return "Unable to load users right now.";
}

function isMissingPublicUsersRpcError(error: unknown) {
  const message = getErrorMessage(error);
  return (
    message.includes("Could not find the function public.list_public_users") ||
    message.includes("Could not find the function public.get_public_user_by_username") ||
    message.includes("schema cache")
  );
}

function getAvatarInitials(label: string) {
  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "LU";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "LU";
}

export function buildFallbackAvatar(label: string) {
  const safeLabel = label.trim() || "Luminas User";
  const initials = getAvatarInitials(safeLabel);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="${safeLabel}">
      <rect width="96" height="96" rx="48" fill="#EEF2FF" />
      <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#2563EB">
        ${initials}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizePublicUser(user: PublicUserRecord): PublicUser {
  const fullName = user.full_name?.trim() || null;
  const username = user.username?.trim() || "";

  return {
    ...user,
    username,
    full_name: fullName,
    bio: user.bio?.trim() || null,
    professional_role: user.professional_role?.trim() || null,
    avatar_url: buildFallbackAvatar(fullName || username || user.email),
  };
}

export async function listPublicUsers(limit = 12) {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_public_users", {
    limit_count: limit,
  });

  if (error) {
    if (isMissingPublicUsersRpcError(error)) {
      return [];
    }

    throw error;
  }

  return Array.isArray(data) ? data.map((user) => normalizePublicUser(user as PublicUserRecord)) : [];
}

export async function getPublicUserByUsername(username: string) {
  if (!supabase || !isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase.rpc("get_public_user_by_username", {
    username_input: username,
  });

  if (error) {
    if (isMissingPublicUsersRpcError(error)) {
      return null;
    }

    throw error;
  }

  const user = Array.isArray(data) ? data[0] : data;
  return user ? normalizePublicUser(user as PublicUserRecord) : null;
}
