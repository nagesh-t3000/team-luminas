import type { ExploreUpdate } from "@/lib/exploreUpdates";
import { getStoredAuthUser, isProfessionalAccount } from "@/lib/appAuth";

const STORAGE_KEY = "luminas.userJobs";

type StoredUserJob = ExploreUpdate & {
  author_id: string;
};

type CreateUserJobInput = {
  authorId: string;
  sourceName: string;
  title: string;
  summary: string;
  location: string;
  profileRoleType: string;
  experienceRange: string;
  employmentType: string;
  workMode: string;
  externalUrl?: string | null;
  imageUrl?: string | null;
  tags?: string[];
};

function readStoredUserJobs() {
  if (typeof window === "undefined") {
    return [] as StoredUserJob[];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [] as StoredUserJob[];
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue.map(normalizeStoredUserJob).filter(isStoredUserJob) : [];
  } catch {
    return [] as StoredUserJob[];
  }
}

function writeStoredUserJobs(jobs: StoredUserJob[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function isStoredUserJob(value: StoredUserJob | null): value is StoredUserJob {
  return value !== null;
}

function normalizeStoredUserJob(value: unknown): StoredUserJob | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const job = value as Partial<StoredUserJob>;
  const id = normalizeString(job.id);
  const authorId = normalizeString(job.author_id);
  const title = normalizeString(job.title);
  const summary = normalizeString(job.summary);
  const sourceName = normalizeString(job.source_name);
  const location = normalizeString(job.location) || "Remote";
  const createdAt = normalizeString(job.created_at);
  const publishedAt = normalizeString(job.published_at);

  if (!id || !authorId || !title || !summary || !sourceName || !createdAt || !publishedAt) {
    return null;
  }

  return {
    id,
    author_id: authorId,
    category: "job",
    source_name: sourceName,
    title,
    summary,
    location,
    external_url: normalizeString(job.external_url) || null,
    image_url: normalizeString(job.image_url) || null,
    tags: normalizeStringArray(job.tags),
    raw_payload:
      typeof job.raw_payload === "object" && job.raw_payload !== null
        ? job.raw_payload
        : {},
    published_at: publishedAt,
    created_at: createdAt,
  };
}

function sortNewestFirst(jobs: StoredUserJob[]) {
  return [...jobs].sort((left, right) => {
    const leftTime = new Date(left.published_at).getTime();
    const rightTime = new Date(right.published_at).getTime();
    return rightTime - leftTime;
  });
}

export function listUserJobs() {
  const authUser = getStoredAuthUser();

  if (!authUser || !isProfessionalAccount(authUser)) {
    return [];
  }

  return sortNewestFirst(readStoredUserJobs().filter((job) => job.author_id === authUser.id));
}

export async function createUserJob({
  authorId,
  sourceName,
  title,
  summary,
  location,
  profileRoleType,
  experienceRange,
  employmentType,
  workMode,
  externalUrl,
  imageUrl,
  tags = [],
}: CreateUserJobInput) {
  const authUser = getStoredAuthUser();
  const normalizedAuthorId = authorId.trim();

  if (!authUser || authUser.id !== normalizedAuthorId || !isProfessionalAccount(authUser)) {
    throw new Error("Only professional accounts can post jobs.");
  }

  const now = new Date().toISOString();
  const createdJob: StoredUserJob = {
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : now,
    author_id: normalizedAuthorId,
    category: "job",
    source_name: sourceName.trim(),
    title: title.trim(),
    summary: summary.trim(),
    location: location.trim() || "Remote",
    external_url: externalUrl?.trim() || null,
    image_url: imageUrl?.trim() || null,
    tags: normalizeStringArray(tags),
    raw_payload: {
      cta: "Apply now",
      profile_role_type: profileRoleType.trim(),
      experience_range: experienceRange.trim(),
      employment_type: employmentType.trim(),
      work_mode: workMode.trim(),
    },
    published_at: now,
    created_at: now,
  };

  const currentJobs = readStoredUserJobs();
  writeStoredUserJobs(sortNewestFirst([createdJob, ...currentJobs]));
  return createdJob;
}
