---
name: schedule-performance
description: Keep the schedule views (오늘의 근무 / 스케줄 보기) fast by caching data, batching updates, and avoiding heavy work in render paths.
---

# Schedule Performance Skill

The schedule UI renders thousands of cells and pulls large payloads (saved schedules, shift types, requests). Use these rules whenever the work touches `src/app/schedule` or any component under `src/components/schedule/`.

## 🔁 Cache Before You Render
- **Group assignments once.** Use memoized maps (`Map<date, assignments[]>`, `Map<date|employee, assignments[]>`) instead of re-filtering `schedule` arrays inside render loops. Reuse helpers like `getAssignmentsForCell`.
- **Reuse derived data.** If multiple components need the same lookup (shift name/color, off-balance info), precompute maps with `useMemo`.

## 🌀 Never Block the UI
- **Wrap bulk state updates in `React.startTransition`.** Loading 600+ assignments or shift configs should be transitioned so the tab renders immediately.
- **Avoid awaits on modal close.** Call cache invalidations (`utils.*.invalidate()`) without awaiting so dialogs dismiss instantly.
- **Defer expensive logs.** Remove `console.log` inside render loops or wrap them behind development guards.

## 🧱 Rendering Guidelines
- **Default to the light view.** Land the user on “오늘의 근무” before mounting the heavy schedule grid. Only mount the full grid when it’s actively needed.
- **Skip redundant renders.** Track the last loaded schedule id/`updatedAt` and bail out if nothing changed.
- **Add virtualization if you touch the grid.** Long term we plan to virtualize rows/columns; any new grid-like display must consider `@tanstack/react-virtual` or an equivalent strategy.

## 🧰 Tooling Checklist
- ✅ Memoize derived data (`useMemo`, `useCallback`)
- ✅ Guard effects with `isLoading` flags so fallbacks don’t thrash localStorage/network
- ✅ Use transition-friendly patterns (`startTransition`, `useDeferredValue`) when switching tabs or injecting large arrays
- ⚠️ Never mutate schedule state in response to every render cycle; schedule updates must be event-driven

Following these practices keeps tab switches, modal opens, and data fetches responsive even with large schedules. Use this skill whenever “스케줄” performance, caching, or UI responsiveness is mentioned. 
