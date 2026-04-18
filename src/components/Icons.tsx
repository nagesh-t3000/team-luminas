export function IconHome({ active }: { active?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={active ? 0 : 2}>
      {active ? (
        <path
          fill="currentColor"
          stroke="none"
          d="M22 10.5 12 3 2 10.5V22a1 1 0 0 0 1 1h6v-7h4v7h6a1 1 0 0 0 1-1z"
        />
      ) : (
        <path d="M4 10.5 12 4l8 6.5V21a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1z" />
      )}
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}

export function IconExplore() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 22 20 2 20 12 2" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function IconReels() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="M17 9v6l4-3z" />
    </svg>
  );
}

export function IconMessage() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16v10H8l-4 4z" />
    </svg>
  );
}

export function IconHeart({ filled }: { filled?: boolean }) {
  if (filled) {
    return (
      <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="#ed4956">
        <path d="M12 21s-7-4.35-10-8.5C-1 8.5 2 4 7 4c2.5 0 5 2 5 2s2.5-2 5-2c5 0 8 4.5 5 8.5C19 16.65 12 21 12 21z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s-7-4.35-10-8.5C-1 8.5 2 4 7 4c2.5 0 5 2 5 2s2.5-2 5-2c5 0 8 4.5 5 8.5C19 16.65 12 21 12 21z" />
    </svg>
  );
}

export function IconComment() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v12H8l-4 4z" />
    </svg>
  );
}

export function IconShare() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12v7h16v-7M12 3v12M8 7l4-4 4 4" />
    </svg>
  );
}

export function IconBookmark({ filled }: { filled?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  );
}

export function IconCreate() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0L4.3 17.8a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H3.5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1.4 1.4a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.6z" />
    </svg>
  );
}

export function IconMore() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <circle cx="6" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18" cy="12" r="1.8" />
    </svg>
  );
}
