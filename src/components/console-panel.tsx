/**
 * A titled panel for the DM console. The console is dense enough that a bare
 * `runic` label over loose content stops reading as structure — each region
 * needs an actual edge. Header sits inside the chamfer, so the plate's masked
 * border still survives the cut.
 */
export function ConsolePanel({
  title,
  aside,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={"plate flex min-h-0 flex-col " + className}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-basalt-700 px-4 py-2.5">
        <span className="runic">{title}</span>
        {aside}
      </div>
      <div className={"min-h-0 flex-1 p-4 " + bodyClassName}>{children}</div>
    </section>
  );
}
