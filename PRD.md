# Product Requirements Document — Scratch Pad

## Document Purpose

Define the product boundary, users, problems, goals, journeys, feature outcomes, success criteria, and explicit scope without implementation invention.

## Product Definition

Scratch Pad is a single-note app: the user types into one text area, the text is saved automatically one second after typing stops, the text can be saved to a Markdown file the user chooses, a plain text file the user chooses can replace the text after confirmation, and the text is stored on the device and restored after restart.

## Problem Statement

People who want one always-available scratch note for quick jottings need a focused way to provide one text area for a single note without multiple notes or a note list.

## Target Users

- People who want one always-available scratch note for quick jottings
- Writers who keep a single running draft and occasionally export it as Markdown

## Goals

- Provide one text area for a single note
- Persist the note automatically one second after typing stops
- Save the note to a user-chosen Markdown file
- Replace the note from a user-chosen plain text file after confirmation
- Restore the stored note after restart

## Non-Goals

- Multiple notes or a note list
- Rich text formatting or Markdown preview
- Cloud sync or sharing

## Primary User Journeys

### Single note editor outcome

- Actor: People who want one always-available scratch note for quick jottings
- Steps: The user types in the text area, or the app starts. → The main window shows exactly one text area holding the single note. On app start the stored note is loaded into the text area; if no note has been stored yet the text area is empty. Every keystroke updates the in-memory text, and one second after the last keystroke the full text is written to the device store, replacing the previous stored text. If the user types again before the one-second delay elapses, the pending save is restarted so only the latest text is written. The text area accepts any text including empty text; saving empty text stores an empty note. If loading the stored note fails, the text area is shown empty and one error message states the note could not be loaded.
- Outcome: The user types freely in one text area and the note is kept on the device and restored after restart.

### Save note as Markdown file outcome

- Actor: People who want one always-available scratch note for quick jottings
- Steps: The user activates the Save as Markdown control. → Activating the control opens a Save panel where the user chooses the destination and file name; the suggested file name is scratch-pad.md. The file is written as Markdown with a level-one heading line '# Scratch Pad', one blank line, then the note text exactly as it appears in the text area, with no trailing newline added beyond the note text. The write replaces the whole file atomically so a failed write leaves any existing file at that location unchanged. On success a confirmation message states the file was saved. If the user cancels the Save panel nothing is written and no message is shown.
- Outcome: The user saves the current note text to a Markdown file at a location the user chooses.

### Open plain text file to replace note outcome

- Actor: People who want one always-available scratch note for quick jottings
- Steps: The user activates the Open text file control. → Activating the control opens an Open panel where the user chooses a plain text file. After a file is chosen, a confirmation dialog asks 'Replace the current note with the contents of this file?' with the labels Replace and Cancel. Choosing Cancel leaves the note text unchanged and writes nothing. Choosing Replace reads the file as UTF-8 text, puts that text into the text area, and immediately stores it as the note, replacing the previous stored text. If the file cannot be read as UTF-8 text, the note text is left unchanged and one error message states the file could not be opened.
- Outcome: The user replaces the note text with the contents of a plain text file the user chooses, after confirming.

## Screen Map

- main: Single note editor (FEAT-SINGLE-NOTE-EDITOR); Save note as Markdown file (FEAT-SAVE-NOTE-AS-MARKDOWN-FILE); Open plain text file to replace note (FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE)

## Feature Contracts

### FEAT-SINGLE-NOTE-EDITOR — Single note editor

- Behavior: The main window shows exactly one text area holding the single note. On app start the stored note is loaded into the text area; if no note has been stored yet the text area is empty. Every keystroke updates the in-memory text, and one second after the last keystroke the full text is written to the device store, replacing the previous stored text. If the user types again before the one-second delay elapses, the pending save is restarted so only the latest text is written. The text area accepts any text including empty text; saving empty text stores an empty note. If loading the stored note fails, the text area is shown empty and one error message states the note could not be loaded.
- Inputs: The user types in the text area, or the app starts.
- Outputs: The user types freely in one text area and the note is kept on the device and restored after restart.
- Acceptance outcomes: After typing text and advancing the injected clock by 1000 ms, reading the stored note returns exactly the typed text.; Typing more text 500 ms after a change and advancing the clock by 1000 ms stores only the latest text, not the intermediate text.; When the store write fails, the previously stored note read back is unchanged and the error message is shown.; With a stored note present, starting the app shows that stored text in the text area.
- Failure behavior: A failed automatic save leaves the previously stored note unchanged and one error message states the note could not be saved; the text stays in the text area so the next pause in typing retries the save.
- Recovery: Preserve the last valid state, explain the failure, and allow an explicit retry of Single note editor.

