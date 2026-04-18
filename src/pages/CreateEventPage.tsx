import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconSparkles } from "@/components/Icons";
import { isVerifiedProfile, type AuthUser } from "@/lib/appAuth";
import { generateEventSummary } from "@/lib/eventAi";
import { createUserEvent } from "@/lib/userEvents";

type CreateEventPageProps = {
  authUser: AuthUser;
};

const MAX_TITLE_LENGTH = 100;
const MAX_SOURCE_LENGTH = 80;
const MAX_LOCATION_LENGTH = 80;
const MAX_SUMMARY_LENGTH = 500;
const MAX_IMAGE_URL_LENGTH = 300;
const MAX_EXTERNAL_URL_LENGTH = 300;
const MAX_TAGS_LENGTH = 120;

function toLocalDateTimeInputValue(date: Date) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return toLocalDateTimeInputValue(date);
}

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

  return "Unable to create your event right now.";
}

function normalizeTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 8);
}

export function CreateEventPage({ authUser }: CreateEventPageProps) {
  const navigate = useNavigate();
  const canCreateEvents = isVerifiedProfile(authUser);
  const suggestedSourceName = useMemo(
    () => authUser.full_name?.trim() || authUser.username,
    [authUser.full_name, authUser.username],
  );
  const [title, setTitle] = useState("");
  const [sourceName, setSourceName] = useState(suggestedSourceName);
  const [location, setLocation] = useState("Remote");
  const [startsAt, setStartsAt] = useState(getDefaultStartDate);
  const [summary, setSummary] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleGenerateSummary() {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setErrorMessage("Add an event title first so AI can suggest the summary.");
      return;
    }

    setIsGeneratingSummary(true);
    setErrorMessage("");

    try {
      const nextSummary = await generateEventSummary({ title: trimmedTitle });
      setSummary(nextSummary.slice(0, MAX_SUMMARY_LENGTH));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsGeneratingSummary(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreateEvents) {
      setErrorMessage("Only verified profiles can create events.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Add an event title.");
      return;
    }

    if (!sourceName.trim()) {
      setErrorMessage("Add the host, club, company, or organizer name.");
      return;
    }

    if (!location.trim()) {
      setErrorMessage("Add the event location.");
      return;
    }

    if (!startsAt.trim() || Number.isNaN(new Date(startsAt).getTime())) {
      setErrorMessage("Choose a valid start date and time.");
      return;
    }

    if (!summary.trim()) {
      setErrorMessage("Add a short summary so people know what to expect.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createUserEvent({
        authorId: authUser.id,
        sourceName: sourceName.trim(),
        title: title.trim(),
        summary: summary.trim(),
        location: location.trim(),
        externalUrl: externalUrl.trim() || null,
        imageUrl: imageUrl.trim() || null,
        tags: normalizeTags(tags),
        startsAt: new Date(startsAt).toISOString(),
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
              Create
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ig-text">Create an event</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ig-muted">
              Share meetups, talks, workshops, or community sessions directly from the home screen.
            </p>
          </div>
          <Link
            to="/create"
            className="inline-flex items-center justify-center rounded-xl border border-ig-border px-4 py-2 text-sm font-semibold text-ig-text transition hover:bg-ig-bg"
          >
            Back to create
          </Link>
        </div>

        {!canCreateEvents ? (
          <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold text-amber-900">Verified profiles only</h2>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Only verified profiles can create events. Event hosts need an active professional account and a
              completed human verification before they can publish to Explore.
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
                <h2 className="text-lg font-semibold text-ig-text">Event basics</h2>
                <p className="mt-2 text-sm leading-6 text-ig-muted">
                  Add the headline details people need before they decide to open the event.
                </p>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Event title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE_LENGTH))}
                    placeholder="Design x AI meetup, Product demo day, Startup hiring session..."
                    className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    maxLength={MAX_TITLE_LENGTH}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Organizer</span>
                  <input
                    value={sourceName}
                    onChange={(event) => setSourceName(event.target.value.slice(0, MAX_SOURCE_LENGTH))}
                    placeholder="Luminas Community"
                    className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    maxLength={MAX_SOURCE_LENGTH}
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
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
                    <span className="mb-2 block text-sm font-medium text-ig-text">Start date and time</span>
                    <input
                      type="datetime-local"
                      value={startsAt}
                      onChange={(event) => setStartsAt(event.target.value)}
                      className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">Details</h2>
                <p className="mt-2 text-sm leading-6 text-ig-muted">
                  Include context, a destination link, and a few tags so it is easier to discover in Explore.
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-ig-muted">
                    {isGeneratingSummary
                      ? "Generating a summary from your event title..."
                      : "Use the AI button to suggest a summary based on the title only."}
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateSummary}
                    disabled={isSubmitting || isGeneratingSummary || !title.trim()}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ig-link bg-white text-ig-link transition hover:bg-[#0095f60d] disabled:cursor-not-allowed disabled:opacity-70"
                    aria-label="Generate event summary with AI"
                    title="Generate summary with AI"
                  >
                    <IconSparkles />
                  </button>
                </div>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Summary</span>
                  <textarea
                    value={summary}
                    onChange={(event) => setSummary(event.target.value.slice(0, MAX_SUMMARY_LENGTH))}
                    placeholder="Who is it for, what will happen, and why should someone attend?"
                    className="min-h-32 w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    maxLength={MAX_SUMMARY_LENGTH}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Event URL</span>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.target.value.slice(0, MAX_EXTERNAL_URL_LENGTH))}
                    placeholder="https://example.com/register"
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
                    placeholder="https://images.example.com/event-cover.jpg"
                    className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    maxLength={MAX_IMAGE_URL_LENGTH}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Tags</span>
                  <input
                    value={tags}
                    onChange={(event) => setTags(event.target.value.slice(0, MAX_TAGS_LENGTH))}
                    placeholder="design, ai, networking"
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
                disabled={isSubmitting || isGeneratingSummary}
                className="inline-flex items-center justify-center rounded-2xl bg-ig-link px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Publishing..." : "Publish event"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
