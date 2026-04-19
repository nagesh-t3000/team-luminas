import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconSparkles } from "@/components/Icons";
import { currentUser } from "@/data/mockData";
import { getAuthUserAvatarUrl, hasCompleteProfileBasics, persistAuthUserWithSettings, type AuthUser } from "@/lib/appAuth";
import {
  validateCompanyWebsite,
  type CompanyWebsiteVerificationResult,
} from "@/lib/companyWebsiteVerification";
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

const companyDomainOptions = [
  "Startup",
  "Fintech",
  "AI",
  "B2B SaaS",
  "Developer Tools",
  "Ecommerce",
  "Healthcare",
  "Edtech",
  "Climate",
  "Consumer",
  "Marketplace",
  "Enterprise Software",
] as const;

const MAX_PROFILE_PHOTO_DIMENSION = 512;
const MAX_PROFILE_PHOTO_DATA_URL_LENGTH = 200_000;
const MAX_SKILLED_DOMAINS = 8;
const MAX_COMPANY_DOMAINS = 1;
const MAX_COMPANY_WEBSITE_URL_LENGTH = 300;

function parseCommaSeparatedList(
  value: string,
  limit: number,
  normalizeItem: (item: string) => string = (item) => item.trim(),
) {
  const seen = new Set<string>();

  return value
    .split(",")
    .map((item) => normalizeItem(item))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    })
    .slice(0, limit);
}

function parseDomains(value: string) {
  return parseCommaSeparatedList(value, MAX_SKILLED_DOMAINS);
}

function normalizeCompanyDomains(domains: string[]) {
  const seen = new Set<string>();

  return domains
    .map((domain) => domain.trim())
    .filter(Boolean)
    .filter((domain) => {
      if (seen.has(domain)) {
        return false;
      }

      seen.add(domain);
      return true;
    })
    .slice(0, MAX_COMPANY_DOMAINS);
}

function normalizeCompanyWebsiteUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  const candidateUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;

  try {
    const parsedUrl = new URL(candidateUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Enter a valid company website URL.");
    }

    return parsedUrl.toString().slice(0, MAX_COMPANY_WEBSITE_URL_LENGTH);
  } catch {
    throw new Error("Enter a valid company website URL.");
  }
}

function buildCompanyWebsiteValidationKey(websiteUrl: string, companyDomains: string[]) {
  return websiteUrl ? `${websiteUrl}::${companyDomains.join("|").toLowerCase()}` : "";
}

