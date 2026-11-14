# Technical Requirements Document — Scratch Pad

## Document Purpose

Lock the stack, project layout, interfaces, data, integrations, lifecycle, persistence, credentials, permissions, recovery, tests, packaging, signing, validation, and completion proof.

## Locked Identity

- Project name: Scratch Pad
- Project slug: scratch-pad
- Bundle or application ID: com.scratch.pad
- Runtime mode: linux-desktop
- Output artifact: Linux AppImage
- Artifact path: dist/scratch-pad.AppImage

## Locked Stack

- Tauri 2
- Rust
- TypeScript
- Vite
- DOM-driven frontend
- platform-safe Tauri commands and capabilities
- Vitest
- Cargo test

## Runtime Architecture Contracts

- The TypeScript DOM frontend owns presentation and sends typed Tauri invoke requests; Rust commands own filesystem, persistence, and platform operations behind least-privilege capabilities.
- Managed Rust state owns cancellable operations and returns allowlisted serializable results; frontend state never receives unrestricted paths.

## Forbidden Technologies

- Forbidden: Electron
- Forbidden: Flutter
- Forbidden: SwiftUI application architecture

## Project Layout

- package.json
- src/main.ts
- src/style.css
- tests/contract.test.ts
- src-tauri/Cargo.toml
- src-tauri/src/main.rs
- src-tauri/src/lib.rs
- src-tauri/src/platform/mod.rs
- src-tauri/tests/contract_tests.rs
- src-tauri/tauri.conf.json
- src-tauri/capabilities/default.json
- app-icon.svg
- README.md
- tsconfig.json
- vite.config.ts
- index.html
- src/api.ts
- src/errors.ts
- src/ui.ts
- src/store.ts
- tests/store.test.ts
- tests/kit.test.ts
- tests/ui.test.ts
- scripts/package_linux.sh
- src-tauri/build.rs
- src-tauri/rustfmt.toml
- src-tauri/src/error.rs
- src-tauri/src/database.rs
- src-tauri/tests/kit_tests.rs
- src-tauri/src/platform/datastore.rs
- src-tauri/tests/datastore_tests.rs
- src-tauri/src/platform/lifecyclecoordinator.rs
- src-tauri/tests/lifecyclecoordinator_tests.rs
- src-tauri/src/platform/permissioncoordinator.rs
- src-tauri/tests/permissioncoordinator_tests.rs
- src/features/singlenoteeditorfeature.ts
- tests/features/singlenoteeditorfeature.test.ts
- src/features/openplaintextfiletoreplacenotefeature.ts
- tests/features/openplaintextfiletoreplacenotefeature.test.ts
- src/features/savenoteasmarkdownfilefeature.ts
- tests/features/savenoteasmarkdownfilefeature.test.ts
- src-tauri/src/platform/packaging.rs
- src-tauri/tests/packaging_tests.rs

## Owner-to-File and Focused-Test Map

- OWN-FOUNDATION — Foundation — implementation package.json — focused test tests/contract.test.ts — command npm run typecheck
- OWN-DATA-STORE — DataStore — implementation src-tauri/src/platform/datastore.rs — focused test src-tauri/tests/datastore_tests.rs — command cargo test --manifest-path src-tauri/Cargo.toml --test datastore_tests
- OWN-LIFECYCLE-COORDINATOR — LifecycleCoordinator — implementation src-tauri/src/platform/lifecyclecoordinator.rs — focused test src-tauri/tests/lifecyclecoordinator_tests.rs — command cargo test --manifest-path src-tauri/Cargo.toml --test lifecyclecoordinator_tests
- OWN-PERMISSION-COORDINATOR — PermissionCoordinator — implementation src-tauri/src/platform/permissioncoordinator.rs — focused test src-tauri/tests/permissioncoordinator_tests.rs — command cargo test --manifest-path src-tauri/Cargo.toml --test permissioncoordinator_tests
- OWN-SINGLE-NOTE-EDITOR — SingleNoteEditorFeature — implementation src/features/singlenoteeditorfeature.ts — focused test tests/features/singlenoteeditorfeature.test.ts — command npm test -- tests/features/singlenoteeditorfeature.test.ts
- OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — OpenPlainTextFileToReplaceNoteFeature — implementation src/features/openplaintextfiletoreplacenotefeature.ts — focused test tests/features/openplaintextfiletoreplacenotefeature.test.ts — command npm test -- tests/features/openplaintextfiletoreplacenotefeature.test.ts
- OWN-SAVE-NOTE-AS-MARKDOWN-FILE — SaveNoteAsMarkdownFileFeature — implementation src/features/savenoteasmarkdownfilefeature.ts — focused test tests/features/savenoteasmarkdownfilefeature.test.ts — command npm test -- tests/features/savenoteasmarkdownfilefeature.test.ts
- OWN-PACKAGING — Packaging — implementation src-tauri/src/platform/packaging.rs — focused test src-tauri/tests/packaging_tests.rs — command cargo test --manifest-path src-tauri/Cargo.toml --test packaging_tests

