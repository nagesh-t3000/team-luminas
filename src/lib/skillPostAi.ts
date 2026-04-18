import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type SkillPostAiMode = "suggest" | "enhance";

type GenerateSkillPostCopyInput = {
  skill: string;
  content?: string;
  prompt?: string;
  mode: SkillPostAiMode;
};

type GenerateSkillPostCopyResponse = {
  content: string;
};

function isGenerateSkillPostCopyResponse(value: unknown): value is GenerateSkillPostCopyResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "content" in value && typeof value.content === "string";
}

export async function generateSkillPostCopy({
  skill,
  content = "",
  prompt = "",
  mode,
}: GenerateSkillPostCopyInput) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Update the anon key in .env.");
  }

  const { data, error } = await supabase.functions.invoke("generate-skill-post-copy", {
    body: {
      content,
      mode,
      prompt,
      skill,
    },
  });

  if (error) {
    const message = error.message || "";

    if (message.includes("Failed to send a request") || message.includes("FunctionsHttpError")) {
      throw new Error(
        'The AI copy service is not reachable. Deploy the Supabase Edge Function "generate-skill-post-copy", set the "OPENAI_API_KEY" secret, and try again.',
      );
    }

    throw error;
  }

  if (!isGenerateSkillPostCopyResponse(data) || !data.content.trim()) {
    throw new Error("The AI copy service returned an invalid response.");
  }

  return data.content.trim();
}
