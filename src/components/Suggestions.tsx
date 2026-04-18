import { Link } from "react-router-dom";
import { currentUser, suggestedUsers, roleLabel } from "@/data/mockData";
import { getStoredAuthUser } from "@/lib/appAuth";

export function Suggestions() {
  const authUser = getStoredAuthUser();
  const profileUsername = authUser?.username || currentUser.username;
  const displayName = authUser?.full_name?.trim() || currentUser.fullName;

  return (
    <aside className="hidden w-[319px] shrink-0 py-8 pl-4 xl:block">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={currentUser.avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" width={56} height={56} />
          <div className="min-w-0">
            <Link to={`/profile/${profileUsername}`} className="block truncate text-[14px] font-semibold hover:text-ig-muted">
              {profileUsername}
            </Link>
            <span className="block truncate text-[14px] text-ig-muted">{displayName}</span>
          </div>
        </div>
        <button type="button" className="shrink-0 text-[12px] font-semibold text-ig-link">
          Switch
        </button>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[14px] font-semibold text-ig-muted">Suggested for you</span>
        <button type="button" className="text-[12px] font-semibold text-ig-text">
          See All
        </button>
      </div>
      <ul className="space-y-3">
        {suggestedUsers.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <img src={u.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" width={32} height={32} />
              <div className="min-w-0">
                <Link to={`/profile/${u.username}`} className="block truncate text-[14px] font-semibold hover:text-ig-muted">
                  {u.username}
                </Link>
                <span className="block truncate text-[12px] text-ig-muted">{roleLabel[u.role]}</span>
              </div>
            </div>
            <button type="button" className="shrink-0 text-[12px] font-semibold text-ig-link">
              Follow
            </button>
          </li>
        ))}
      </ul>
      <footer className="mt-8 space-y-3 text-[12px] text-ig-muted">
        <p className="leading-relaxed">
          About · Help · Press · API · Jobs · Privacy · Terms · Locations · Language · Meta Verified
        </p>
        <p>© 2026 Luminas (demo UI — no backend)</p>
      </footer>
    </aside>
  );
}
