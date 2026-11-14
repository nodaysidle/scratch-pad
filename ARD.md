# Architecture Requirements Document — Scratch Pad

## Document Purpose

Lock architecture boundaries, component ownership, runtime flows, state placement, platform lifecycle, persistence, security, integrations, and trade-offs without changing product scope.

## Architecture Summary

Scratch Pad is a single-note app: the user types into one text area, the text is saved automatically one second after typing stops, the text can be saved to a Markdown file the user chooses, a plain text file the user chooses can replace the text after confirmation, and the text is stored on the device and restored after restart. The implementation uses the Tauri 2 Rust + TypeScript Desktop contract in linux-desktop runtime mode.

## Architectural Style

- Preset-owned Tauri 2 Rust + TypeScript Desktop architecture
- The TypeScript DOM frontend owns presentation and sends typed Tauri invoke requests; Rust commands own filesystem, persistence, and platform operations behind least-privilege capabilities.
- Managed Rust state owns cancellable operations and returns allowlisted serializable results; frontend state never receives unrestricted paths.
- Vertical feature owners with explicit platform-boundary owners
- One-way feature and contract dependencies following the phase graph
- Local-first state unless product semantics explicitly require a remote service

## Runtime Boundaries

- FEAT-SINGLE-NOTE-EDITOR — Single note editor: The main window shows exactly one text area holding the single note. On app start the stored note is loaded into the text area; if no note has been stored yet the text area is empty. Every keystroke updates the in-memory text, and one second after the last keystroke the full text is written to the device store, replacing the previous stored text. If the user types again before the one-second delay elapses, the pending save is restarted so only the latest text is written. The text area accepts any text including empty text; saving empty text stores an empty note. If loading the stored note fails, the text area is shown empty and one error message states the note could not be loaded.
- FEAT-SAVE-NOTE-AS-MARKDOWN-FILE — Save note as Markdown file: Activating the control opens a Save panel where the user chooses the destination and file name; the suggested file name is the note's first line in lower case with its words joined, followed by the date as dd-mm-yyyy, for example apikeys-14-11-2026.md, or scratchpad-14-11-2026.md when the note has no usable first line. The file is written as Markdown with a level-one heading line '# Scratch Pad', one blank line, then the note text exactly as it appears in the text area, with no trailing newline added beyond the note text. The write replaces the whole file atomically so a failed write leaves any existing file at that location unchanged. On success a confirmation message states the file was saved. If the user cancels the Save panel nothing is written and no message is shown.
- FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Open plain text file to replace note: Activating the control opens an Open panel where the user chooses a plain text file. After a file is chosen, a confirmation dialog asks 'Replace the current note with the contents of this file?' with the labels Replace and Cancel. Choosing Cancel leaves the note text unchanged and writes nothing. Choosing Replace reads the file as UTF-8 text, puts that text into the text area, and immediately stores it as the note, replacing the previous stored text. If the file cannot be read as UTF-8 text, the note text is left unchanged and one error message states the file could not be opened.

## Component and Ownership Map

- OWN-FOUNDATION — Foundation owns package.json, src/main.ts, src/style.css, tests/contract.test.ts, src-tauri/Cargo.toml, src-tauri/src/main.rs, src-tauri/src/lib.rs, src-tauri/src/platform/mod.rs, src-tauri/tests/contract_tests.rs, src-tauri/tauri.conf.json, src-tauri/capabilities/default.json, app-icon.svg, README.md, tsconfig.json, vite.config.ts, index.html, src/api.ts, src/errors.ts, src/ui.ts, src/store.ts, tests/store.test.ts, tests/kit.test.ts, tests/ui.test.ts, scripts/package_linux.sh, src-tauri/build.rs, src-tauri/rustfmt.toml, src-tauri/src/error.rs, src-tauri/src/database.rs, src-tauri/tests/kit_tests.rs; focused test tests/contract.test.ts; create phase PHASE-01-FOUNDATION
- OWN-DATA-STORE — DataStore owns src-tauri/src/platform/datastore.rs; focused test src-tauri/tests/datastore_tests.rs; create phase PHASE-02-DATA-STORE; registration edits are listed per task in TASKS.md
- OWN-LIFECYCLE-COORDINATOR — LifecycleCoordinator owns src-tauri/src/platform/lifecyclecoordinator.rs; focused test src-tauri/tests/lifecyclecoordinator_tests.rs; create phase PHASE-03-LIFECYCLE-COORDINATOR; registration edits are listed per task in TASKS.md
- OWN-PERMISSION-COORDINATOR — PermissionCoordinator owns src-tauri/src/platform/permissioncoordinator.rs; focused test src-tauri/tests/permissioncoordinator_tests.rs; create phase PHASE-04-PERMISSION-COORDINATOR; registration edits are listed per task in TASKS.md
- OWN-SINGLE-NOTE-EDITOR — SingleNoteEditorFeature owns src/features/singlenoteeditorfeature.ts; focused test tests/features/singlenoteeditorfeature.test.ts; create phase PHASE-05-SINGLE-NOTE-EDITOR; registration edits are listed per task in TASKS.md
- OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — OpenPlainTextFileToReplaceNoteFeature owns src/features/openplaintextfiletoreplacenotefeature.ts; focused test tests/features/openplaintextfiletoreplacenotefeature.test.ts; create phase PHASE-06-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE; registration edits are listed per task in TASKS.md
- OWN-SAVE-NOTE-AS-MARKDOWN-FILE — SaveNoteAsMarkdownFileFeature owns src/features/savenoteasmarkdownfilefeature.ts; focused test tests/features/savenoteasmarkdownfilefeature.test.ts; create phase PHASE-07-SAVE-NOTE-AS-MARKDOWN-FILE; registration edits are listed per task in TASKS.md
- OWN-PACKAGING — Packaging owns src-tauri/src/platform/packaging.rs; focused test src-tauri/tests/packaging_tests.rs; create phase PHASE-08-PACKAGING; registration edits are listed per task in TASKS.md

