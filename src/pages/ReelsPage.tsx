import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AuthUser } from "@/lib/appAuth";
import {
  deriveInitialProlinkAudienceSelection,
  getAllProlinkAudiences,
  listProlinkFeedItems,
  selectRelevantProlinkFeedItems,
  type ProlinkAudience,
  type ProlinkFeedItem,
} from "@/lib/prolinkFeed";

type Opportunity = {
  id: number;
  company: string;
  role: string;
  profileRoleType: string;
  experience: string;
  workMode: string;
  location: string;
  matchScore: string;
  credibility: string;
  workflow: string;
  focus: string;
};

type RoleLane = {
  id: string;
  title: string;
  summary: string;
  hiringLens: string;
  opportunities: Opportunity[];
};

type DiscoveryOption = {
  id: ProlinkAudience;
  label: string;
  summary: string;
};

const platformSignals = [
  {
    title: "Verified companies only",
    description: "Employer identity, hiring ownership, and role intent are validated before any opportunity goes live.",
  },
  {
    title: "Experienced professionals only",
    description: "Every lane is scoped for operators, managers, senior ICs, and leaders. Fresher hiring stays out of scope.",
  },
  {
    title: "Role matching with context",
    description: "Listings highlight business outcomes, seniority, and workflow expectations instead of relying on keywords alone.",
  },
];

const hiringWorkflowStandards = [
  "Structured scorecards and calibrated interview loops reduce noise in mid-to-senior hiring.",
  "Opportunity cards show match rationale so professionals can self-select faster and more accurately.",
  "Business-ready workflows make stakeholder alignment, recruiter handoff, and credibility checks visible from day one.",
];

