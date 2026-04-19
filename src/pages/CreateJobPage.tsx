import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isProfessionalAccount, type AuthUser } from "@/lib/appAuth";
import { createUserJob } from "@/lib/userJobs";

type CreateJobPageProps = {
  authUser: AuthUser;
};

const MAX_TITLE_LENGTH = 100;
const MAX_SOURCE_LENGTH = 80;
const MAX_LOCATION_LENGTH = 80;
const MAX_ROLE_TYPE_LENGTH = 60;
const MAX_EXPERIENCE_LENGTH = 40;
const MAX_SUMMARY_LENGTH = 600;
const MAX_IMAGE_URL_LENGTH = 300;
const MAX_EXTERNAL_URL_LENGTH = 300;
const MAX_TAGS_LENGTH = 120;

const employmentTypeOptions = ["Full-time", "Part-time", "Contract", "Consulting"] as const;
const workModeOptions = ["Remote", "Hybrid", "On-site"] as const;

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

  return "Unable to post your job right now.";
}

function normalizeTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 8);
}

export function CreateJobPage({ authUser }: CreateJobPageProps) {
  const navigate = useNavigate();
  const canPostJobs = isProfessionalAccount(authUser);
  const suggestedCompanyName = useMemo(
    () => authUser.full_name?.trim() || authUser.username,
    [authUser.full_name, authUser.username],
  );
  const [title, setTitle] = useState("");
  const [sourceName, setSourceName] = useState(suggestedCompanyName);
  const [profileRoleType, setProfileRoleType] = useState("Engineering and Data");
  const [location, setLocation] = useState("Remote");
  const [workMode, setWorkMode] = useState<(typeof workModeOptions)[number]>("Remote");
  const [employmentType, setEmploymentType] = useState<(typeof employmentTypeOptions)[number]>("Full-time");
  const [experienceRange, setExperienceRange] = useState("5-8 years");
  const [summary, setSummary] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canPostJobs) {
      setErrorMessage("Only professional accounts can post jobs.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Add a job title.");
      return;
    }

    if (!sourceName.trim()) {
      setErrorMessage("Add the company or hiring team name.");
      return;
    }

    if (!profileRoleType.trim()) {
      setErrorMessage("Add the profile role type for this opportunity.");
      return;
    }

    if (!experienceRange.trim()) {
      setErrorMessage("Add the expected experience range.");
      return;
    }

    if (!summary.trim()) {
      setErrorMessage("Add a summary so experienced professionals understand the role.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createUserJob({
        authorId: authUser.id,
        sourceName: sourceName.trim(),
        title: title.trim(),
        summary: summary.trim(),
        location: location.trim(),
        profileRoleType: profileRoleType.trim(),
        experienceRange: experienceRange.trim(),
        employmentType,
        workMode,
        externalUrl: externalUrl.trim() || null,
        imageUrl: imageUrl.trim() || null,
        tags: normalizeTags(tags),
      });

      navigate("/explore");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-10">
      <div className="rounded-[28px] border border-ig-border bg-ig-surface p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 border-b border-ig-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-ig-border bg-ig-bg px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ig-link">
              Prolink
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ig-text">Post a job</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ig-muted">
              Create a simple job listing for experienced professionals and separate it clearly by profile role type.
            </p>
          </div>
          <Link
            to="/create"
            className="inline-flex items-center justify-center rounded-xl border border-ig-border px-4 py-2 text-sm font-semibold text-ig-text transition hover:bg-ig-bg"
          >
            Back to create
          </Link>
        </div>

        {!canPostJobs ? (
          <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold text-amber-900">Professional accounts only</h2>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Job posting is limited to professional accounts so Prolink stays focused on trusted business hiring.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/settings"
                className="inline-flex items-center justify-center rounded-xl bg-ig-link px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Open settings
              </Link>
              <Link
                to="/create"
                className="inline-flex items-center justify-center rounded-xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                Back to create
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">Job basics</h2>
                <p className="mt-2 text-sm leading-6 text-ig-muted">
                  Add the headline details companies and experienced professionals need first.
                </p>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Job title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE_LENGTH))}
                    placeholder="Senior Product Manager, Staff Backend Engineer..."
                    className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    maxLength={MAX_TITLE_LENGTH}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Company or hiring team</span>
                  <input
                    value={sourceName}
                    onChange={(event) => setSourceName(event.target.value.slice(0, MAX_SOURCE_LENGTH))}
                    placeholder="Northstar Cloud"
                    className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    maxLength={MAX_SOURCE_LENGTH}
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ig-text">Profile role type</span>
                    <input
                      value={profileRoleType}
                      onChange={(event) => setProfileRoleType(event.target.value.slice(0, MAX_ROLE_TYPE_LENGTH))}
                      placeholder="Engineering and Data"
                      className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                      maxLength={MAX_ROLE_TYPE_LENGTH}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ig-text">Experience range</span>
                    <input
                      value={experienceRange}
                      onChange={(event) => setExperienceRange(event.target.value.slice(0, MAX_EXPERIENCE_LENGTH))}
                      placeholder="5-8 years"
                      className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                      maxLength={MAX_EXPERIENCE_LENGTH}
                    />
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ig-text">Location</span>
                    <input
                      value={location}
                      onChange={(event) => setLocation(event.target.value.slice(0, MAX_LOCATION_LENGTH))}
                      placeholder="Remote, Bengaluru, Mumbai..."
                      className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                      maxLength={MAX_LOCATION_LENGTH}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ig-text">Work mode</span>
                    <select
                      value={workMode}
                      onChange={(event) => setWorkMode(event.target.value as (typeof workModeOptions)[number])}
                      className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    >
                      {workModeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ig-text">Employment type</span>
                    <select
                      value={employmentType}
                      onChange={(event) => setEmploymentType(event.target.value as (typeof employmentTypeOptions)[number])}
                      className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    >
                      {employmentTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">Role details</h2>
                <p className="mt-2 text-sm leading-6 text-ig-muted">
                  Explain the scope, level, and business context so the right professionals self-select.
                </p>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Role summary</span>
                  <textarea
                    value={summary}
                    onChange={(event) => setSummary(event.target.value.slice(0, MAX_SUMMARY_LENGTH))}
                    placeholder="Describe what the person will own, which team they will work with, and why this role matters to the business."
                    className="min-h-36 w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    maxLength={MAX_SUMMARY_LENGTH}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Apply URL</span>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.target.value.slice(0, MAX_EXTERNAL_URL_LENGTH))}
                    placeholder="https://example.com/jobs/staff-platform-engineer"
                    className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    maxLength={MAX_EXTERNAL_URL_LENGTH}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Cover image URL</span>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value.slice(0, MAX_IMAGE_URL_LENGTH))}
                    placeholder="https://images.example.com/team-hiring.jpg"
                    className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    maxLength={MAX_IMAGE_URL_LENGTH}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Tags</span>
                  <input
                    value={tags}
                    onChange={(event) => setTags(event.target.value.slice(0, MAX_TAGS_LENGTH))}
                    placeholder="backend, leadership, hiring, platform"
                    className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    maxLength={MAX_TAGS_LENGTH}
                  />
                </label>
              </div>
            </section>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                to="/create"
                className="inline-flex items-center justify-center rounded-2xl border border-ig-border px-5 py-3 text-sm font-semibold text-ig-text transition hover:bg-ig-bg"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-2xl bg-ig-link px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Posting..." : "Post job"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