## Runtime Flows

1. Single note editor outcome: The user types in the text area, or the app starts. → The main window shows exactly one text area holding the single note. On app start the stored note is loaded into the text area; if no note has been stored yet the text area is empty. Every keystroke updates the in-memory text, and one second after the last keystroke the full text is written to the device store, replacing the previous stored text. If the user types again before the one-second delay elapses, the pending save is restarted so only the latest text is written. The text area accepts any text including empty text; saving empty text stores an empty note. If loading the stored note fails, the text area is shown empty and one error message states the note could not be loaded. → The user types freely in one text area and the note is kept on the device and restored after restart.
2. Save note as Markdown file outcome: The user activates the Save as Markdown control. → Activating the control opens a Save panel where the user chooses the destination and file name; the suggested file name is the note's first line in lower case with its words joined, followed by the date as dd-mm-yyyy, for example apikeys-14-11-2026.md, or scratchpad-14-11-2026.md when the note has no usable first line. The file is written as Markdown with a level-one heading line '# Scratch Pad', one blank line, then the note text exactly as it appears in the text area, with no trailing newline added beyond the note text. The write replaces the whole file atomically so a failed write leaves any existing file at that location unchanged. On success a confirmation message states the file was saved. If the user cancels the Save panel nothing is written and no message is shown. → The user saves the current note text to a Markdown file at a location the user chooses.
3. Open plain text file to replace note outcome: The user activates the Open text file control. → Activating the control opens an Open panel where the user chooses a plain text file. After a file is chosen, a confirmation dialog asks 'Replace the current note with the contents of this file?' with the labels Replace and Cancel. Choosing Cancel leaves the note text unchanged and writes nothing. Choosing Replace reads the file as UTF-8 text, puts that text into the text area, and immediately stores it as the note, replacing the previous stored text. If the file cannot be read as UTF-8 text, the note text is left unchanged and one error message states the file could not be opened. → The user replaces the note text with the contents of a plain text file the user chooses, after confirming.

## State Ownership

- Persistence: enabled and local-first; record collections use SQLite through a Rust repository boundary.
- Settings placement: No data object uses settings storage, so the app writes no settings file.
- Record placement: SQLite in the Tauri app-data directory through rusqlite (bundled) in Rust, never tauri-plugin-sql; migrations and transactions are owned by Rust, PRAGMA user_version stores the schema version.
- OWN-DATA-STORE owns state mutated through src-tauri/src/platform/datastore.rs.
- OWN-LIFECYCLE-COORDINATOR owns state mutated through src-tauri/src/platform/lifecyclecoordinator.rs.
- OWN-PERMISSION-COORDINATOR owns state mutated through src-tauri/src/platform/permissioncoordinator.rs.
- OWN-SINGLE-NOTE-EDITOR owns state mutated through src/features/singlenoteeditorfeature.ts.
- OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE owns state mutated through src/features/openplaintextfiletoreplacenotefeature.ts.
- OWN-SAVE-NOTE-AS-MARKDOWN-FILE owns state mutated through src/features/savenoteasmarkdownfilefeature.ts.
- OWN-PACKAGING owns state mutated through src-tauri/src/platform/packaging.rs.

## Platform Lifecycle

