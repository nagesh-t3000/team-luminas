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
  is_professional_account?: boolean | null;
  company_domains?: string[] | null;
  preferred_suggestions?: string[] | null;
  human_verification_status?: "required" | "pending" | "verified" | "failed" | null;
  human_verification_provider?: string | null;
  human_verified_at?: string | null;
  human_verification_failure_reason?: string | null;
  company_verification_status?: "required" | "pending" | "approved" | "rejected" | null;
  company_verification_website_url?: string | null;
  company_verification_review_notes?: string | null;
  company_verified_at?: string | null;
  created_at: string;
  was_created?: boolean;
};

const STORAGE_KEY = "luminas-auth-user";

type UserSettingsRecord = {
  user_id: string;
  profile_photo_url: string | null;
  skilled_domains: string[] | null;
  is_professional_account: boolean | null;
  company_domains: string[] | null;
  preferred_suggestions: string[] | null;
  company_verification_status: "required" | "pending" | "approved" | "rejected" | null;
  company_verification_website_url: string | null;
  company_verification_review_notes: string | null;
  company_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeDomainList(domains: string[] | null | undefined, maxItems: number) {
  return Array.isArray(domains)
    ? domains
        .map((domain) => (typeof domain === "string" ? domain.trim() : ""))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
}

function normalizeCompanyVerificationStatus(
  status: AuthUser["company_verification_status"],
): NonNullable<AuthUser["company_verification_status"]> {
  return status === "pending" || status === "approved" || status === "rejected" ? status : "required";
}

function normalizeAuthUser(user: AuthUser) {
  return {
    ...user,
    profile_photo_url: typeof user.profile_photo_url === "string" ? user.profile_photo_url : null,
    skilled_domains: normalizeDomainList(user.skilled_domains, 8),
    is_professional_account: Boolean(user.is_professional_account),
    company_domains: normalizeDomainList(user.company_domains, 1),
    company_verification_status: normalizeCompanyVerificationStatus(user.company_verification_status),
    company_verification_website_url:
      typeof user.company_verification_website_url === "string" ? user.company_verification_website_url.trim() || null : null,
    company_verification_review_notes:
      typeof user.company_verification_review_notes === "string" ? user.company_verification_review_notes.trim() || null : null,
    company_verified_at: typeof user.company_verified_at === "string" ? user.company_verified_at : null,
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
    is_professional_account: settings.is_professional_account,
    company_domains: settings.company_domains,
    preferred_suggestions: settings.preferred_suggestions,
    company_verification_status: settings.company_verification_status,
    company_verification_website_url: settings.company_verification_website_url,
    company_verification_review_notes: settings.company_verification_review_notes,
    company_verified_at: settings.company_verified_at,
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

export function isVerifiedProfile(
  user:
    | Pick<AuthUser, "is_professional_account" | "human_verification_status">
    | null
    | undefined,
) {
  return Boolean(user?.is_professional_account && user.human_verification_status === "verified");
}

export function isProfessionalAccount(user: Pick<AuthUser, "is_professional_account"> | null | undefined) {
  return Boolean(user?.is_professional_account);
}

export function canCreateAds(
  user:
    | Pick<
        AuthUser,
        "is_professional_account" | "company_domains" | "human_verification_status" | "company_verification_status"
      >
    | null
    | undefined,
) {
  return Boolean(
    user?.is_professional_account &&
      normalizeDomainList(user.company_domains, 1).length > 0 &&
      user.human_verification_status === "verified" &&
      user.company_verification_status === "approved",
  );
}

export function hasCompleteProfileBasics(
  user:
    | Pick<AuthUser, "full_name" | "bio" | "skilled_domains">
    | null
    | undefined,
) {
  const fullName = user?.full_name?.trim();
  const bio = user?.bio?.trim();
  const skilledDomains = normalizeDomainList(user?.skilled_domains, 8);

  return Boolean(fullName && bio && skilledDomains.length > 0);
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
