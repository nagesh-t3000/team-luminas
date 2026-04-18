import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type GenerateEventSummaryInput = {
  title: string;
};

type GenerateEventSummaryResponse = {
  summary: string;
};

function isGenerateEventSummaryResponse(value: unknown): value is GenerateEventSummaryResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "summary" in value && typeof value.summary === "string";
}

export async function generateEventSummary({ title }: GenerateEventSummaryInput) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Update the anon key in .env.");
  }

  const { data, error } = await supabase.functions.invoke("generate-event-summary", {
    body: {
      title,
    },
  });

  if (error) {
    const message = error.message || "";

    if (message.includes("Failed to send a request") || message.includes("FunctionsHttpError")) {
      throw new Error(
        'The AI event summary service is not reachable. Deploy the Supabase Edge Function "generate-event-summary", set the "OPENAI_API_KEY" secret, and try again.',
      );
    }

    throw error;
  }

  if (!isGenerateEventSummaryResponse(data) || !data.summary.trim()) {
    throw new Error("The AI event summary service returned an invalid response.");
  }

  return data.summary.trim();
}