- CON-LIFECYCLE-APPLICATION-LAUNCH: Initialize preset-owned state and services without starting privileged capture, remote requests, or destructive work automatically. Cleanup: Rollback partial initialization and keep a safe retry or manual launch path.
- CON-LIFECYCLE-APPLICATION-TERMINATION: Stop new work, cancel active operations, and preserve only state covered by the persistence contracts, except that the single note editor flushes its pending debounced save on window close. Cleanup: Release permissions, listeners, handles, tasks, and temporary resources before termination completes.
- CON-LIFECYCLE-PRESET: Use tauri::Builder as the cross-platform desktop entry. Close managed tasks, database handles, and platform listeners on exit. Keep platform differences behind Rust commands and capability files. Cleanup: Restore the last safe lifecycle state, release partial resources, and rerun the focused lifecycle checks.

## Persistence Placement

- Persistence: enabled and local-first; record collections use SQLite through a Rust repository boundary.
- Settings: No data object uses settings storage, so the app writes no settings file.
- Records: SQLite in the Tauri app-data directory through rusqlite (bundled) in Rust, never tauri-plugin-sql; migrations and transactions are owned by Rust, PRAGMA user_version stores the schema version.

## Security Boundaries

- Minimize collected data and keep it inside the preset-defined owner, storage, and integration boundaries.
- Protect Note as personal data and never expose it through logs or diagnostics.
- Protect Markdown export file as personal data and never expose it through logs or diagnostics.
- CON-PERMISSION-FILESYSTEM: Use tauri-plugin-dialog only to let the user choose paths; Rust commands read and write only those chosen paths, including paths saved earlier to reopen, with std::fs after canonicalizing each existing path (for a save target that may not exist yet, its parent directory); the frontend gets no tauri-plugin-fs access.
- CON-SECURITY-BOUNDARY: Minimize collected data and keep it inside the preset-defined owner, storage, and integration boundaries. Protect Note as personal data and never expose it through logs or diagnostics. Protect Markdown export file as personal data and never expose it through logs or diagnostics.
- CON-PLATFORM-FILES: Read and write only paths the user chooses through the dialog; the app never scans a broad folder or keeps a copy of a user document.
- CON-PLATFORM-THEME: One fixed exception to CON-PLATFORM-FILES: the app reads the active Omarchy theme palette at ~/.config/omarchy/current/theme/colors.toml through the theme_palette command. It is read-only, never written, and only an allowlist of colour keys with validated #rrggbb values (plus mode light or dark) reaches the frontend.
- CON-PLATFORM-FONT: A second fixed exception to CON-PLATFORM-FILES: the app reads the font size from the default terminal's config (~/.config/xdg-terminals.list, then ghostty/config, alacritty/alacritty.toml, kitty/kitty.conf or foot/foot.ini) through the terminal_font command. It is read-only, and only one validated number (6 to 72 points) reaches the frontend.

## Accessibility Boundary

- Use semantic HTML, native controls, ARIA only where native semantics are insufficient, visible focus, full keyboard operation, reduced motion, and Vitest DOM accessibility assertions.

## External Integration Placement

- Standalone local application: no remote network endpoints, cloud credentials, or third-party web services are used.
- No external service is activated by this product contract.

## Recovery Architecture

- Return one allowlisted error enum through each Tauri command and preserve the last valid frontend state.
- Use cancellation tokens and scoped Rust resources; roll back transactions before reporting a terminal result.

## Packaging and Installation

- Build the frontend with Vite and the native boundary with Cargo.
- Set tauri.conf.json productName to the locked project name.
- The packet targets Linux only: scripts/package_linux.sh builds the AppImage, and the installed desktop entry is validated before the launch smoke.
- Use least-privilege capabilities for every command and plugin.
- Verify the AppImage before the launch smoke.
- For local proof, run ./scripts/package_linux.sh --install: it builds the AppImage, installs it under ~/.local/bin with a desktop entry and icon, and keeps the previous AppImage in dist/rollback/ as the rollback copy; then launch the installed identity.
- Output artifact: Linux AppImage
- Artifact path: dist/scratch-pad.AppImage

## Architectural Trade-offs

- Preset fidelity is favored over cross-stack reuse.
- Deterministic owner and file mappings are favored over runtime plugin discovery.
- Durable local recovery is favored over transient simplicity.
- No server runtime is introduced.

## Architecture Review Checklist

- Every feature has one owner and one focused test.
- Every contract resolves to known features and one owner.
- Every modified file is created in an earlier phase.
- Persistence, permissions, credentials, lifecycle, recovery, packaging, and signing are explicit.
- No forbidden technology appears in an implementation decision.

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
