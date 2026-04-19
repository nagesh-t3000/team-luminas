import type { AuthUser } from "@/lib/appAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type ProlinkAudience = "founder" | "investor" | "job_seeker" | "recruiter" | "advisor";

export type ProlinkFeedItem = {
  id: string;
  item_type: "person" | "event" | "job" | "service" | "marketplace" | "post" | "investment" | "founder_ask";
  headline: string;
  description: string;
  media_kind: "image" | "video" | "none";
  media_url: string | null;
  cta_label: string;
  cta_url: string;
  location: string;
  author_name: string;
  company_name: string;
  published_at: string;
  raw_payload: Record<string, unknown>;
  primary_audience: ProlinkAudience;
  secondary_audiences: ProlinkAudience[];
  topic_tags: string[];
  skill_tags: string[];
  marketplace_tags: string[];
  intent_type: "hire" | "raise" | "attend" | "network" | "sell" | "buy" | "learn" | "offer" | "invest" | "discover";
  quality_score: number;
  ai_summary: string;
  ai_model: string;
  ai_enriched_at: string;
  is_sponsored: boolean;
  sponsorship_label: string | null;
  sponsor_name: string | null;
  campaign_goal: string | null;
  target_domains: string[];
  target_locations: string[];
  campaign_priority: number;
};

export type RankedProlinkFeedItem = ProlinkFeedItem & {
  relevance_score: number;
};

const PROLINK_AUDIENCES: ProlinkAudience[] = ["founder", "investor", "job_seeker", "recruiter", "advisor"];

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Unable to load the ProLink feed right now.";
}

function isMissingProlinkFeedRpcError(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("Could not find the function public.list_prolink_feed_items") ||
    message.includes("Could not find the function public.list_prolink_feed_candidates_for_enrichment") ||
    message.includes("schema cache")
  );
}

function isAudience(value: string): value is ProlinkAudience {
  return PROLINK_AUDIENCES.includes(value as ProlinkAudience);
}

function isMediaKind(value: string): value is ProlinkFeedItem["media_kind"] {
  return value === "image" || value === "video" || value === "none";
}

function isItemType(value: string): value is ProlinkFeedItem["item_type"] {
  return ["person", "event", "job", "service", "marketplace", "post", "investment", "founder_ask"].includes(value);
}

function isIntentType(value: string): value is ProlinkFeedItem["intent_type"] {
  return ["hire", "raise", "attend", "network", "sell", "buy", "learn", "offer", "invest", "discover"].includes(value);
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function normalizeStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .filter((item) => {
      const normalizedValue = item.toLowerCase();

      if (seen.has(normalizedValue)) {
        return false;
      }

      seen.add(normalizedValue);
      return true;
    })
    .slice(0, maxItems);
}

function normalizeAudienceArray(value: unknown) {
  return normalizeStringArray(value, 4)
    .map((item) => item.toLowerCase())
    .filter((item): item is ProlinkAudience => isAudience(item));
}

