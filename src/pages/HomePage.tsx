import { PostCard } from "@/components/PostCard";
import { StoryRail } from "@/components/StoryRail";
import { Suggestions } from "@/components/Suggestions";
import { posts } from "@/data/mockData";

export function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[935px] justify-center gap-8 lg:max-w-[1015px] lg:gap-16">
      <div className="w-full min-w-0 md:max-w-[630px]">
        <StoryRail />
        <div className="md:space-y-0">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
      <Suggestions />
    </div>
  );
}
