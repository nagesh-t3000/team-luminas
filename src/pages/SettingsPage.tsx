import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { currentUser } from "@/data/mockData";
import { getAuthUserAvatarUrl, persistAuthUserWithSettings, type AuthUser } from "@/lib/appAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type SettingsPageProps = {
  authUser: AuthUser;
  onSettingsUpdated: (user: AuthUser) => void;
};

const profileTypes = [
  "Founder",
  "Investor",
  "Job Seeker",
  "Operator",
  "Builder",
  "Designer",
  "Marketer",
  "Student",
  "Advisor",
  "Other",
] as const;

const suggestionRoles = [
  { id: "founder", label: "Founders" },
  { id: "investor", label: "Investors" },
  { id: "job_seeker", label: "Job seekers" },
  { id: "recruiter", label: "Recruiters" },
  { id: "advisor", label: "Advisors" },
] as const;

const MAX_PROFILE_PHOTO_DIMENSION = 512;
const MAX_PROFILE_PHOTO_DATA_URL_LENGTH = 200_000;

function parseDomains(value: string) {
  return value
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
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

  return fallbackMessage;
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read the selected image."));
    };

    image.src = objectUrl;
  });
}

async function fileToOptimizedDataUrl(file: File) {
  const image = await loadImageFromFile(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight, 1);
  const scale = Math.min(1, MAX_PROFILE_PHOTO_DIMENSION / longestSide);
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to process the selected image.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);

  if (!dataUrl) {
    throw new Error("Unable to process the selected image.");
  }

  if (dataUrl.length > MAX_PROFILE_PHOTO_DATA_URL_LENGTH) {
    throw new Error("Selected image is still too large to save. Choose a smaller photo.");
  }

  return dataUrl;
}

