# Repository Guidelines

This repo contains a Next.js app under `web`. Use this guide to set up, develop, and contribute consistently.

## Project Structure & Module Organization
- Root: `prototype.txt` (notes), `web/` (app source).
- App code: `web/src`
  - `app/` — App Router pages, layouts, and API route handlers under `app/api/*`.
  - `lib/` — Shared utilities (`types.ts`, `testdata.ts`).
  - `public/` — Static assets.
- Config: `web/eslint.config.mjs`, `web/next.config.ts`, `web/tsconfig.json`, `web/postcss.config.mjs`.

## Build, Test, and Development Commands
- From `web/`:
  - `npm install` — Install dependencies (Node 18+ recommended).
  - `npm run dev` — Start dev server with Turbopack on http://localhost:3000.
  - `npm run build` — Production build (Turbopack).
  - `npm start` — Run built app.
  - `npm run lint` — Lint with ESLint.

## Coding Style & Naming Conventions
- TypeScript strict; import alias `@/*` maps to `web/src/*`.
- React components: PascalCase files (`MyWidget.tsx`). Helpers/hooks: camelCase (`useThing.ts`).
- Route segments under `app/` use lowercase and hyphens (`app/reports/staffing/`).
- Indentation: 2 spaces; prefer named exports; keep files focused.
- Styling: Tailwind CSS (`app/globals.css` + utility classes). Avoid inline styles unless necessary.
- Linting: extends `next/core-web-vitals` and `next/typescript`. Fix warnings before PR.

## Icon Reference
- https://www.figma.com/design/cvHhlQwekzo6tiuO0Iwl37/Smoooth-Icons--Free-pack---Community-?node-id=202-304&p=f&t=hX4pzfhF14gZyFm5-0

## Testing Guidelines
- No test suite yet. When adding tests:
  - Unit tests: Vitest/Jest, name `*.test.ts`/`*.test.tsx` near sources.
  - E2E: Playwright, place under `e2e/`.
  - Aim for meaningful coverage on `lib/` and critical API routes.

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (e.g., `feat: add staffing report API`, `fix: handle null shift`). Keep commits small and scoped.
- PRs: include a clear summary, linked issues, and screenshots/GIFs for UI changes. Note breaking changes and update docs as needed.
- Ensure `npm run lint` and build succeed before requesting review.

## Security & Configuration Tips
- Use environment files in `web/` (`.env.local`) for secrets; never commit them. Client-exposed vars must be prefixed `NEXT_PUBLIC_`.
- Avoid storing real data in `testdata.ts`; use anonymized examples.

## Skills

You've got skills.

- List your skills directly after reading this via `scripts/list-skills skills/`. Remember them.
- If a skill matches a certain task at hand, only then read its full documentation (`SKILL.md`) and use it.