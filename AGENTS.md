### AGENTS.md content-splitting rule

Split a section out of this file into its own `rules/*.md` file (referenced back with a plain backtick path, e.g. `` `rules/foo.md` `` — not an `@`-import, which auto-loads into every session's context and wastes tokens on unrelated tasks) when **both** of these hold:

- **Append-only / growing** — the section is a running log of learnings (e.g. gotchas discovered from live deploy errors) rather than a fixed, stable rule.
- **Not relevant to every task** — it only matters for a specific sub-area of work (e.g. HANA SQLScript syntax), not the project as a whole.

Keep a section inline in `AGENTS.md` when it's short and stable (a one-off convention or constraint that doesn't keep growing) and broadly relevant to most tasks in this repo — splitting those out just fragments the file without saving tokens.

## Proposal & Option Ordering

When proposing solutions, options, or alternatives to the user—including during `/grill-me`, interactive questions, design reviews, and planning:

- Always order choices starting from the smallest, least invasive change (minimal diff / simplest fix) first.
- Progress towards broader refactors, larger architectural overhauls, or heavier changes last.
- Default to recommending the lowest-friction, smallest-surface-area option that fully satisfies the user's requirements without unnecessary complexity.

## Project Structure

```text
.
├── firestore.rules              # Firestore security rules
├── database.rules.json          # Realtime Database security rules
├── storage.rules                # Firebase Storage security rules
├── firebase.json                # Firebase hosting, headers, and emulator config
├── docs/                        # Architecture, design system, and task documentation
├── rules/                       # AI workflows (e.g. `rules/ai-workflow.md`)
├── r2-worker/                   # Cloudflare Worker for R2 storage integration
└── web/                         # Main Angular standalone frontend application
    ├── scripts/                 # Maintenance, migration, and backfill scripts
    └── src/
        ├── environments/        # Firebase and environment configurations
        └── app/
            ├── components/      # Reusable UI components
            ├── guards/          # Route guards (auth, admin, etc.)
            ├── mock-data/       # Mock data fixtures
            ├── models/          # TypeScript models and interfaces
            ├── pages/           # Routed view/page components
            ├── repositories/    # Data access layer (Firestore / RTDB)
            ├── services/        # Business logic, state, and API services
            └── shared/          # Shared utilities, pipes, and status messages
```

## Async Task Feedback

For any task that performs asynchronous processing or changes user data—such as save, import/export, delete, upload, or similar operations—provide visible toast/status feedback for the full operation:

For short-lived operations that complete immediately and do not perform long-running processing or persist user data, visible toast/status feedback is not required.

- Show a progress message before starting the awaited operation, using wording such as `กำลัง...`.
- Show a success message after the operation completes successfully, using the shared success tone so the message is displayed in green.
- If the operation fails, show an error message and do not show a success message.
- Disable the triggering button or control while the operation is running to prevent duplicate submissions.
- Use `finally` to restore loading/busy state regardless of success or failure.

## Firestore Schema Changes

When adding or changing a Firestore document field, update the corresponding validation and allowed-field list in `firestore.rules` in the same change. Verify that the client document shape and deployed Firestore Rules remain in sync, and mention the required rules deployment command when handing off the change.

## Realtime Database Changes

When adding or changing Realtime Database data, update the JSON import/export functionality in the same change so it supports the updated data shape and remains compatible with the database.

## Font Compatibility

Do not use the middle dot character `·` in UI text or source content because the project font does not support it. Use a supported separator such as `-` instead.

## Full-Space Pages

New pages must fill the available center content area in both width and height. Use the existing app-shell/content layout and set an appropriate minimum height for the viewport content area so short pages do not leave unused gaps.

## Component File Separation

Always separate Angular components (both pages and reusable components) into distinct `.html`, `.css`, and `.ts` files (using `templateUrl` and `styleUrl`) instead of inline `template` or `styles`, to keep code clean and easy to maintain and edit.

## UI Design & Styling Patterns

When designing, building, or modifying UI components, layouts, or pages, read `docs/design-pattern-knowledge.md` first. Follow the established design patterns, including the 3-column app shell constraints (overflow prevention), multi-theme CSS variable tokens, retro/arcade component structures, font compatibility, and Angular style budget guidelines.

Always use semantic theme CSS variables (`var(--color-*)`) for all colors in UI components, templates, and styles. Do not hardcode HEX/RGB/HSL color values or use static Tailwind color utility classes (e.g. `bg-white`, `text-black`, `bg-slate-800`, `text-pink-600`) in component files, as they break multi-theme compatibility. Literal color definitions are strictly restricted to theme token blocks in `styles.css`.

## Mobile Layout & Navigation Patterns

When designing, modifying, or fixing mobile layouts, header bars, marquees, sidebars, or responsive navigation drawers, read `docs/mobile-layout-knowledge.md` first. Follow the multi-tier header container pattern, drawer overflow constraints (`overflow-x: hidden`), and flexbox baseline alignment standards.

## Git Commits

Do not commit git changes automatically. Always wait for the user to explicitly request or instruct a commit before executing `git commit`.

## Development Server & Build Workflow

The user normally keeps `web/_run_web.bat` (`npm start` / `ng serve`) running in the background. Do not run `npm run build` during routine development tasks, as changes are automatically recompiled incrementally by the dev server. Only run `npm run build` when explicitly requested, when verifying production bundle budgets, or when preparing for deployment.

## Unit Testing Workflow

When executing unit tests, prioritize testing against the active Karma runner at `http://localhost:9876/` (e.g. using `npx karma run` or checking the active runner) instead of triggering a cold build. If `http://localhost:9876/` is not running or cannot be reached, inform the user to run `_run_debug.bat` (located in `web/_run_debug.bat`) to start the test server.

## PortMaster Game Filtering & Route Management

When modifying game categorization, system filters, or PortMaster routing, refer to `docs/portmaster-game-filtering.md`. This file documents the architecture and implementation details for separating PortMaster games (`PORT`, `PortMaster`) from the retro home feed into their own dedicated `/port` route and sidebar navigation.


