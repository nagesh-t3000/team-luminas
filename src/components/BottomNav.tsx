import { NavLink } from "react-router-dom";
import { IconCreate, IconHome, IconReels, IconSearch } from "@/components/Icons";
import { currentUser } from "@/data/mockData";
import { getAuthUserAvatarUrl, getStoredAuthUser } from "@/lib/appAuth";

const item = "flex flex-1 flex-col items-center justify-center py-2 text-ig-text";

export function BottomNav() {
  const authUser = getStoredAuthUser();
  const profileUsername = authUser?.username || currentUser.username;
  const avatarUrl = getAuthUserAvatarUrl(authUser) || currentUser.avatarUrl;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-[50px] border-t border-ig-border bg-ig-surface md:hidden">
      <NavLink to="/" end className={({ isActive }) => `${item} ${isActive ? "opacity-100" : "opacity-90"}`}>
        {({ isActive }) => <IconHome active={isActive} />}
      </NavLink>
      <NavLink to="/explore" className={item} aria-label="Discover">
        <IconSearch />
      </NavLink>
      <NavLink to="/create" className={item} aria-label="Create">
        <IconCreate />
      </NavLink>
      <NavLink to="/reels" className={item} aria-label="Prolink">
        <IconReels />
      </NavLink>
      <NavLink to={`/profile/${profileUsername}`} className={item}>
        <span className="flex h-6 w-6 overflow-hidden rounded-full border border-ig-border">
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" width={24} height={24} />
        </span>
      </NavLink>
    </nav>
  );
}
