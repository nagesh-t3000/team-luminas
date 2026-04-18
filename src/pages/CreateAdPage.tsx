import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAdCampaign, type AdCampaignStatus, type AdCampaignTargetType } from "@/lib/adCampaigns";
import { isVerifiedProfile, type AuthUser } from "@/lib/appAuth";
import { listAuthoredExploreUpdates } from "@/lib/exploreUpdates";
import { listSkillPostsByUsername } from "@/lib/skillPosts";

type CreateAdPageProps = {
  authUser: AuthUser;
};

type BoostTarget = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
};

const objectiveOptions = [
  {
    id: "reach-more-members",
    label: "Reach more members",
    description: "Increase visibility across the network for discovery and top-of-funnel awareness.",
  },
  {
    id: "drive-rsvps",
    label: "Drive RSVPs",
    description: "Best for events where you want more seat requests or signups.",
  },
  {
    id: "generate-inbound-leads",
    label: "Generate inbound leads",
    description: "Use this when the post is meant to start conversations or attract opportunities.",
  },
] as const;

const MAX_AUDIENCE_SUMMARY_LENGTH = 500;
const MIN_BUDGET_INR = 500;
const MAX_BUDGET_INR = 500000;
const MIN_DURATION_DAYS = 1;
const MAX_DURATION_DAYS = 30;

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

  return "Unable to create your ad campaign right now.";
}

function parseAudienceLabels(value: string) {
  const seen = new Set<string>();

  return value
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean)
    .filter((label) => {
      const normalizedLabel = label.toLowerCase();

      if (seen.has(normalizedLabel)) {
        return false;
      }

      seen.add(normalizedLabel);
      return true;
    })
    .slice(0, 8);
}