const roleLanes: RoleLane[] = [
  {
    id: "engineering-data",
    title: "Engineering and Data",
    summary: "For backend, platform, security, data, and AI professionals who own systems, scale, and reliability.",
    hiringLens: "Best-fit roles emphasize architecture depth, delivery ownership, and measurable technical decision making.",
    opportunities: [
      {
        id: 1,
        company: "Northstar Cloud",
        role: "Staff Platform Engineer",
        profileRoleType: "Engineering Leadership",
        experience: "8-12 years",
        workMode: "Hybrid",
        location: "Bengaluru",
        matchScore: "94% role match",
        credibility: "Verified employer and CTO-approved brief",
        workflow: "Architecture review -> systems interview -> exec close",
        focus: "Kubernetes reliability, platform governance, and developer productivity across multi-product teams.",
      },
      {
        id: 2,
        company: "Helio Metrics",
        role: "Senior Data Engineer",
        profileRoleType: "Data and Analytics",
        experience: "6-10 years",
        workMode: "Remote",
        location: "India",
        matchScore: "91% role match",
        credibility: "Verified employer with production scale proof points",
        workflow: "SQL case study -> pipeline deep dive -> hiring manager panel",
        focus: "Modern warehouse design, event pipelines, and stakeholder-ready metrics foundations.",
      },
    ],
  },
  {
    id: "product-design",
    title: "Product and Design",
    summary: "For PMs, design leaders, and product strategists shaping roadmap quality, customer insight, and execution clarity.",
    hiringLens: "High-signal roles call out ownership scope, decision rights, and the business problem behind the open headcount.",
    opportunities: [
      {
        id: 3,
        company: "Aster Loop",
        role: "Senior Product Manager, Growth Systems",
        profileRoleType: "Product Strategy",
        experience: "7-11 years",
        workMode: "Hybrid",
        location: "Mumbai",
        matchScore: "92% role match",
        credibility: "Verified employer with quarterly roadmap transparency",
        workflow: "Product case -> cross-functional panel -> founder conversation",
        focus: "Lifecycle growth, pricing experiments, and product-led expansion for B2B revenue teams.",
      },
      {
        id: 4,
        company: "Frame Commerce",
        role: "Lead Product Designer",
        profileRoleType: "Design Leadership",
        experience: "6-9 years",
        workMode: "Remote",
        location: "APAC",
        matchScore: "89% role match",
        credibility: "Verified design org with portfolio-based screening",
        workflow: "Portfolio review -> systems critique -> VP Design round",
        focus: "Complex workflow UX, design systems maturity, and decision support for enterprise buyers.",
      },
    ],
  },
  {
    id: "gtm-operations",
    title: "Go-To-Market, Operations and People",
    summary: "For revenue, finance, operations, HR, and talent professionals who improve hiring quality and business execution.",
    hiringLens: "Smart separation by profile role helps companies hire operators with the right domain rhythm, not generic resumes.",
    opportunities: [
      {
        id: 5,
        company: "Veritas Health",
        role: "Revenue Operations Manager",
        profileRoleType: "Business Operations",
        experience: "5-9 years",
        workMode: "Hybrid",
        location: "Delhi NCR",
        matchScore: "90% role match",
        credibility: "Verified employer with CFO and CRO sponsorship",
        workflow: "Dashboard scenario -> stakeholder panel -> business case debrief",
        focus: "Forecast hygiene, funnel analytics, and tooling alignment across sales, marketing, and finance.",
      },
      {
        id: 6,
        company: "PeopleGrid Labs",
        role: "Senior Talent Partner",
        profileRoleType: "Recruitment and People",
        experience: "7-10 years",
        workMode: "On-site",
        location: "Pune",
        matchScore: "88% role match",
        credibility: "Verified employer with structured hiring scorecards",
        workflow: "Role calibration -> talent strategy round -> leadership sign-off",
        focus: "Senior hiring design, recruiter enablement, and stakeholder-driven workforce planning.",
      },
    ],
  },
  {
    id: "leadership-strategy",
    title: "Leadership and Strategy",
    summary: "For directors, heads, chiefs, and functional leaders trusted with growth, transformation, and cross-business outcomes.",
    hiringLens: "Executive roles surface mandate clarity, board visibility, and business impact expectations before outreach begins.",
    opportunities: [
      {
        id: 7,
        company: "Atlas Capital Systems",
        role: "Director of Strategic Partnerships",
        profileRoleType: "Leadership",
        experience: "10-15 years",
        workMode: "Hybrid",
        location: "Singapore",
        matchScore: "93% role match",
        credibility: "Verified employer with board-level sponsorship",
        workflow: "Market mapping -> leadership panel -> final business alignment",
        focus: "Ecosystem partnerships, enterprise negotiation, and channel-led market expansion.",
      },
      {
        id: 8,
        company: "Praxis Mobility",
        role: "Head of Business Finance",
        profileRoleType: "Finance Leadership",
        experience: "10-14 years",
        workMode: "Hybrid",
        location: "Bengaluru",
        matchScore: "90% role match",
        credibility: "Verified employer with audited growth metrics",
        workflow: "Strategic case -> CEO and CFO panel -> operating plan review",
        focus: "Financial planning, decision support, and profitability modeling for multi-market scale.",
      },
    ],
  },
];

const discoveryOptions: DiscoveryOption[] = [
  {
    id: "founder",
    label: "Founders",
    summary: "Hire fast, meet investors, and discover operators who understand zero-to-one execution.",
  },
  {
    id: "investor",
    label: "Investors",
    summary: "Find startups raising, map founder momentum, and keep warm deal flow in one lane.",
  },
  {
    id: "job_seeker",
    label: "Job seekers",
    summary: "Swipe through credible jobs with stage, scope, and working style visible up front.",
  },
  {
    id: "recruiter",
    label: "Recruiters",
    summary: "Surface verified talent pools and spot professionals who fit your hiring brief faster.",
  },
  {
    id: "advisor",
    label: "Advisors",
    summary: "Meet founders, investors, and teams looking for strategic support with real context.",
  },
];

function getAudienceTheme(audience: ProlinkAudience) {
  switch (audience) {
    case "founder":
      return {
        panelClassName: "bg-gradient-to-br from-[#111827] via-[#1d4ed8] to-[#020617]",
        badgeClassName: "border-white/15 bg-white/10 text-white/85",
      };
    case "investor":
      return {
        panelClassName: "bg-gradient-to-br from-[#052e16] via-[#15803d] to-[#022c22]",
        badgeClassName: "border-white/15 bg-emerald-500/20 text-white/85",
      };
    case "job_seeker":
      return {
        panelClassName: "bg-gradient-to-br from-[#312e81] via-[#0f766e] to-[#111827]",
        badgeClassName: "border-white/15 bg-cyan-400/20 text-white/85",
      };
    case "recruiter":
      return {
        panelClassName: "bg-gradient-to-br from-[#3f3f46] via-[#ea580c] to-[#111827]",
        badgeClassName: "border-white/15 bg-orange-400/20 text-white/85",
      };
    case "advisor":
    default:
      return {
        panelClassName: "bg-gradient-to-br from-[#1f2937] via-[#be123c] to-[#4c1d95]",
        badgeClassName: "border-white/15 bg-fuchsia-400/20 text-white/85",
      };
  }
}

