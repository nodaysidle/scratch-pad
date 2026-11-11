# AGENTS.md — Scratch Pad

## Document Purpose

Provide the downstream coding agent with the exact authority, stack lock, execution order, validation gates, stop conditions, and honest completion vocabulary for this project.

## Required Reading Order

1. PRD.md for product scope and outcomes
2. ARD.md for architecture and ownership
3. TRD.md for locked technical contracts
4. TASKS.md for execution order
5. AGENTS.md for operating and completion rules

## Authority Hierarchy

1. The five-document packet as a single execution contract
2. PRD.md for product meaning and scope
3. ARD.md for architecture and ownership
4. TRD.md for technical and release decisions
5. TASKS.md for ordered implementation
6. Existing source only after it is created by the declared task

## Locked Stack

- Tauri 2
- Rust
- TypeScript
- Vite
- DOM-driven frontend
- platform-safe Tauri commands and capabilities
- Vitest
- Cargo test

## Forbidden Substitutions

- Forbidden: Electron
- Forbidden: Flutter
- Forbidden: SwiftUI application architecture

## Locked Identity and Output

- Identity: com.scratch.pad
- Preset: tauri2-rust-typescript-desktop
- Runtime mode: linux-desktop
- Artifact: Linux AppImage
- Artifact path: dist/scratch-pad.AppImage

## Installation Rule

For local proof, run ./scripts/package_linux.sh --install: it builds the AppImage, installs it under ~/.local/bin with a desktop entry and icon, and keeps the previous AppImage in dist/rollback/ as the rollback copy; then launch the installed identity.

## Execution Rules

- Before TASK-01, copy these kit files to the same path in the project root: README.md, package.json, tsconfig.json, vite.config.ts, index.html, src/api.ts, src/errors.ts, src/ui.ts, src/store.ts, tests/store.test.ts, src/main.ts, src/style.css, tests/kit.test.ts, tests/ui.test.ts, app-icon.svg, scripts/package_linux.sh, src-tauri/Cargo.toml, src-tauri/build.rs, src-tauri/rustfmt.toml, src-tauri/src/main.rs, src-tauri/src/lib.rs, src-tauri/src/platform/mod.rs, src-tauri/src/error.rs, src-tauri/src/database.rs, src-tauri/tests/kit_tests.rs, src-tauri/tauri.conf.json, src-tauri/capabilities/default.json. Keep every behavior kit/README.md lists and keep the kit tests passing.
- Do not reinterpret the idea, add scope, switch stacks, rename IDs, or invent owners.
- Use the exact owner, implementation file, focused test, feature, contract, task, and phase mappings.
- Create files only in the task that first owns them and modify them only after creation.
- Implement failure, denied, cancellation, cleanup, persistence, credential, permission, lifecycle, and recovery paths before declaring a feature complete.
- Keep secrets out of source, logs, tests, fixtures, examples, commands, and generated artifacts.
- Keep test doubles (in-memory stores, console-only output, fake platform calls) in test files only; production entry points call the real owners named in the contracts.
- Preserve unrelated user work and stop if an undeclared conflict prevents the exact task.

## Runtime Architecture Rules

- The TypeScript DOM frontend owns presentation and sends typed Tauri invoke requests; Rust commands own filesystem, persistence, and platform operations behind least-privilege capabilities.
- Managed Rust state owns cancellable operations and returns allowlisted serializable results; frontend state never receives unrestricted paths.

## Integration Boundary

Standalone local application: no remote network endpoints, cloud credentials, or third-party web services are used.

## Recovery Rules

- Return one allowlisted error enum through each Tauri command and preserve the last valid frontend state.
- Use cancellation tokens and scoped Rust resources; roll back transactions before reporting a terminal result.

## Lifecycle Rules

- Use tauri::Builder as the cross-platform desktop entry.
- Close managed tasks, database handles, and platform listeners on exit.
- Keep platform differences behind Rust commands and capability files.

## Accessibility Rules

- Use semantic HTML, native controls, ARIA only where native semantics are insufficient, visible focus, full keyboard operation, reduced motion, and Vitest DOM accessibility assertions.

## Owner Map