function normalizeCount(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function normalizeBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeRawPayload(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function normalizeProlinkFeedItem(item: Partial<ProlinkFeedItem>): ProlinkFeedItem {
  const raw_payload = normalizeRawPayload(item.raw_payload);
  const primaryAudienceValue = normalizeString(item.primary_audience, "founder").toLowerCase();
  const primary_audience = isAudience(primaryAudienceValue) ? primaryAudienceValue : "founder";
  const mediaKindValue = normalizeString(item.media_kind, "none").toLowerCase();
  const normalizedItemTypeValue = normalizeString(item.item_type, "post").toLowerCase();
  const normalizedIntentTypeValue = normalizeString(item.intent_type, "discover").toLowerCase();
  const item_type = isItemType(normalizedItemTypeValue) ? normalizedItemTypeValue : "post";
  const media_kind = isMediaKind(mediaKindValue) ? mediaKindValue : "none";
  const intent_type = isIntentType(normalizedIntentTypeValue) ? normalizedIntentTypeValue : "discover";

  return {
    id: normalizeString(item.id),
    item_type,
    headline: normalizeString(item.headline),
    description: normalizeString(item.description),
    media_kind,
    media_url: normalizeString(item.media_url, "") || null,
    cta_label: normalizeString(item.cta_label, "Explore"),
    cta_url: normalizeString(item.cta_url, "/explore"),
    location: normalizeString(item.location, "Remote"),
    author_name: normalizeString(item.author_name),
    company_name: normalizeString(item.company_name),
    published_at: normalizeString(item.published_at, new Date().toISOString()),
    raw_payload,
    primary_audience,
    secondary_audiences: normalizeAudienceArray(item.secondary_audiences),
    topic_tags: normalizeStringArray(item.topic_tags, 8),
    skill_tags: normalizeStringArray(item.skill_tags, 8),
    marketplace_tags: normalizeStringArray(item.marketplace_tags, 8),
    intent_type,
    quality_score: normalizeCount(item.quality_score),
    ai_summary: normalizeString(item.ai_summary),
    ai_model: normalizeString(item.ai_model, "unknown"),
    ai_enriched_at: normalizeString(item.ai_enriched_at, new Date().toISOString()),
    is_sponsored: normalizeBoolean(raw_payload.is_sponsored),
    sponsorship_label: normalizeString(raw_payload.sponsorship_label) || null,
    sponsor_name: normalizeString(raw_payload.sponsor_name) || null,
    campaign_goal: normalizeString(raw_payload.campaign_goal) || null,
    target_domains: normalizeStringArray(raw_payload.target_domains, 8),
    target_locations: normalizeStringArray(raw_payload.target_locations, 4),
    campaign_priority: normalizeCount(raw_payload.campaign_priority),
  };
}

function tokenizeText(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValues(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap((item) => collectStringValues(item));
  }

  return [];
}

function getProfileSignalTokens(
  authUser: Pick<AuthUser, "professional_role" | "skilled_domains" | "company_domains" | "preferred_suggestions">,
) {
  const tokens = new Set<string>();

  tokenizeText(authUser.professional_role?.trim() || "").forEach((token) => tokens.add(token));
  (authUser.skilled_domains ?? []).forEach((domain) => tokenizeText(domain).forEach((token) => tokens.add(token)));
  (authUser.company_domains ?? []).forEach((domain) => tokenizeText(domain).forEach((token) => tokens.add(token)));
  (authUser.preferred_suggestions ?? []).forEach((audience) =>
    tokenizeText(audience.replace(/_/g, " ")).forEach((token) => tokens.add(token)),
  );

  return tokens;
}

function getItemSignalTokens(item: ProlinkFeedItem) {
  const tokens = new Set<string>();

  [item.headline, item.description, item.ai_summary, item.author_name, item.company_name]
    .flatMap((value) => tokenizeText(value))
    .forEach((token) => tokens.add(token));

  [...item.topic_tags, ...item.skill_tags, ...item.marketplace_tags]
    .flatMap((value) => tokenizeText(value))
    .forEach((token) => tokens.add(token));

  collectStringValues(item.raw_payload)
    .flatMap((value) => tokenizeText(value))
    .forEach((token) => tokens.add(token));

  return tokens;
}

function getArrayOverlapScore(left: Iterable<string>, right: Set<string>, pointsPerMatch: number, maxScore: number) {
  let score = 0;

  for (const value of left) {
    if (right.has(value)) {
      score += pointsPerMatch;
    }

    if (score >= maxScore) {
      return maxScore;
    }
  }

  return score;
}

function getFreshnessScore(publishedAt: string) {
  const publishedTime = new Date(publishedAt).getTime();

  if (!Number.isFinite(publishedTime)) {
    return 0;
  }

  const ageInDays = Math.max(0, (Date.now() - publishedTime) / (1000 * 60 * 60 * 24));

  if (ageInDays <= 2) {
    return 12;
  }

  if (ageInDays <= 7) {
    return 8;
  }

  if (ageInDays <= 14) {
    return 5;
  }

  if (ageInDays <= 30) {
    return 3;
  }

  return 1;
}

function hasStrongProfileSignals(authUser: Pick<AuthUser, "professional_role" | "skilled_domains" | "company_domains" | "preferred_suggestions">) {
  return Boolean(
    authUser.professional_role?.trim() ||
      (authUser.skilled_domains ?? []).length > 0 ||
      (authUser.company_domains ?? []).length > 0 ||
      (authUser.preferred_suggestions ?? []).length > 0,
  );
}

function buildSelectedAudienceSet(selectedAudiences: ProlinkAudience[]) {
  return new Set(
    selectedAudiences.length === 0 || selectedAudiences.length === PROLINK_AUDIENCES.length
      ? PROLINK_AUDIENCES
      : selectedAudiences,
  );
}

function getBaseRelevanceScore(
  item: ProlinkFeedItem,
  itemTokens: Set<string>,
  profileTokens: Set<string>,
  selectedAudienceSet: Set<ProlinkAudience>,
  strongSignals: boolean,
  index: number,
) {
  let score = 0;

  if (selectedAudienceSet.has(item.primary_audience)) {
    score += 38;
  } else {
    score -= 12;
  }

  score += item.secondary_audiences.some((audience) => selectedAudienceSet.has(audience)) ? 16 : 0;
  score += getArrayOverlapScore(profileTokens, itemTokens, 4, 24);
  score += Math.round(item.quality_score / 7);
  score += getFreshnessScore(item.published_at);

  if (!strongSignals) {
    score += 10;
    score += (index % 5) * 0.25;
  }

  return score;
}

function getSponsoredRelevanceScore(
  item: ProlinkFeedItem,
  profileTokens: Set<string>,
  selectedAudienceSet: Set<ProlinkAudience>,
) {
  let score = 0;

  if (!item.is_sponsored) {
    return score;
  }

  score += selectedAudienceSet.has(item.primary_audience) ? 10 : -6;
  score += getArrayOverlapScore(item.target_domains, profileTokens, 5, 20);
  score += getArrayOverlapScore(item.target_locations, profileTokens, 3, 6);
  score += getArrayOverlapScore(tokenizeText(item.campaign_goal ?? ""), profileTokens, 3, 9);
  score += Math.round(item.campaign_priority / 10);

  return score - 10;
}

function interleaveSponsoredFeedItems(
  organicItems: RankedProlinkFeedItem[],
  sponsoredItems: RankedProlinkFeedItem[],
  maxItems: number,
) {
  if (maxItems <= 0) {
    return [];
  }

  if (organicItems.length === 0) {
    return sponsoredItems.slice(0, Math.min(3, maxItems));
  }

  const result: RankedProlinkFeedItem[] = [];
  const maxSponsoredItems = Math.min(sponsoredItems.length, Math.min(4, Math.floor(maxItems / 6)));
  let organicIndex = 0;
  let sponsoredIndex = 0;
  let organicSinceLastSponsored = 0;

  while (result.length < maxItems && (organicIndex < organicItems.length || sponsoredIndex < maxSponsoredItems)) {
    const shouldInsertSponsored =
      sponsoredIndex < maxSponsoredItems &&
      organicSinceLastSponsored >= 5 &&
      result.length >= 4 &&
      organicIndex < organicItems.length;

    if (shouldInsertSponsored) {
      result.push(sponsoredItems[sponsoredIndex]);
      sponsoredIndex += 1;
      organicSinceLastSponsored = 0;
      continue;
    }

    if (organicIndex < organicItems.length) {
      result.push(organicItems[organicIndex]);
      organicIndex += 1;
      organicSinceLastSponsored += 1;
      continue;
    }

    if (sponsoredIndex < maxSponsoredItems && result.length >= 4) {
      result.push(sponsoredItems[sponsoredIndex]);
      sponsoredIndex += 1;
      organicSinceLastSponsored = 0;
      continue;
    }

    break;
  }

  return result;
}

export function normalizeRoleToProlinkAudience(role: string | null | undefined): ProlinkAudience | null {
  const normalizedRole = role?.trim().toLowerCase() ?? "";

  if (!normalizedRole) {
    return null;
  }

  if (normalizedRole.includes("founder")) {
    return "founder";
  }

  if (normalizedRole.includes("investor")) {
    return "investor";
  }

  if (normalizedRole.includes("job seeker") || normalizedRole.includes("student")) {
    return "job_seeker";
  }

  if (normalizedRole.includes("recruit") || normalizedRole.includes("talent") || normalizedRole.includes("hr")) {
    return "recruiter";
  }

  if (normalizedRole.includes("advisor") || normalizedRole.includes("mentor")) {
    return "advisor";
  }

  return null;
}

export function deriveInitialProlinkAudienceSelection(
  authUser: Pick<AuthUser, "preferred_suggestions" | "professional_role">,
) {
  const preferredSuggestions = (authUser.preferred_suggestions ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is ProlinkAudience => isAudience(value));

  if (preferredSuggestions.length > 0) {
    return preferredSuggestions;
  }

  const roleAudience = normalizeRoleToProlinkAudience(authUser.professional_role);

  if (roleAudience) {
    return [roleAudience];
  }

  return [...PROLINK_AUDIENCES];
}

export async function listProlinkFeedItems(limit = 60, cursor?: string | null): Promise<ProlinkFeedItem[]> {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_prolink_feed_items", {
    limit_count: limit,
    cursor_input: cursor?.trim() || null,
  });

  if (error) {
    if (isMissingProlinkFeedRpcError(error)) {
      return [];
    }

    throw new Error(getErrorMessage(error));
  }

  return Array.isArray(data) ? data.map((item) => normalizeProlinkFeedItem(item as Partial<ProlinkFeedItem>)) : [];
}

