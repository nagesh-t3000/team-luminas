import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Origin": "*",
};

const MAX_BATCH_SIZE = 25;
const MAX_HEADLINE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 1200;
const MAX_SUMMARY_LENGTH = 500;
const ALLOWED_AUDIENCES = ["founder", "investor", "job_seeker", "recruiter", "advisor"] as const;
const ALLOWED_INTENTS = ["hire", "raise", "attend", "network", "sell", "buy", "learn", "offer", "invest", "discover"] as const;

type Audience = (typeof ALLOWED_AUDIENCES)[number];
type Intent = (typeof ALLOWED_INTENTS)[number];

type FeedItemCandidate = {
  id?: string;
  item_type?: string;
  headline?: string;
  description?: string;
  location?: string;
  author_name?: string;
  company_name?: string;
  raw_payload?: Record<string, unknown>;
};

type EnrichProlinkFeedRequest = {
  items?: FeedItemCandidate[];
  candidateLimit?: number;
  persist?: boolean;
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

type EnrichedItem = {
  feed_item_id: string;
  primary_audience: Audience;
  secondary_audiences: Audience[];
  topic_tags: string[];
  skill_tags: string[];
  marketplace_tags: string[];
  intent_type: Intent;
  quality_score: number;
  ai_summary: string;
  ai_model: string;
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

function normalizeStringArray(value: unknown, maxItems: number, maxItemLength: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .map((item) => item.slice(0, maxItemLength))
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    })
    .slice(0, maxItems);
}

function isAudience(value: string): value is Audience {
  return (ALLOWED_AUDIENCES as readonly string[]).includes(value);
}

function isIntent(value: string): value is Intent {
  return (ALLOWED_INTENTS as readonly string[]).includes(value);
}

function normalizeCandidate(item: FeedItemCandidate) {
  return {
    id: normalizeText(item.id, 80),
    item_type: normalizeText(item.item_type, 40).toLowerCase(),
    headline: normalizeText(item.headline, MAX_HEADLINE_LENGTH),
    description: normalizeText(item.description, MAX_DESCRIPTION_LENGTH),
    location: normalizeText(item.location, 120),
    author_name: normalizeText(item.author_name, 120),
    company_name: normalizeText(item.company_name, 120),
    raw_payload: typeof item.raw_payload === "object" && item.raw_payload !== null ? item.raw_payload : {},
  };
}

function buildPrompt(items: ReturnType<typeof normalizeCandidate>[]) {
  return [
    "Classify each ProLink feed item for a professional marketplace discovery feed.",
    "Return valid JSON only, with this exact shape:",
    '{ "items": [ { "feed_item_id": "uuid", "primary_audience": "founder", "secondary_audiences": ["advisor"], "topic_tags": ["saas"], "skill_tags": ["hiring"], "marketplace_tags": ["seed","hybrid"], "intent_type": "hire", "quality_score": 84, "ai_summary": "short summary" } ] }',
    "Rules:",
    "- primary_audience must be one of founder, investor, job_seeker, recruiter, advisor",
    "- secondary_audiences must be zero to four unique values from the same list",
    "- intent_type must be one of hire, raise, attend, network, sell, buy, learn, offer, invest, discover",
    "- quality_score must be an integer from 0 to 100",
    "- ai_summary must be plain text under 420 characters",
    "- Use the item content only; do not invent users, metrics, speakers, or guarantees",
    "- Favor precision over optimism and keep tags short and reusable",
    "",
    JSON.stringify({
      items: items.map((item) => ({
        feed_item_id: item.id,
        item_type: item.item_type,
        headline: item.headline,
        description: item.description,
        location: item.location,
        author_name: item.author_name,
        company_name: item.company_name,
        raw_payload: item.raw_payload,
      })),
    }),
  ].join("\n");
}

function extractJson(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const startIndex = trimmed.indexOf("{");
  const endIndex = trimmed.lastIndexOf("}");

  if (startIndex >= 0 && endIndex > startIndex) {
    return trimmed.slice(startIndex, endIndex + 1);
  }

  throw new Error("OpenAI did not return valid JSON.");
}

