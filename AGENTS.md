<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Shared Content tutorials use an isolated in-memory practice assignment and the builder's existing operations; never swap the live store or persist practice, so autosave and content locks remain untouched.
- Student leave warnings use a memory-only latched hook; only explicit acknowledgement after safe fullscreen/focus recovery unlocks the paper.
- Showcase content lives in `src/builder/demo.ts` (deterministic ids) and is added to local storage once by the save service; `src/test/demo.test.ts` keeps it covering every question type and shared block with zero validation errors — update both when adding a new type.
- Assignment status (draft/published/archived) rules live in `src/builder/status.ts` and are covered by `src/test/status.test.ts`; missing status on stored data means draft, so old saves keep working.
- Results analytics live in `src/analytics/`: `types.ts` (what an attempt stores, frozen at start/submit), `grading.ts` (snapshots + per-part grading with a grader version), `metrics.ts` (the only place metric formulas live; every screen reads from it), `fake-data.ts` (deterministic sample class behind `getResults`). Rules are covered by `src/test/analytics.test.ts` — change formulas there, never inline in components.
- Student attempt rules live in `src/attempts/rules.ts` (pure server logic: ownership, lifecycle, server clock, session lock, versioned autosave, idempotent requests, all-or-nothing grading) and are covered by `src/test/attempts.test.ts`; `api.ts` only simulates the network/transaction around them so a real backend can port `rules.ts` one-to-one. Student screens (`/student`, `/student/$assignmentId`) talk only to `attemptApi` and never receive the answer key while working.
- The finished-attempt page (`ResultView.tsx`) is one read-only review screen used both right after submitting and on every revisit; it renders from the attempt's own `view` + saved answers, and shows correctness/answer key only from `result.review`, which the server fills only when the teacher's show-answers setting allows (so the rule stays server-side).
