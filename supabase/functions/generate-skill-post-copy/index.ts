import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Origin": "*",
};

const MAX_CONTENT_LENGTH = 1000;
const MAX_PROMPT_LENGTH = 240;

type GenerateSkillPostCopyRequest = {
  content?: string;
  mode?: "suggest" | "enhance";
  prompt?: string;
  skill?: string;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function buildUserPrompt({
  skill,
  content,
  prompt,
  mode,
}: {
  skill: string;
  content: string;
  prompt: string;
  mode: "suggest" | "enhance";
}) {
  const direction = prompt ? `Additional direction: ${prompt}` : "Additional direction: none.";

  if (mode === "suggest") {
    return [
      `Write a first-person professional social post for a user sharing a skill on Luminas.`,
      `Selected skill: ${skill}`,
      direction,
      "Goal: explain what the user helps with, what value they create, and invite relevant conversations or opportunities.",
      "Keep it concise, polished, and authentic. Return plain text only.",
    ].join("\n");
  }

  return [
    `Improve the following first-person professional social post for Luminas.`,
    `Selected skill: ${skill}`,
    direction,
    "Preserve the user's core meaning and first-person voice. Make it clearer, more engaging, and more polished.",
    "Do not invent achievements, clients, or outcomes that are not already implied.",
    "Return plain text only.",
    "",
    "Draft:",
    content,
  ].join("\n");
}

async function generateCopy({
  skill,
  content,
  prompt,
  mode,
}: {
  skill: string;
  content: string;
  prompt: string;
  mode: "suggest" | "enhance";
}) {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();

  if (!openAiApiKey) {
    throw new Error('Missing "OPENAI_API_KEY" secret for the AI copy service.');
  }

  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: mode === "suggest" ? 0.8 : 0.5,
      messages: [
        {
          role: "system",
          content:
            "You write polished professional social copy for a networking app. Return only the final post as plain text, with no markdown, no bullet list, no surrounding quotes, and no hashtags unless explicitly requested. Keep the response under 900 characters.",
        },
        {
          role: "user",
          content: buildUserPrompt({
            skill,
            content,
            prompt,
            mode,
          }),
        },
      ],
    }),
  });

  const payload = (await openAiResponse.json()) as OpenAiChatCompletionResponse;

  if (!openAiResponse.ok) {
    throw new Error(payload.error?.message || "OpenAI returned an unexpected error.");
  }

  const generatedContent = payload.choices?.[0]?.message?.content?.trim();

  if (!generatedContent) {
    throw new Error("OpenAI did not return any content.");
  }

  return generatedContent.slice(0, MAX_CONTENT_LENGTH);
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = (await request.json()) as GenerateSkillPostCopyRequest;
    const skill = normalizeText(body.skill, 120);
    const content = normalizeText(body.content, MAX_CONTENT_LENGTH);
    const prompt = normalizeText(body.prompt, MAX_PROMPT_LENGTH);
    const mode = body.mode === "enhance" ? "enhance" : "suggest";

    if (!skill) {
      return json({ error: "A selected skill is required." }, 400);
    }

    if (mode === "enhance" && !content) {
      return json({ error: "Draft content is required to enhance a post." }, 400);
    }

    const generatedContent = await generateCopy({
      skill,
      content,
      prompt,
      mode,
    });

    return json({ content: generatedContent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate AI copy right now.";
    return json({ error: message }, 400);
  }
});