function normalizeEnrichedItem(value: unknown, fallbackItem: ReturnType<typeof normalizeCandidate>): EnrichedItem {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const primaryAudienceValue = normalizeText(record.primary_audience, 40).toLowerCase();
  const primary_audience = isAudience(primaryAudienceValue) ? primaryAudienceValue : "founder";
  const secondary_audiences = normalizeStringArray(record.secondary_audiences, 4, 30)
    .map((item) => item.toLowerCase())
    .filter((item): item is Audience => isAudience(item) && item !== primary_audience);
  const intentValue = normalizeText(record.intent_type, 20).toLowerCase();
  const intent_type = isIntent(intentValue) ? intentValue : "discover";
  const qualityScoreValue = typeof record.quality_score === "number" ? record.quality_score : Number(record.quality_score);
  const quality_score = Number.isFinite(qualityScoreValue) ? Math.max(0, Math.min(100, Math.round(qualityScoreValue))) : 50;
  const ai_summary =
    normalizeText(record.ai_summary, MAX_SUMMARY_LENGTH) ||
    `Relevant ${fallbackItem.item_type || "feed"} item for ${primary_audience.replace("_", " ")} discovery.`;

  return {
    feed_item_id: fallbackItem.id,
    primary_audience,
    secondary_audiences,
    topic_tags: normalizeStringArray(record.topic_tags, 8, 40),
    skill_tags: normalizeStringArray(record.skill_tags, 8, 40),
    marketplace_tags: normalizeStringArray(record.marketplace_tags, 8, 40),
    intent_type,
    quality_score,
    ai_summary,
    ai_model: "gpt-4.1-mini",
  };
}

async function fetchCandidates(limit: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing "SUPABASE_URL" or "SUPABASE_SERVICE_ROLE_KEY" for ProLink enrichment.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase.rpc("list_prolink_feed_candidates_for_enrichment", {
    limit_count: limit,
  });

  if (error) {
    throw new Error(error.message || "Unable to load ProLink feed candidates.");
  }

  return Array.isArray(data) ? data.map((item) => normalizeCandidate(item as FeedItemCandidate)).filter((item) => item.id) : [];
}

async function persistEnrichedItems(items: EnrichedItem[]) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing "SUPABASE_URL" or "SUPABASE_SERVICE_ROLE_KEY" for ProLink enrichment.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  await Promise.all(
    items.map(async (item) => {
      const { error } = await supabase.rpc("upsert_prolink_feed_ai_metadata", {
        feed_item_id_input: item.feed_item_id,
        primary_audience_input: item.primary_audience,
        secondary_audiences_input: item.secondary_audiences,
        topic_tags_input: item.topic_tags,
        skill_tags_input: item.skill_tags,
        marketplace_tags_input: item.marketplace_tags,
        intent_type_input: item.intent_type,
        quality_score_input: item.quality_score,
        ai_summary_input: item.ai_summary,
        ai_model_input: item.ai_model,
      });

      if (error) {
        throw new Error(error.message || `Unable to persist metadata for item ${item.feed_item_id}.`);
      }
    }),
  );
}

async function enrichItems(items: ReturnType<typeof normalizeCandidate>[]) {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();

  if (!openAiApiKey) {
    throw new Error('Missing "OPENAI_API_KEY" secret for the ProLink enrichment service.');
  }

  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You classify marketplace feed items for relevance. Return strict JSON only, with no markdown and no prose outside the JSON object.",
        },
        {
          role: "user",
          content: buildPrompt(items),
        },
      ],
    }),
  });

  const payload = (await openAiResponse.json()) as OpenAiChatCompletionResponse;

  if (!openAiResponse.ok) {
    throw new Error(payload.error?.message || "OpenAI returned an unexpected error.");
  }

  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenAI did not return any enrichment data.");
  }

  const parsed = JSON.parse(extractJson(content)) as { items?: unknown[] };
  const itemsById = new Map(items.map((item) => [item.id, item] as const));

  return (Array.isArray(parsed.items) ? parsed.items : [])
    .map((item) => {
      const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      const feedItemId = normalizeText(record.feed_item_id, 80);
      const fallbackItem = itemsById.get(feedItemId);

      if (!fallbackItem) {
        return null;
      }

      return normalizeEnrichedItem(record, fallbackItem);
    })
    .filter((item): item is EnrichedItem => Boolean(item));
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = (await request.json()) as EnrichProlinkFeedRequest;
    const persist = Boolean(body.persist);
    const requestedLimit = Math.max(1, Math.min(MAX_BATCH_SIZE, Math.round(Number(body.candidateLimit) || 0)));
    const providedItems = Array.isArray(body.items)
      ? body.items.map(normalizeCandidate).filter((item) => item.id && item.headline && item.description)
      : [];
    const items = providedItems.length > 0 ? providedItems.slice(0, MAX_BATCH_SIZE) : await fetchCandidates(requestedLimit || 10);

    if (items.length === 0) {
      return json({ items: [], persisted: false, persisted_count: 0 });
    }

    const enrichedItems = await enrichItems(items);

    if (persist && enrichedItems.length > 0) {
      await persistEnrichedItems(enrichedItems);
    }

    return json({
      items: enrichedItems,
      persisted: persist,
      persisted_count: persist ? enrichedItems.length : 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to enrich ProLink feed items right now.";
    return json({ error: message }, 400);
  }
});
