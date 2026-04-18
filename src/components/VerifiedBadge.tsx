type VerifiedBadgeProps = {
  size?: number;
  title?: string;
};

export function VerifiedBadge({
  size = 16,
  title = "Verified professional account",
}: VerifiedBadgeProps) {
  return (
    <span
      className="inline-flex shrink-0 align-middle text-[#0095F6]"
      role="img"
      aria-label={title}
      title={title}
    >
      <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
        <path d="M12 2.5 14.45 4l3.07-.18 1.68 2.58 2.8 1.26-.27 3.07L23.5 13l-1.77 2.27.27 3.07-2.8 1.26-1.68 2.58-3.07-.18L12 23.5 9.55 22l-3.07.18-1.68-2.58-2.8-1.26.27-3.07L.5 13l1.77-2.27L2 7.66 4.8 6.4l1.68-2.58L9.55 4 12 2.5Z" />
        <path
          d="m9.8 12.9 1.45 1.45 3.45-4.1"
          fill="none"
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </span>
  );
}
