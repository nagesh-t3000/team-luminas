import { useEffect, useState } from "react";
import { StoryRail } from "@/components/StoryRail";
import { PostCard } from "@/components/PostCard";
import { SkillPostCard } from "@/components/SkillPostCard";
import { Suggestions } from "@/components/Suggestions";
import { posts } from "@/data/mockData";
import { listSkillPosts, type SkillPost } from "@/lib/skillPosts";

export function HomePage() {
  const [skillPosts, setSkillPosts] = useState<SkillPost[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isCancelled = false;

    listSkillPosts(20)
      .then((nextPosts) => {
        if (!isCancelled) {
          setSkillPosts(nextPosts);
          setErrorMessage("");
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load skill posts right now.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[935px] justify-center gap-8 lg:max-w-[1015px] lg:gap-16">
      <div className="w-full min-w-0 md:max-w-[630px]">
        <StoryRail />
        <div className="md:space-y-0">
          {errorMessage ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          ) : null}
          {skillPosts.map((post) => (
            <div key={post.id} className="mb-4 md:mb-6">
              <SkillPostCard post={post} />
            </div>
          ))}
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
      <Suggestions />
    </div>
  );
}
