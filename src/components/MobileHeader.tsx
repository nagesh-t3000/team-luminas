import { Link } from "react-router-dom";
import { IconMessage } from "@/components/Icons";

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-ig-border bg-ig-surface px-4 md:hidden">
      <span className="text-[28px] leading-none" style={{ fontFamily: '"Grand Hotel", cursive' }}>
        Luminas
      </span>
      <div className="flex items-center gap-5">
        <button type="button" className="text-ig-text" aria-label="Notifications">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zM18 16v-5a6 6 0 0 0-12 0v5l-2 2h16z" />
          </svg>
        </button>
        <Link to="/messages" className="text-ig-text" aria-label="Messages">
          <IconMessage />
        </Link>
      </div>
    </header>
  );
}
