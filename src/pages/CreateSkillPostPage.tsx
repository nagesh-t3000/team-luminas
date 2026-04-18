import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthUser } from "@/lib/appAuth";
import { filesToSkillPostMediaItems, MAX_POST_MEDIA_ITEMS } from "@/lib/postMedia";
import { createSkillPost, type SkillPostMediaItem } from "@/lib/skillPosts";

type CreateSkillPostPageProps = {
  authUser: AuthUser;
};

const MAX_POST_LENGTH = 1000;

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

  return "Unable to publish your post right now.";
}

export function CreateSkillPostPage({ authUser }: CreateSkillPostPageProps) {
  const navigate = useNavigate();
  const skilledDomains = useMemo(() => authUser.skilled_domains ?? [], [authUser.skilled_domains]);
  const [selectedSkill, setSelectedSkill] = useState(skilledDomains[0] ?? "");
  const [content, setContent] = useState("");
  const [mediaItems, setMediaItems] = useState<SkillPostMediaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const trimmedContent = content.trim();
  const remainingCharacters = MAX_POST_LENGTH - content.length;
  const hasPostContent = Boolean(trimmedContent) || mediaItems.length > 0;

  async function handleMediaSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    if (mediaItems.length + selectedFiles.length > MAX_POST_MEDIA_ITEMS) {
      setErrorMessage(`You can attach up to ${MAX_POST_MEDIA_ITEMS} images or videos per post.`);
      return;
    }

    setIsProcessingMedia(true);
    setErrorMessage("");

    try {
      const nextMediaItems = await filesToSkillPostMediaItems(selectedFiles);
      setMediaItems((current) => [...current, ...nextMediaItems].slice(0, MAX_POST_MEDIA_ITEMS));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsProcessingMedia(false);
    }
  }

  function removeMediaItem(index: number) {
    setMediaItems((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSkill.trim()) {
      setErrorMessage("Choose one of your saved skills.");
      return;
    }

    if (!trimmedContent && mediaItems.length === 0) {
      setErrorMessage("Write something or attach media to your post.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createSkillPost({
        authorId: authUser.id,
        skilledDomain: selectedSkill,
        content: trimmedContent,
        mediaItems,
      });

      navigate(`/profile/${authUser.username}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-10">
      <div className="rounded-[28px] border border-ig-border bg-ig-surface p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 border-b border-ig-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-ig-border bg-ig-bg px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ig-link">
              Create
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ig-text">Share one of your skills</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ig-muted">
              Post what you know, what you can help with, or the kind of work you want to be known for on Luminas.
            </p>
          </div>
          <Link
            to="/create"
            className="inline-flex items-center justify-center rounded-xl border border-ig-border px-4 py-2 text-sm font-semibold text-ig-text transition hover:bg-ig-bg"
          >
            Back to create
          </Link>
        </div>

        {skilledDomains.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold text-amber-900">Add your skills first</h2>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Skill posts can only be created from the domains saved on your profile. Add your skills in settings, then come back here to post.
            </p>
            <Link
              to="/settings"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-ig-link px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Open settings
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">Selected skill</h2>
                <p className="mt-2 text-sm leading-6 text-ig-muted">Pick one of the skills already shown on your profile.</p>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Skill</span>
                  <select
                    value={selectedSkill}
                    onChange={(event) => setSelectedSkill(event.target.value)}
                    className="w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                  >
                    {skilledDomains.map((domain) => (
                      <option key={domain} value={domain}>
                        {domain}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  {skilledDomains.map((domain) => (
                    <button
                      key={domain}
                      type="button"
                      onClick={() => setSelectedSkill(domain)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        selectedSkill === domain
                          ? "border-ig-link bg-ig-link text-white"
                          : "border-ig-border bg-white text-ig-text hover:bg-ig-bg"
                      }`}
                    >
                      {domain}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">What do you want to share?</h2>
                <p className="mt-2 text-sm leading-6 text-ig-muted">
                  Explain your expertise, a recent win, what you can help with, or the type of work you are open to.
                </p>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ig-text">Post body</span>
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value.slice(0, MAX_POST_LENGTH))}
                    placeholder="Example: I help early-stage teams improve onboarding flows, activation metrics, and pricing experiments..."
                    className="min-h-40 w-full rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-text outline-none transition focus:border-ig-link focus:ring-2 focus:ring-[#0095f633]"
                    maxLength={MAX_POST_LENGTH}
                  />
                </label>
                <div className="flex items-center justify-between text-xs text-ig-muted">
                  <span>Your post will appear in the home feed and on your profile.</span>
                  <span>{remainingCharacters} characters left</span>
                </div>
              </div>
            </section>

            <section className="grid gap-6 rounded-3xl border border-ig-border bg-ig-bg p-5 md:grid-cols-[180px_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-ig-text">Images and videos</h2>
                <p className="mt-2 text-sm leading-6 text-ig-muted">
                  Attach up to {MAX_POST_MEDIA_ITEMS} images or videos to give your post more context.
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-ig-link px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95">
                    Add media
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handleMediaSelection}
                      disabled={isProcessingMedia || isSubmitting || mediaItems.length >= MAX_POST_MEDIA_ITEMS}
                    />
                  </label>
                  {mediaItems.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setMediaItems([])}
                      className="rounded-xl border border-ig-border px-4 py-2 text-sm font-semibold text-ig-text transition hover:bg-white"
                    >
                      Remove all
                    </button>
                  ) : null}
                  <span className="text-xs text-ig-muted">
                    {mediaItems.length}/{MAX_POST_MEDIA_ITEMS} selected
                  </span>
                </div>

                <p className="text-xs text-ig-muted">
                  Images are compressed before saving. Videos are stored as selected, so shorter clips work best.
                </p>

                {isProcessingMedia ? (
                  <div className="rounded-2xl border border-ig-border bg-white px-4 py-3 text-sm text-ig-muted">
                    Processing selected media...
                  </div>
                ) : null}

                {mediaItems.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {mediaItems.map((mediaItem, index) => (
                      <div key={`${mediaItem.kind}-${index}`} className="overflow-hidden rounded-3xl border border-ig-border bg-white">
                        <div className="flex items-center justify-between border-b border-ig-border px-4 py-3">
                          <span className="text-xs font-semibold uppercase tracking-wide text-ig-link">
                            {mediaItem.kind === "image" ? "Image" : "Video"} {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMediaItem(index)}
                            className="text-xs font-semibold text-ig-muted transition hover:text-ig-text"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="bg-black">
                          {mediaItem.kind === "image" ? (
                            <img
                              src={mediaItem.url}
                              alt=""
                              className="h-64 w-full object-cover"
                              width={640}
                              height={640}
                            />
                          ) : (
                            <video
                              src={mediaItem.url}
                              controls
                              preload="metadata"
                              className="h-64 w-full bg-black object-contain"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                to="/create"
                className="inline-flex items-center justify-center rounded-2xl border border-ig-border px-5 py-3 text-sm font-semibold text-ig-text transition hover:bg-ig-bg"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || isProcessingMedia || !hasPostContent}
                className="inline-flex items-center justify-center rounded-2xl bg-ig-link px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Publishing..." : "Publish skill post"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
