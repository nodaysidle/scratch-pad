# Scratch Pad starter kit

Tested starting code for the Tauri plumbing in TRD.md. Before TASK-01, copy every file below from kit/ to the same path in the project root. The task that owns a file starts from this content and extends it; keep every behavior listed here.

- package.json
- tsconfig.json
- vite.config.ts
- index.html
- src/api.ts
- src/errors.ts
- src/ui.ts
- src/store.ts
- tests/store.test.ts
- src/main.ts
- src/style.css
- tests/kit.test.ts
- tests/ui.test.ts
- app-icon.svg
- scripts/package_linux.sh
- src-tauri/Cargo.toml
- src-tauri/build.rs
- src-tauri/rustfmt.toml
- src-tauri/src/main.rs
- src-tauri/src/lib.rs
- src-tauri/src/platform/mod.rs
- src-tauri/src/error.rs
- src-tauri/src/database.rs
- src-tauri/tests/kit_tests.rs
- src-tauri/tauri.conf.json
- src-tauri/capabilities/default.json

## Behavior to keep

- src/store.ts: createStore(initial) is the one shared view state (get, set(patch), subscribe) and createSlots() the named mount points (host(name), mount(name, element); mountRow(name, render) and row(name, record) for a control that repeats in every list row; handle(name, action) and run(name) for an action a shared control runs). The task that builds the main screen creates the store and places every host; a later task never edits that task's file: it reads the store, calls store.set, subscribes to re-render its own view, and mounts its control from src/main.ts with slots.mount.
- Time: no kit file reads the clock. A feature that needs the time takes now: () => Date in the dependencies object of its factory; src/main.ts passes () => new Date() to every such factory, so every task sees the same today, and a test passes a fake clock.
- src/errors.ts: errors.show(message, onRetry?) shows a message; passing onRetry adds a Retry button that repeats the failed command (the banner has no other retry control). src/ui.ts confirmDialog(message, confirmLabel) is the in-page confirmation (Cancel and the confirm button; Escape cancels), styled in src/style.css.
- src-tauri/src/lib.rs: app_builder registers every plugin and command and nothing else; run() owns the only setup closure, because Builder::setup replaces any earlier one. Add each new command to generate_handler! and each new store to manage_state.
- manage_state(app, folder) opens every store in one folder: run() passes app_data_dir(), tests pass a temporary folder, so tests never touch real app data.
- src-tauri/tests/kit_tests.rs builds app_builder(mock_builder()) with the app's own context() and calls commands through get_ipc_response from the devUrl origin (http://localhost:1420); a request from any other origin is refused. Keep this test passing as commands are added.
- Every command returns Result<T, AppError>; AppError carries a fallback message written for the user, which errors.report() shows when no feature string applies. Every user-visible string the PRD states (a failure message, a label, an empty state) comes from the PRD and is shown with errors.show(), never errors.report(); the PRD string wins over any AppError message this kit or a command produces. Never show a raw runtime error.
- src-tauri/capabilities/default.json lists only core:default, core:window:allow-destroy (so the editor can flush its pending save before the window closes), and the permissions of the plugins lib.rs initializes. Add a permission only with the plugin feature that needs it.
- Its windows array starts as ["main"]. When a feature opens another window, give it a fixed label and add that label there, or Tauri refuses every command the window calls. Create that window fresh each time it opens (close it, never just hide it), so it always loads current data.
- database.rs applies MIGRATIONS in order and records the schema version in PRAGMA user_version; append new migrations, never edit a shipped one. database::open creates the data folder (create_dir_all) before opening records.sqlite3, so a launch step that opens the store before manage_state still works on a fresh install.
- src-tauri/tests/kit_tests.rs compares schema_version with database::MIGRATIONS.len(), so adding a migration needs no edit to that test.
- scripts/package_linux.sh builds the AppImage, writes dist/, and with --install installs it under ~/.local/bin with a desktop entry and icon. On Arch/Omarchy use it for local proof; the AppImage runs on Wayland with GDK_BACKEND=wayland.
- Versions are exact (= in Cargo.toml, no ^ in package.json) because they are tested together; keep src-tauri/Cargo.lock and package-lock.json from the first build, and change a version only on purpose, never by a broad update.
- Screens are built from src/ui.ts and the classes in src/style.css, never from unstyled elements: button() is sized to its label (primary for the one main action); toolbar() holds a search field and actions; setEnabled() disables a command until it has something to act on (Edit, Delete, Copy with nothing selected); emptyState(title, hint) fills an empty list with one centered message saying how to fill it; list rows use .row with aria-selected for the selection and clampedText() so long text is cut to a few lines with the full text on hover, never a scroll area inside a scrolling list; a form is built from field(label, control) lines, one per input, with the label above its control; the detail view of the selected record and a form shell are each a panel(); stored text that can hold line breaks (a note, a snippet, a description) is shown with multilineText(text), which keeps line breaks and indentation and wraps long lines, and is edited in a textarea; body text uses the system font, and monospace only for code.
- src/style.css uses the system font and light and dark system colors; the page never scrolls, and .app-content scrolls inside the window.
- No task edits src/style.css: the helpers and classes above cover the screens of this packet. A look they do not cover is set in the feature's own file through single properties of the element's style object (element.style.gap = "8px"); the content security policy (style-src 'self') blocks a style attribute, setAttribute("style", ...), style.cssText and a style element, but not single style properties.
