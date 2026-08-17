export type SlotGroup = {
  level: number;
  total: number;
  spent: number;
};

export function SlotPips({ groups }: { groups: SlotGroup[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {groups.map((group) => (
        <div key={group.level} className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] tracking-wide text-ash-500">
            L{group.level}
          </span>
          {Array.from({ length: group.total }, (_, i) => {
            const isSpent = i >= group.total - group.spent;
            return (
              <span
                key={i}
                className={
                  "h-[15px] w-[15px] shrink-0 transition-transform duration-200 ease-fast [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)] " +
                  (isSpent
                    ? "bg-basalt-600 shadow-none"
                    : "bg-forge-500 shadow-[0_0_9px_rgba(255,182,39,.6)]")
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