## Interface Contracts

### CON-SINGLE-NOTE-EDITOR-INTERFACE — Single note editor interface

- Kind: interface
- Feature trace: FEAT-SINGLE-NOTE-EDITOR
- Owner: OWN-SINGLE-NOTE-EDITOR
- Decision: The main window shows exactly one text area holding the single note. On app start the stored note is loaded into the text area; if no note has been stored yet the text area is empty. Every keystroke updates the in-memory text, and one second after the last keystroke the full text is written to the device store, replacing the previous stored text. If the user types again before the one-second delay elapses, the pending save is restarted so only the latest text is written. The text area accepts any text including empty text; saving empty text stores an empty note. If loading the stored note fails, the text area is shown empty and one error message states the note could not be loaded.
- Inputs: The user types in the text area, or the app starts.
- Outputs: The user types freely in one text area and the note is kept on the device and restored after restart.
- Failure behavior: A failed automatic save leaves the previously stored note unchanged and one error message states the note could not be saved; the text stays in the text area so the next pause in typing retries the save.
- Recovery: Preserve the last valid state, explain the failure, and allow an explicit retry of Single note editor.

### CON-SAVE-NOTE-AS-MARKDOWN-FILE-INTERFACE — Save note as Markdown file interface

- Kind: interface
- Feature trace: FEAT-SAVE-NOTE-AS-MARKDOWN-FILE
- Owner: OWN-SAVE-NOTE-AS-MARKDOWN-FILE
- Decision: Activating the control opens a Save panel where the user chooses the destination and file name; the suggested file name is the note's first line as a lowercase slug followed by the date as dd-mm-yyyy, for example apikeys-14-11-2026.md, or scratch-pad-14-11-2026.md when the note has no usable first line. The file is written as Markdown with a level-one heading line '# Scratch Pad', one blank line, then the note text exactly as it appears in the text area, with no trailing newline added beyond the note text. The write replaces the whole file atomically so a failed write leaves any existing file at that location unchanged. On success a confirmation message states the file was saved. If the user cancels the Save panel nothing is written and no message is shown.
- Inputs: The user activates the Save as Markdown control.
- Outputs: The user saves the current note text to a Markdown file at a location the user chooses.
- Failure behavior: If the file cannot be written, the existing file at the chosen location is left unchanged and one error message states the file could not be saved.
- Recovery: Preserve the last valid state, explain the failure, and allow an explicit retry of Save note as Markdown file.

### CON-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-INTERFACE — Open plain text file to replace note interface

- Kind: interface
- Feature trace: FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Owner: OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Decision: Activating the control opens an Open panel where the user chooses a plain text file. After a file is chosen, a confirmation dialog asks 'Replace the current note with the contents of this file?' with the labels Replace and Cancel. Choosing Cancel leaves the note text unchanged and writes nothing. Choosing Replace reads the file as UTF-8 text, puts that text into the text area, and immediately stores it as the note, replacing the previous stored text. If the file cannot be read as UTF-8 text, the note text is left unchanged and one error message states the file could not be opened.
- Inputs: The user activates the Open text file control.
- Outputs: The user replaces the note text with the contents of a plain text file the user chooses, after confirming.
- Failure behavior: If the chosen file cannot be read, the note text and the stored note are left unchanged and one error message states the file could not be opened.
- Recovery: Preserve the last valid state, explain the failure, and allow an explicit retry of Open plain text file to replace note.