### FEAT-SAVE-NOTE-AS-MARKDOWN-FILE — Save note as Markdown file

- Behavior: Activating the control opens a Save panel where the user chooses the destination and file name; the suggested file name is scratch-pad.md. The file is written as Markdown with a level-one heading line '# Scratch Pad', one blank line, then the note text exactly as it appears in the text area, with no trailing newline added beyond the note text. The write replaces the whole file atomically so a failed write leaves any existing file at that location unchanged. On success a confirmation message states the file was saved. If the user cancels the Save panel nothing is written and no message is shown.
- Inputs: The user activates the Save as Markdown control.
- Outputs: The user saves the current note text to a Markdown file at a location the user chooses.
- Acceptance outcomes: Cancelling the Save panel writes no file and shows no message.; Saving an empty note produces a file whose content is '# Scratch Pad\n\n'.; Saving a note whose text is 'Hello' produces a file whose content is '# Scratch Pad\n\nHello'.; When the write fails, a pre-existing file at the chosen location still has its previous content.
- Failure behavior: If the file cannot be written, the existing file at the chosen location is left unchanged and one error message states the file could not be saved.
- Recovery: Preserve the last valid state, explain the failure, and allow an explicit retry of Save note as Markdown file.

### FEAT-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Open plain text file to replace note

- Behavior: Activating the control opens an Open panel where the user chooses a plain text file. After a file is chosen, a confirmation dialog asks 'Replace the current note with the contents of this file?' with the labels Replace and Cancel. Choosing Cancel leaves the note text unchanged and writes nothing. Choosing Replace reads the file as UTF-8 text, puts that text into the text area, and immediately stores it as the note, replacing the previous stored text. If the file cannot be read as UTF-8 text, the note text is left unchanged and one error message states the file could not be opened.
- Inputs: The user activates the Open text file control.
- Outputs: The user replaces the note text with the contents of a plain text file the user chooses, after confirming.
- Acceptance outcomes: Choosing Cancel in the confirmation dialog leaves the text area and the stored note unchanged.; Confirming Replace with a file containing 'Draft two' leaves the text area showing 'Draft two' and reading the stored note returns 'Draft two'.; When the chosen file cannot be read, the text area and the stored note keep their previous values and the error message is shown.
- Failure behavior: If the chosen file cannot be read, the note text and the stored note are left unchanged and one error message states the file could not be opened.
- Recovery: Preserve the last valid state, explain the failure, and allow an explicit retry of Open plain text file to replace note.

## Requirement Contracts

