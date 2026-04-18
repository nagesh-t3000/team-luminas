import { stories, userById, currentUser } from "@/data/mockData";

export function StoryRail() {
  return (
    <div className="mb-3 rounded-lg border border-ig-border bg-ig-surface px-4 py-3 md:border-0 md:bg-transparent md:px-0 md:py-0">
      <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-1">
        <div className="flex w-[72px] shrink-0 flex-col items-center gap-1">
          <div className="relative">
            <div className="story-ring">
              <div className="story-ring-inner">
                <img
                  src={currentUser.avatarUrl}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover"
                  width={56}
                  height={56}
                />
              </div>
            </div>
            <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-ig-link text-xs font-bold text-white">
              +
            </span>
          </div>
          <span className="max-w-[72px] truncate text-center text-[12px] text-ig-text">Your story</span>
        </div>
        {stories.map((s) => {
          const u = userById(s.userId);
          return (
            <div key={s.userId} className="flex w-[72px] shrink-0 flex-col items-center gap-1">
              <div className="story-ring">
                <div className="story-ring-inner">
                  <img src={u.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" width={56} height={56} />
                </div>
              </div>
              <span className="max-w-[72px] truncate text-center text-[12px] text-ig-text">{u.username}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