## Data Contracts

### CON-DATA-NOTE — Note

- Kind: data
- Feature trace: FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Owner: OWN-DATA-STORE
- Decision: The single note text the user types, stored on the device and restored after restart.
- Stored fields (one record each, plus a stable generated id): text (long text).
- Store operations, exactly these and no others: create (FEAT-SINGLE-NOTE-EDITOR); read (FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE); update (FEAT-SINGLE-NOTE-EDITOR, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE).
- Interface: OWN-DATA-STORE owns every Tauri command for Note, registers them in src-tauri/src/lib.rs, and appends one migration that creates the table to database::MIGRATIONS in src-tauri/src/database.rs; it never hard-codes the schema version. Table: CREATE TABLE note (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL); the list command orders by id DESC. Rust shapes: struct Note { id: i64, text: String } and struct NoteInput with the same fields without id, both deriving Serialize, Deserialize, Clone, Debug, PartialEq; the JSON keys on the wire are exactly id, text, so TypeScript reads and writes those keys and no camelCase variant. Commands, exactly: create_note(input: NoteInput) returns Note; list_note() takes no arguments and returns every Note by descending id; get_note(id: i64) returns Note; update_note(id: i64, input: NoteInput) returns the updated Note and replaces every field with input, so the caller sends the stored value of each field it does not change. One more command, owned by OWN-DATA-STORE and registered in src-tauri/src/lib.rs, reads the file for FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE: read_text_file(path: String) returns String; path is a file the user chose in the Open dialog, Rust resolves it with the filesystem permission helper (std::fs canonicalize; it must exist and be a file, otherwise AppError invalid), reads it fully and decodes it as UTF-8 exactly as stored (no trimming, no newline changes), and returns the text; a file that is not valid UTF-8 returns AppError invalid and a read failure returns AppError storage; it never writes anything. Each returns the AppError enum on failure (not-found for an unknown id); feature tasks reach them only through the call(command, args) wrapper in src/api.ts and add no Rust command of their own. Validation: create and update accept any text for text, including empty text and text with leading or trailing whitespace: Rust stores the value exactly as given, and the editor sends the text exactly as typed, never trimmed (an empty note is a valid note); any other value rule a feature states (a minimum, a fixed set of options) is checked by that feature's form before it calls the command, and Rust checks only what is listed here.
- Wire format (every Tauri command of every data object, stated once here): ids are i64 numbers; whole numbers are i64, numbers are f64, flags are booleans; date-time values are RFC3339 UTC strings (for example 2026-01-31T09:30:00Z), created and compared as UTC and converted to local time only for display; date values are calendar days written YYYY-MM-DD in the user's local calendar and compared as days, never converted through UTC; a text-list is an array of strings; an optional field is a Rust Option and is sent and received as null when absent, never as an omitted key, an empty string, or a sentinel value; record keys are the snake_case field names, and top-level command arguments are written camelCase from TypeScript (Tauri maps them to snake_case); every failure is the AppError enum serialized as {kind: storage | not-found | invalid, message}, never a raw string. A list command takes no arguments and returns every record by descending id, which is the order of creation and not the order of any date or time field; no declared feature needs a range or limit filter, so a feature that needs a subset (such as one day or one week) filters the returned array in TypeScript, and a feature that needs another order sorts it there, breaking ties by descending id.
- Retention: Kept on the device until the user replaces it by typing or by opening a plain text file.
- Sensitivity: personal
- Failure behavior: Reject invalid or incomplete records without replacing the last valid state.
- Recovery: Preserve the last valid record: a failed command returns the AppError, leaves every stored row as it was, and the owning feature shows that message.

### CON-DATA-MARKDOWN-EXPORT-FILE — Markdown export file

