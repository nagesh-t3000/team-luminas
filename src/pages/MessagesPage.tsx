import { Link } from "react-router-dom";
import { users, currentUser } from "@/data/mockData";

const threads = users.filter((u) => u.id !== currentUser.id).slice(0, 6);

export function MessagesPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[630px] flex-col border-ig-border bg-ig-surface md:mt-6 md:min-h-[80vh] md:overflow-hidden md:rounded-lg md:border">
      <header className="flex h-[44px] items-center justify-center border-b border-ig-border md:h-[52px]">
        <span className="text-[16px] font-semibold">{currentUser.username}</span>
      </header>
      <ul className="flex-1 divide-y divide-ig-border">
        {threads.map((u) => (
          <li key={u.id}>
            <Link to="#" className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]">
              <img src={u.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" width={56} height={56} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold">{u.username}</span>
                  <span className="shrink-0 text-[12px] text-ig-muted">Now</span>
                </div>
                <p className="truncate text-[14px] text-ig-muted">Active on Luminas · {u.headline}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
