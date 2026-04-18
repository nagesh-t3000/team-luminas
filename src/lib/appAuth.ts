export type AuthUser = {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  bio?: string | null;
  professional_role?: string | null;
  human_verification_status?: "required" | "pending" | "verified" | "failed" | null;
  human_verification_provider?: string | null;
  human_verified_at?: string | null;
  human_verification_failure_reason?: string | null;
  created_at: string;
  was_created?: boolean;
};

const STORAGE_KEY = "luminas-auth-user";

function hydrateAuthUserForNewSession(user: AuthUser) {
  return user;
}

export function getStoredAuthUser() {
  const rawValue = localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return hydrateAuthUserForNewSession(JSON.parse(rawValue) as AuthUser);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setStoredAuthUser(user: AuthUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredAuthUser() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isProfileSetupRequired(user: AuthUser) {
  return !user.full_name?.trim();
}

export function isHumanVerificationRequired(user: AuthUser) {
  return user.human_verification_status !== "verified";
}