- Kind: data
- Feature trace: FEAT-SAVE-NOTE-AS-MARKDOWN-FILE
- Owner: OWN-DATA-STORE
- Decision: A Markdown file the user chooses to save the note text to.
- Interface: Markdown export file is a file the user chooses, not a record: it has no id and no list, get, create, update, or delete command. OWN-DATA-STORE owns exactly these Tauri commands and registers them in src-tauri/src/lib.rs: write_markdown_export_file(path: String, content: String) returns nothing (FEAT-SAVE-NOTE-AS-MARKDOWN-FILE): path is the target the user chose in the Save dialog and may not exist yet, so Rust canonicalizes its parent directory (it must exist and be a directory, otherwise AppError invalid), joins the file name onto it, writes the content to a temporary file in that directory, syncs it, and renames it over the target; a failure removes the temporary file and leaves an existing target untouched; the feature that saves it owns the file's layout and builds the whole content string in TypeScript from its own data in the layout its behavior states, writing every date or time it shows in local time (the stored UTC value converted; this is the one time rule for every exported file; its test sets TZ or injects the offset so the exported bytes are deterministic); OWN-DATA-STORE only writes the string it is given.
- Retention: Kept at the location the user chose until the user removes it outside the app.
- Sensitivity: personal
- Failure behavior: Reject invalid or incomplete records without replacing the last valid state.
- Recovery: Preserve the last valid record: a failed command returns the AppError, leaves every stored row as it was, and the owning feature shows that message.

## External Integration Contracts

- Standalone local application: no remote network endpoints, cloud credentials, or third-party web services are used.

## Lifecycle Contracts

### CON-LIFECYCLE-APPLICATION-LAUNCH — Application launch

- Kind: lifecycle
- Feature trace: none
- Owner: OWN-LIFECYCLE-COORDINATOR
- Decision: Initialize preset-owned state and services without starting privileged capture, remote requests, or destructive work automatically.
- Cleanup: Rollback partial initialization and keep a safe retry or manual launch path.
- Failure behavior: An interrupted lifecycle transition must not be reported as complete.
- Recovery: Rollback partial initialization and keep a safe retry or manual launch path.

### CON-LIFECYCLE-APPLICATION-TERMINATION — Application termination

- Kind: lifecycle
- Feature trace: none
- Owner: OWN-LIFECYCLE-COORDINATOR
- Decision: Stop new work, cancel active operations, and preserve only state covered by the persistence contracts. The one pending debounced save of the single note is not discarded: on window close the single note editor (OWN-SINGLE-NOTE-EDITOR) flush() writes the latest text before the window is destroyed (src/main.ts registers it with onCloseRequested); if that write fails the window still closes.
- Cleanup: Release permissions, listeners, handles, tasks, and temporary resources before termination completes.
- Failure behavior: An interrupted lifecycle transition must not be reported as complete.
- Recovery: Release permissions, listeners, handles, tasks, and temporary resources before termination completes.

### CON-LIFECYCLE-PRESET — Tauri 2 Rust + TypeScript Desktop lifecycle

- Kind: lifecycle
- Feature trace: FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Owner: OWN-LIFECYCLE-COORDINATOR
- Decision: Use tauri::Builder as the cross-platform desktop entry. Close managed tasks, database handles, and platform listeners on exit. Keep platform differences behind Rust commands and capability files.
- Failure behavior: A preset lifecycle invariant failure blocks completion and leaves the last safe state active.
- Recovery: Restore the last safe lifecycle state, release partial resources, and rerun the focused lifecycle checks.

## Persistence Contracts

Persistence: enabled and local-first; record collections use SQLite through a Rust repository boundary.

### CON-PERSISTENCE-NOTE — Note persistence

- Kind: persistence
- Feature trace: FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Owner: OWN-DATA-STORE
- Decision: Persistence: enabled and local-first; record collections use SQLite through a Rust repository boundary. The single note text the user types, stored on the device and restored after restart.
- Application ID: com.scratch.pad
- Placement: SQLite in the Tauri app-data directory through rusqlite (bundled) in Rust, never tauri-plugin-sql; migrations and transactions are owned by Rust, PRAGMA user_version stores the schema version.
- Write mode: Every write commits in one SQLite transaction; a failed write rolls back and leaves the previous rows intact.
- Retention: Kept on the device until the user replaces it by typing or by opening a plain text file.
- Deletion: No feature deletes Note; build no delete action for it.
- Sensitivity: personal
- Failure behavior: A failed write leaves the prior durable state valid and the new state visibly unsaved.
- Recovery: Retry through the same atomic boundary without duplicating the record.; No feature deletes Note; build no delete action for it.

