import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { currentUser } from "@/data/mockData";
import { getAuthUserAvatarUrl, getStoredAuthUser } from "@/lib/appAuth";
import { listConnectedUsernames, subscribeToConnections, toggleConnection } from "@/lib/connections";
import type { PublicUser } from "@/lib/publicUsers";

type SuggestionsProps = {
  users?: PublicUser[];
};

export function Suggestions({ users = [] }: SuggestionsProps) {
  const authUser = getStoredAuthUser();
  const profileUsername = authUser?.username || currentUser.username;
  const displayName = authUser?.full_name?.trim() || currentUser.fullName;
  const avatarUrl = getAuthUserAvatarUrl(authUser) || currentUser.avatarUrl;
  const isAuthUserVerified = Boolean(
    authUser?.is_professional_account && authUser.human_verification_status === "verified",
  );
  const [connectedUsernames, setConnectedUsernames] = useState<string[]>([]);
  const [pendingUsernames, setPendingUsernames] = useState<string[]>([]);
  const displayedSuggestions = users
    .filter((user) => user.username !== profileUsername)
    .slice(0, 5);
  const connectedUsernamesSet = useMemo(() => new Set(connectedUsernames), [connectedUsernames]);
  const pendingUsernamesSet = useMemo(() => new Set(pendingUsernames), [pendingUsernames]);

  useEffect(() => {
    let isCancelled = false;

    const syncConnections = async () => {
      const nextConnectedUsernames = await listConnectedUsernames(profileUsername);

      if (!isCancelled) {
        setConnectedUsernames(nextConnectedUsernames);
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
  }, [profileUsername]);

  async function handleToggleConnection(targetUsername: string) {
    if (pendingUsernamesSet.has(targetUsername)) {
      return;
    }

    setPendingUsernames((currentUsernames) => [...currentUsernames, targetUsername]);

    const isConnected = await toggleConnection(profileUsername, targetUsername);

    setConnectedUsernames((currentUsernames) =>
      isConnected
        ? Array.from(new Set([...currentUsernames, targetUsername]))
        : currentUsernames.filter((username) => username !== targetUsername),
    );
    setPendingUsernames((currentUsernames) => currentUsernames.filter((username) => username !== targetUsername));
  }

  return (
    <aside className="hidden w-[319px] shrink-0 py-8 pl-4 xl:block">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" width={56} height={56} />
          <div className="min-w-0">
            <span className="flex items-center gap-1.5">
              <Link to={`/profile/${profileUsername}`} className="block truncate text-[14px] font-semibold hover:text-ig-muted">
                {profileUsername}
              </Link>
              {isAuthUserVerified ? <VerifiedBadge size={14} /> : null}
            </span>
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
      {displayedSuggestions.length > 0 ? (
        <ul className="space-y-3">
          {displayedSuggestions.map((user) => (
            <li key={user.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <img src={user.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" width={32} height={32} />
                <div className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <Link to={`/profile/${user.username}`} className="block truncate text-[14px] font-semibold hover:text-ig-muted">
                      {user.username}
                    </Link>
                    {user.is_verified ? <VerifiedBadge size={14} /> : null}
                  </span>
                  <span className="block truncate text-[12px] text-ig-muted">
                    {user.professional_role || "Luminas member"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                  connectedUsernamesSet.has(user.username) ? "bg-ig-bg text-ig-text" : "text-ig-link"
                }`}
                onClick={() => void handleToggleConnection(user.username)}
                disabled={pendingUsernamesSet.has(user.username)}
              >
                {connectedUsernamesSet.has(user.username) ? "Connected" : "Connect"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ig-muted">No real users available yet.</p>
      )}
      <footer className="mt-8 space-y-3 text-[12px] text-ig-muted">
        <p className="leading-relaxed">
          About · Help · Press · API · Jobs · Privacy · Terms · Locations · Language · Meta Verified
        </p>
        <p>© 2026 Luminas</p>
      </footer>
    </aside>
  );
}
