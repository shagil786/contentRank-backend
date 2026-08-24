"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-6">
      <section className="max-w-xl w-full border-2 border-ink p-6 sm:p-10">
        <p className="font-mono text-xs tracking-widest text-signal">OUTRANK / RECOVERY MODE</p>
        <h1 className="font-display text-4xl sm:text-6xl tracking-tightest leading-none mt-4">
          THE BOARD HIT A SNAG.
        </h1>
        <p className="font-mono text-sm leading-relaxed text-muted-foreground mt-5">
          The page could not finish rendering. Your data is safe. Try rendering it again,
          or reload the page if the problem continues.
        </p>
        <div className="flex flex-wrap gap-3 mt-7">
          <button
            type="button"
            onClick={() => reset()}
            className="bg-signal text-white px-5 py-3 font-mono text-xs tracking-widest hover:bg-signal-dim"
          >
            TRY AGAIN
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border border-ink px-5 py-3 font-mono text-xs tracking-widest hover:bg-ink hover:text-paper"
          >
            RELOAD PAGE
          </button>
        </div>
      </section>
    </main>
  );
}
