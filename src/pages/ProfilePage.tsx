import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EventFeedCard } from "@/components/EventFeedCard";
import { IconSettings } from "@/components/Icons";
import { SkillPostCard } from "@/components/SkillPostCard";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { currentUser, posts, roleLabel, users } from "@/data/mockData";
import { listUserExperiencesByUsername, type UserExperience } from "@/lib/experiences";
import { listAuthoredExploreUpdates, type ExploreUpdate } from "@/lib/exploreUpdates";
import { getAuthUserAvatarUrl, getStoredAuthUser } from "@/lib/appAuth";
import { getConnectionCount, listConnectedUsernames, subscribeToConnections, toggleConnection } from "@/lib/connections";
import { getPublicUserByUsername, type PublicUser } from "@/lib/publicUsers";
import { listSavedProfileItems, subscribeToSavedProfileItems, type SavedProfileItem } from "@/lib/savedItems";
import { listSkillPostsByUsername, type SkillPost } from "@/lib/skillPosts";
import { listUserEvents } from "@/lib/userEvents";

type ProfileTab = "posts" | "experience" | "saved";

const experienceByRole = {
  founder: [
    {
      title: "Founder",
      org: "Luminas",
      period: "2024 - Present",
      summary: "Building a professional network for startup operators, investors, and talent.",
    },
    {
      title: "Product Lead",
      org: "VentureStack",
      period: "2021 - 2024",
      summary: "Led zero-to-one workflow launches for founder onboarding and investor matching.",
    },
  ],
  investor: [
    {
      title: "Partner",
      org: "Northvale Capital",
      period: "2022 - Present",
      summary: "Backing fintech and infrastructure teams from Series A through growth.",
    },
    {
      title: "Principal",
      org: "Atlas Ventures",
      period: "2019 - 2022",
      summary: "Focused on operator-led diligence and sourcing across developer tooling.",
    },
  ],
  job_seeker: [
    {
      title: "Staff Engineer",
      org: "Open to Work",
      period: "Now",
      summary: "Exploring backend and platform roles across remote-first product teams.",
    },
    {
      title: "Senior Software Engineer",
      org: "ScaleCloud",
      period: "2020 - 2024",
      summary: "Owned distributed systems migrations, internal platform tooling, and reliability work.",
    },
  ],
  recruiter: [
    {
      title: "Lead Recruiter",
      org: "TalentGrid",
      period: "2023 - Present",
      summary: "Hiring senior engineering, product, and GTM talent for venture-backed teams.",
    },
    {
      title: "Talent Partner",
      org: "HireLoop",
      period: "2019 - 2023",
      summary: "Built outbound pipelines and hiring processes for fast-growing startups.",
    },
  ],
  advisor: [
    {
      title: "Go-to-Market Advisor",
      org: "Sage Advisory",
      period: "2022 - Present",
      summary: "Helping startups sharpen activation, monetization, and pricing strategy.",
    },
    {
      title: "Growth Consultant",
      org: "Independent",
      period: "2018 - 2022",
      summary: "Worked with early-stage teams on experimentation frameworks and commercial strategy.",
    },
  ],
} as const;

