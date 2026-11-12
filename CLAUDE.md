# Flightpath prototype

Clickable, mobile-first prototype of Flightpath ("Strava for pilots"). No backend: all data is seed JSON loaded into browser state. The goal is Phase 0 validation demos with pilots, CFIs and flight schools.

Product source of truth: the Flightpath Project Brief (claude.ai project). Roadmap: "Flightpath — Clickable Prototype Roadmap" doc. If code and brief disagree, ask; don't guess.

## Commands

- `npm run dev` — local dev server
- `npm run check` — typecheck + lint + unit tests (must pass before every commit)
- `npm run test:e2e` — Playwright smoke tests (demo scripts)
- `npm run build` — production build (Netlify runs this)

## Product rules (non-negotiable)

1. **Tier gating lives in one place.** `src/domain/tiers.ts` maps every gated feature to the plans that unlock it. UI calls `can(account, feature)`; never compare plan names in components.
2. **Tiers:** Pilot Free / Pilot Pro · CFI (free verified role) / CFI Pro (includes all Pilot Pro features) · School Basic (free page, member count only, no feed, no perks, no dashboard) / School Pro (includes CFI Pro for staff CFIs).
3. **CFI sign-off authority is never paywalled.** Any verified CFI can sign off flights they instructed and milestones for linked students. No self-verification. Every sign-off is logged and revocable, and is labeled as a platform verification, not an FAA endorsement.
4. **No leaderboards for speed, altitude, ceiling or risk.** Challenges reward experience, proficiency and good decisions (a no-go can earn recognition).
5. **Minors default to private** with discovery off. Medical class and age are never shown.
6. **Readiness is never certified by an algorithm.** Advisor copy suggests; the CFI decides.
7. **Rewards/discounts are out of scope** until aviation counsel reviews (§61.113). Perks UI may exist only as a School Pro placeholder.
8. **Demo data is fictional.** No real schools, people or tail numbers in seed data.

## Architecture

```
src/
  app/        routes, layout, tab bar, providers
  features/   one folder per area (feed, explore, log, progress, profile, school)
  domain/     types, tiers (gating), pure business logic — no React, fully unit-tested
  data/seed/  JSON seed files + validated loader (zod schemas in domain/schemas.ts)
  store/      Zustand stores, persisted to localStorage with a schema version
  ui/         design tokens and shared presentational components
e2e/          Playwright smoke tests, one per demo script
```

- Domain logic is pure TypeScript in `src/domain/` and is tested there; components stay thin.
- Seed data is validated with zod at load. A validation failure renders a visible error screen; never fail silently.
- Persisted state carries `STORAGE_VERSION` and a fingerprint of the seed data. Bump `STORAGE_VERSION` when the persisted shape changes; a version or seed mismatch, or corrupt state, resets to seed with a console warning.
- The active persona is selected via the persona switcher; all screens derive from the active account.

## Conventions

- TypeScript strict, `noUncheckedIndexedAccess`. No `any`, no non-null `!` without a comment explaining why.
- Function components, named exports. Files: `PascalCase.tsx` for components, `camelCase.ts` otherwise.
- Tailwind for styling; colors, radii and fonts come from tokens in `src/index.css` (`@theme`). No raw hex in components.
- Accessible by default: real buttons/links, labels on icon buttons, 44px minimum touch targets.
- No empty `catch`. Errors either surface in UI or are logged with context and rethrown.
- Each logic change ships with a unit test; each milestone's demo script ships with a Playwright test.
- Commits: small, imperative subject ("Add tier gating map"), one step per commit.

## Skills to use

- New screens: `frontend-design`, then `design:ux-copy` for wording.
- Charts (school dashboard): `dataviz`.
- Before finishing a milestone: `engineering:code-review` on the milestone diff.
- Netlify changes: the `netlify-*` skills (`netlify-config`, `netlify-deploy`, `netlify-forms`).
- M5: `design:accessibility-review`. M6: `design:user-research`, `product-management:synthesize-research`.
