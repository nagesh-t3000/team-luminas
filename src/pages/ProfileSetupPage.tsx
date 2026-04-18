import { useMemo, useState } from "react";
import { setStoredAuthUser, type AuthUser } from "@/lib/appAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type ProfileSetupPageProps = {
  authUser: AuthUser;
  onProfileCompleted: (user: AuthUser) => void;
};

const professionalRoles = [
  "Founder",
  "Investor",
  "Job Seeker",
  "Operator",
  "Builder",
  "Designer",
  "Marketer",
  "Student",
  "Other",
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

  return "Unable to save your profile right now.";
}

export function ProfileSetupPage({
  authUser,
  onProfileCompleted,
}: ProfileSetupPageProps) {
  const [fullName, setFullName] = useState(authUser.full_name ?? "");
  const [professionalRole, setProfessionalRole] = useState(
    authUser.professional_role ?? "",
  );
  const [bio, setBio] = useState(authUser.bio ?? "");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const configMessage = useMemo(() => {
    if (isSupabaseConfigured) {
      return "";
    }

    return "Supabase is not configured yet. Add the anon key in .env first.";
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured yet. Update the anon key in .env.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("complete_user_profile", {
        user_id_input: authUser.id,
        full_name_input: fullName.trim(),
        bio_input: bio.trim(),
        professional_role_input: professionalRole,
      });

      if (error) {
        throw error;
      }

      const updatedUser = Array.isArray(data) ? data[0] : data;

      if (!updatedUser) {
        throw new Error("No profile data was returned from Supabase.");
      }

      setStoredAuthUser(updatedUser);
      onProfileCompleted(updatedUser);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ig-bg px-6 py-10">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-ig-border bg-ig-surface p-8 shadow-sm">
          <span className="inline-flex rounded-full border border-ig-border bg-ig-bg px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ig-link">
            Profile setup
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ig-text sm:text-5xl">
            Finish your Luminas profile before entering the app.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ig-muted">
            Your account exists, but your public profile still needs the basics:
            full name, a short bio, and your professional role.
          </p>

          <div className="mt-8 rounded-3xl border border-ig-border bg-ig-bg p-5">
            <h2 className="text-lg font-semibold text-ig-text">Preview</h2>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                  Username
                </p>
                <p className="mt-1 text-base font-semibold text-ig-text">
                  @{authUser.username}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                  Name
                </p>
                <p className="mt-1 text-base text-ig-text">
                  {fullName.trim() || "Your full name will appear here"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                  Role
                </p>
                <p className="mt-1 text-base text-ig-text">
                  {professionalRole || "Choose the role that fits you best"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ig-muted">
                  Bio
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ig-muted">
                  {bio.trim() || "Add a quick one or two sentence introduction."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-ig-border bg-ig-surface p-8 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-ig-text">
            Complete your profile
          </h2>
          <p className="mt-2 text-sm text-ig-muted">
            This only appears when your `full_name` is still missing.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ig-text">
                Full name
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Jane Founder"
                className="w-full rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                autoComplete="name"
                maxLength={80}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ig-text">
                Professional role
              </span>
              <select
                value={professionalRole}
                onChange={(event) => setProfessionalRole(event.target.value)}
                className="w-full rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                required
              >
                <option value="">Select a role</option>
                {professionalRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ig-text">
                Bio
              </span>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Tell the community what you are building, investing in, or looking for."
                className="min-h-32 w-full rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                maxLength={280}
                required
              />
            </label>

            {(errorMessage || configMessage) && (
              <div className="rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-muted">
                {errorMessage || configMessage}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-2xl bg-ig-link px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving profile..." : "Save and continue"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
