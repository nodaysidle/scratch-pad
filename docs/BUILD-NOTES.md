# Build Notes — Scratch Pad

This document records ambiguities, environmental constraints, and technical choices encountered during the build of Scratch Pad.

---

### Entry 1: Vitest Raw Import for CSS in Foundation Contract Test

- **Task**: TASK-01-FOUNDATION
- **Document and Heading**: `TASKS.md` — `### TASK-01-FOUNDATION — Foundation setup`
- **Exact Sentence**: `- Acceptance criteria: ... Every file listed in kit/README.md is copied to the matching path in the project root and is not empty; ... tests/contract.test.ts passes.`
- **What was unclear**: In Vitest / Vite 7 under happy-dom, standard ESM raw query import (`import css from '../src/style.css?raw'`) returned an empty string in the test runner environment, causing the assertion that `src/style.css` is non-empty to fail despite the file being 3,463 bytes on disk.
- **What was chosen**: In `tests/contract.test.ts`, verified existence and non-emptiness of `src/style.css` using `import.meta.glob('../src/style.css', { query: '?raw', import: 'default', eager: true })` and checked the resulting module dictionary, ensuring tests reliably pass in both browser and headless test environments without altering `src/style.css`.

---

### Entry 2: Outdated GNU Binutils in Upstream LinuxDeploy AppImage

- **Task**: TASK-08-PACKAGING
- **Document and Heading**: `TASKS.md` — `### TASK-08-PACKAGING — Packaging`
- **Exact Sentence**: `- Verification commands: ... ./scripts/package_linux.sh`
- **What was unclear**: The upstream `linuxdeploy-x86_64.AppImage` downloaded by Tauri into `~/.cache/tauri` packages GNU Binutils 2.35 from 2020. Modern Arch Linux shared libraries use the `.relr.dyn` section type (`0x13`). The older bundled `strip` binary failed with `strip: ...: unknown type [0x13] section '.relr.dyn'` and terminated with exit code 1 during library deployment.
- **What was chosen**: Extracted `linuxdeploy-x86_64.AppImage`, replaced its internal `/usr/bin/strip` with a proxy forwarding to host `/usr/bin/strip` (GNU Binutils 2.47), and repacked it using host `appimagetool` as an ELF binary so it withstands Tauri's 3-byte magic-zeroing offset (`dd seek=8 conv=notrunc`).

---

### Entry 3: Modern Arch Linux gdk-pixbuf Layout in linuxdeploy-plugin-gtk.sh

- **Task**: TASK-08-PACKAGING
- **Document and Heading**: `TASKS.md` — `### TASK-08-PACKAGING — Packaging`
- **Exact Sentence**: `- Verification commands: ... ./scripts/package_linux.sh`
- **What was unclear**: Upstream `linuxdeploy-plugin-gtk.sh` assumes `/usr/lib/gdk-pixbuf-2.0/2.10.0` exists as a directory. On modern Arch Linux, gdk-pixbuf loaders are compiled directly into the library, and that directory does not exist on disk. `realpath` failed on the missing path, and redirecting `gdk-pixbuf-query-loaders` failed with `No such file or directory` because the target directory was not created.
- **What was chosen**: In `~/.cache/tauri/linuxdeploy-plugin-gtk.sh`, added a missing-path check in `copy_lib_tree` (`[ -e "$elem" ] || continue`), ensured `mkdir -p "$(dirname ...)"` runs before writing `loaders.cache`, and guarded the `sed -i` substitution so it only runs when `loaders.cache` is present.
