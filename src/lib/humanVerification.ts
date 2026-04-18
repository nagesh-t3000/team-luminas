export type HumanVerificationMode = "backend" | "provider";

const configuredMode = import.meta.env.VITE_HUMAN_VERIFICATION_MODE?.trim().toLowerCase();

export const humanVerificationMode: HumanVerificationMode =
  configuredMode === "provider" ? "provider" : "backend";

export const humanVerificationProvider =
  import.meta.env.VITE_HUMAN_VERIFICATION_PROVIDER?.trim() ||
  (humanVerificationMode === "provider"
    ? "passive-liveness-provider"
    : "supabase-edge-face-id");
