/** Shown when bundled seed data fails validation, so a bad edit is never a blank screen. */
export function SeedErrorScreen({ errors }: { errors: string[] }) {
  return (
    <main className="mx-auto max-w-lg p-6" role="alert">
      <h1 className="text-xl font-bold">Demo data failed to load</h1>
      <p className="mt-2 text-ink-muted">
        Fix these problems in <code>src/data/seed</code> and reload. {errors.length} found:
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 font-ident text-[13px]">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </main>
  )
}