function ProfileTabIcon({ tab }: { tab: ProfileTab }) {
  if (tab === "experience") {
    return (
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="7" width="18" height="12" rx="2" />
        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18" />
      </svg>
    );
  }

  if (tab === "saved") {
    return (
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

export function ProfilePage() {
  const { username } = useParams();
  const authUser = useMemo(() => getStoredAuthUser(), []);
  const viewerUsername = authUser?.username || currentUser.username;
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [skillPosts, setSkillPosts] = useState<SkillPost[]>([]);
  const [skillPostsError, setSkillPostsError] = useState("");
  const [authoredEvents, setAuthoredEvents] = useState<ExploreUpdate[]>([]);
  const [authoredEventsError, setAuthoredEventsError] = useState("");
  const [userExperiences, setUserExperiences] = useState<UserExperience[]>([]);
  const [userExperiencesError, setUserExperiencesError] = useState("");
  const [publicProfile, setPublicProfile] = useState<PublicUser | null>(null);
  const [connectedUsernames, setConnectedUsernames] = useState<string[]>([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const [isConnectionPending, setIsConnectionPending] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedProfileItem[]>(() => listSavedProfileItems());
  const isOwnProfile = username === viewerUsername;
  const matchedMockUser = useMemo(() => users.find((candidate) => candidate.username === username) ?? null, [username]);
  const fallbackUser = useMemo(
    () =>
      matchedMockUser ?? {
        id: "",
        username: username || currentUser.username,
        fullName: username || "Luminas member",
        avatarUrl: currentUser.avatarUrl,
        role: currentUser.role,
        headline: "",
      },
    [matchedMockUser, username],
  );
  const user = useMemo(() => {
    if (isOwnProfile && authUser) {
      return {
        ...currentUser,
        id: authUser.id,
        username: authUser.username,
        fullName: authUser.full_name?.trim() || currentUser.fullName,
        avatarUrl: getAuthUserAvatarUrl(authUser) || currentUser.avatarUrl,
        headline: authUser.bio?.trim() || currentUser.headline,
      };
    }

    if (publicProfile) {
      return {
        id: publicProfile.id,
        username: publicProfile.username,
        fullName: publicProfile.full_name?.trim() || publicProfile.username,
        avatarUrl: publicProfile.avatar_url,
        role: fallbackUser.role,
        headline: publicProfile.bio?.trim() || fallbackUser.headline,
      };
    }

    return fallbackUser;
  }, [authUser, fallbackUser, isOwnProfile, publicProfile]);
  const userPosts = posts.filter((p) => p.userId === user.id);
  const displayGrid = userPosts.map((p) => ({ id: p.id, src: p.imageUrl }));
  const seededExperienceEntries = matchedMockUser ? experienceByRole[matchedMockUser.role] : [];
  const displayRole =
    isOwnProfile && authUser?.professional_role?.trim()
      ? authUser.professional_role
      : publicProfile?.professional_role?.trim()
        ? publicProfile.professional_role
        : matchedMockUser
          ? roleLabel[matchedMockUser.role]
          : "";
  const skilledDomains = isOwnProfile ? authUser?.skilled_domains ?? [] : [];
  const totalPostCount = skillPosts.length + userPosts.length;
  const tabs: Array<{ id: ProfileTab; label: string }> = [
    { id: "posts", label: "Posts" },
    { id: "experience", label: "Experience" },
    { id: "saved", label: "Saved" },
  ];
  const displayExperienceEntries =
    userExperiences.length > 0
      ? userExperiences.map((entry) => ({
          title: entry.title,
          organization: entry.organization,
          period: entry.period,
          summary: entry.summary,
        }))
      : isOwnProfile
        ? []
        : seededExperienceEntries.map((entry) => ({
            title: entry.title,
            organization: entry.org,
            period: entry.period,
            summary: entry.summary,
          }));
  const isConnected = connectedUsernames.includes(user.username);
  const formattedConnectionCount = new Intl.NumberFormat("en-US").format(connectionCount);
  const isVerifiedProfile = isOwnProfile
    ? Boolean(authUser?.is_professional_account && authUser.human_verification_status === "verified")
    : Boolean(publicProfile?.is_verified);

  useEffect(() => {
    if (isOwnProfile || !username) {
      setPublicProfile(null);
      return;
    }

    let isCancelled = false;

    getPublicUserByUsername(username)
      .then((profile) => {
        if (!isCancelled) {
          setPublicProfile(profile);
        }
      })
      .catch((error) => {
        console.error("Failed to load public profile", error);

        if (!isCancelled) {
          setPublicProfile(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOwnProfile, username]);

  useEffect(() => {
    let isCancelled = false;

    const syncConnections = async () => {
      const [nextConnectedUsernames, nextConnectionCount] = await Promise.all([
        listConnectedUsernames(viewerUsername),
        getConnectionCount(user.username),
      ]);

      if (!isCancelled) {
        setConnectedUsernames(nextConnectedUsernames);
        setConnectionCount(nextConnectionCount);
      }
    };

    void syncConnections();

    const unsubscribe = subscribeToConnections(() => {
      void syncConnections();
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [user.username, viewerUsername]);

  useEffect(() => {
    let isCancelled = false;

    listSkillPostsByUsername(user.username, 20, authUser?.id)
      .then((nextPosts) => {
        if (!isCancelled) {
          setSkillPosts(nextPosts);
          setSkillPostsError("");
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setSkillPosts([]);
          setSkillPostsError(error instanceof Error ? error.message : "Unable to load skill posts right now.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [user.username]);

  useEffect(() => {
    let isCancelled = false;

    async function loadAuthoredEvents() {
      try {
        const nextEvents = isOwnProfile
          ? listUserEvents()
          : publicProfile?.id
            ? await listAuthoredExploreUpdates(publicProfile.id, "event", 20)
            : [];

        if (!isCancelled) {
          setAuthoredEvents(nextEvents);
          setAuthoredEventsError("");
        }
      } catch (error) {
        if (!isCancelled) {
          setAuthoredEvents([]);
          setAuthoredEventsError(error instanceof Error ? error.message : "Unable to load events right now.");
        }
      }
    }

    void loadAuthoredEvents();

    return () => {
      isCancelled = true;
    };
  }, [isOwnProfile, publicProfile?.id]);

  useEffect(() => {
    setSavedItems(listSavedProfileItems());

    const unsubscribe = subscribeToSavedProfileItems(() => {
      setSavedItems(listSavedProfileItems());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let isCancelled = false;

    listUserExperiencesByUsername(user.username, 20)
      .then((nextExperiences) => {
        if (!isCancelled) {
          setUserExperiences(nextExperiences);
          setUserExperiencesError("");
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setUserExperiences([]);
          setUserExperiencesError(error instanceof Error ? error.message : "Unable to load experiences right now.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [user.username]);

  async function handleToggleConnection() {
    if (isConnectionPending) {
      return;
    }

    setIsConnectionPending(true);

    const nextIsConnected = await toggleConnection(viewerUsername, user.username);
    const [nextConnectedUsernames, nextConnectionCount] = await Promise.all([
      listConnectedUsernames(viewerUsername),
      getConnectionCount(user.username),
    ]);

    setConnectedUsernames(
      nextConnectedUsernames.length > 0
        ? nextConnectedUsernames
        : nextIsConnected
          ? [user.username]
          : [],
    );
    setConnectionCount(nextConnectionCount);
    setIsConnectionPending(false);
  }

  return (
    <div className="relative mx-auto max-w-[935px] border-ig-border bg-ig-surface md:mt-6 md:rounded-lg md:border lg:max-w-[1015px]">
      {isOwnProfile ? (
        <Link
          to="/settings"
          aria-label="Open settings"
          className="absolute right-4 top-4 rounded-full border border-ig-border bg-white p-2 text-ig-text shadow-sm transition hover:bg-ig-bg md:right-8 md:top-8"
        >
          <IconSettings />
        </Link>
      ) : null}
      <div className="px-4 pb-4 pt-4 md:flex md:gap-8 md:px-8 md:py-8">
        <div className="flex justify-center md:block md:shrink-0">
          <img
            src={user.avatarUrl}
            alt=""
            className="h-[90px] w-[90px] rounded-full object-cover md:h-[150px] md:w-[150px]"
            width={150}
            height={150}
          />
        </div>
        <div className="mt-4 min-w-0 flex-1 md:mt-0">
          <div className="mb-4 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5">
                <h1 className="text-[20px] font-normal">{user.username}</h1>
                {isVerifiedProfile ? <VerifiedBadge size={18} /> : null}
              </span>
            </div>
            {!isOwnProfile ? (
              <div className="flex gap-2 md:ml-4">
                <button
                  type="button"
                  className={`rounded-lg px-4 py-1.5 text-[14px] font-semibold ${
                    isConnected ? "bg-ig-bg text-ig-text" : "bg-ig-link text-white"
                  }`}
                  onClick={() => void handleToggleConnection()}
                  disabled={isConnectionPending}
                >
                  {isConnected ? "Connected" : "Connect"}
                </button>
                <button type="button" className="rounded-lg bg-ig-bg px-4 py-1.5 text-[14px] font-semibold">
                  Message
                </button>
              </div>
            ) : null}
          </div>
          <div className="mb-4 hidden gap-10 text-[16px] md:flex">
            <span>
              <strong>{totalPostCount}</strong> posts
            </span>
            <span>
              <strong>{formattedConnectionCount}</strong> connections
            </span>
          </div>
          <div className="mb-1">
            <p className="text-[14px] font-semibold">{user.fullName}</p>
            <p className="text-[14px] text-ig-muted">{displayRole}</p>
          </div>
          {skilledDomains.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {skilledDomains.map((domain) => (
                <span key={domain} className="rounded-full border border-ig-border bg-ig-bg px-3 py-1 text-[12px] font-medium text-ig-text">
                  {domain}
                </span>
              ))}
            </div>
          ) : null}
          <p className="whitespace-pre-line text-[14px] leading-relaxed">{user.headline}</p>
          <a href="#" className="mt-1 text-[14px] font-semibold text-ig-link" onClick={(e) => e.preventDefault()}>
            luminas.app/{user.username}
          </a>
        </div>
      </div>
      <div className="flex justify-around border-t border-ig-border py-3 text-[14px] md:hidden">
        <span>
          <strong>{totalPostCount}</strong> posts
        </span>
        <span>
          <strong>{formattedConnectionCount}</strong> connections
        </span>
      </div>
      <div className="flex border-t border-ig-border">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              className={`flex flex-1 items-center justify-center gap-2 border-t py-3 text-[12px] font-semibold uppercase tracking-wide ${
                isActive ? "border-black text-ig-text" : "border-transparent text-ig-muted"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <ProfileTabIcon tab={tab.id} />
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab === "posts" ? (
        totalPostCount > 0 || authoredEvents.length > 0 || Boolean(skillPostsError) || Boolean(authoredEventsError) ? (
          <div className="px-4 py-4 md:px-6">
            {skillPostsError ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{skillPostsError}</div>
            ) : null}
            {authoredEventsError ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {authoredEventsError}
              </div>
            ) : null}
            {skillPosts.length > 0 ? (
              <div className="space-y-4">
                {skillPosts.map((post) => (
                  <SkillPostCard key={post.id} post={post} />
                ))}
              </div>
            ) : null}
            {authoredEvents.length > 0 ? (
              <div className={`space-y-4 ${skillPosts.length > 0 ? "mt-4" : ""}`}>
                {authoredEvents.map((event) => (
                  <EventFeedCard key={event.id} update={event} />
                ))}
              </div>
            ) : null}
            {displayGrid.length > 0 ? (
              <div className={`grid grid-cols-3 gap-[2px] md:gap-1 ${skillPosts.length > 0 || authoredEvents.length > 0 ? "mt-4" : ""}`}>
                {displayGrid.map((g) => (
                  <Link
                    key={g.id}
                    to="#"
                    className="relative aspect-square overflow-hidden bg-black/5"
                    onClick={(e) => e.preventDefault()}
                  >
                    <img src={g.src} alt="" className="h-full w-full object-cover" width={400} height={400} loading="lazy" />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="px-4 py-10 text-center md:px-6">
            <h2 className="text-[16px] font-semibold">No posts yet</h2>
            <p className="mt-2 text-[14px] text-ig-muted">
              {isOwnProfile ? "Create a skill post to start sharing what you know." : `${user.username} has not posted yet.`}
            </p>
            {isOwnProfile ? (
              <Link
                to="/create/post"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-ig-link px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Create skill post
              </Link>
            ) : null}
          </div>
        )
      ) : null}
      {activeTab === "experience" ? (
        displayExperienceEntries.length > 0 || Boolean(userExperiencesError) ? (
          <div className="space-y-3 px-4 py-4 md:px-6">
            {userExperiencesError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{userExperiencesError}</div>
            ) : null}
            {displayExperienceEntries.map((entry) => (
              <section key={`${entry.title}-${entry.organization}-${entry.period}`} className="rounded-xl border border-ig-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[15px] font-semibold">{entry.title}</h2>
                    <p className="text-[14px] text-ig-muted">{entry.organization}</p>
                  </div>
                  <span className="text-[12px] font-medium uppercase tracking-wide text-ig-muted">{entry.period}</span>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-ig-text">{entry.summary}</p>
              </section>
            ))}
          </div>
        ) : (
          <div className="px-4 py-10 text-center md:px-6">
            <h2 className="text-[16px] font-semibold">No experience added yet</h2>
            <p className="mt-2 text-[14px] text-ig-muted">
              {isOwnProfile ? "Add experience entries so visitors can understand your background." : `${user.username} has not added any experience yet.`}
            </p>
            {isOwnProfile ? (
              <Link
                to="/create/experience"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-ig-link px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Add experience
              </Link>
            ) : null}
          </div>
        )
      ) : null}
      {activeTab === "saved" ? (
        isOwnProfile ? (
          savedItems.length > 0 ? (
            <div className="space-y-4 px-4 py-4 md:px-6">
              {savedItems.map((item) =>
                item.kind === "skill_post" ? (
                  <SkillPostCard key={`skill-post-${item.post.id}`} post={item.post} />
                ) : (
                  <EventFeedCard key={`event-${item.event.id}`} update={item.event} />
                ),
              )}
            </div>
          ) : (
            <div className="px-4 py-10 text-center md:px-6">
              <h2 className="text-[16px] font-semibold">Nothing saved yet</h2>
              <p className="mt-2 text-[14px] text-ig-muted">
                Save posts and events to come back to them from your profile.
              </p>
            </div>
          )
        ) : (
          <div className="px-4 py-10 text-center md:px-6">
            <h2 className="text-[16px] font-semibold">Saved posts are private</h2>
            <p className="mt-2 text-[14px] text-ig-muted">Only {user.username} can view the content in this tab.</p>
          </div>
        )
      ) : null}
    </div>
  );
}
