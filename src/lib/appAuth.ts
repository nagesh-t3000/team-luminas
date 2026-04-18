import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  bio?: string | null;
  professional_role?: string | null;
  profile_photo_url?: string | null;
  skilled_domains?: string[] | null;
  preferred_suggestions?: string[] | null;
  human_verification_status?: "required" | "pending" | "verified" | "failed" | null;
  human_verification_provider?: string | null;
  human_verified_at?: string | null;
  human_verification_failure_reason?: string | null;
  created_at: string;
  was_created?: boolean;
};

const STORAGE_KEY = "luminas-auth-user";

type UserSettingsRecord = {
  user_id: string;
  profile_photo_url: string | null;
  skilled_domains: string[] | null;
  preferred_suggestions: string[] | null;
  created_at: string;
  updated_at: string;
};

function normalizeAuthUser(user: AuthUser) {
  return {
    ...user,
    profile_photo_url: typeof user.profile_photo_url === "string" ? user.profile_photo_url : null,
    skilled_domains: Array.isArray(user.skilled_domains)
      ? user.skilled_domains
          .map((domain) => (typeof domain === "string" ? domain.trim() : ""))
          .filter(Boolean)
          .slice(0, 8)
      : [],
    preferred_suggestions: Array.isArray(user.preferred_suggestions)
      ? user.preferred_suggestions
          .map((role) => (typeof role === "string" ? role.trim() : ""))
          .filter((role): role is string => role.length > 0)
      : [],
  };
}

function mergeAuthUserWithSettings(user: AuthUser, settings?: UserSettingsRecord | null) {
  if (!settings) {
    return normalizeAuthUser(user);
  }

  return normalizeAuthUser({
    ...user,
    profile_photo_url: settings.profile_photo_url,
    skilled_domains: settings.skilled_domains,
    preferred_suggestions: settings.preferred_suggestions,
  });
}

function isMissingUserSettingsRpcError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";

  return (
    message.includes("Could not find the function public.get_user_settings") ||
    message.includes("Could not find the function public.upsert_user_settings") ||
    message.includes("schema cache")
  );
}

export function getStoredAuthUser() {
  const rawValue = localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return normalizeAuthUser(JSON.parse(rawValue) as AuthUser);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setStoredAuthUser(user: AuthUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAuthUser(user)));
}

export function clearStoredAuthUser() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAuthUserAvatarUrl(user: Pick<AuthUser, "profile_photo_url"> | null | undefined) {
  return user?.profile_photo_url?.trim() || null;
}

export async function getUserSettings(userId: string) {
  if (!supabase || !isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase.rpc("get_user_settings", {
    user_id_input: userId,
  });

  if (error) {
    if (isMissingUserSettingsRpcError(error)) {
      return null;
    }

    throw error;
  }

  const settings = Array.isArray(data) ? data[0] : data;
  return (settings as UserSettingsRecord | null | undefined) ?? null;
}

export async function syncAuthUserSettings(user: AuthUser) {
  const normalizedUser = normalizeAuthUser(user);

  if (!normalizedUser.id || !supabase || !isSupabaseConfigured) {
    return normalizedUser;
  }

  try {
    const settings = await getUserSettings(normalizedUser.id);
    return mergeAuthUserWithSettings(normalizedUser, settings);
  } catch (error) {
    console.error("Failed to load user settings", error);
    return normalizedUser;
  }
}

export async function persistAuthUserWithSettings(user: AuthUser) {
  const mergedUser = await syncAuthUserSettings(user);
  setStoredAuthUser(mergedUser);
  return mergedUser;
}

export function isProfileSetupRequired(user: AuthUser) {
  return !user.full_name?.trim();
}

export function isHumanVerificationRequired(user: AuthUser) {
  return user.human_verification_status !== "verified";
}
