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
- Showcase content lives in `src/builder/demo.ts` (deterministic ids) and is added to local storage once by the save service; `src/test/demo.test.ts` keeps it covering every question type and shared block with zero validation errors — update both when adding a new type.
- Assignment status (draft/published/archived) rules live in `src/builder/status.ts` and are covered by `src/test/status.test.ts`; missing status on stored data means draft, so old saves keep working.
