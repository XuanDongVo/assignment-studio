# Assignment Studio

Build a UI-only prototype of a teacher "Assignment Builder" for an English e-learning platform (Grades 6-8, Vietnamese learners). Stack: Vite + React + TypeScript + Tailwind + shadcn/ui + lucide-react + @dnd-kit + zustand. Mock data in memory/localStorage only, no backend. Every visible button must work. Desktop-first, light theme, white/light-gray surfaces, indigo primary, green=saved, amber=warning, red=error. Calm, minimal, subtle borders, no gradients/glassmorphism/fake charts.

LAYOUT (3 panels + header)
- Header: Back, inline-editable title, status badge (Draft / Unsaved changes / Saving / Saved), Save Draft (also Ctrl+S), Edit | Student Preview toggle, Settings button, More menu (Duplicate, Delete with confirm). Confirm before leaving with unsaved changes.
- Left, 2 tabs. "Add content": Single Choice, True false, Mutplice Choice, Text Input, Multiple Blanks,, Matching, Section, Instructions, Reading Passage, Image, Answer Pool (icon + label + 1-line description; click or drag to add at the selected position). "Outline": collapsible tree of sections and items, select, drag to reorder or move between sections, rename, delete.
- Center: paper-like document canvas (max-w ~820px). Top summary: title, grade, total questions, total points, sections. Each item has a drag handle, selected highlight, context menu (Duplicate, Delete, Add before/after), move up/down buttons as fallback. Empty state with "Add your first question". Numbering "Câu n / total" is automatic and continuous.
- Right: property editor that changes with the selection, inline validation, no modal per edit.

DATA MODEL (typed, stable string IDs)
Question content separate from assignment config. Interaction types: SINGLE_CHOICE (options + correct), TEXT_INPUT (accepted answers, case sensitivity, optional prefix like "→ What subject", optional visible cue like "(not listen)"), MULTI_TEXT_INPUT (blanks each with accepted answers), MATCHING (item references a shared pool + correct entry). Config per item: points, required, gradingMode AUTO|MANUAL, isExample (shown with answer, unscored, unnumbered), groupId. Content blocks: Instructions, Passage, Media, AnswerPool (entries auto-lettered A, B, C...). Sections have bilingual title and instructions (EN + VI).

RICH TEXT MARKUP (one shared component): [[ea]] = underlined text (also inside options); {{1}} or {{answer|alt}} = blank.

SHARED CONTENT
A passage, pool, image or instruction block owns a group of questions via groupId; never duplicate it per question. Render the block with its members in a visually grouped container ("School Building · 6 questions") and nest them in the outline. Group moves as one unit; "Add question to this group"; attach/detach from the property editor; deleting a block asks "delete with members" or "ungroup". Editing the shared block updates the whole group. Cloze: passage has blanks {{1}}-{{6}} shown as numbered chips; each blank is its own question (dropdown or input); clicking a chip selects it; button "Create questions for all blanks". Matching: lettered pool box A-H above its items, each item has a letter selector; warn when deleting a pool entry in use.

STUDENT PREVIEW
Uses the current unsaved state, in document order, with section headings, numbering, example items, and per-type controls (radio, input with prefix/cue, inline blanks, dropdown for matching/cloze). Shared passages/pools shown once. "Show points" toggle, "Reset answers", "Back to Editor". Render only from a separate student-view model that strips isCorrect, acceptedAnswers, explanations and hints, so no answer key exists in the DOM.

VALIDATION PANEL (collapsible, live, "Go to item" action)
Errors: empty prompt, single choice with <2 options or no correct, AUTO question with no accepted answer, matching item missing pool/entry, broken passage/pool/blank reference, invalid points, empty section title. Warnings: empty section, passage without questions, unused pool entries, missing Vietnamese text, missing image alt. Drafts can be saved with errors; "Ready to publish" only when zero errors.

SETTINGS (side sheet)
Title, grade, instructions, total time limit for the whole attempt (minutes, no per-question timer), start and due date (due must be after start), target classes (mock multi-select), show answers after submission (off / after submission / after due), show points, shuffle off by default.

SAVE
Mock service behind an interface (localStorage, 600ms delay, optional simulated failure with Retry). Dirty detection via snapshot comparison, autosave 5s after last change (toggle in More menu).

RESPONSIVE
Below ~1100px, toolbox and property editor become drawers; no horizontal overflow at 1280/1024px.

SEED DATA (real Grade 6 content, no Lorem Ipsum), 9 sections, 3+ questions each:
I Pronunciation (underlined sounds in options). II Picture-gap ("You can use a ___ to look up a new word", image placeholder). III Multiple choice ("How is your first week ___ school?"). IV Verb forms ("Look! The cat ___ (eat) your breakfast", plus a two-blank item). V Find-and-correct (one example item, then "She is wanting to buy a new computer."). VI Matching, pool A-H (A. No, they are sleeping. B. By bicycle. C. To buy some bread. D. My friends. E. Five days a week. F. Home. G. Yes, I do. H. I go out and play in the playground.) with 8 items ("Who are you waiting for?"...). VII Cloze passage "School Building" with 6 blanks. VIII Sentence building from cues, MANUAL grading. IX Sentence rewriting with prefix ("What subject..." / "My class...").

Keep the code modular (types, store, selectors, validation, mock service, components). At the end, list what is done, assumptions, and what is incomplete.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2fec60bb-0363-4438-8c94-4a34c655f7c7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
