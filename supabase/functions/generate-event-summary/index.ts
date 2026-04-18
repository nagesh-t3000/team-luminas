import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Origin": "*",
};

const MAX_TITLE_LENGTH = 100;
const MAX_SUMMARY_LENGTH = 500;

type GenerateEventSummaryRequest = {
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

async function generateSummary(title: string) {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();

  if (!openAiApiKey) {
    throw new Error('Missing "OPENAI_API_KEY" secret for the AI event summary service.');
  }

  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You write concise professional event summaries for a networking app. Return only a short plain-text summary, with no markdown, no bullet list, no surrounding quotes, and no hashtags. Keep the response under 420 characters.",
        },
        {
          role: "user",
          content: [
            "Write a compelling event summary based only on this title.",
            "Infer a likely audience and value proposition, but do not invent specific speakers, sponsors, venues, or guarantees.",
            "The summary should help someone quickly understand what the event is about and why they might attend.",
            "",
            `Event title: ${title}`,
          ].join("\n"),
        },
      ],
    }),
  });

  const payload = (await openAiResponse.json()) as OpenAiChatCompletionResponse;

  if (!openAiResponse.ok) {
    throw new Error(payload.error?.message || "OpenAI returned an unexpected error.");
  }

  const summary = payload.choices?.[0]?.message?.content?.trim();

  if (!summary) {
    throw new Error("OpenAI did not return any summary.");
  }

  return summary.slice(0, MAX_SUMMARY_LENGTH);
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = (await request.json()) as GenerateEventSummaryRequest;
    const title = normalizeText(body.title, MAX_TITLE_LENGTH);

    if (!title) {
      return json({ error: "An event title is required." }, 400);
    }

    const summary = await generateSummary(title);
    return json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate an event summary right now.";
    return json({ error: message }, 400);
  }
});
