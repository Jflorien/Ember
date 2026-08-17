export type ConditionKind = "buff" | "debuff" | "concentration";

const KIND_STYLES: Record<
  ConditionKind,
  { ring: string; text: string; dot: string; pulse?: boolean }
> = {
  buff: {
    ring: "shadow-[inset_0_0_0_1px_rgba(95,191,127,.4)]",
    text: "text-[#9ee0b4]",
    dot: "bg-verdant shadow-[0_0_8px_var(--verdant)]",
  },
  debuff: {
    ring: "shadow-[inset_0_0_0_1px_rgba(139,107,196,.42)]",
    text: "text-[#c3adea]",
    dot: "bg-shadow shadow-[0_0_8px_var(--shadow)]",
  },
  concentration: {
    ring: "shadow-[inset_0_0_0_1px_rgba(255,182,39,.42)]",
    text: "text-forge-300",
    dot: "bg-forge-500 shadow-[0_0_8px_var(--forge-500)] animate-pulse",
    pulse: true,
  },
};

export function ConditionPill({
  name,
  kind,
  duration,
}: {
  name: string;
  kind: ConditionKind;
  duration?: string;
}) {
  const style = KIND_STYLES[kind];

  return (
    <span
      className={
        "flex items-center gap-1.5 bg-basalt-850 py-1.5 pl-2 pr-2.5 text-xs font-semibold [clip-path:polygon(7px_0,100%_0,100%_calc(100%-7px),calc(100%-7px)_100%,0_100%,0_7px)] " +
        `${style.ring} ${style.text}`
      }
    >
      <i className={`h-2 w-2 rounded-full ${style.dot}`} />
      {name}
      {duration && (
        <span className="font-mono text-[10px] text-ash-500">{duration}</span>
      )}
    </span>
  );
}