export function SettingsPage({ authUser, onSettingsUpdated }: SettingsPageProps) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(authUser.full_name ?? "");
  const [profileType, setProfileType] = useState(authUser.professional_role ?? "");
  const [bio, setBio] = useState(authUser.bio ?? "");
  const [domainInput, setDomainInput] = useState((authUser.skilled_domains ?? []).join(", "));
  const [preferredSuggestions, setPreferredSuggestions] = useState<string[]>(authUser.preferred_suggestions ?? []);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(getAuthUserAvatarUrl(authUser));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const parsedDomains = useMemo(() => parseDomains(domainInput), [domainInput]);

  function toggleSuggestionRole(roleId: string) {
    setPreferredSuggestions((current) =>
      current.includes(roleId) ? current.filter((role) => role !== roleId) : [...current, roleId],
    );
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    try {
      const dataUrl = await fileToOptimizedDataUrl(selectedFile);
      setProfilePhotoUrl(dataUrl);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to update your profile photo."));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fullName.trim()) {
      setErrorMessage("Full name is required.");
      return;
    }

    if (!profileType.trim()) {
      setErrorMessage("Choose a profile type.");
      return;
    }

    if (!supabase || !isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured yet. Update the anon key in .env.");
      return;
    }

    const normalizedProfilePhotoUrl = profilePhotoUrl?.trim() || null;

    if (
      normalizedProfilePhotoUrl &&
      normalizedProfilePhotoUrl.length > MAX_PROFILE_PHOTO_DATA_URL_LENGTH
    ) {
      setErrorMessage("Selected image is too large to save. Choose a smaller photo.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const updatedUser: AuthUser = {
        ...authUser,
        full_name: fullName.trim(),
        bio: bio.trim(),
        professional_role: profileType.trim(),
      };

      const profileUpdate = await supabase.rpc("complete_user_profile", {
        user_id_input: authUser.id,
        full_name_input: updatedUser.full_name,
        bio_input: updatedUser.bio ?? "",
        professional_role_input: updatedUser.professional_role ?? "",
      });

      if (profileUpdate.error) {
        throw profileUpdate.error;
      }

      const settingsUpdate = await supabase.rpc("upsert_user_settings", {
        user_id_input: authUser.id,
        profile_photo_url_input: normalizedProfilePhotoUrl,
        skilled_domains_input: parsedDomains,
        preferred_suggestions_input: preferredSuggestions,
      });

      if (settingsUpdate.error) {
        throw settingsUpdate.error;
      }

      const profileRecord = Array.isArray(profileUpdate.data) ? profileUpdate.data[0] : profileUpdate.data;

      if (!profileRecord) {
        throw new Error("No profile data was returned from Supabase.");
      }

      const syncedUser = await persistAuthUserWithSettings({
        ...authUser,
        ...profileRecord,
      });

      onSettingsUpdated(syncedUser);
      navigate(`/profile/${syncedUser.username}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to save your settings right now."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
      <div className="rounded-[28px] border border-ig-border bg-ig-surface p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 border-b border-ig-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-ig-border bg-ig-bg px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ig-link">
              Settings
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ig-text">Manage your profile</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ig-muted">
              Update your profile type, expert domains, profile photo, and the types of people Luminas should suggest to you.
            </p>
          </div>
          <Link
            to={`/profile/${authUser.username}`}
            className="inline-flex items-center justify-center rounded-xl border border-ig-border px-4 py-2 text-sm font-semibold text-ig-text transition hover:bg-ig-bg"
          >
            Back to profile
          </Link>
        </div>

        <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
          <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
            <div>
              <h2 className="text-lg font-semibold text-ig-text">Profile photo</h2>
              <p className="mt-2 text-sm leading-6 text-ig-muted">Upload a new photo to personalize your profile across the app.</p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <img
                  src={profilePhotoUrl || currentUser.avatarUrl}
                  alt=""
                  className="h-24 w-24 rounded-full object-cover"
                  width={96}
                  height={96}
                />
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-ig-link px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95">
                    Upload photo
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setProfilePhotoUrl(null)}
                    className="rounded-xl border border-ig-border px-4 py-2 text-sm font-semibold text-ig-text transition hover:bg-white"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="text-xs text-ig-muted">
                Uploaded photos are resized automatically before saving so they can be stored reliably in Supabase.
              </p>
            </div>
          </section>

          <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
            <div>
              <h2 className="text-lg font-semibold text-ig-text">Public profile</h2>
              <p className="mt-2 text-sm leading-6 text-ig-muted">Keep your identity, role, and domain expertise up to date.</p>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ig-text">Full name</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                  maxLength={80}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ig-text">Profile type</span>
                <select
                  value={profileType}
                  onChange={(event) => setProfileType(event.target.value)}
                  className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                  required
                >
                  <option value="">Select your profile type</option>
                  {profileTypes.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ig-text">Specific domains you are skilled in</span>
                <input
                  type="text"
                  value={domainInput}
                  onChange={(event) => setDomainInput(event.target.value)}
                  placeholder="AI infrastructure, fintech, product design, growth"
                  className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                />
                <p className="mt-2 text-xs text-ig-muted">Separate domains with commas. Up to 8 will be shown on your profile.</p>
                {parsedDomains.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {parsedDomains.map((domain) => (
                      <span key={domain} className="rounded-full border border-ig-border bg-white px-3 py-1 text-xs font-medium text-ig-text">
                        {domain}
                      </span>
                    ))}
                  </div>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ig-text">Bio</span>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Share what you build, invest in, recruit for, or want to learn next."
                  className="min-h-32 w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                  maxLength={280}
                />
              </label>
            </div>
          </section>

          <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
            <div>
              <h2 className="text-lg font-semibold text-ig-text">Preferred suggestions</h2>
              <p className="mt-2 text-sm leading-6 text-ig-muted">Choose which profile types you want Luminas to prioritize in your suggestions.</p>
            </div>
            <div>
              <div className="flex flex-wrap gap-3">
                {suggestionRoles.map((role) => {
                  const isSelected = preferredSuggestions.includes(role.id);

                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleSuggestionRole(role.id)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        isSelected ? "border-ig-link bg-ig-link text-white" : "border-ig-border bg-white text-ig-text hover:bg-ig-bg"
                      }`}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-ig-muted">
                Leave all unselected if you want to keep seeing a broad mix of founders, investors, recruiters, and advisors.
              </p>
            </div>
          </section>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              to={`/profile/${authUser.username}`}
              className="inline-flex items-center justify-center rounded-2xl border border-ig-border px-5 py-3 text-sm font-semibold text-ig-text transition hover:bg-ig-bg"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-2xl bg-ig-link px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