- OWN-FOUNDATION — Foundation — package.json; src/main.ts; src/style.css; tests/contract.test.ts; src-tauri/Cargo.toml; src-tauri/src/main.rs; src-tauri/src/lib.rs; src-tauri/src/platform/mod.rs; src-tauri/tests/contract_tests.rs; src-tauri/tauri.conf.json; src-tauri/capabilities/default.json; app-icon.svg; README.md; tsconfig.json; vite.config.ts; index.html; src/api.ts; src/errors.ts; src/ui.ts; src/store.ts; tests/store.test.ts; tests/kit.test.ts; tests/ui.test.ts; scripts/package_linux.sh; src-tauri/build.rs; src-tauri/rustfmt.toml; src-tauri/src/error.rs; src-tauri/src/database.rs; src-tauri/tests/kit_tests.rs — tests/contract.test.ts — create PHASE-01-FOUNDATION — modify none
- OWN-DATA-STORE — DataStore — src-tauri/src/platform/datastore.rs — src-tauri/tests/datastore_tests.rs — create PHASE-02-DATA-STORE — later phases that edit this owner's own file: PHASE-04-PERMISSION-COORDINATOR
- OWN-LIFECYCLE-COORDINATOR — LifecycleCoordinator — src-tauri/src/platform/lifecyclecoordinator.rs — src-tauri/tests/lifecyclecoordinator_tests.rs — create PHASE-03-LIFECYCLE-COORDINATOR — later phases that edit this owner's own file: none
- OWN-PERMISSION-COORDINATOR — PermissionCoordinator — src-tauri/src/platform/permissioncoordinator.rs — src-tauri/tests/permissioncoordinator_tests.rs — create PHASE-04-PERMISSION-COORDINATOR — later phases that edit this owner's own file: none
- OWN-SINGLE-NOTE-EDITOR — SingleNoteEditorFeature — src/features/singlenoteeditorfeature.ts — tests/features/singlenoteeditorfeature.test.ts — create PHASE-05-SINGLE-NOTE-EDITOR — later phases that edit this owner's own file: none
- OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — OpenPlainTextFileToReplaceNoteFeature — src/features/openplaintextfiletoreplacenotefeature.ts — tests/features/openplaintextfiletoreplacenotefeature.test.ts — create PHASE-06-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — later phases that edit this owner's own file: none
- OWN-SAVE-NOTE-AS-MARKDOWN-FILE — SaveNoteAsMarkdownFileFeature — src/features/savenoteasmarkdownfilefeature.ts — tests/features/savenoteasmarkdownfilefeature.test.ts — create PHASE-07-SAVE-NOTE-AS-MARKDOWN-FILE — later phases that edit this owner's own file: none
- OWN-PACKAGING — Packaging — src-tauri/src/platform/packaging.rs — src-tauri/tests/packaging_tests.rs — create PHASE-08-PACKAGING — later phases that edit this owner's own file: none
- Shared file src-tauri/src/lib.rs — edited by TASK-02-DATA-STORE, TASK-03-LIFECYCLE-COORDINATOR, TASK-04-PERMISSION-COORDINATOR, TASK-08-PACKAGING in task order; each task edits it only to register or wire its own owner
- Shared file src-tauri/src/platform/mod.rs — edited by TASK-02-DATA-STORE, TASK-03-LIFECYCLE-COORDINATOR, TASK-04-PERMISSION-COORDINATOR, TASK-08-PACKAGING in task order; each task edits it only to register or wire its own owner
- Shared file src-tauri/tests/kit_tests.rs — edited by TASK-02-DATA-STORE, TASK-03-LIFECYCLE-COORDINATOR, TASK-04-PERMISSION-COORDINATOR, TASK-08-PACKAGING in task order; each task edits it only to register or wire its own owner
- Shared file src-tauri/src/database.rs — edited by TASK-02-DATA-STORE in task order; each task edits it only to register or wire its own owner
- Shared file src/main.ts — edited by TASK-05-SINGLE-NOTE-EDITOR, TASK-06-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE, TASK-07-SAVE-NOTE-AS-MARKDOWN-FILE, TASK-08-PACKAGING in task order; each task edits it only to register or wire its own owner
- Shared file src-tauri/Cargo.toml — edited by TASK-08-PACKAGING in task order; each task edits it only to register or wire its own owner
- Shared file src-tauri/capabilities/default.json — edited by TASK-08-PACKAGING in task order; each task edits it only to register or wire its own owner

## Required Phase Order

