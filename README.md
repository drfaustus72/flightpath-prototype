# Flightpath prototype

Clickable, mobile-first prototype of Flightpath, a social and training-progress app for pilots, CFIs and flight schools. There is no backend: demo data is bundled seed JSON, held in browser storage.

## Run it

```sh
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck + lint + unit tests
npm run test:e2e     # Playwright smoke tests (uses your installed Google Chrome)
```

## Using the demo

- Tap the persona button (top right) to view the app as the student pilot, CFI, school admin or free pilot.
- **Reset demo** in the same sheet erases every change and returns to the seed data.
- On a phone, use "Add to Home Screen" to install it as an app.

## Deploy

Netlify builds from `main` using `netlify.toml` (`npm run build`, publishes `dist/`).

## Notes

- All people, schools and accounts in `src/data/seed` are fictional. Airport coordinates and elevations are approximate and for display only — not for navigation.
- See `CLAUDE.md` for product rules, architecture and conventions.
