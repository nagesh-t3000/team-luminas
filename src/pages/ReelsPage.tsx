const reels = [
  { id: 1, thumb: "https://picsum.photos/seed/r1/400/700", title: "Pitch in 60s", user: "marcuszhou" },
  { id: 2, thumb: "https://picsum.photos/seed/r2/400/700", title: "Term sheet basics", user: "nvcapital" },
  { id: 3, thumb: "https://picsum.photos/seed/r3/400/700", title: "Resume teardown", user: "hireloop" },
  { id: 4, thumb: "https://picsum.photos/seed/r4/400/700", title: "Board meeting clips", user: "sage_advisory" },
];

export function ReelsPage() {
  return (
    <div className="mx-auto max-w-[935px] px-3 pb-6 pt-4 md:pt-8 lg:max-w-[1015px]">
      <h1 className="mb-4 hidden text-[24px] font-bold md:block">Reels</h1>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3">
        {reels.map((r) => (
          <button
            key={r.id}
            type="button"
            className="group relative aspect-[9/16] w-full overflow-hidden rounded-md bg-black text-left"
          >
            <img src={r.thumb} alt="" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
            <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-[13px] font-semibold text-white">
              @{r.user}
              <span className="mt-0.5 block text-[12px] font-normal text-white/90">{r.title}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