1. PHASE-01-FOUNDATION: Locked foundation; depends on nothing; tasks TASK-01-FOUNDATION
2. PHASE-02-DATA-STORE: DataStore; depends on PHASE-01-FOUNDATION; tasks TASK-02-DATA-STORE
3. PHASE-03-LIFECYCLE-COORDINATOR: LifecycleCoordinator; depends on PHASE-01-FOUNDATION; tasks TASK-03-LIFECYCLE-COORDINATOR
4. PHASE-04-PERMISSION-COORDINATOR: PermissionCoordinator; depends on PHASE-01-FOUNDATION; tasks TASK-04-PERMISSION-COORDINATOR
5. PHASE-05-SINGLE-NOTE-EDITOR: SingleNoteEditorFeature; depends on PHASE-01-FOUNDATION, PHASE-02-DATA-STORE, PHASE-03-LIFECYCLE-COORDINATOR; tasks TASK-05-SINGLE-NOTE-EDITOR
6. PHASE-06-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE: OpenPlainTextFileToReplaceNoteFeature; depends on PHASE-01-FOUNDATION, PHASE-02-DATA-STORE, PHASE-03-LIFECYCLE-COORDINATOR, PHASE-04-PERMISSION-COORDINATOR, PHASE-05-SINGLE-NOTE-EDITOR; tasks TASK-06-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
7. PHASE-07-SAVE-NOTE-AS-MARKDOWN-FILE: SaveNoteAsMarkdownFileFeature; depends on PHASE-01-FOUNDATION, PHASE-02-DATA-STORE, PHASE-03-LIFECYCLE-COORDINATOR, PHASE-04-PERMISSION-COORDINATOR, PHASE-05-SINGLE-NOTE-EDITOR; tasks TASK-07-SAVE-NOTE-AS-MARKDOWN-FILE
8. PHASE-08-PACKAGING: Packaging; depends on PHASE-01-FOUNDATION, PHASE-02-DATA-STORE, PHASE-03-LIFECYCLE-COORDINATOR, PHASE-06-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE, PHASE-04-PERMISSION-COORDINATOR, PHASE-07-SAVE-NOTE-AS-MARKDOWN-FILE, PHASE-05-SINGLE-NOTE-EDITOR; tasks TASK-08-PACKAGING

## Validation Gates

