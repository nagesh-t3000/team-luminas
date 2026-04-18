import { useEffect, useMemo, useState } from "react";
import { StoryRail } from "@/components/StoryRail";
import { SkillPostCard } from "@/components/SkillPostCard";
import { Suggestions } from "@/components/Suggestions";
import { getStoredAuthUser } from "@/lib/appAuth";
import { listExploreUpdates, type ExploreUpdate } from "@/lib/exploreUpdates";
import { listPublicUsers, type PublicUser } from "@/lib/publicUsers";
import { listSkillPosts, type SkillPost } from "@/lib/skillPosts";

export function HomePage() {
  const authUser = useMemo(() => getStoredAuthUser(), []);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [events, setEvents] = useState<ExploreUpdate[]>([]);
  const [skillPosts, setSkillPosts] = useState<SkillPost[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isCancelled = false;

    Promise.all([listPublicUsers(12), listExploreUpdates(4, "event"), listSkillPosts(20, authUser?.id)])
      .then(([nextUsers, nextEvents, nextPosts]) => {
        if (!isCancelled) {
          setUsers(nextUsers);
          setEvents(nextEvents);
          setSkillPosts(nextPosts);
          setErrorMessage("");
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load the home feed right now.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [authUser?.id]);

  return (
    <div className="mx-auto flex w-full max-w-[935px] justify-center gap-8 lg:max-w-[1015px] lg:gap-16">
      <div className="w-full min-w-0 md:max-w-[630px]">
        <StoryRail users={users} events={events} />
        <div className="md:space-y-0">
          {errorMessage ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          ) : null}
          {skillPosts.map((post) => (
            <div key={post.id} className="mb-4 md:mb-6">
              <SkillPostCard post={post} />
            </div>
          ))}
          {!errorMessage && events.length === 0 && skillPosts.length === 0 ? (
            <div className="rounded-3xl border border-ig-border bg-ig-surface p-6 text-center shadow-sm">
              <h2 className="text-base font-semibold text-ig-text">No live feed yet</h2>
              <p className="mt-2 text-sm text-ig-muted">
                Apply your Supabase SQL to seed member events and skill posts for the home feed.
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <Suggestions users={users} />
    </div>
  );
}
