import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { currentUser } from "@/data/mockData";
import { listAdCampaignsByUser, updateAdCampaignStatus, type AdCampaign } from "@/lib/adCampaigns";
import { getStoredAuthUser } from "@/lib/appAuth";

const quickActions = [
  { label: "Create a post", to: "/create/post" },
  { label: "Host an event", to: "/create/event" },
  { label: "Create an ad", to: "/create/ad" },
  { label: "Update settings", to: "/settings" },
] as const;

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStatusLabel(value: AdCampaign["status"]) {
  if (value === "draft") {
    return "Draft";
  }

  if (value === "paused") {
    return "Paused";
  }

  return "Active";
}

export function DashboardPage() {
  const authUser = useMemo(() => getStoredAuthUser(), []);
  const authUserId = authUser?.id ?? null;
  const firstName = authUser?.full_name?.trim().split(/\s+/)[0] || currentUser.fullName.split(/\s+/)[0];
  const profileUsername = authUser?.username || currentUser.username;
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [adsErrorMessage, setAdsErrorMessage] = useState("");
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [updatingCampaignId, setUpdatingCampaignId] = useState("");

  useEffect(() => {
    let isCancelled = false;

    if (!authUser) {
      setIsLoadingAds(false);
      return () => {
        isCancelled = true;
      };
    }

    setIsLoadingAds(true);

    listAdCampaignsByUser(authUser.id, 12)
      .then((nextCampaigns) => {
        if (!isCancelled) {
          setCampaigns(nextCampaigns);
          setAdsErrorMessage("");
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setAdsErrorMessage(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingAds(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [authUserId]);

  const metricCards = useMemo(
    () => [
      { label: "Posts shared", value: "24" },
      { label: "Profile visits", value: "182" },
      { label: "Active boosts", value: String(campaigns.filter((campaign) => campaign.status === "active").length) },
    ],
    [campaigns],
  );

  async function handleCampaignStatusChange(campaignId: string, nextStatus: "active" | "paused") {
    if (!authUser) {
      return;
    }

    setUpdatingCampaignId(campaignId);
    setAdsErrorMessage("");

    try {
      const updatedCampaign = await updateAdCampaignStatus(campaignId, authUser.id, nextStatus);
      setCampaigns((current) =>
        current.map((campaign) => (campaign.id === updatedCampaign.id ? updatedCampaign : campaign)),
      );
    } catch (error) {
      setAdsErrorMessage(getErrorMessage(error));
    } finally {
      setUpdatingCampaignId("");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1015px] px-4 py-6 md:px-0">
      <div className="rounded-[28px] border border-ig-border bg-ig-surface p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-ig-muted">Dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold text-ig-text">Welcome back, {firstName}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ig-muted">
          Track your activity, jump back into creation, and keep your profile ready for new opportunities.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {metricCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-ig-border bg-ig-bg px-4 py-5">
              <p className="text-sm text-ig-muted">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-ig-text">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-ig-border bg-ig-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ig-text">Quick actions</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className="rounded-2xl border border-ig-border bg-ig-bg px-4 py-4 text-sm font-medium text-ig-text transition-colors hover:bg-black/5"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-ig-border bg-ig-surface p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">Ads</h2>
                <p className="mt-2 text-sm text-ig-muted">
                  Review saved campaigns, launch drafts, and pause active boosts from one place.
                </p>
              </div>
              <Link
                to="/create/ad"
                className="inline-flex items-center justify-center rounded-xl bg-ig-link px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Create ad
              </Link>
            </div>

            {adsErrorMessage ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {adsErrorMessage}
              </div>
            ) : null}

            {isLoadingAds ? (
              <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-ig-border bg-ig-bg px-4 py-6 text-sm text-ig-muted">
                <span
                  className="h-5 w-5 animate-spin rounded-full border-2 border-ig-border border-t-ig-link"
                  aria-hidden="true"
                />
                <span>Loading your ad campaigns...</span>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-dashed border-ig-border bg-ig-bg p-5">
                <h3 className="text-base font-semibold text-ig-text">No ad campaigns yet</h3>
                <p className="mt-2 text-sm leading-6 text-ig-muted">
                  Boost one of your best events or skill posts to start building paid reach on Luminas.
                </p>
                <Link
                  to="/create/ad"
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-ig-link px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                >
                  Create your first ad
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {campaigns.map((campaign) => {
                  const nextStatus = campaign.status === "active" ? "paused" : "active";
                  const actionLabel =
                    campaign.status === "active"
                      ? "Pause"
                      : campaign.status === "draft"
                        ? "Launch boost"
                        : "Resume";
                  const isUpdating = updatingCampaignId === campaign.id;

                  return (
                    <article key={campaign.id} className="rounded-3xl border border-ig-border bg-ig-bg p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-ig-text">
                              {campaign.target_title || "Untitled campaign"}
                            </h3>
                            <span className="rounded-full border border-ig-border bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ig-link">
                              {campaign.target_type === "event" ? "Event" : "Skill post"}
                            </span>
                            <span className="rounded-full border border-ig-border bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ig-text">
                              {formatStatusLabel(campaign.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-ig-muted">
                            {campaign.target_context || "Campaign"} . {campaign.objective.replace(/-/g, " ")}
                          </p>
                          {campaign.audience_summary ? (
                            <p className="mt-3 text-sm leading-6 text-ig-muted">{campaign.audience_summary}</p>
                          ) : null}
                          {campaign.audience_labels.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {campaign.audience_labels.map((label) => (
                                <span
                                  key={label}
                                  className="rounded-full border border-ig-border bg-white px-3 py-1 text-xs font-semibold text-ig-text"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text">
                          <p className="font-semibold">{formatCurrency(campaign.budget_inr)}</p>
                          <p className="mt-1 text-xs text-ig-muted">{campaign.duration_days} day run</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleCampaignStatusChange(campaign.id, nextStatus)}
                          disabled={isUpdating}
                          className="inline-flex items-center justify-center rounded-xl border border-ig-border bg-white px-4 py-2 text-sm font-semibold text-ig-text transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isUpdating ? "Updating..." : actionLabel}
                        </button>
                        <Link
                          to={campaign.target_path || "/dashboard"}
                          className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-ig-link transition hover:bg-[#0095f614]"
                        >
                          View boosted content
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="rounded-[28px] border border-ig-border bg-ig-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ig-text">Profile</h2>
          <p className="mt-2 text-sm text-ig-muted">Keep your public profile updated so the right people can find you.</p>
          <Link
            to={`/profile/${profileUsername}`}
            className="mt-4 inline-flex rounded-full border border-ig-border px-4 py-2 text-sm font-medium text-ig-text transition-colors hover:bg-black/5"
          >
            View profile
          </Link>
        </aside>
      </div>
    </div>
  );
}
