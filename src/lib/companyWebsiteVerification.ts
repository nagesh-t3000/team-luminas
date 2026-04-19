import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type CompanyWebsiteVerificationResult = {
  status: "approved" | "rejected" | "pending";
  reviewNotes: string;
  checkedAt: string;
  checkedUrl: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
};

type ValidateCompanyWebsiteInput = {
  websiteUrl: string;
  companyDomains: string[];
};

function isCompanyWebsiteVerificationResult(value: unknown): value is CompanyWebsiteVerificationResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CompanyWebsiteVerificationResult>;

  return (
    (candidate.status === "approved" || candidate.status === "rejected" || candidate.status === "pending") &&
    typeof candidate.reviewNotes === "string" &&
    typeof candidate.checkedAt === "string" &&
    typeof candidate.checkedUrl === "string" &&
    (candidate.confidence === "high" || candidate.confidence === "medium" || candidate.confidence === "low") &&
    Array.isArray(candidate.reasons) &&
    candidate.reasons.every((reason) => typeof reason === "string")
  );
}

export async function validateCompanyWebsite({
  websiteUrl,
  companyDomains,
}: ValidateCompanyWebsiteInput): Promise<CompanyWebsiteVerificationResult> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Update the anon key in .env.");
  }

  const { data, error } = await supabase.functions.invoke("validate-company-website", {
    body: {
      companyDomains,
      websiteUrl,
    },
  });

  if (error) {
    const message = error.message || "";

    if (message.includes("Failed to send a request") || message.includes("FunctionsHttpError")) {
      throw new Error(
        'The website verification service is not reachable. Deploy the Supabase Edge Function "validate-company-website", set the "OPENAI_API_KEY" secret, and try again.',
      );
    }

    throw error;
  }

  if (!isCompanyWebsiteVerificationResult(data)) {
    throw new Error("The website verification service returned an invalid response.");
  }

  return {
    ...data,
    checkedUrl: data.checkedUrl.trim(),
    reviewNotes: data.reviewNotes.trim(),
    reasons: data.reasons.map((reason) => reason.trim()).filter(Boolean),
  };
}