- REQ-SINGLE-NOTE-EDITOR — The main window shows exactly one text area holding the single note. On app start the stored note is loaded into the text area; if no note has been stored yet the text area is empty. Every keystroke updates the in-memory text, and one second after the last keystroke the full text is written to the device store, replacing the previous stored text. If the user types again before the one-second delay elapses, the pending save is restarted so only the latest text is written. The text area accepts any text including empty text; saving empty text stores an empty note. If loading the stored note fails, the text area is shown empty and one error message states the note could not be loaded. Acceptance ACC-SINGLE-NOTE-EDITOR-01, ACC-SINGLE-NOTE-EDITOR-02, ACC-SINGLE-NOTE-EDITOR-03, ACC-SINGLE-NOTE-EDITOR-04: After typing text and advancing the injected clock by 1000 ms, reading the stored note returns exactly the typed text.; Typing more text 500 ms after a change and advancing the clock by 1000 ms stores only the latest text, not the intermediate text.; When the store write fails, the previously stored note read back is unchanged and the error message is shown.; With a stored note present, starting the app shows that stored text in the text area.
- REQ-SAVE-NOTE-AS-MARKDOWN-FILE — Activating the control opens a Save panel where the user chooses the destination and file name; the suggested file name is scratch-pad.md. The file is written as Markdown with a level-one heading line '# Scratch Pad', one blank line, then the note text exactly as it appears in the text area, with no trailing newline added beyond the note text. The write replaces the whole file atomically so a failed write leaves any existing file at that location unchanged. On success a confirmation message states the file was saved. If the user cancels the Save panel nothing is written and no message is shown. Acceptance ACC-SAVE-NOTE-AS-MARKDOWN-FILE-01, ACC-SAVE-NOTE-AS-MARKDOWN-FILE-02, ACC-SAVE-NOTE-AS-MARKDOWN-FILE-03, ACC-SAVE-NOTE-AS-MARKDOWN-FILE-04: Cancelling the Save panel writes no file and shows no message.; Saving an empty note produces a file whose content is '# Scratch Pad\n\n'.; Saving a note whose text is 'Hello' produces a file whose content is '# Scratch Pad\n\nHello'.; When the write fails, a pre-existing file at the chosen location still has its previous content.
- REQ-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE — Activating the control opens an Open panel where the user chooses a plain text file. After a file is chosen, a confirmation dialog asks 'Replace the current note with the contents of this file?' with the labels Replace and Cancel. Choosing Cancel leaves the note text unchanged and writes nothing. Choosing Replace reads the file as UTF-8 text, puts that text into the text area, and immediately stores it as the note, replacing the previous stored text. If the file cannot be read as UTF-8 text, the note text is left unchanged and one error message states the file could not be opened. Acceptance ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-01, ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-02, ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-03: Choosing Cancel in the confirmation dialog leaves the text area and the stored note unchanged.; Confirming Replace with a file containing 'Draft two' leaves the text area showing 'Draft two' and reading the stored note returns 'Draft two'.; When the chosen file cannot be read, the text area and the stored note keep their previous values and the error message is shown.

## Shared End-to-End Acceptance

- No shared acceptance criterion requires the final integration and packaging gate.

## UX Requirements

- The automatic save writes the full note text one second after the last keystroke, with no partial text written.
- The stored note is restored into the text area when the app starts.
- Text typed within the last second before the window is closed is written before the app exits.

## Privacy and Security Requirements

- Minimize collected data and keep it inside the preset-defined owner, storage, and integration boundaries.
- Protect Note as personal data and never expose it through logs or diagnostics.
- Protect Markdown export file as personal data and never expose it through logs or diagnostics.

## Operational Constraints

- The app holds exactly one note; there is no list of notes.
- The note is stored on the device only; no network access is used.
- The Markdown export begins with the heading '# Scratch Pad' followed by one blank line and the note text.

## Success Criteria

- Provide one text area for a single note
- Persist the note automatically one second after typing stops
- Save the note to a user-chosen Markdown file
- Replace the note from a user-chosen plain text file after confirmation
- Restore the stored note after restart
- After typing text and advancing the injected clock by 1000 ms, reading the stored note returns exactly the typed text.
- Typing more text 500 ms after a change and advancing the clock by 1000 ms stores only the latest text, not the intermediate text.
- With a stored note present, starting the app shows that stored text in the text area.
- When the store write fails, the previously stored note read back is unchanged and the error message is shown.
- Saving a note whose text is 'Hello' produces a file whose content is '# Scratch Pad\n\nHello'.
- Saving an empty note produces a file whose content is '# Scratch Pad\n\n'.
- When the write fails, a pre-existing file at the chosen location still has its previous content.
- Cancelling the Save panel writes no file and shows no message.
- Confirming Replace with a file containing 'Draft two' leaves the text area showing 'Draft two' and reading the stored note returns 'Draft two'.
- Choosing Cancel in the confirmation dialog leaves the text area and the stored note unchanged.
- When the chosen file cannot be read, the text area and the stored note keep their previous values and the error message is shown.

## Explicit Assumptions

- The selected preset is authoritative for every technology and mechanical decision.
- Omitted mechanics use the conservative preset-defined contract without another provider request.

## Scope Boundaries

- Included features: Single note editor; Save note as Markdown file; Open plain text file to replace note
- Excluded outcomes: Multiple notes or a note list; Rich text formatting or Markdown preview; Cloud sync or sharing
- Locked delivery preset: tauri2-rust-typescript-desktop

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