1. Run `npm run typecheck` and require exit status zero.
2. Run `npm test` and require exit status zero.
3. Run `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and require exit status zero.
4. Run `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` and require exit status zero.
5. Run `cargo test --manifest-path src-tauri/Cargo.toml` and require exit status zero.
6. Run `npm run tauri -- build --no-bundle` and require exit status zero.
7. Run `./scripts/package_linux.sh` and require exit status zero.

## Stop Conditions

- Stop when a requested implementation decision is absent from all five documents.
- Stop when an ID, owner, file, focused test, dependency, or command conflicts across documents.
- Stop when a task would modify a file before its create task.
- Stop when a forbidden technology or undeclared remote service is required.
- Stop when a relevant test, build, package, signing, install, or launch check fails after root-cause diagnosis.
- Report the exact blocker without claiming completion.
- Report PARTIAL, not DONE, while any production entry point uses a test double or any CON-RUNTIME-WIRING check fails.

## Completion Reporting

- DONE: every declared feature and contract is implemented, every required command passed, the artifact was verified, and no required work remains.
- PARTIAL: safe implemented work is verified but a named external proof or user-controlled action remains; list it precisely.
- BLOCKED: an exact missing authority, unavailable dependency, unsafe conflict, or repeated external failure prevents further safe progress; include the failing command and next action.

## Review Checklist

- Product and non-goal boundaries match PRD.md.
- Architecture and state ownership match ARD.md.
- Stack, files, contracts, permissions, persistence, credentials, lifecycle, recovery, packaging, and signing match TRD.md.
- Task and phase ordering match TASKS.md.
- Focused tests and every final command passed with fresh output.

## Traceability Index

- FEAT-SINGLE-NOTE-EDITOR — Single note editor — Requirement REQ-SINGLE-NOTE-EDITOR — Owner OWN-SINGLE-NOTE-EDITOR — Task TASK-05-SINGLE-NOTE-EDITOR depends on TASK-01-FOUNDATION, TASK-02-DATA-STORE, TASK-03-LIFECYCLE-COORDINATOR
- FEAT-SAVE-NOTE-AS-MARKDOWN-FILE — Save note as Markdown file — Requirement REQ-SAVE-NOTE-AS-MARKDOWN-FILE — Owner OWN-SAVE-NOTE-AS-MARKDOWN-FILE — Task TASK-07-SAVE-NOTE-AS-MARKDOWN-FILE depends on TASK-01-FOUNDATION, TASK-02-DATA-STORE, TASK-03-LIFECYCLE-COORDINATOR, TASK-04-PERMISSION-COORDINATOR, TASK-05-SINGLE-NOTE-EDITOR
- FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Open plain text file to replace note — Requirement REQ-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Owner OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Task TASK-06-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE depends on TASK-01-FOUNDATION, TASK-02-DATA-STORE, TASK-03-LIFECYCLE-COORDINATOR, TASK-04-PERMISSION-COORDINATOR, TASK-05-SINGLE-NOTE-EDITOR
- REQ-SINGLE-NOTE-EDITOR — Feature FEAT-SINGLE-NOTE-EDITOR
- REQ-SAVE-NOTE-AS-MARKDOWN-FILE — Feature FEAT-SAVE-NOTE-AS-MARKDOWN-FILE
- REQ-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Feature FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-01 — Features FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Owner OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-02 — Features FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Owner OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-03 — Features FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Owner OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- ACC-SAVE-NOTE-AS-MARKDOWN-FILE-01 — Features FEAT-SAVE-NOTE-AS-MARKDOWN-FILE — Owner OWN-SAVE-NOTE-AS-MARKDOWN-FILE
- ACC-SAVE-NOTE-AS-MARKDOWN-FILE-02 — Features FEAT-SAVE-NOTE-AS-MARKDOWN-FILE — Owner OWN-SAVE-NOTE-AS-MARKDOWN-FILE
- ACC-SAVE-NOTE-AS-MARKDOWN-FILE-03 — Features FEAT-SAVE-NOTE-AS-MARKDOWN-FILE — Owner OWN-SAVE-NOTE-AS-MARKDOWN-FILE
- ACC-SAVE-NOTE-AS-MARKDOWN-FILE-04 — Features FEAT-SAVE-NOTE-AS-MARKDOWN-FILE — Owner OWN-SAVE-NOTE-AS-MARKDOWN-FILE
- ACC-SINGLE-NOTE-EDITOR-01 — Features FEAT-SINGLE-NOTE-EDITOR — Owner OWN-SINGLE-NOTE-EDITOR
- ACC-SINGLE-NOTE-EDITOR-02 — Features FEAT-SINGLE-NOTE-EDITOR — Owner OWN-SINGLE-NOTE-EDITOR
- ACC-SINGLE-NOTE-EDITOR-03 — Features FEAT-SINGLE-NOTE-EDITOR — Owner OWN-SINGLE-NOTE-EDITOR
- ACC-SINGLE-NOTE-EDITOR-04 — Features FEAT-SINGLE-NOTE-EDITOR — Owner OWN-SINGLE-NOTE-EDITOR
- CON-SINGLE-NOTE-EDITOR-INTERFACE — interface — Owner OWN-SINGLE-NOTE-EDITOR — Features FEAT-SINGLE-NOTE-EDITOR
- CON-SINGLE-NOTE-EDITOR-RECOVERY — recovery — Owner OWN-SINGLE-NOTE-EDITOR — Features FEAT-SINGLE-NOTE-EDITOR
- CON-SAVE-NOTE-AS-MARKDOWN-FILE-INTERFACE — interface — Owner OWN-SAVE-NOTE-AS-MARKDOWN-FILE — Features FEAT-SAVE-NOTE-AS-MARKDOWN-FILE
- CON-SAVE-NOTE-AS-MARKDOWN-FILE-RECOVERY — recovery — Owner OWN-SAVE-NOTE-AS-MARKDOWN-FILE — Features FEAT-SAVE-NOTE-AS-MARKDOWN-FILE
- CON-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-INTERFACE — interface — Owner OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Features FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- CON-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-RECOVERY — recovery — Owner OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Features FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- CON-DATA-NOTE — data — Owner OWN-DATA-STORE — Features FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- CON-DATA-MARKDOWN-EXPORT-FILE — data — Owner OWN-DATA-STORE — Features FEAT-SAVE-NOTE-AS-MARKDOWN-FILE
- CON-LIFECYCLE-APPLICATION-LAUNCH — lifecycle — Owner OWN-LIFECYCLE-COORDINATOR — Features none
- CON-LIFECYCLE-APPLICATION-TERMINATION — lifecycle — Owner OWN-LIFECYCLE-COORDINATOR — Features none
- CON-LIFECYCLE-PRESET — lifecycle — Owner OWN-LIFECYCLE-COORDINATOR — Features FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- CON-PERSISTENCE-NOTE — persistence — Owner OWN-DATA-STORE — Features FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- CON-PERSISTENCE-MARKDOWN-EXPORT-FILE — persistence — Owner OWN-DATA-STORE — Features FEAT-SAVE-NOTE-AS-MARKDOWN-FILE
- CON-PERMISSION-FILESYSTEM — permission — Owner OWN-PERMISSION-COORDINATOR — Features FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- CON-SECURITY-BOUNDARY — security — Owner OWN-PACKAGING — Features FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- CON-PACKAGING-RELEASE — packaging — Owner OWN-PACKAGING — Features FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- CON-PRESET-OPTIONS — packaging — Owner OWN-PACKAGING — Features FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- CON-PLATFORM-FILES — security — Owner OWN-PACKAGING — Features FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- CON-RUNTIME-WIRING — packaging — Owner OWN-PACKAGING — Features FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
