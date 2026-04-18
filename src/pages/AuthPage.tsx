import { useEffect, useMemo, useState } from "react";
import {
  setStoredAuthUser,
  type AuthUser,
} from "@/lib/appAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthPageProps = {
  onAuthenticated: (user: AuthUser) => void;
};

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

  return "Unable to sign in or create an account right now.";
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);

  const configMessage = useMemo(() => {
    if (isSupabaseConfigured) {
      return "";
    }

    return "Add your Supabase anon key in .env to enable live auth and user lookup.";
  }, []);

  async function loadUsers() {
    if (!supabase || !isSupabaseConfigured) {
      setIsUsersLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("list_public_users", {
      limit_count: 6,
    });

    if (error) {
      console.error("Failed to load users", error);
      setErrorMessage("Could not load users from Supabase.");
    } else {
      setUsers(data ?? []);
    }

    setIsUsersLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured yet. Update the anon key in .env.");
      return;
    }

    setErrorMessage("");
    setInfoMessage("");
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("login_or_create_user", {
        identifier_input: identifier.trim(),
        password_input: password,
      });

      if (error) {
        throw error;
      }

      const authenticatedUser = Array.isArray(data) ? data[0] : data;

      if (!authenticatedUser) {
        throw new Error("No user data was returned from Supabase.");
      }

      setStoredAuthUser(authenticatedUser);
      onAuthenticated(authenticatedUser);
      await loadUsers();

      if (authenticatedUser.was_created) {
        setInfoMessage("New account created and saved to Supabase.");
        return;
      }

      setInfoMessage("Signed in successfully.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ig-bg">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-6 py-10 lg:flex-row lg:items-center lg:gap-14">
        <section className="w-full max-w-xl">
          <span className="inline-flex rounded-full border border-ig-border bg-ig-surface px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ig-link">
            Welcome back
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ig-text sm:text-5xl">
            Sign in before entering your Luminas home screen.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-ig-muted">
            Use any email address or username plus password to connect through
            Supabase. If the account does not exist yet, Luminas will create it
            directly in the database without sending confirmation emails or
            restricting company domains.
          </p>

          <div className="mt-8 rounded-3xl border border-ig-border bg-ig-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">Users preview</h2>
                <p className="mt-1 text-sm text-ig-muted">
                  Showing rows from the public `users` table.
                </p>
              </div>
              <span className="rounded-full bg-ig-bg px-3 py-1 text-xs font-medium text-ig-muted">
                {users.length} loaded
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {isUsersLoading ? (
                <p className="text-sm text-ig-muted">Loading users...</p>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-2xl border border-ig-border bg-ig-bg px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ig-text">
                        @{user.username}
                      </p>
                      <p className="truncate text-sm text-ig-muted">
                        {user.full_name || user.email}
                      </p>
                    </div>
                    <span className="ml-4 rounded-full bg-white px-3 py-1 text-xs text-ig-muted">
                      {user.professional_role || "user"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ig-muted">
                  No users found yet. Run the SQL file in Supabase and insert a few
                  rows to see them here.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="w-full max-w-md rounded-[32px] border border-ig-border bg-ig-surface p-8 shadow-sm">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-ig-text">
              Luminas
            </h2>
            <p className="mt-2 text-sm text-ig-muted">
              Login or create your account with any email to continue.
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ig-text">
                Username / Email
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Enter any email or username"
                className="w-full rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                autoComplete="username"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ig-text">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                className="w-full rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                autoComplete="current-password"
                required
              />
            </label>

            {(errorMessage || configMessage) && (
              <div className="rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-muted">
                {errorMessage || configMessage}
              </div>
            )}

            {infoMessage && (
              <div className="rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-text">
                {infoMessage}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-2xl bg-ig-link px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Checking account..." : "Login / Create account"}
            </button>
          </form>

          <div className="mt-6 rounded-2xl bg-ig-bg px-4 py-3 text-sm text-ig-muted">
            Supabase project: <span className="font-semibold text-ig-text">xwsfjqjqejqixcweiqzb</span>
          </div>
        </section>
      </div>
    </div>
  );
}
