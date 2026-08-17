const CANNOT_EXCEED = 100;

function clampPct(value: number) {
  return Math.max(0, Math.min(CANNOT_EXCEED, value));
}

export function HpBar({
  current,
  max,
  temp = 0,
  label = "Hit Points",
}: {
  current: number;
  max: number;
  temp?: number;
  label?: string;
}) {
  const pct = clampPct((current / max) * 100);
  const tempPct = clampPct((temp / max) * 100);
  const state = pct < 25 ? "cold" : pct < 60 ? "warm" : "hot";

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="runic">{label}</span>
        <span className="font-mono text-sm font-bold tabular-nums text-ash-100">
          {current}
          <i className="ml-0.5 text-xs not-italic text-ash-500">/{max}</i>
          {temp > 0 && (
            <span className="ml-2 text-frost">+{temp}</span>
          )}
        </span>
      </div>
      <div className="relative h-[11px] overflow-hidden bg-basalt-990 shadow-[inset_0_0_0_1px_var(--basalt-600),inset_0_2px_5px_rgba(0,0,0,.75)]">
        <div
          className={
            "relative h-full transition-[width] duration-500 ease-slow " +
            (state === "cold"
              ? "bg-[linear-gradient(90deg,#3a1a12,#7a2408)]"
              : state === "warm"
                ? "bg-[linear-gradient(90deg,var(--molten-800),var(--molten-600))] shadow-[0_0_9px_rgba(209,78,17,.42)]"
                : "bg-[linear-gradient(90deg,var(--molten-700),var(--molten-500)_55%,var(--forge-500))] shadow-[0_0_12px_rgba(242,100,25,.5)]")
          }
          style={{ width: `${pct}%` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.28),transparent_52%)]" />
        </div>
        {temp > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-[repeating-linear-gradient(45deg,rgba(94,200,232,.75)_0_4px,rgba(94,200,232,.42)_4px_8px)] shadow-[0_0_9px_rgba(94,200,232,.5)]"
            style={{ left: `${pct}%`, width: `${tempPct}%` }}
          />
        )}
      </div>
    </div>
  );
}
