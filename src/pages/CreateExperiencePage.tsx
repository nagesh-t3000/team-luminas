import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthUser } from "@/lib/appAuth";
import { createUserExperience } from "@/lib/experiences";

type CreateExperiencePageProps = {
  authUser: AuthUser;
};

const MAX_TITLE_LENGTH = 80;
const MAX_ORGANIZATION_LENGTH = 80;
const MAX_PERIOD_LENGTH = 40;
const MAX_SUMMARY_LENGTH = 500;

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

  return "Unable to add your experience right now.";
}

export function CreateExperiencePage({ authUser }: CreateExperiencePageProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [period, setPeriod] = useState("");
  const [summary, setSummary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setErrorMessage("Add a role or title for this experience.");
      return;
    }

    if (!organization.trim()) {
      setErrorMessage("Add the company, project, or organization.");
      return;
    }

    if (!period.trim()) {
      setErrorMessage("Add the time period for this experience.");
      return;
    }

    if (!summary.trim()) {
      setErrorMessage("Add a short summary for this experience.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createUserExperience({
        userId: authUser.id,
        title: title.trim(),
        organization: organization.trim(),
        period: period.trim(),
        summary: summary.trim(),
      });

      navigate(`/profile/${authUser.username}`);
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
              Create
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ig-text">Add an experience</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ig-muted">
              Highlight the roles, projects, or leadership experience you want people to see on your profile.
            </p>
          </div>
          <Link
            to="/create"
            className="inline-flex items-center justify-center rounded-xl border border-ig-border px-4 py-2 text-sm font-semibold text-ig-text transition hover:bg-ig-bg"
          >
            Back to create
          </Link>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
            <div>
              <h2 className="text-lg font-semibold text-ig-text">Role details</h2>
              <p className="mt-2 text-sm leading-6 text-ig-muted">
                Add the title and organization you want visitors to recognize first.
              </p>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ig-text">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE_LENGTH))}
                  placeholder="Founder, Product Lead, Staff Engineer..."
                  className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                  maxLength={MAX_TITLE_LENGTH}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ig-text">Organization</span>
                <input
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value.slice(0, MAX_ORGANIZATION_LENGTH))}
                  placeholder="Luminas, Northvale Capital, Independent..."
                  className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                  maxLength={MAX_ORGANIZATION_LENGTH}
                />
              </label>
            </div>
          </section>

          <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
            <div>
              <h2 className="text-lg font-semibold text-ig-text">Timing and summary</h2>
              <p className="mt-2 text-sm leading-6 text-ig-muted">
                Add the time range and a short description of what you did or achieved.
              </p>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ig-text">Time period</span>
                <input
                  value={period}
                  onChange={(event) => setPeriod(event.target.value.slice(0, MAX_PERIOD_LENGTH))}
                  placeholder="2024 - Present"
                  className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                  maxLength={MAX_PERIOD_LENGTH}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ig-text">Summary</span>
                <textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value.slice(0, MAX_SUMMARY_LENGTH))}
                  placeholder="Summarize the scope, wins, or focus of this role."
                  className="min-h-32 w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                  maxLength={MAX_SUMMARY_LENGTH}
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
              {isSubmitting ? "Saving..." : "Save experience"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
