const tiles = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  src: `https://picsum.photos/seed/ex${i}/400/400`,
}));

export function ExplorePage() {
  return (
    <div className="mx-auto max-w-[935px] px-0 pb-4 pt-2 md:pt-6 lg:max-w-[1015px]">
      <div className="grid grid-cols-3 gap-[2px] md:gap-1">
        {tiles.map((t) => (
          <a
            key={t.id}
            href="#"
            className="relative aspect-square overflow-hidden bg-black/5"
            onClick={(e) => e.preventDefault()}
          >
            <img src={t.src} alt="" className="h-full w-full object-cover" width={400} height={400} loading="lazy" />
            <span className="absolute inset-0 bg-black/0 transition-colors hover:bg-black/10" />
          </a>
        ))}
      </div>
    </div>
  );
}