### CON-PERSISTENCE-MARKDOWN-EXPORT-FILE — Markdown export file persistence

- Kind: persistence
- Feature trace: FEAT-SAVE-NOTE-AS-MARKDOWN-FILE
- Owner: OWN-DATA-STORE
- Decision: Persistence: the document location the user chooses; the app keeps no copy. A Markdown file the user chooses to save the note text to.
- Application ID: com.scratch.pad
- Placement: Local filesystem at the path the user chooses through tauri-plugin-dialog; Rust reads or writes that exact path and nothing else.
- Write mode: Every write replaces the destination by renaming a temporary file in the same directory; a failed write leaves the previous file intact.
- Retention: Kept at the location the user chose until the user removes it outside the app.
- Deletion: No feature deletes Markdown export file; build no delete action for it.
- Sensitivity: personal
- Failure behavior: A failed save leaves the user's existing document unchanged and the new state visibly unsaved.
- Recovery: Retry through the same save boundary; never truncate or replace the user's file with partial content.; No feature deletes Markdown export file; build no delete action for it.

## Credential Contracts

No credential contract is required; no feature stores a secret.

## Permission Contracts

### CON-PERMISSION-FILESYSTEM — filesystem permission

- Kind: permission
- Feature trace: FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Owner: OWN-PERMISSION-COORDINATOR
- Decision: Use tauri-plugin-dialog only to let the user choose paths; Rust commands read and write only those chosen paths, including paths saved earlier to reopen, with std::fs after canonicalizing each existing path (for a save target that may not exist yet, its parent directory); the frontend gets no tauri-plugin-fs access.
- Purpose: Access only user-selected files and folders required by a feature.
- Denied behavior: Leave existing state unchanged and allow another explicit selection.
- Failure behavior: Leave existing state unchanged and allow another explicit selection.
- Recovery: Recheck authorization only after an explicit user action and preserve the documented denied path.

## Errors and Recovery Contracts

- Return one allowlisted error enum through each Tauri command and preserve the last valid frontend state.
- Use cancellation tokens and scoped Rust resources; roll back transactions before reporting a terminal result.

### CON-SINGLE-NOTE-EDITOR-RECOVERY — Single note editor recovery

- Kind: recovery
- Feature trace: FEAT-SINGLE-NOTE-EDITOR
- Owner: OWN-SINGLE-NOTE-EDITOR
- Decision: Treat failure as a terminal or recoverable state exactly as the semantic contract describes. Return one allowlisted error enum through each Tauri command and preserve the last valid frontend state. Use cancellation tokens and scoped Rust resources; roll back transactions before reporting a terminal result.
- Failure behavior: A failed automatic save leaves the previously stored note unchanged and one error message states the note could not be saved; the text stays in the text area so the next pause in typing retries the save.
- Recovery: Preserve the last valid state, explain the failure, and allow an explicit retry of Single note editor.

### CON-SAVE-NOTE-AS-MARKDOWN-FILE-RECOVERY — Save note as Markdown file recovery

- Kind: recovery
- Feature trace: FEAT-SAVE-NOTE-AS-MARKDOWN-FILE
- Owner: OWN-SAVE-NOTE-AS-MARKDOWN-FILE
- Decision: Treat failure as a terminal or recoverable state exactly as the semantic contract describes. Return one allowlisted error enum through each Tauri command and preserve the last valid frontend state. Use cancellation tokens and scoped Rust resources; roll back transactions before reporting a terminal result.
- Failure behavior: If the file cannot be written, the existing file at the chosen location is left unchanged and one error message states the file could not be saved.
- Recovery: Preserve the last valid state, explain the failure, and allow an explicit retry of Save note as Markdown file.

### CON-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-RECOVERY — Open plain text file to replace note recovery

- Kind: recovery
- Feature trace: FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Owner: OWN-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Decision: Treat failure as a terminal or recoverable state exactly as the semantic contract describes. Return one allowlisted error enum through each Tauri command and preserve the last valid frontend state. Use cancellation tokens and scoped Rust resources; roll back transactions before reporting a terminal result.
- Failure behavior: If the chosen file cannot be read, the note text and the stored note are left unchanged and one error message states the file could not be opened.
- Recovery: Preserve the last valid state, explain the failure, and allow an explicit retry of Open plain text file to replace note.