export function rankProlinkFeedItems(
  items: ProlinkFeedItem[],
  authUser: Pick<AuthUser, "professional_role" | "skilled_domains" | "company_domains" | "preferred_suggestions">,
  selectedAudiences: ProlinkAudience[],
) {
  const selectedAudienceSet = buildSelectedAudienceSet(selectedAudiences);
  const profileTokens = getProfileSignalTokens(authUser);
  const strongSignals = hasStrongProfileSignals(authUser);

  return [...items]
    .map((item, index) => {
      const itemTokens = getItemSignalTokens(item);
      let score = getBaseRelevanceScore(item, itemTokens, profileTokens, selectedAudienceSet, strongSignals, index);
      score += getSponsoredRelevanceScore(item, profileTokens, selectedAudienceSet);

      return {
        ...item,
        relevance_score: score,
      };
    })
    .sort((left, right) => {
      if (right.relevance_score !== left.relevance_score) {
        return right.relevance_score - left.relevance_score;
      }

      if (left.is_sponsored !== right.is_sponsored) {
        return left.is_sponsored ? 1 : -1;
      }

      if (right.campaign_priority !== left.campaign_priority) {
        return right.campaign_priority - left.campaign_priority;
      }

      return new Date(right.published_at).getTime() - new Date(left.published_at).getTime();
    });
}

export function selectRelevantProlinkFeedItems(
  items: ProlinkFeedItem[],
  authUser: Pick<AuthUser, "professional_role" | "skilled_domains" | "company_domains" | "preferred_suggestions">,
  selectedAudiences: ProlinkAudience[],
  maxItems = 24,
) {
  const rankedItems = rankProlinkFeedItems(items, authUser, selectedAudiences);
  const strongSignals = hasStrongProfileSignals(authUser);
  const organicItems = rankedItems.filter((item) => !item.is_sponsored);
  const sponsoredItems = rankedItems.filter((item) => item.is_sponsored);
  const relevantOrganicItems = strongSignals ? organicItems.filter((item) => item.relevance_score >= 20) : organicItems;
  const baseOrganicItems =
    relevantOrganicItems.length >= Math.min(12, maxItems) ? relevantOrganicItems : organicItems;
  const eligibleSponsoredItems = sponsoredItems.filter((item) => item.relevance_score >= (strongSignals ? 32 : 24));

  return interleaveSponsoredFeedItems(baseOrganicItems, eligibleSponsoredItems, maxItems);
}

export function getAllProlinkAudiences() {
  return [...PROLINK_AUDIENCES];
}
