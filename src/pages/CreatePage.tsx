import { Link } from "react-router-dom";
import type { AuthUser } from "@/lib/appAuth";

type CreatePageProps = {
  authUser: AuthUser;
};

const createOptions = [
  {
    title: "Event",
    description:
      "Create a meetup, workshop, demo day, or other community event so people can discover it in Explore.",
    href: "/create/event",
    cta: "Create event",
  },
  {
    title: "Skill post",
    description:
      "Share a short post with text, images, or videos so your expertise can appear in the home feed and on your profile.",
    href: "/create/post",
    cta: "Create skill post",
  },
  {
    title: "Experience",
    description:
      "Add a role, company, time period, and summary so your profile experience tab reflects your real background.",
    href: "/create/experience",
    cta: "Add experience",
  },
] as const;

export function CreatePage({ authUser }: CreatePageProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
      <div className="rounded-[28px] border border-ig-border bg-ig-surface p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 border-b border-ig-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-ig-border bg-ig-bg px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ig-link">
              Create
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ig-text">Choose what you want to add</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ig-muted">
              Use this space to create an event, publish a skill post, or add a profile experience entry.
            </p>
          </div>
          <Link
            to={`/profile/${authUser.username}`}
            className="inline-flex items-center justify-center rounded-xl border border-ig-border px-4 py-2 text-sm font-semibold text-ig-text transition hover:bg-ig-bg"
          >
            Back to profile
          </Link>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {createOptions.map((option) => (
            <section key={option.title} className="rounded-3xl border border-ig-border bg-ig-bg p-6">
              <h2 className="text-xl font-semibold text-ig-text">{option.title}</h2>
              <p className="mt-3 text-sm leading-6 text-ig-muted">{option.description}</p>
              <Link
                to={option.href}
                className="mt-6 inline-flex items-center justify-center rounded-2xl bg-ig-link px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
              >
                {option.cta}
              </Link>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