function haveMatchingItems(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((item, index) => item === second[index]);
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

function trimTextToLength(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function buildAiProfileBio({
  fullName,
  profileType,
  skilledDomains,
  existingBio,
}: {
  fullName: string;
  profileType: string;
  skilledDomains: string[];
  existingBio: string;
}) {
  const name = fullName.trim();
  const role = profileType.trim();
  const skills = skilledDomains.slice(0, 3);
  const introParts = [
    role ? `I'm a ${role.toLowerCase()}` : "",
    skills.length > 0 ? `focused on ${skills.join(", ")}` : "",
  ].filter(Boolean);
  const intro = introParts.length > 0 ? `${introParts.join(" ")}.` : "";
  const collaborationLine =
    skills.length > 0
      ? ` I enjoy connecting with people working across ${skills.join(", ")}.`
      : " I enjoy connecting with thoughtful builders, operators, and collaborators.";

  if (existingBio.trim()) {
    const baseBio = existingBio.trim().replace(/\s+/g, " ");
    const enhancedBio = `${baseBio}${baseBio.endsWith(".") ? "" : "."}${collaborationLine}`;
    return trimTextToLength(enhancedBio, 280);
  }

  const lead = name ? `${name} here.` : "Here to connect.";
  return trimTextToLength(`${lead} ${intro}${collaborationLine}`.replace(/\s+/g, " ").trim(), 280);
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
  const [isProfessionalAccount, setIsProfessionalAccount] = useState(Boolean(authUser.is_professional_account));
  const [selectedCompanyDomain, setSelectedCompanyDomain] = useState(authUser.company_domains?.[0] ?? "");
  const [companyDomains, setCompanyDomains] = useState<string[]>(() => normalizeCompanyDomains(authUser.company_domains ?? []));
  const [companyWebsiteUrl, setCompanyWebsiteUrl] = useState(authUser.company_verification_website_url ?? "");
  const [preferredSuggestions, setPreferredSuggestions] = useState<string[]>(authUser.preferred_suggestions ?? []);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(getAuthUserAvatarUrl(authUser));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [websiteValidationState, setWebsiteValidationState] = useState<"idle" | "checking" | "complete" | "error">(
    "idle",
  );
  const [websiteValidationError, setWebsiteValidationError] = useState("");
  const [websiteValidationResult, setWebsiteValidationResult] = useState<CompanyWebsiteVerificationResult | null>(null);
  const [lastWebsiteValidationKey, setLastWebsiteValidationKey] = useState("");
  const websiteValidationRequestIdRef = useRef(0);

  const parsedDomains = useMemo(() => parseDomains(domainInput), [domainInput]);
  const normalizedCompanyDomains = useMemo(() => normalizeCompanyDomains(companyDomains), [companyDomains]);
  const savedCompanyDomains = useMemo(() => normalizeCompanyDomains(authUser.company_domains ?? []), [authUser.company_domains]);
  const normalizedCompanyWebsiteUrlForValidation = useMemo(() => {
    if (!isProfessionalAccount) {
      return "";
    }

    try {
      return normalizeCompanyWebsiteUrl(companyWebsiteUrl);
    } catch {
      return "";
    }
  }, [companyWebsiteUrl, isProfessionalAccount]);
  const companyWebsiteUrlInputError = useMemo(() => {
    if (!isProfessionalAccount || !companyWebsiteUrl.trim()) {
      return "";
    }

    try {
      normalizeCompanyWebsiteUrl(companyWebsiteUrl);
      return "";
    } catch (error) {
      return getErrorMessage(error, "Enter a valid company website URL.");
    }
  }, [companyWebsiteUrl, isProfessionalAccount]);
  const companyWebsiteValidationKey = useMemo(
    () => buildCompanyWebsiteValidationKey(normalizedCompanyWebsiteUrlForValidation, normalizedCompanyDomains),
    [normalizedCompanyDomains, normalizedCompanyWebsiteUrlForValidation],
  );
  const currentWebsiteValidationResult =
    companyWebsiteValidationKey && companyWebsiteValidationKey === lastWebsiteValidationKey ? websiteValidationResult : null;
  const companyVerificationStatus = authUser.company_verification_status ?? "required";
  const companyVerificationWebsiteUrl = authUser.company_verification_website_url?.trim() ?? "";
  const companyVerificationNotes = authUser.company_verification_review_notes?.trim() ?? "";
  const profileBasicsChecklist = useMemo(
    () => [
      { id: "name", label: "Name", isComplete: Boolean(fullName.trim()) },
      { id: "bio", label: "Bio", isComplete: Boolean(bio.trim()) },
      { id: "skills", label: "Skills", isComplete: parsedDomains.length > 0 },
    ],
    [bio, fullName, parsedDomains],
  );
  const canEnhanceProfileVisibility = profileBasicsChecklist.every((item) => item.isComplete);
  const savedProfileBasicsComplete = hasCompleteProfileBasics(authUser);
  const hasUnsavedVisibilityBasics =
    fullName.trim() !== (authUser.full_name?.trim() ?? "") ||
    bio.trim() !== (authUser.bio?.trim() ?? "") ||
    !haveMatchingItems(parsedDomains, authUser.skilled_domains ?? []);
  const needsProfessionalAccountForVisibility = !isProfessionalAccount;
  const hasUnsavedProfessionalAccountChange = isProfessionalAccount !== Boolean(authUser.is_professional_account);
  const hasUnsavedCompanyVerificationChange =
    hasUnsavedProfessionalAccountChange ||
    !haveMatchingItems(normalizedCompanyDomains, savedCompanyDomains) ||
    companyWebsiteUrl.trim() !== companyVerificationWebsiteUrl;
  const shouldAutoValidateCompanyWebsite = Boolean(
    isProfessionalAccount && normalizedCompanyWebsiteUrlForValidation && !companyWebsiteUrlInputError,
  );
  const visibilityStatus = authUser.human_verification_status ?? "required";
  const visibilityStatusLabel =
    visibilityStatus === "verified"
      ? "Verified"
      : visibilityStatus === "pending"
        ? "Pending review"
        : visibilityStatus === "failed"
          ? "Try again"
          : "Not started";
  const visibilityStatusClasses =
    visibilityStatus === "verified"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : visibilityStatus === "pending"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : visibilityStatus === "failed"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-amber-200 bg-amber-50 text-amber-700";
  const canEnhanceBioWithAi = Boolean(fullName.trim() || profileType.trim() || parsedDomains.length > 0 || bio.trim());
  const companyVerificationStatusLabel =
    companyVerificationStatus === "approved"
      ? "Approved"
      : companyVerificationStatus === "pending"
        ? "Pending review"
        : companyVerificationStatus === "rejected"
          ? "Needs updates"
          : "Not submitted";
  const companyVerificationStatusClasses =
    companyVerificationStatus === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : companyVerificationStatus === "pending"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : companyVerificationStatus === "rejected"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-amber-200 bg-amber-50 text-amber-700";

  useEffect(() => {
    if (!shouldAutoValidateCompanyWebsite) {
      websiteValidationRequestIdRef.current += 1;
      setWebsiteValidationState("idle");
      setWebsiteValidationError("");
      setWebsiteValidationResult(null);
      setLastWebsiteValidationKey("");
      return;
    }

    if (currentWebsiteValidationResult) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const requestId = websiteValidationRequestIdRef.current + 1;
      websiteValidationRequestIdRef.current = requestId;
      setWebsiteValidationState("checking");
      setWebsiteValidationError("");

      try {
        const result = await validateCompanyWebsite({
          companyDomains: normalizedCompanyDomains,
          websiteUrl: normalizedCompanyWebsiteUrlForValidation,
        });

        if (websiteValidationRequestIdRef.current !== requestId) {
          return;
        }

        setWebsiteValidationResult(result);
        setLastWebsiteValidationKey(companyWebsiteValidationKey);
        setWebsiteValidationState("complete");
      } catch (error) {
        if (websiteValidationRequestIdRef.current !== requestId) {
          return;
        }

        setWebsiteValidationResult(null);
        setLastWebsiteValidationKey("");
        setWebsiteValidationState("error");
        setWebsiteValidationError(getErrorMessage(error, "Unable to validate the website right now."));
      }
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    currentWebsiteValidationResult,
    normalizedCompanyDomains,
    normalizedCompanyWebsiteUrlForValidation,
    shouldAutoValidateCompanyWebsite,
  ]);

  function toggleSuggestionRole(roleId: string) {
    setPreferredSuggestions((current) =>
      current.includes(roleId) ? current.filter((role) => role !== roleId) : [...current, roleId],
    );
  }

  function addCompanyDomain(domain: string) {
    const normalizedDomain = domain.trim();

    if (!normalizedDomain) {
      return;
    }

    setCompanyDomains([normalizedDomain]);
    setSelectedCompanyDomain(normalizedDomain);
    setErrorMessage("");
  }

  function removeCompanyDomain(domain: string) {
    setCompanyDomains((current) => current.filter((item) => item !== domain));
    setSelectedCompanyDomain("");
  }

  function handleEnhanceBioWithAi() {
    if (!canEnhanceBioWithAi) {
      setErrorMessage("Add your name, profile type, skills, or an existing bio before using AI.");
      return;
    }

    setBio(
      buildAiProfileBio({
        fullName,
        profileType,
        skilledDomains: parsedDomains,
        existingBio: bio,
      }),
    );
    setErrorMessage("");
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

    if (isProfessionalAccount && normalizedCompanyDomains.length === 0) {
      setErrorMessage("Add at least one company domain for a professional account.");
      return;
    }

    let normalizedCompanyWebsiteUrl = "";

    try {
      normalizedCompanyWebsiteUrl = isProfessionalAccount ? normalizeCompanyWebsiteUrl(companyWebsiteUrl) : "";
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Enter a valid company website URL."));
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
        is_professional_account: isProfessionalAccount,
        company_domains: isProfessionalAccount ? normalizedCompanyDomains : [],
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
        is_professional_account_input: isProfessionalAccount,
        company_domains_input: isProfessionalAccount ? normalizedCompanyDomains : [],
        preferred_suggestions_input: preferredSuggestions,
      });

      if (settingsUpdate.error) {
        throw settingsUpdate.error;
      }

      if (hasUnsavedCompanyVerificationChange) {
        const companyVerificationUpdate = await supabase.rpc("sync_company_verification_profile", {
          user_id_input: authUser.id,
          is_professional_account_input: isProfessionalAccount,
          company_domains_input: isProfessionalAccount ? normalizedCompanyDomains : [],
          company_verification_website_url_input: normalizedCompanyWebsiteUrl || null,
        });

        if (companyVerificationUpdate.error) {
          throw companyVerificationUpdate.error;
        }

        if (isProfessionalAccount && normalizedCompanyDomains.length > 0 && normalizedCompanyWebsiteUrl) {
          const validationResult =
            currentWebsiteValidationResult && currentWebsiteValidationResult.checkedUrl === normalizedCompanyWebsiteUrl
              ? currentWebsiteValidationResult
              : await validateCompanyWebsite({
                  companyDomains: normalizedCompanyDomains,
                  websiteUrl: normalizedCompanyWebsiteUrl,
                });

          const appliedCompanyVerificationResult = await supabase.rpc("apply_company_website_verification_result", {
            user_id_input: authUser.id,
            company_verification_website_url_input: validationResult.checkedUrl,
            company_verification_status_input: validationResult.status,
            company_verification_review_notes_input: validationResult.reviewNotes,
            company_verified_at_input: validationResult.status === "approved" ? validationResult.checkedAt : null,
          });

          if (appliedCompanyVerificationResult.error) {
            throw appliedCompanyVerificationResult.error;
          }

          setWebsiteValidationResult(validationResult);
          setLastWebsiteValidationKey(companyWebsiteValidationKey);
          setWebsiteValidationState("complete");
          setWebsiteValidationError("");
        }
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
              <p className="mt-2 text-sm leading-6 text-ig-muted">
                Keep your identity, role, and domain expertise up to date.
              </p>
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

              <section className="rounded-2xl border border-ig-border bg-white p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-xl">
                    <h3 className="text-sm font-semibold text-ig-text">Professional account</h3>
                    <p className="mt-1 text-sm leading-6 text-ig-muted">
                      Turn this on for company-backed profiles. Company focus areas stay separate from your personal
                      skill domains.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-3 self-start">
                    <input
                      type="checkbox"
                      checked={isProfessionalAccount}
                      onChange={(event) => setIsProfessionalAccount(event.target.checked)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-ig-text">
                      {isProfessionalAccount ? "Enabled" : "Disabled"}
                    </span>
                    <span
                      className={`relative h-7 w-12 rounded-full transition ${
                        isProfessionalAccount ? "bg-ig-link" : "bg-ig-border"
                      }`}
                    >
                      <span
                        className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition ${
                          isProfessionalAccount ? "translate-x-5" : ""
                        }`}
                      />
                    </span>
                  </label>
                </div>

                {isProfessionalAccount ? (
                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ig-text">Company domain</span>
                      <select
                        value={selectedCompanyDomain}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSelectedCompanyDomain(value);

                          if (value) {
                            addCompanyDomain(value);
                          }
                        }}
                        className="w-full rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                      >
                        <option value="">Select a company domain</option>
                        {companyDomainOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs text-ig-muted">
                      Choose 1 company domain for your professional account.
                    </p>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ig-text">Company website</span>
                      <input
                        type="url"
                        value={companyWebsiteUrl}
                        onChange={(event) => setCompanyWebsiteUrl(event.target.value)}
                        placeholder="https://example.com"
                        className="w-full rounded-2xl border border-ig-border bg-ig-bg px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                      />
                      <p className="mt-2 text-xs text-ig-muted">
                        Luminas checks this website within seconds using AI. It looks for a real company presence,
                        relevant business details, and enough public information to support profile verification.
                      </p>
                    </label>
                    <div className="rounded-2xl border border-ig-border bg-white px-4 py-3">
                      {!companyWebsiteUrl.trim() ? (
                        <p className="text-sm text-ig-muted">
                          Add a valid public website URL to start the automated company check.
                        </p>
                      ) : companyWebsiteUrlInputError ? (
                        <p className="text-sm text-red-700">{companyWebsiteUrlInputError}</p>
                      ) : websiteValidationState === "checking" ? (
                        <p className="text-sm text-sky-700">
                          Checking the website now. This usually takes a few seconds.
                        </p>
                      ) : websiteValidationState === "error" ? (
                        <p className="text-sm text-red-700">{websiteValidationError}</p>
                      ) : currentWebsiteValidationResult ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                                currentWebsiteValidationResult.status === "approved"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : currentWebsiteValidationResult.status === "rejected"
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : "border-sky-200 bg-sky-50 text-sky-700"
                              }`}
                            >
                              {currentWebsiteValidationResult.status === "approved"
                                ? "AI approved"
                                : currentWebsiteValidationResult.status === "rejected"
                                  ? "AI rejected"
                                  : "AI pending"}
                            </span>
                            <p className="text-xs uppercase tracking-[0.18em] text-ig-muted">
                              Confidence: {currentWebsiteValidationResult.confidence}
                            </p>
                          </div>
                          <p className="text-sm leading-6 text-ig-text">{currentWebsiteValidationResult.reviewNotes}</p>
                          {currentWebsiteValidationResult.reasons.length > 0 ? (
                            <p className="text-xs leading-5 text-ig-muted">
                              Signals found: {currentWebsiteValidationResult.reasons.join(" | ")}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-ig-muted">
                          The website is ready to be checked.
                        </p>
                      )}
                    </div>
                    {companyDomains.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {companyDomains.map((domain) => (
                          <button
                            key={domain}
                            type="button"
                            onClick={() => removeCompanyDomain(domain)}
                            className="rounded-full border border-ig-border bg-white px-3 py-1 text-xs font-medium text-ig-text transition hover:bg-ig-bg"
                          >
                            {domain} x
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="rounded-2xl border border-ig-border bg-ig-bg p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${companyVerificationStatusClasses}`}
                        >
                          {companyVerificationStatusLabel}
                        </span>
                        <p className="text-sm text-ig-muted">Company approval is only required for ads and promotions.</p>
                      </div>
                      {!normalizedCompanyDomains.length ? (
                        <p className="mt-3 text-sm leading-6 text-ig-muted">
                          Add at least one company domain before using company verification for ads and promotions.
                        </p>
                      ) : !companyWebsiteUrl.trim() ? (
                        <p className="mt-3 text-sm leading-6 text-ig-muted">
                          Add your company website to start the automated verification check immediately.
                        </p>
                      ) : hasUnsavedCompanyVerificationChange ? (
                        <p className="mt-3 text-sm leading-6 text-ig-muted">
                          Save settings after the website check finishes to store the latest verification result.
                        </p>
                      ) : companyVerificationStatus === "approved" ? (
                        <p className="mt-3 text-sm leading-6 text-emerald-800">
                          Your company has been approved for ads and promotions.
                        </p>
                      ) : companyVerificationStatus === "pending" ? (
                        <p className="mt-3 text-sm leading-6 text-sky-800">
                          Your website needs follow-up review. Ads and promotions unlock after approval.
                        </p>
                      ) : companyVerificationStatus === "rejected" ? (
                        <p className="mt-3 text-sm leading-6 text-red-800">
                          Update your company website or domains, then save again to re-run verification.
                        </p>
                      ) : (
                        <p className="mt-3 text-sm leading-6 text-amber-800">
                          Company verification has not started yet. Save a website URL to verify it.
                        </p>
                      )}
                      {companyVerificationNotes ? (
                        <div className="mt-3 rounded-2xl border border-ig-border bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ig-muted">Verification notes</p>
                          <p className="mt-2 text-sm leading-6 text-ig-text">{companyVerificationNotes}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>

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
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-xs text-ig-muted">
                    Use AI to draft or tighten your bio from the name, role, and skills in this form.
                  </p>
                  <button
                    type="button"
                    onClick={handleEnhanceBioWithAi}
                    disabled={!canEnhanceBioWithAi}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ig-link bg-white text-ig-link transition hover:bg-[#0095f60d] disabled:cursor-not-allowed disabled:opacity-70"
                    aria-label="Enhance profile bio with AI"
                    title="Enhance profile bio with AI"
                  >
                    <IconSparkles />
                  </button>
                </div>
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
              <h2 className="text-lg font-semibold text-ig-text">Profile visibility</h2>
              <p className="mt-2 text-sm leading-6 text-ig-muted">
                Unlock a more trusted, easier-to-discover profile after your basics are complete.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${visibilityStatusClasses}`}
                >
                  {visibilityStatusLabel}
                </span>
                <p className="text-sm text-ig-muted">
                  Complete your name, bio, and at least one skill before starting the visibility step.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {profileBasicsChecklist.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      item.isComplete
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    <p className="font-semibold">{item.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em]">
                      {item.isComplete ? "Complete" : "Required"}
                    </p>
                  </div>
                ))}
              </div>

              {!canEnhanceProfileVisibility ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="text-base font-semibold text-amber-900">Complete your profile basics first</h3>
                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    Add your name, a short bio, and at least one skill in this form to unlock the visibility upgrade.
                  </p>
                </div>
              ) : needsProfessionalAccountForVisibility ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="text-base font-semibold text-amber-900">Enable professional account first</h3>
                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    Turn on your professional account, then save settings to continue to verification and profile visibility.
                  </p>
                </div>
              ) : hasUnsavedVisibilityBasics || hasUnsavedProfessionalAccountChange || !savedProfileBasicsComplete ? (
                <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5">
                  <h3 className="text-base font-semibold text-sky-900">Save settings to continue</h3>
                  <p className="mt-2 text-sm leading-6 text-sky-800">
                    Your visibility requirements are ready in the form. Save these settings first, then start verification.
                  </p>
                </div>
              ) : (
                <div
                  className={`rounded-3xl border p-5 ${
                    visibilityStatus === "verified"
                      ? "border-emerald-200 bg-emerald-50"
                      : visibilityStatus === "pending"
                        ? "border-sky-200 bg-sky-50"
                        : visibilityStatus === "failed"
                          ? "border-red-200 bg-red-50"
                          : "border-ig-border bg-white"
                  }`}
                >
                  <h3
                    className={`text-base font-semibold ${
                      visibilityStatus === "verified"
                        ? "text-emerald-900"
                        : visibilityStatus === "pending"
                          ? "text-sky-900"
                          : visibilityStatus === "failed"
                            ? "text-red-900"
                            : "text-ig-text"
                    }`}
                  >
                    {visibilityStatus === "verified"
                      ? "Your profile visibility is already enhanced"
                      : visibilityStatus === "pending"
                        ? "Verification is in progress"
                        : visibilityStatus === "failed"
                          ? "Verification needs another attempt"
                          : "Ready to enhance your profile visibility"}
                  </h3>
                  <p
                    className={`mt-2 text-sm leading-6 ${
                      visibilityStatus === "verified"
                        ? "text-emerald-800"
                        : visibilityStatus === "pending"
                          ? "text-sky-800"
                          : visibilityStatus === "failed"
                            ? "text-red-800"
                            : "text-ig-muted"
                    }`}
                  >
                    {visibilityStatus === "verified"
                      ? "Your account has already completed the verification step that helps your profile look more trusted across Luminas."
                      : visibilityStatus === "pending"
                        ? "Your verification is already underway. Open the verification page to review the latest status."
                        : visibilityStatus === "failed"
                          ? "Open verification to retry the live-human check and restore enhanced visibility."
                          : "Start the live-human verification step to strengthen trust signals and improve your profile visibility."}
                  </p>
                  <Link
                    to="/verification"
                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-ig-link px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                  >
                    {visibilityStatus === "verified"
                      ? "View verification status"
                      : visibilityStatus === "pending"
                        ? "Review verification"
                        : visibilityStatus === "failed"
                          ? "Retry verification"
                          : "Enhance visibility"}
                  </Link>
                </div>
              )}
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
