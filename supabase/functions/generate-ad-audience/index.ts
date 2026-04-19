import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Origin": "*",
};

const MAX_TITLE_LENGTH = 120;
const MAX_SUBTITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 600;
const MAX_OBJECTIVE_LENGTH = 120;
const MAX_SUMMARY_LENGTH = 500;
const MAX_LABELS = 8;

type GenerateAdAudienceRequest = {
  description?: string;
  objective?: string;
  subtitle?: string;
  targetType?: "event" | "skill_post";
  title?: string;
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

type GeneratedAudiencePayload = {
  audienceSummary?: unknown;
  audienceLabels?: unknown;
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

function normalizeLabels(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const seen = new Set<string>();

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const normalizedItem = item.toLowerCase();

      if (seen.has(normalizedItem)) {
        return false;
      }

      seen.add(normalizedItem);
      return true;
    })
    .slice(0, MAX_LABELS);
}

function extractJsonObject(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("{") && trimmedValue.endsWith("}")) {
    return trimmedValue;
  }

  const fencedMatch = trimmedValue.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmedValue.indexOf("{");
  const lastBrace = trimmedValue.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmedValue.slice(firstBrace, lastBrace + 1);
  }

  return trimmedValue;
}

async function generateAudience({
  description,
  objective,
  subtitle,
  targetType,
  title,
}: {
  description: string;
  objective: string;
  subtitle: string;
  targetType: "event" | "skill_post";
  title: string;
}) {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();

  if (!openAiApiKey) {
    throw new Error('Missing "OPENAI_API_KEY" secret for the AI audience service.');
  }

  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: [
            "You write concise audience targeting suggestions for ad campaigns in a professional networking app.",
            'Return JSON only with this shape: {"audienceSummary":"...","audienceLabels":["..."]}.',
            "The audienceSummary must be plain text under 420 characters.",
            "The audienceLabels must be short, relevant audience descriptors with no hashtags.",
            "Do not invent unsupported claims, outcomes, or demographics that are not reasonably implied by the content.",
            "Prefer practical targeting descriptors such as role, company stage, skill area, city, industry, or intent.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Content type: ${targetType === "event" ? "event" : "skill post"}`,
            `Campaign objective: ${objective}`,
            `Title: ${title}`,
            subtitle ? `Subtitle/context: ${subtitle}` : "",
            description ? `Description: ${description}` : "",
            "",
            "Draft one audienceSummary and 4-8 audienceLabels for this campaign.",
            "Make the targeting specific enough to be useful, but not so narrow that it excludes likely interested professionals.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    }),
  });

  const payload = (await openAiResponse.json()) as OpenAiChatCompletionResponse;

  if (!openAiResponse.ok) {
    throw new Error(payload.error?.message || "OpenAI returned an unexpected error.");
  }

  const rawContent = payload.choices?.[0]?.message?.content?.trim();

  if (!rawContent) {
    throw new Error("OpenAI did not return any audience guidance.");
  }

  let parsedContent: GeneratedAudiencePayload;

  try {
    parsedContent = JSON.parse(extractJsonObject(rawContent)) as GeneratedAudiencePayload;
  } catch {
    throw new Error("OpenAI returned audience guidance in an invalid format.");
  }

  const audienceSummary = normalizeText(parsedContent.audienceSummary, MAX_SUMMARY_LENGTH);
  const audienceLabels = normalizeLabels(parsedContent.audienceLabels);

  if (!audienceSummary) {
    throw new Error("OpenAI did not return an audience summary.");
  }

  if (audienceLabels.length === 0) {
    throw new Error("OpenAI did not return any audience labels.");
  }

  return {
    audienceSummary,
    audienceLabels,
  };
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = (await request.json()) as GenerateAdAudienceRequest;
    const title = normalizeText(body.title, MAX_TITLE_LENGTH);
    const subtitle = normalizeText(body.subtitle, MAX_SUBTITLE_LENGTH);
    const description = normalizeText(body.description, MAX_DESCRIPTION_LENGTH);
    const objective = normalizeText(body.objective, MAX_OBJECTIVE_LENGTH);
    const targetType = body.targetType === "skill_post" ? "skill_post" : "event";

    if (!title) {
      return json({ error: "A target title is required." }, 400);
    }

    if (!objective) {
      return json({ error: "A campaign objective is required." }, 400);
    }

    const generatedAudience = await generateAudience({
      description,
      objective,
      subtitle,
      targetType,
      title,
    });

    return json(generatedAudience);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate audience notes right now.";
    return json({ error: message }, 400);
  }
});
