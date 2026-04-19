import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type GenerateAdAudienceInput = {
  targetType: "event" | "skill_post";
  title: string;
  subtitle?: string;
  description?: string;
  objective: string;
};

type GenerateAdAudienceResponse = {
  audienceSummary: string;
  audienceLabels: string[];
};

function isGenerateAdAudienceResponse(value: unknown): value is GenerateAdAudienceResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Partial<GenerateAdAudienceResponse>;

  return (
    typeof response.audienceSummary === "string" &&
    Array.isArray(response.audienceLabels) &&
    response.audienceLabels.every((label) => typeof label === "string")
  );
}

export async function generateAdAudience({
  targetType,
  title,
  subtitle = "",
  description = "",
  objective,
}: GenerateAdAudienceInput) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Update the anon key in .env.");
  }

  const { data, error } = await supabase.functions.invoke("generate-ad-audience", {
    body: {
      description,
      objective,
      subtitle,
      targetType,
      title,
    },
  });

  if (error) {
    const message = error.message || "";

    if (message.includes("Failed to send a request") || message.includes("FunctionsHttpError")) {
      throw new Error(
        'The AI audience service is not reachable. Deploy the Supabase Edge Function "generate-ad-audience", set the "OPENAI_API_KEY" secret, and try again.',
      );
    }

    throw error;
  }

  if (!isGenerateAdAudienceResponse(data) || !data.audienceSummary.trim()) {
    throw new Error("The AI audience service returned an invalid response.");
  }

  return {
    audienceSummary: data.audienceSummary.trim(),
    audienceLabels: data.audienceLabels.map((label) => label.trim()).filter(Boolean).slice(0, 8),
  };
}