## Security Contract

### CON-SECURITY-BOUNDARY — Privacy and security boundary

- Kind: security
- Feature trace: FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Owner: OWN-PACKAGING
- Decision: Minimize collected data and keep it inside the preset-defined owner, storage, and integration boundaries. Protect Note as personal data and never expose it through logs or diagnostics. Protect Markdown export file as personal data and never expose it through logs or diagnostics.
- Failure behavior: A privacy or security invariant failure stops the affected operation before data crosses the boundary.
- Recovery: Restore the last safe state and require explicit user action before retrying.

### CON-PLATFORM-FILES — Local file boundary

- Kind: security
- Feature trace: FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Owner: OWN-PACKAGING
- Decision: Read and write only paths the user chooses through the dialog; the app never scans a broad folder or keeps a copy of a user document.
- Every path comes from tauri-plugin-dialog or a path the app saved to reopen.
- Rust canonicalizes the path, or the parent directory of a save target that does not exist yet, and operates on that exact path.
- The frontend receives no unrestricted filesystem scope.
- Failure behavior: A path outside the declared boundary is rejected and leaves the filesystem unchanged.
- Recovery: Return to the declared boundary, explain the rejected path, and retry only with an allowed path.

## Accessibility Contracts

- Use semantic HTML, native controls, ARIA only where native semantics are insufficient, visible focus, full keyboard operation, reduced motion, and Vitest DOM accessibility assertions.

## Testing Contract

- Framework: Vitest for frontend behavior and Cargo test for Rust boundaries
- src-tauri/tests/datastore_tests.rs: cover no direct features and contracts CON-DATA-NOTE, CON-DATA-MARKDOWN-EXPORT-FILE, CON-PERSISTENCE-NOTE, CON-PERSISTENCE-MARKDOWN-EXPORT-FILE.
- src-tauri/tests/lifecyclecoordinator_tests.rs: cover no direct features and contracts CON-LIFECYCLE-APPLICATION-LAUNCH, CON-LIFECYCLE-APPLICATION-TERMINATION, CON-LIFECYCLE-PRESET.
- src-tauri/tests/permissioncoordinator_tests.rs: cover no direct features and contracts CON-PERMISSION-FILESYSTEM.
- tests/features/singlenoteeditorfeature.test.ts: cover FEAT-SINGLE-NOTE-EDITOR and contracts CON-SINGLE-NOTE-EDITOR-INTERFACE, CON-SINGLE-NOTE-EDITOR-RECOVERY.
- tests/features/openplaintextfiletoreplacenotefeature.test.ts: cover FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE and contracts CON-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-INTERFACE, CON-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-RECOVERY.
- tests/features/savenoteasmarkdownfilefeature.test.ts: cover FEAT-SAVE-NOTE-AS-MARKDOWN-FILE and contracts CON-SAVE-NOTE-AS-MARKDOWN-FILE-INTERFACE, CON-SAVE-NOTE-AS-MARKDOWN-FILE-RECOVERY.
- src-tauri/tests/packaging_tests.rs: cover no direct features and contracts CON-SECURITY-BOUNDARY, CON-PACKAGING-RELEASE, CON-PRESET-OPTIONS, CON-PLATFORM-FILES, CON-RUNTIME-WIRING.
- Run focused tests before shared suites and package checks.

## Packaging Contract

### CON-PACKAGING-RELEASE — Tauri 2 Rust + TypeScript Desktop packaging

- Kind: packaging
- Feature trace: FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Owner: OWN-PACKAGING
- Decision: Build the frontend with Vite and the native boundary with Cargo. Set tauri.conf.json productName to the locked project name. The packet targets Linux only: scripts/package_linux.sh builds the AppImage, and the installed desktop entry is validated before the launch smoke. Use least-privilege capabilities for every command and plugin. Verify the AppImage before the launch smoke.
- Installation: For local proof, run ./scripts/package_linux.sh --install: it builds the AppImage, installs it under ~/.local/bin with a desktop entry and icon, and keeps the previous AppImage in dist/rollback/ as the rollback copy; then launch the installed identity.
- Output artifact: Linux AppImage
- Failure behavior: A failed build, signature, package, install, or launch check blocks completion.
- Recovery: Fix the first failing validation command, rebuild the artifact, and rerun every later release gate.

