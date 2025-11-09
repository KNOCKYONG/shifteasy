---
name: requests-ops
description: Best practices for the 근무 교대 “요청사항” 페이지 (swap requests) to keep fetching, filtering, and actions fast.
---

# Requests Operations Skill

Applies to `src/app/requests/page.tsx`, `api/swap/*`, and any component/mutation that powers the “요청사항” tab.

## 🔄 Data Fetching Rules
- Use `api.swap.list.useQuery({ limit: 100, offset: 0 })` (already implemented). Do **not** introduce additional REST fetches when TRPC data exists.
- Keep query options light: disable `refetchOnWindowFocus` unless strictly required; large lists should not refetch on every focus.
- Prefer `startTransition` or loading indicators around expensive refetches (approve/reject/cancel) so the list doesn’t freeze.

## ⚙️ Filtering & Tabs
- Perform filtering once per render (`useMemo`) instead of re-running `.filter` chains in JSX for each counter.
- When tabs depend on `searchParams`, sync them via `useEffect` but avoid cascaded renders; debounced switching is fine if more filters are added.
- Aggregated counters (대기중/승인됨 등) should be computed from the pre-filtered array, not by re-filtering inside the JSX badges.

## ✅ Mutations
- Always reuse the existing mutations (`api.swap.approve/reject/cancel`) and call `refetch()` or targeted `utils.swap.list.invalidate()` without blocking the UI.
- Show `Loader2` spinners only while the specific mutation is pending; avoid global “processing…” overlays that block the whole tab.
- After a mutation succeeds, batch cache invalidations (e.g., `Promise.all([refetch(), utils.schedule.list.invalidate()])`) or fire-and-forget with `.catch(console.error)` so the UI stays responsive.

## 🧠 UX Tips
- Keep the preview modal cheap: pass already-fetched data rather than re-querying by ID.
- When adding new filters (date range, requester), compute derived arrays once and store them in state/memo to avoid repeated work.
- Remove heavy console logs or debug dumps—they block the thread in environments with many requests.

Use this skill whenever you touch the “요청사항” tab or swap-request back office to maintain snappy interactions. 
