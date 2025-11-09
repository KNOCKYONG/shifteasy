# Repository Guidelines

This repo contains a Next.js app in the repository root (the legacy `web/` note is outdated). Use this guide to set up, develop, and contribute consistently.

## Project Structure & Module Organization
- Root: Next.js app source lives directly under `src/`, plus config in the repo root.
- App code: `src`
  - `app/` — App Router pages, layouts, and API route handlers under `app/api/*`.
  - `components/`, `hooks/`, `lib/`, `server/` — shared UI, hooks, utilities, and TRPC/server logic.
  - `public/` — Static assets.
- Config: `eslint.config.mjs`, `next.config.js`, `tsconfig.json`, `postcss.config.js`, `tailwind.config.js`.

## Build, Test, and Development Commands
- From repo root:
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

## Frontend Performance & UX Notes
- **Long lists/grids:** Schedule pages can render thousands of cells. Cache heavy lookups (e.g., group assignments by date/employee) and wrap bulk state updates in `React.startTransition` to avoid blocking the main thread.
- **Modals:** Do not `await` cache invalidation or network calls when closing modals. Trigger them asynchronously so the modal dismisses immediately.
- **Console logging:** The schedule view logs large objects; avoid `console.log` inside tight render loops to keep navigation responsive.

## Schedule Feature Tips
- `getAssignmentsForCell` already exposes per-cell data; reuse it instead of re-filtering the entire schedule array inside components.
- When loading schedules from `savedSchedules`, respect the `lastLoadedRef` guard and only mutate state if the schedule `id`/`updatedAt` actually changed.
- For “스케줄 보기” defaults, load into the lightweight “오늘의 근무” tab first, then let the heavy schedule view load in the background.
