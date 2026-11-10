# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file IT PMO Kanban board demo (`index.html`) for a fictitious bank's internal training. Everything — markup, `<style>`, `<script>` — lives in that one file.

`v2/index.html` is a separate single-file retro (1960s) redesign with tabs (Board / Projects / Timeline / Assignees), deployed at `/v2/`. Same hard constraints and architecture; do not overwrite v1 when changing v2. v2 has a strict hash-based CSP: after editing its `<script>` or `<style>`, run `node tools/csp.mjs v2/index.html --write` (CI fails on stale hashes). Never add inline `style=""` or event-handler attributes there; set dynamic sizes through `data-vars` + `applyVars()` (CSSOM).

## Running

No build, no package manager, no tests. Open the file directly (file:// must keep working):

```
start index.html          # PowerShell / cmd
```

## Hard constraints (from the original spec — do not break)

- Vanilla HTML/CSS/JS only. No frameworks, libraries, CDNs, web fonts, image files, bundlers or npm. Icons are Unicode/inline SVG; fonts are the system stack.
- **No persistence.** Board state lives only in the in-memory `state` object. Do not add localStorage, sessionStorage, IndexedDB or cookies. A refresh resetting to seed data is intended, and the header note says so.
- The only network call is FormSubmit's AJAX endpoint (`notifyNewTask()`). No other backend.
- No real bank logo or branding; the wordmark is plain text "IT PMO" in a corporate blue palette.
- No `alert()`/`confirm()`: validation errors are inline, and delete uses an inline "Delete? Yes / No" toggle.
- No `!important`; colours and spacing come from CSS custom properties in `:root`.

## Script architecture

The script is split into numbered, commented sections (config → state → utils → seed → filters → rendering → actions → toasts → FormSubmit → form → board events → filter events → init).

- **Config at the top of the script:** `FORMSUBMIT_ENDPOINT` (swap the email here only), `TASK_ID_PREFIX`, `EMAIL_SUBJECT_PREFIX`, and the `STATUSES`/`PROJECTS`/`CATEGORIES`/`PRIORITIES` lists. Columns and all `<select>` options are generated from these lists, so add or rename values there, not in the markup.
- **State:** `state = { tasks, filters }` is the single source of truth. A separate `ui` object holds transient card UI (`pendingDeleteId`, `focusAfterRender`) so that confirm toggles and focus restoration survive re-renders.
- **Re-render rule:** card DOM is written only by `renderBoard()`, which calls `renderCard()` (an HTML string) and `renderSummary()`. Actions (`addTask`, `moveTask`, `deleteTask`) mutate `state` and then call `renderBoard()`; never patch card DOM directly. Every user string must go through `escapeHtml()` before it reaches `innerHTML`.
- **Events are delegated** on `#board` (dragstart/dragover/dragleave/drop/dragend, `change` for the "Move ▸" select, `click` for the delete/confirm buttons, Escape to cancel a delete), because cards are recreated on every render.
- **Dates** are compared as local `YYYY-MM-DD` strings (`todayISO()`, `toISODate()`); avoid `toISOString()` for dates (UTC drift). The seed uses `daysFromToday()` so that some tasks are always overdue.
- **Optimistic submit:** `handleSubmit()` adds the card, resets the form and shows a success toast before awaiting `notifyNewTask()`. A failure only shows a warning toast. The submit button shows "Sending…" while `requestsInFlight > 0`. `notifyNewTask()` skips the network call while the endpoint still contains the `YOUR_EMAIL@example.com` placeholder, and treats `success: "false"` in a 200 response as a failure (FormSubmit's response before the address is activated).

## FormSubmit

The first submission to a new address sends an activation email; nothing is delivered until the link in it is clicked. That note is also kept as an HTML comment above the script.
