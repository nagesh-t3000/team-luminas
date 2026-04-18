import { useEffect, useState } from "react";
import { IconSearch } from "@/components/Icons";
import {
  listExploreUpdates,
  type ExploreUpdate,
  type ExploreUpdateCategory,
} from "@/lib/exploreUpdates";
import { formatRelativePostTime } from "@/lib/skillPosts";
import { listUserEvents } from "@/lib/userEvents";

const categoryTabs: Array<{ label: string; value: ExploreUpdateCategory | "all" }> = [
  { label: "All", value: "all" },
  { label: "Hackathons", value: "hackathon" },
  { label: "Events", value: "event" },
  { label: "Jobs", value: "job" },
];

const categoryLabel: Record<ExploreUpdateCategory, string> = {
  hackathon: "Hackathon",
  event: "Event",
  job: "Job",
};

const categoryAccent: Record<ExploreUpdateCategory, string> = {
  hackathon: "bg-violet-100 text-violet-700",
  event: "bg-amber-100 text-amber-700",
  job: "bg-emerald-100 text-emerald-700",
};

function ExploreUpdateCard({ update }: { update: ExploreUpdate }) {
  const callToAction =
    typeof update.raw_payload.cta === "string" && update.raw_payload.cta.trim()
      ? update.raw_payload.cta.trim()
      : "View source";

  return (
    <article className="overflow-hidden rounded-3xl border border-ig-border bg-ig-surface shadow-sm">
      <div className="aspect-[16/10] bg-ig-bg">
        {update.image_url ? (
          <img
            src={update.image_url}
            alt={update.title}
            className="h-full w-full object-cover"
            width={960}
            height={600}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-6 text-center text-xl font-semibold text-slate-600">
            {update.source_name}
          </div>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${categoryAccent[update.category]}`}
          >
            {categoryLabel[update.category]}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-ig-muted">{update.source_name}</span>
          <span className="text-xs text-ig-muted">{formatRelativePostTime(update.published_at)}</span>
        </div>

        <div>
          <h2 className="text-lg font-semibold leading-6 text-ig-text">{update.title}</h2>
          <p className="mt-2 text-sm leading-6 text-ig-muted">{update.summary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-ig-muted">
          <span className="rounded-full border border-ig-border bg-ig-bg px-3 py-1">{update.location}</span>
          {update.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-ig-border px-3 py-1 text-[13px]">
              #{tag}
            </span>
          ))}
        </div>

        {update.external_url ? (
          <a
            href={update.external_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full bg-ig-link px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {callToAction}
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function ExplorePage() {
  const [selectedCategory, setSelectedCategory] = useState<ExploreUpdateCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [updates, setUpdates] = useState<ExploreUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    listExploreUpdates(24, selectedCategory === "all" ? undefined : selectedCategory, searchQuery)
      .then((remoteUpdates) => {
        if (!isCancelled) {
          const normalizedSearch = searchQuery.trim().toLowerCase();
          const createdEvents = listUserEvents().filter((event) => {
            const matchesCategory = selectedCategory === "all" || event.category === selectedCategory;

            if (!matchesCategory) {
              return false;
            }

            if (!normalizedSearch) {
              return true;
            }

            const searchableText = [
              event.title,
              event.summary,
              event.source_name,
              event.location,
              ...event.tags,
            ]
              .join(" ")
              .toLowerCase();

            return searchableText.includes(normalizedSearch);
          });

          const nextUpdates = [...createdEvents, ...remoteUpdates].sort((left, right) => {
            const leftTime = new Date(left.published_at).getTime();
            const rightTime = new Date(right.published_at).getTime();
            return rightTime - leftTime;
          });

          setUpdates(nextUpdates);
          setErrorMessage("");
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load explore updates right now.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedCategory, searchQuery]);

  return (
    <div className="mx-auto max-w-[935px] px-4 pb-8 pt-3 md:px-0 md:pt-6 lg:max-w-[1015px]">
      <div className="mb-4 rounded-3xl border border-ig-border bg-ig-surface p-3 shadow-sm">
        <label className="flex items-center gap-3 rounded-2xl bg-ig-bg px-4 py-3 text-ig-muted">
          <span className="shrink-0">
            <IconSearch />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search jobs, hackathons, events, companies, skills..."
            className="w-full bg-transparent text-sm text-ig-text outline-none placeholder:text-ig-muted"
          />
        </label>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {categoryTabs.map((tab) => {
          const isActive = tab.value === selectedCategory;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedCategory(tab.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-ig-text text-white"
                  : "border border-ig-border bg-ig-surface text-ig-text hover:bg-ig-bg"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <p className="mb-5 text-sm text-ig-muted">
        {updates.length} result{updates.length === 1 ? "" : "s"}
        {selectedCategory !== "all" ? ` in ${categoryLabel[selectedCategory].toLowerCase()}s` : ""}
        {searchQuery.trim() ? ` for "${searchQuery.trim()}"` : ""}
      </p>

      {errorMessage ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-3xl border border-ig-border bg-ig-surface px-5 py-8 text-center text-sm text-ig-muted">
          Loading professional updates...
        </div>
      ) : updates.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2">
          {updates.map((update) => (
            <ExploreUpdateCard key={update.id} update={update} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-ig-border bg-ig-surface px-5 py-10 text-center">
          <p className="text-base font-semibold text-ig-text">
            {searchQuery.trim() ? "No updates matched your search." : "No updates yet for this filter."}
          </p>
          <p className="mt-2 text-sm text-ig-muted">
            {searchQuery.trim()
              ? "Try a different keyword, company name, location, or category."
              : "Apply the latest Supabase SQL migration to seed jobs, hackathons, and event listings."}
          </p>
        </div>
      )}
    </div>
  );
}
