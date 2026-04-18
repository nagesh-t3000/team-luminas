import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type UserExperience = {
  id: string;
  user_id: string;
  title: string;
  organization: string;
  period: string;
  summary: string;
  created_at: string;
};

type CreateUserExperienceInput = {
  userId: string;
  title: string;
  organization: string;
  period: string;
  summary: string;
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

  return "Unable to load or save experiences right now.";
}

function isMissingUserExperiencesRpcError(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("Could not find the function public.create_user_experience") ||
    message.includes("Could not find the function public.list_user_experiences_by_username") ||
    message.includes("schema cache")
  );
}

function normalizeUserExperience(experience: UserExperience) {
  return {
    ...experience,
    title: experience.title?.trim() || "",
    organization: experience.organization?.trim() || "",
    period: experience.period?.trim() || "",
    summary: experience.summary?.trim() || "",
  };
}

export async function listUserExperiencesByUsername(username: string, limit = 20) {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_user_experiences_by_username", {
    username_input: username,
    limit_count: limit,
  });

  if (error) {
    if (isMissingUserExperiencesRpcError(error)) {
      return [];
    }

    throw new Error(getErrorMessage(error));
  }

  return Array.isArray(data)
    ? data.map((experience) => normalizeUserExperience(experience as UserExperience))
    : [];
}

export async function createUserExperience({
  userId,
  title,
  organization,
  period,
  summary,
}: CreateUserExperienceInput) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Update the anon key in .env.");
  }

  const { data, error } = await supabase.rpc("create_user_experience", {
    user_id_input: userId,
    title_input: title,
    organization_input: organization,
    period_input: period,
    summary_input: summary,
  });

  if (error) {
    if (isMissingUserExperiencesRpcError(error)) {
      throw new Error(
        "Your Supabase SQL is missing the user experiences migration. Apply `supabase/sql/006_user_experiences.sql` and try again.",
      );
    }

    throw new Error(getErrorMessage(error));
  }

  const createdExperience = Array.isArray(data) ? data[0] : data;

  if (!createdExperience) {
    throw new Error("No experience entry was returned from Supabase.");
  }

  return normalizeUserExperience(createdExperience as UserExperience);
}