export function CreateAdPage({ authUser }: CreateAdPageProps) {
  const navigate = useNavigate();
  const canCreateAds = isVerifiedProfile(authUser);
  const [targetType, setTargetType] = useState<AdCampaignTargetType>("event");
  const [eventTargets, setEventTargets] = useState<BoostTarget[]>([]);
  const [skillPostTargets, setSkillPostTargets] = useState<BoostTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [selectedObjective, setSelectedObjective] = useState<string>(objectiveOptions[0].id);
  const [budgetInr, setBudgetInr] = useState("2500");
  const [durationDays, setDurationDays] = useState("7");
  const [audienceSummary, setAudienceSummary] = useState("");
  const [audienceLabelsInput, setAudienceLabelsInput] = useState("");
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isCancelled = false;

    if (!canCreateAds) {
      setIsLoadingTargets(false);
      return () => {
        isCancelled = true;
      };
    }

    setIsLoadingTargets(true);

    Promise.all([
      listAuthoredExploreUpdates(authUser.id, "event", 20),
      listSkillPostsByUsername(authUser.username, 20),
    ])
      .then(([events, skillPosts]) => {
        if (isCancelled) {
          return;
        }

        setEventTargets(
          events.map((event) => ({
            id: event.id,
            title: event.title,
            subtitle: event.location || "Remote",
            description: event.summary,
          })),
        );
        setSkillPostTargets(
          skillPosts.map((post) => ({
            id: post.id,
            title: post.skilled_domain,
            subtitle: post.author_professional_role || "Skill post",
            description: post.content || "Media-led skill post",
          })),
        );
        setErrorMessage("");
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingTargets(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [authUser.id, authUser.username, canCreateAds]);

  const availableTargets = useMemo(
    () => (targetType === "event" ? eventTargets : skillPostTargets),
    [eventTargets, skillPostTargets, targetType],
  );

  useEffect(() => {
    if (availableTargets.length === 0) {
      setSelectedTargetId("");
      return;
    }

    if (!availableTargets.some((target) => target.id === selectedTargetId)) {
      setSelectedTargetId(availableTargets[0].id);
    }
  }, [availableTargets, selectedTargetId]);

  const audienceLabels = useMemo(() => parseAudienceLabels(audienceLabelsInput), [audienceLabelsInput]);
  const selectedTarget = availableTargets.find((target) => target.id === selectedTargetId) || null;

  async function submitCampaign(status: AdCampaignStatus) {
    if (!canCreateAds) {
      setErrorMessage("Only verified professional accounts can create ads.");
      return;
    }

    if (!selectedTargetId) {
      setErrorMessage(`Choose one of your ${targetType === "event" ? "events" : "skill posts"} to boost.`);
      return;
    }

    if (!selectedObjective.trim()) {
      setErrorMessage("Choose a campaign objective.");
      return;
    }

    const parsedBudget = Number.parseInt(budgetInr, 10);

    if (!Number.isFinite(parsedBudget) || parsedBudget < MIN_BUDGET_INR || parsedBudget > MAX_BUDGET_INR) {
      setErrorMessage(`Budget must be between INR ${MIN_BUDGET_INR} and INR ${MAX_BUDGET_INR}.`);
      return;
    }

    const parsedDuration = Number.parseInt(durationDays, 10);

    if (!Number.isFinite(parsedDuration) || parsedDuration < MIN_DURATION_DAYS || parsedDuration > MAX_DURATION_DAYS) {
      setErrorMessage(`Duration must be between ${MIN_DURATION_DAYS} and ${MAX_DURATION_DAYS} days.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createAdCampaign({
        ownerId: authUser.id,
        targetType,
        targetId: selectedTargetId,
        objective: selectedObjective,
        budgetInr: parsedBudget,
        durationDays: parsedDuration,
        audienceSummary: audienceSummary.trim(),
        audienceLabels,
        status,
      });

      navigate("/dashboard");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
      <div className="rounded-[28px] border border-ig-border bg-ig-surface p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 border-b border-ig-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-ig-border bg-ig-bg px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ig-link">
              Create
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ig-text">Create an ad</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ig-muted">
              Boost your best event or skill post with a simple campaign, a clear budget, and a focused audience.
            </p>
          </div>
          <Link
            to="/create"
            className="inline-flex items-center justify-center rounded-xl border border-ig-border px-4 py-2 text-sm font-semibold text-ig-text transition hover:bg-ig-bg"
          >
            Back to create
          </Link>
        </div>

        {!canCreateAds ? (
          <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold text-amber-900">Verified professional accounts only</h2>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Ads are limited to verified professional accounts so boosted content stays relevant and trustworthy.
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
          <div className="mt-8 space-y-6">
            <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">What do you want to boost?</h2>
                <p className="mt-2 text-sm leading-6 text-ig-muted">
                  Start by choosing the type of content you want to turn into a paid campaign.
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  {(["event", "skill_post"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTargetType(type)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        targetType === type
                          ? "border-ig-link bg-ig-link text-white"
                          : "border-ig-border bg-white text-ig-text hover:bg-ig-bg"
                      }`}
                    >
                      {type === "event" ? "Event" : "Skill post"}
                    </button>
                  ))}
                </div>
                <p className="text-xs leading-5 text-ig-muted">
                  Events must already exist in Explore to be boostable here. Locally created draft events do not show up
                  until they are stored in Supabase.
                </p>
              </div>
            </section>

            <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">Choose content</h2>
                <p className="mt-2 text-sm leading-6 text-ig-muted">
                  Pick one of your own {targetType === "event" ? "events" : "skill posts"} to promote.
                </p>
              </div>
              <div className="space-y-4">
                {isLoadingTargets ? (
                  <div className="rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-muted">
                    Loading your boostable content...
                  </div>
                ) : availableTargets.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-ig-border bg-white p-5">
                    <h3 className="text-base font-semibold text-ig-text">
                      No {targetType === "event" ? "published events" : "skill posts"} available yet
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-ig-muted">
                      Create the content first, then come back here to boost it as an ad campaign.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        to={targetType === "event" ? "/create/event" : "/create/post"}
                        className="inline-flex items-center justify-center rounded-xl bg-ig-link px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                      >
                        {targetType === "event" ? "Create event" : "Create skill post"}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {availableTargets.map((target) => {
                      const isSelected = target.id === selectedTargetId;

                      return (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => setSelectedTargetId(target.id)}
                          className={`rounded-3xl border p-4 text-left transition ${
                            isSelected
                              ? "border-ig-link bg-[#0095f614]"
                              : "border-ig-border bg-white hover:bg-ig-bg"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-ig-text">{target.title}</h3>
                              <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-ig-link">
                                {target.subtitle}
                              </p>
                            </div>
                            {isSelected ? (
                              <span className="rounded-full bg-ig-link px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                                Selected
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 text-sm leading-6 text-ig-muted">{target.description}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">Campaign setup</h2>
                <p className="mt-2 text-sm leading-6 text-ig-muted">
                  Set the goal, budget, and run length for this boost.
                </p>
              </div>
              <div className="space-y-5">
                <div>
                  <span className="mb-2 block text-sm font-medium text-ig-text">Objective</span>
                  <div className="grid gap-3 md:grid-cols-3">
                    {objectiveOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedObjective(option.id)}
                        className={`rounded-3xl border p-4 text-left transition ${
                          selectedObjective === option.id
                            ? "border-ig-link bg-[#0095f614]"
                            : "border-ig-border bg-white hover:bg-ig-bg"
                        }`}
                      >
                        <h3 className="text-sm font-semibold text-ig-text">{option.label}</h3>
                        <p className="mt-2 text-xs leading-5 text-ig-muted">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ig-text">Budget (INR)</span>
                    <input
                      type="number"
                      min={MIN_BUDGET_INR}
                      max={MAX_BUDGET_INR}
                      step={100}
                      value={budgetInr}
                      onChange={(event) => setBudgetInr(event.target.value)}
                      className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ig-text">Duration (days)</span>
                    <input
                      type="number"
                      min={MIN_DURATION_DAYS}
                      max={MAX_DURATION_DAYS}
                      value={durationDays}
                      onChange={(event) => setDurationDays(event.target.value)}
                      className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">Audience notes</h2>
                <p className="mt-2 text-sm leading-6 text-ig-muted">
                  Add a simple summary of who this campaign is meant to reach.
                </p>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Audience summary</span>
                  <textarea
                    value={audienceSummary}
                    onChange={(event) => setAudienceSummary(event.target.value.slice(0, MAX_AUDIENCE_SUMMARY_LENGTH))}
                    placeholder="Example: Founders and early-stage operators in Bengaluru looking for GTM and product community events."
                    maxLength={MAX_AUDIENCE_SUMMARY_LENGTH}
                    className="min-h-32 w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Audience labels</span>
                  <input
                    value={audienceLabelsInput}
                    onChange={(event) => setAudienceLabelsInput(event.target.value)}
                    placeholder="founders, product managers, bengaluru, hiring"
                    className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {audienceLabels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-ig-border bg-white px-3 py-1.5 text-xs font-semibold text-ig-text"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {selectedTarget ? (
              <section className="rounded-3xl border border-ig-border bg-ig-bg p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-ig-text">Campaign summary</h2>
                    <p className="mt-1 text-sm text-ig-muted">
                      Boosting {selectedTarget.title} for {durationDays || "0"} days with an INR {budgetInr || "0"} budget.
                    </p>
                  </div>
                  <span className="rounded-full border border-ig-border bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ig-link">
                    {targetType === "event" ? "Event ad" : "Skill post ad"}
                  </span>
                </div>
              </section>
            ) : null}

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
                type="button"
                onClick={() => submitCampaign("draft")}
                disabled={isSubmitting || isLoadingTargets || availableTargets.length === 0}
                className="inline-flex items-center justify-center rounded-2xl border border-ig-border bg-white px-5 py-3 text-sm font-semibold text-ig-text transition hover:bg-ig-bg disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Saving..." : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => submitCampaign("active")}
                disabled={isSubmitting || isLoadingTargets || availableTargets.length === 0}
                className="inline-flex items-center justify-center rounded-2xl bg-ig-link px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Launching..." : "Launch boost"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