function getProlinkItemTypeLabel(itemType: ProlinkFeedItem["item_type"]) {
  switch (itemType) {
    case "person":
      return "People";
    case "event":
      return "Event";
    case "job":
      return "Job";
    case "service":
      return "Service";
    case "marketplace":
      return "Marketplace";
    case "post":
      return "Post";
    case "investment":
      return "Investment";
    case "founder_ask":
      return "Founder ask";
  }
}

function getProlinkPrimaryAction(item: ProlinkFeedItem) {
  if (item.cta_url && item.cta_url !== "/explore") {
    return {
      label: item.cta_label,
      to: item.cta_url,
    };
  }

  switch (item.item_type) {
    case "person":
      return { label: "Start intro chat", to: "/messages" };
    case "job":
      return { label: "Ask about role", to: "/messages" };
    case "event":
      return { label: "Message organizer", to: "/messages" };
    case "service":
      return { label: "Start chat", to: "/messages" };
    case "marketplace":
      return { label: "Ask for details", to: "/messages" };
    case "post":
      return { label: "Reply in chat", to: "/messages" };
    case "investment":
      return { label: "Request intro", to: "/messages" };
    case "founder_ask":
      return { label: "Offer help", to: "/messages" };
  }
}

function ProlinkFeedCard({ item }: { item: ProlinkFeedItem }) {
  const theme = getAudienceTheme(item.primary_audience);
  const primaryAction = getProlinkPrimaryAction(item);
  const sponsorName = item.sponsor_name || item.company_name || item.author_name || "Verified advertiser";

  return (
    <article
      className={`relative isolate min-h-[70vh] overflow-hidden rounded-[32px] p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.22)] md:min-h-[72vh] md:p-8 ${theme.panelClassName}`}
    >
      {item.media_url ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url("${item.media_url}")` }}
          aria-hidden="true"
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.2),rgba(2,6,23,0.82))]" />
      <div className="absolute -right-16 top-10 h-40 w-40 rounded-full border border-white/10 bg-white/5 blur-2xl" />
      <div className="absolute -bottom-12 left-8 h-36 w-36 rounded-full border border-white/10 bg-black/10 blur-2xl" />

      <div className="relative flex h-full min-w-0 flex-col justify-between">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {item.is_sponsored ? (
              <span className="rounded-full border border-amber-200/40 bg-amber-300/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-50">
                {item.sponsorship_label || "Sponsored"}
              </span>
            ) : null}
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${theme.badgeClassName}`}>
              {getProlinkItemTypeLabel(item.item_type)}
            </span>
            <span className="rounded-full border border-white/15 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              {item.primary_audience.replace("_", " ")}
            </span>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {[...item.secondary_audiences.slice(0, 2), item.intent_type].map((value) => (
              <span
                key={`${item.id}-${value}`}
                className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/75"
              >
                {value.replace("_", " ")}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-12 min-w-0 max-w-3xl">
          <h3 className="break-words text-[28px] font-bold leading-tight sm:text-[32px] md:text-[42px]">{item.headline}</h3>
          <p className="mt-5 max-w-2xl break-words text-[15px] leading-7 text-white/85 md:text-[16px]">{item.description}</p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="min-w-0 rounded-[28px] border border-white/10 bg-black/15 p-5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              {item.is_sponsored ? "Sponsored recommendation" : "Why this is relevant"}
            </p>
            <p className="mt-4 text-[14px] leading-7 text-white/85">{item.ai_summary}</p>
            {item.is_sponsored ? (
              <p className="mt-3 text-[12px] leading-6 text-white/70">
                Promoted by {sponsorName}. This placement is still ranked against your selected lanes and profile signals.
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {[...item.topic_tags, ...item.skill_tags].slice(0, 6).map((tag) => (
                <span
                  key={`${item.id}-${tag}`}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-medium text-white/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              {item.is_sponsored ? "Promoted action" : "Next action"}
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-[14px] leading-6 text-white/80">
                <p className="font-semibold text-white">{item.company_name || item.author_name || "Luminas network"}</p>
                <p className="mt-1">{item.location}</p>
                {item.is_sponsored ? <p className="mt-1 text-white/70">Sponsored by {sponsorName}</p> : null}
              </div>
              <Link
                to={primaryAction.to}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-white px-5 text-center text-sm font-semibold leading-tight text-[#111827] transition hover:bg-white/90"
              >
                {primaryAction.label}
              </Link>
              <Link
                to="/settings"
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-white/15 bg-black/10 px-5 text-center text-sm font-semibold leading-tight text-white transition hover:bg-white/10"
              >
                Refine my feed
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  return (
    <article className="rounded-3xl border border-ig-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
          {opportunity.profileRoleType}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-700">
          {opportunity.matchScore}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-ig-subtle">{opportunity.company}</p>
        <h3 className="mt-1 text-[22px] font-semibold leading-tight text-ig-text">{opportunity.role}</h3>
        <p className="mt-2 text-[14px] leading-6 text-ig-subtle">{opportunity.focus}</p>
      </div>

      <dl className="mt-5 grid gap-3 text-[14px] text-ig-text sm:grid-cols-2">
        <div className="rounded-2xl bg-[#f6f7f8] p-3">
          <dt className="text-[12px] font-medium uppercase tracking-[0.14em] text-ig-subtle">Experience</dt>
          <dd className="mt-1 font-semibold">{opportunity.experience}</dd>
        </div>
        <div className="rounded-2xl bg-[#f6f7f8] p-3">
          <dt className="text-[12px] font-medium uppercase tracking-[0.14em] text-ig-subtle">Location</dt>
          <dd className="mt-1 font-semibold">
            {opportunity.location} · {opportunity.workMode}
          </dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3 text-[14px] leading-6 text-ig-subtle">
        <p>
          <span className="font-semibold text-ig-text">Credibility:</span> {opportunity.credibility}
        </p>
        <p>
          <span className="font-semibold text-ig-text">Workflow:</span> {opportunity.workflow}
        </p>
      </div>
    </article>
  );
}

function ProfessionalProlinkPage() {
  return (
    <div className="mx-auto max-w-[1120px] px-3 pb-10 pt-4 md:pt-8">
      <section className="rounded-[32px] border border-ig-border bg-gradient-to-br from-[#111827] via-[#1f2937] to-[#0f172a] p-6 text-white md:p-8">
        <div className="max-w-3xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/70">Prolink</p>
          <h1 className="mt-3 text-[32px] font-bold leading-tight md:text-[42px]">
            Experienced professionals hiring, separated by profile role type.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/80 md:text-[16px]">
            A business-focused job ecosystem where verified companies post only high-trust opportunities for proven
            professionals. Freshers are intentionally out of scope for this version so matching stays sharp, relevant,
            and credibility-led.
          </p>
          <div className="mt-6">
            <Link
              to="/create/job"
              className="inline-flex min-h-[64px] items-center justify-center rounded-2xl bg-white px-8 text-[18px] font-semibold text-[#111827] shadow-lg transition hover:bg-white/90"
            >
              Post your job
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {platformSignals.map((signal) => (
            <div key={signal.title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-[16px] font-semibold">{signal.title}</h2>
              <p className="mt-2 text-[14px] leading-6 text-white/75">{signal.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-[28px] border border-ig-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ig-subtle">Why this works</p>
              <h2 className="mt-2 text-[24px] font-semibold text-ig-text">Smarter quality hiring for serious roles</h2>
            </div>
            <span className="rounded-full bg-[#f4f5f6] px-3 py-1 text-[12px] font-medium text-ig-subtle">
              No fresher traffic
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {hiringWorkflowStandards.map((item) => (
              <div key={item} className="rounded-2xl bg-[#f8f9fa] p-4 text-[14px] leading-6 text-ig-subtle">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-ig-border bg-white p-6 shadow-sm">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ig-subtle">Platform rules</p>
          <div className="mt-4 space-y-4">
            <div>
              <h2 className="text-[16px] font-semibold text-ig-text">Employer trust</h2>
              <p className="mt-1 text-[14px] leading-6 text-ig-subtle">
                Company profiles are expected to show ownership, hiring context, and decision-maker visibility.
              </p>
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-ig-text">Candidate fit</h2>
              <p className="mt-1 text-[14px] leading-6 text-ig-subtle">
                Every role is written for proven professionals with meaningful execution history, not entry-level intake.
              </p>
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-ig-text">Business workflow</h2>
              <p className="mt-1 text-[14px] leading-6 text-ig-subtle">
                Listings expose the interview path early so recruiters, hiring managers, and candidates stay aligned.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-6">
        {roleLanes.map((lane) => (
          <div key={lane.id} className="rounded-[30px] border border-ig-border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-ig-border pb-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ig-subtle">Profile role type</p>
                <h2 className="mt-2 text-[28px] font-semibold text-ig-text">{lane.title}</h2>
                <p className="mt-2 text-[15px] leading-7 text-ig-subtle">{lane.summary}</p>
              </div>
              <p className="max-w-md text-[14px] leading-6 text-ig-subtle">{lane.hiringLens}</p>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {lane.opportunities.map((opportunity) => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function DiscoveryProlinkPage({ authUser }: { authUser: AuthUser }) {
  const [selectedAudiences, setSelectedAudiences] = useState<ProlinkAudience[]>(() =>
    deriveInitialProlinkAudienceSelection(authUser),
  );
  const [feedItems, setFeedItems] = useState<ProlinkFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setSelectedAudiences(deriveInitialProlinkAudienceSelection(authUser));
  }, [authUser]);

  const selectedAudienceSet = useMemo(() => new Set(selectedAudiences), [selectedAudiences]);
  const allAudiences = useMemo(() => getAllProlinkAudiences(), []);
  const isShowingAll = selectedAudiences.length === 0 || selectedAudiences.length === allAudiences.length;
  const relevantFeedItems = useMemo(
    () => selectRelevantProlinkFeedItems(feedItems, authUser, selectedAudiences, 24),
    [authUser, feedItems, selectedAudiences],
  );
  const selectedAudienceSummary = isShowingAll
    ? "Showing a broad ranked mix."
    : `${selectedAudiences.length} lane${selectedAudiences.length === 1 ? "" : "s"} tuned.`;
  const currentRoleLabel = authUser.professional_role?.trim() || "Member";

  useEffect(() => {
    let isCancelled = false;

    async function loadInitialFeed() {
      try {
        setIsLoading(true);
        const nextItems: ProlinkFeedItem[] = await listProlinkFeedItems(90);

        if (isCancelled) {
          return;
        }

        setFeedItems(nextItems);
        setNextCursor(nextItems.length > 0 ? nextItems[nextItems.length - 1]?.published_at ?? null : null);
        setHasMore(nextItems.length >= 90);
        setErrorMessage("");
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load the ProLink feed right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialFeed();

    return () => {
      isCancelled = true;
    };
  }, []);

  function toggleAudience(audience: ProlinkAudience) {
    setSelectedAudiences((current) =>
      current.includes(audience) ? current.filter((item) => item !== audience) : [...current, audience],
    );
  }

  async function loadMoreFeedItems() {
    if (!hasMore || !nextCursor || isLoadingMore) {
      return;
    }

    try {
      setIsLoadingMore(true);
      const nextItems: ProlinkFeedItem[] = await listProlinkFeedItems(60, nextCursor);
      const nextItemsById = new Set(feedItems.map((item) => item.id));
      const uniqueNextItems = nextItems.filter((item) => !nextItemsById.has(item.id));

      setFeedItems((current) => [...current, ...uniqueNextItems]);
      setNextCursor(nextItems.length > 0 ? nextItems[nextItems.length - 1]?.published_at ?? null : null);
      setHasMore(nextItems.length >= 60);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load more ProLink items right now.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] px-3 pb-10 pt-4 md:px-6 md:pt-8">
      <section className="overflow-hidden rounded-[32px] border border-ig-border bg-gradient-to-br from-[#111827] via-[#1f2937] to-[#020617] p-6 text-white shadow-sm md:p-8">
        <div className="min-w-0 max-w-4xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/70">Prolink discovery</p>
            <h1 className="mt-3 break-words text-[28px] font-bold leading-tight sm:text-[32px] md:text-[40px]">
              Choose the Prolink feed you want when your account is not in professional mode.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/80 md:text-[16px]">
              This version turns Prolink into an Instagram-style discovery stream: founders can hire and reach investors,
              investors can find startups, job seekers can discover roles, and every user can decide which lanes they want
              to see.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/settings"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-white px-6 text-[15px] font-semibold text-[#111827] transition hover:bg-white/90"
              >
                Update feed interests
              </Link>
              <Link
                to="/explore"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-[15px] font-semibold text-white transition hover:bg-white/10"
              >
                Open discovery
              </Link>
            </div>
            <div className="mt-4 overflow-x-auto pb-1">
              <div className="flex min-w-max flex-nowrap gap-3">
                <div className="flex items-center gap-2 whitespace-nowrap rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Current role</p>
                  <p className="text-[15px] font-semibold text-white md:text-[16px]">{currentRoleLabel}</p>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Account mode</p>
                  <p className="text-[15px] font-semibold text-white md:text-[16px]">Non-professional</p>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Feed status</p>
                  <p className="text-[15px] font-semibold text-white md:text-[16px]">{selectedAudienceSummary}</p>
                </div>
              </div>
            </div>
          </div>
      </section>

      <section className="mt-6">
        <div className="space-y-5">
          <div className="rounded-[28px] border border-ig-border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ig-subtle">Feed picker</p>
                <h2 className="mt-2 text-[26px] font-semibold text-ig-text">Only show the most relevant ProLink content</h2>
                <p className="mt-2 max-w-2xl text-[15px] leading-7 text-ig-subtle">
                  Pick one lane, mix multiple lanes, or keep everything on. The feed is ranked against the current profile,
                  preferred suggestions, and AI tags already stored on each ProLink item. Sponsored recommendations are
                  spaced into the stream only when they match those same signals.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAudiences(getAllProlinkAudiences())}
                className="inline-flex items-center justify-center rounded-2xl border border-ig-border px-4 py-2 text-sm font-semibold text-ig-text transition hover:bg-ig-bg"
              >
                Show all lanes
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {discoveryOptions.map((option) => {
                const isSelected = isShowingAll || selectedAudienceSet.has(option.id);

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleAudience(option.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isSelected ? "border-ig-link bg-ig-link text-white" : "border-ig-border bg-white text-ig-text hover:bg-ig-bg"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-5 lg:max-h-[calc(100vh-240px)] lg:overflow-y-auto lg:pr-2">
            {errorMessage ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
            ) : null}

            {isLoading ? (
              <div className="rounded-[28px] border border-ig-border bg-white p-6 text-sm text-ig-subtle shadow-sm">
                Loading AI-ranked ProLink reels...
              </div>
            ) : null}

            {!isLoading && !errorMessage && relevantFeedItems.length === 0 ? (
              <div className="rounded-[28px] border border-ig-border bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-ig-text">No ProLink feed yet</h3>
                <p className="mt-2 text-sm leading-6 text-ig-subtle">
                  Apply `supabase/sql/017_prolink_feed.sql`, `supabase/sql/018_seed_prolink_feed.sql`, and
                  `supabase/sql/019_seed_prolink_promotional_ads.sql` to load the AI-ranked non-professional feed.
                </p>
              </div>
            ) : null}

            {!isLoading && relevantFeedItems.map((item) => <ProlinkFeedCard key={item.id} item={item} />)}

            {!isLoading && !errorMessage && hasMore && feedItems.length > 0 ? (
              <button
                type="button"
                onClick={() => void loadMoreFeedItems()}
                disabled={isLoadingMore}
                className="inline-flex min-h-[56px] w-full items-center justify-center rounded-[24px] border border-ig-border bg-white px-5 text-sm font-semibold text-ig-text shadow-sm transition hover:bg-ig-bg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMore ? "Loading more..." : "Load more relevant reels"}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

type ReelsPageProps = {
  authUser: AuthUser;
};

export function ReelsPage({ authUser }: ReelsPageProps) {
  if (!authUser.is_professional_account) {
    return <DiscoveryProlinkPage authUser={authUser} />;
  }

  return <ProfessionalProlinkPage />;
}
