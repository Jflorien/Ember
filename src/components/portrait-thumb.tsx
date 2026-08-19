/* eslint-disable @next/next/no-img-element */

/**
 * Shared avatar primitive — a character's portrait if it has one, else its
 * initial on a plain basalt tile. Reuses `.plate` (the chamfer primitive)
 * rather than a hand-rolled clip-path, per the design system's "component
 * classes are the primitive" rule.
 */
export function PortraitThumb({
  url,
  name,
  size = 40,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const style = { width: size, height: size };

  if (url) {
    return (
      <div className="plate xs shrink-0 overflow-hidden" style={style}>
        <img src={url} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="plate xs flex shrink-0 items-center justify-center font-display text-ash-300"
      style={style}
    >
      {initial}
    </div>
  );
}
