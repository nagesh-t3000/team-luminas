import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { currentUser, posts, roleLabel, users } from "@/data/mockData";
import { getStoredAuthUser } from "@/lib/appAuth";

const grid = Array.from({ length: 9 }, (_, i) => ({
  id: i,
  src: `https://picsum.photos/seed/pg${i}/400/400`,
}));

export function ProfilePage() {
  const { username } = useParams();
  const authUser = useMemo(() => getStoredAuthUser(), []);
  const isOwnProfile = Boolean(authUser && username === authUser.username);
  const user = useMemo(() => {
    if (isOwnProfile && authUser) {
      return {
        ...currentUser,
        id: authUser.id,
        username: authUser.username,
        fullName: authUser.full_name?.trim() || currentUser.fullName,
        headline: authUser.bio?.trim() || currentUser.headline,
      };
    }

    return users.find((candidate) => candidate.username === username) ?? currentUser;
  }, [authUser, isOwnProfile, username]);
  const userPosts = posts.filter((p) => p.userId === user.id);
  const displayGrid = userPosts.length > 0 ? userPosts.map((p) => ({ id: p.id, src: p.imageUrl })) : grid;
  const displayRole =
    isOwnProfile && authUser?.professional_role?.trim()
      ? authUser.professional_role
      : roleLabel[user.role];

  return (
    <div className="mx-auto max-w-[935px] border-ig-border bg-ig-surface md:mt-6 md:rounded-lg md:border lg:max-w-[1015px]">
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
              <h1 className="text-[20px] font-normal">{user.username}</h1>
              {user.verified ? (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ig-link text-xs text-white" title="Verified">
                  ✓
                </span>
              ) : null}
            </div>
            <div className="flex gap-2 md:ml-4">
              <button type="button" className="rounded-lg bg-ig-link px-4 py-1.5 text-[14px] font-semibold text-white">
                Follow
              </button>
              <button type="button" className="rounded-lg bg-ig-bg px-4 py-1.5 text-[14px] font-semibold">
                Message
              </button>
            </div>
          </div>
          <div className="mb-4 hidden gap-10 text-[16px] md:flex">
            <span>
              <strong>{displayGrid.length}</strong> posts
            </span>
            <span>
              <strong>12.4k</strong> followers
            </span>
            <span>
              <strong>318</strong> following
            </span>
          </div>
          <div className="mb-1">
            <p className="text-[14px] font-semibold">{user.fullName}</p>
            <p className="text-[14px] text-ig-muted">{displayRole}</p>
          </div>
          <p className="whitespace-pre-line text-[14px] leading-relaxed">{user.headline}</p>
          <a href="#" className="mt-1 text-[14px] font-semibold text-ig-link" onClick={(e) => e.preventDefault()}>
            luminas.app/{user.username}
          </a>
        </div>
      </div>
      <div className="flex justify-around border-t border-ig-border py-3 text-[14px] md:hidden">
        <span>
          <strong>{displayGrid.length}</strong> posts
        </span>
        <span>
          <strong>12.4k</strong> followers
        </span>
        <span>
          <strong>318</strong> following
        </span>
      </div>
      <div className="flex border-t border-ig-border">
        <button type="button" className="flex flex-1 items-center justify-center gap-2 border-t border-black py-3 text-[12px] font-semibold uppercase tracking-wide">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          Posts
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 py-3 text-[12px] font-semibold uppercase tracking-wide text-ig-muted"
        >
          Reels
        </button>
      </div>
      <div className="grid grid-cols-3 gap-[2px] md:gap-1">
        {displayGrid.map((g) => (
          <Link key={g.id} to="#" className="relative aspect-square overflow-hidden bg-black/5" onClick={(e) => e.preventDefault()}>
            <img src={g.src} alt="" className="h-full w-full object-cover" width={400} height={400} loading="lazy" />
          </Link>
        ))}
      </div>
    </div>
  );
}
