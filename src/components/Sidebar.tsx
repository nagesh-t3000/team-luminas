import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  IconCreate,
  IconDashboard,
  IconHome,
  IconMessage,
  IconReels,
  IconSearch,
} from "@/components/Icons";
import { currentUser } from "@/data/mockData";
import { clearStoredAuthUser, getAuthUserAvatarUrl, getStoredAuthUser } from "@/lib/appAuth";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-4 rounded-lg px-3 py-2.5 text-[16px] transition-colors hover:bg-black/5",
    isActive ? "font-bold" : "font-normal",
  ].join(" ");

export function Sidebar() {
  const navigate = useNavigate();
  const authUser = getStoredAuthUser();
  const profileUsername = authUser?.username || currentUser.username;
  const avatarUrl = getAuthUserAvatarUrl(authUser) || currentUser.avatarUrl;
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  function handleLogout() {
    clearStoredAuthUser();
    navigate("/auth", { replace: true });
  }

  return (
    <aside className="fixed bottom-0 top-0 z-30 hidden w-[244px] shrink-0 border-r border-ig-border bg-ig-surface md:flex md:flex-col">
      <div className="px-6 pb-4 pt-8">
        <span className="text-[32px] leading-none tracking-tight" style={{ fontFamily: '"Grand Hotel", cursive' }}>
          Luminas
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        <NavLink to="/" end className={linkClass}>
          {({ isActive }) => (
            <>
              <IconHome active={isActive} />
              <span>Home</span>
            </>
          )}
        </NavLink>
        <NavLink to="/explore" className={linkClass}>
          <>
            <IconSearch />
            <span>Discover</span>
          </>
        </NavLink>
        <NavLink to="/reels" className={linkClass}>
          <IconReels />
          <span>Prolink</span>
        </NavLink>
        <NavLink to="/messages" className={linkClass}>
          <IconMessage />
          <span>Messages</span>
        </NavLink>
        <NavLink to="/create" className={linkClass}>
          <IconCreate />
          <span>Create</span>
        </NavLink>
        <NavLink to="/dashboard" className={linkClass}>
          {({ isActive }) => (
            <>
              <IconDashboard active={isActive} />
              <span>Dashboard</span>
            </>
          )}
        </NavLink>
        <NavLink to={`/profile/${profileUsername}`} className={linkClass}>
          <span className="flex h-6 w-6 shrink-0 overflow-hidden rounded-full border border-ig-border">
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" width={24} height={24} />
          </span>
          <span>Profile</span>
        </NavLink>
      </nav>
      <div className="mt-auto px-3 pb-6">
        <button
          type="button"
          onClick={() => setIsMoreOpen((current) => !current)}
          className="flex w-full items-center gap-4 rounded-lg px-3 py-2.5 text-left text-[16px] hover:bg-black/5"
        >
          <span className="text-xl leading-none">☰</span>
          <span>More</span>
        </button>

        {isMoreOpen ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-ig-border bg-ig-surface shadow-sm">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-4 px-3 py-3 text-left text-[15px] text-red-600 transition-colors hover:bg-red-50"
            >
              <span className="text-xl leading-none">↩</span>
              <span>Log out</span>
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