### CON-PRESET-OPTIONS — Preset options

- Kind: packaging
- Feature trace: FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Owner: OWN-PACKAGING
- Decision: Preset options: linuxPackaging=appimage; wayland=true.
- linuxPackaging: appimage
- wayland: true
- Failure behavior: An option outside the preset schema blocks generation; the compiler never guesses an option.
- Recovery: Correct the option and regenerate.

### CON-RUNTIME-WIRING — Runtime wiring

- Kind: packaging
- Feature trace: FEAT-SINGLE-NOTE-EDITOR, FEAT-SAVE-NOTE-AS-MARKDOWN-FILE, FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE
- Owner: OWN-PACKAGING
- Decision: The shipped app calls the real owners named in the contracts; test doubles never reach a production entry point.
- src-tauri/src/lib.rs defines a public app_builder function, generic over tauri::Runtime, that takes and returns a tauri::Builder, initializes every tauri-plugin crate listed in src-tauri/Cargo.toml and registers every #[tauri::command] with invoke_handler(tauri::generate_handler![...]), and nothing else. run() calls app_builder(tauri::Builder::default()) and owns the only setup closure.
- src/main.ts constructs every feature with the real call() from src/api.ts (the only file that imports invoke) and the initialized plugin APIs; test doubles exist only under tests/.
- The app opens one window with the fixed label main, listed in the windows array of src-tauri/capabilities/default.json.
- Before completion, launch the installed app, complete one acceptance outcome per feature, quit, relaunch, and confirm that every declared stored data object is still present.
- The launch check looks at the app, not only its accessibility tree or stored data: with each list holding several entries, one of them longer than the view is wide, it takes a screenshot of every window, menu, panel, and page and confirms by looking at each one that every heading, row, and control lies fully inside the view, long text truncates or wraps inside it, and text is readable against its background. Clipped, overlapping, or off-screen content blocks completion. If no screenshot can be taken, the completion report says so and asks the user to look instead of reporting the screens as checked.
- Every screen follows the platform's conventions: an empty list shows one centered message saying how to fill it; a command with nothing to act on is disabled until it has a target; long text in a list is cut to a few lines with the full text available, never a scroll area inside a scrolling list; buttons are sized to their label, not stretched across the window; all text uses the system monospace font. The launch check confirms each of these in its screenshots.
- Every failure behavior that shows the user a message is visible in the running app: a view renders the owning feature's error state, and no entry point silently discards an error that the PRD says the user sees. The launch check triggers one such failure per feature that has one and confirms the message appears.
- The launch check leaves no test data behind: it restores every setting it changed to its previous value and removes every record and file it created, and the completion report lists anything it could not remove.
- Launch check: scripts/package_linux.sh --install, then launch the installed Scratch Pad app and complete one acceptance outcome per feature.
- Failure behavior: A production entry point that uses a test double, or a platform owner the running app never calls, blocks completion.
- Recovery: Replace the stand-in with the concrete owner, rerun the packaging focused test, and repeat the launch check.

## Signing Contract

Local proof is unsigned. Record the SHA-256 checksum of the built AppImage in the completion report.

## Installation Contract

For local proof, run ./scripts/package_linux.sh --install: it builds the AppImage, installs it under ~/.local/bin with a desktop entry and icon, and keeps the previous AppImage in dist/rollback/ as the rollback copy; then launch the installed identity.

## Validation Commands

1. `npm run typecheck`
2. `npm test`
3. `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
4. `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
5. `cargo test --manifest-path src-tauri/Cargo.toml`
6. `npm run tauri -- build --no-bundle`
7. `./scripts/package_linux.sh`

## Completion Evidence

- TypeScript, Vitest, Rust format, Clippy, and Cargo tests pass.
- npm run tauri -- build --no-bundle compiles the release binary with the locked capabilities.
- scripts/package_linux.sh builds the AppImage, which installs and launches.
- Local data and temporary-resource cleanup survive a restart smoke.

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
