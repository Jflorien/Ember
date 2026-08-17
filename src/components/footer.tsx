export function Footer() {
  return (
    <footer className="border-t border-basalt-800">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-sm font-bold uppercase tracking-[0.34em] text-forge-500">
            Ember
          </span>
          <p className="max-w-xl text-xs text-ash-500">
            This product includes materials from the System Reference
            Document 5.2.1, licensed under CC BY 4.0.
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-2 text-xs text-ash-500 sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; {new Date().getFullYear()} Ember. All rights reserved.</span>
          <span className="font-mono">SRD 5.2.1 · CC BY 4.0 · free during beta</span>
        </div>
      </div>
    </footer>
  );
}
