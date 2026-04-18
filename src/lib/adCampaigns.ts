import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type AdCampaignTargetType = "event" | "skill_post";
export type AdCampaignStatus = "draft" | "active" | "paused";

export type AdCampaign = {
  id: string;
  owner_id: string;
  target_type: AdCampaignTargetType;
  target_id: string;
  objective: string;
  budget_inr: number;
  duration_days: number;
  audience_summary: string;
  audience_labels: string[];
  status: AdCampaignStatus;
  created_at: string;
  updated_at: string;
  target_title: string | null;
  target_context: string | null;
  target_path: string | null;
};

type CreateAdCampaignInput = {
  ownerId: string;
  targetType: AdCampaignTargetType;
  targetId: string;
  objective: string;
  budgetInr: number;
  durationDays: number;
  audienceSummary: string;
  audienceLabels: string[];
  status: AdCampaignStatus;
};

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

  return "Unable to load ad campaigns right now.";
}

function isMissingAdsRpcError(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("Could not find the function public.create_ad_campaign") ||
    message.includes("Could not find the function public.list_ad_campaigns_by_user") ||
    message.includes("Could not find the function public.update_ad_campaign_status") ||
    message.includes("schema cache")
  );
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeTargetType(value: unknown): AdCampaignTargetType {
  return value === "skill_post" ? "skill_post" : "event";
}

function normalizeStatus(value: unknown): AdCampaignStatus {
  if (value === "draft" || value === "paused") {
    return value;
  }

  return "active";
}

function normalizeAdCampaign(value: AdCampaign): AdCampaign {
  return {
    ...value,
    target_type: normalizeTargetType(value.target_type),
    objective: value.objective?.trim() || "",
    budget_inr: Number(value.budget_inr) || 0,
    duration_days: Number(value.duration_days) || 0,
    audience_summary: value.audience_summary?.trim() || "",
    audience_labels: normalizeStringArray(value.audience_labels),
    status: normalizeStatus(value.status),
    target_title: value.target_title?.trim() || null,
    target_context: value.target_context?.trim() || null,
    target_path: value.target_path?.trim() || null,
  };
}

export async function createAdCampaign({
  ownerId,
  targetType,
  targetId,
  objective,
  budgetInr,
  durationDays,
  audienceSummary,
  audienceLabels,
  status,
}: CreateAdCampaignInput) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Update the anon key in .env.");
  }

  const { data, error } = await supabase.rpc("create_ad_campaign", {
    owner_id_input: ownerId,
    target_type_input: targetType,
    target_id_input: targetId,
    objective_input: objective,
    budget_inr_input: budgetInr,
    duration_days_input: durationDays,
    audience_summary_input: audienceSummary,
    audience_labels_input: audienceLabels,
    status_input: status,
  });

  if (error) {
    if (isMissingAdsRpcError(error)) {
      throw new Error(
        "Your Supabase SQL is missing the ad campaigns migration. Apply `supabase/sql/012_ad_campaigns.sql` and try again.",
      );
    }

    throw new Error(getErrorMessage(error));
  }

  const createdCampaign = Array.isArray(data) ? data[0] : data;

  if (!createdCampaign) {
    throw new Error("No ad campaign was returned from Supabase.");
  }

  return normalizeAdCampaign(createdCampaign as AdCampaign);
}

export async function listAdCampaignsByUser(ownerId: string, limit = 24) {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_ad_campaigns_by_user", {
    owner_id_input: ownerId,
    limit_count: limit,
  });

  if (error) {
    if (isMissingAdsRpcError(error)) {
      return [];
    }

    throw new Error(getErrorMessage(error));
  }

  return Array.isArray(data)
    ? data.map((campaign) => normalizeAdCampaign(campaign as AdCampaign))
    : [];
}

export async function updateAdCampaignStatus(
  campaignId: string,
  ownerId: string,
  status: Extract<AdCampaignStatus, "active" | "paused">,
) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Update the anon key in .env.");
  }

  const { data, error } = await supabase.rpc("update_ad_campaign_status", {
    campaign_id_input: campaignId,
    owner_id_input: ownerId,
    status_input: status,
  });

  if (error) {
    if (isMissingAdsRpcError(error)) {
      throw new Error(
        "Your Supabase SQL is missing the ad campaigns migration. Apply `supabase/sql/012_ad_campaigns.sql` and try again.",
      );
    }

    throw new Error(getErrorMessage(error));
  }

  const updatedCampaign = Array.isArray(data) ? data[0] : data;

  if (!updatedCampaign) {
    throw new Error("No ad campaign was returned from Supabase.");
  }

  return normalizeAdCampaign(updatedCampaign as AdCampaign);
}
