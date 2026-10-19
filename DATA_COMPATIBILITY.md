**AI-generated draft — not reviewed by John**

# Data compatibility and recovery contract

The v3 snapshot schema is in `schema/snapshot-v3.schema.json`.
Personal data is entirely browser-local; it is not sent to GitHub or US-RSE.

## Rules for future changes

- Never delete or repurpose an existing storage key during upgrade.
- Read legacy `usrse26-fieldnotes-v1` snapshots (v1 or v2) without changing
  them.
  Write migrated data to `usrse26-fieldnotes-v3`, keeping an exact recovery
  copy.
  This prevents older open app versions from overwriting the new format.
- Additive fields must survive loading, editing, exporting, and merging.
  Unknown safe JSON fields are retained at root, task, and quick-note levels.
  Conflicting extension values are retained in `_mergeConflicts`.
- Breaking format changes require a new schema version, a new canonical storage
  key to isolate old clients, an explicit migration, and fixture tests.
  Preserve old fixtures and their exact note strings.
- Unsupported future versions and unreadable data must fail closed.
  Do not initialize over them, fall back to older data, or silently reset them.
  Offer an original-data download and explicit recovery instead.
- Import validation must complete before replacing any saved state.
  Replace and merge operations must first preserve the old saved bytes.
- Stable official talk URLs are identifiers.
  Do not rename identifiers merely because titles, session times, or
  presentation order change.
- Never render note text as HTML or send it through telemetry or remote AI.

## Recovery behavior

Quick notes save as you type.
Selection changes, follow-up edits, note-edit sessions, imports, and deletions
preserve checkpoints before replacing data.
Undo is single-step; Recovery offers up to five recent checkpoints.
Explicit recovery also saves a safety copy of what it replaces.

Saving fails safely when recovery backup or primary storage cannot be written.
The previous saved plan remains, and the UI offers a snapshot of in-memory
edits.
Observed edits in another tab block saving until the user downloads, reloads,
and merges; localStorage does not provide an atomic cross-tab compare-and-swap.
Use one editing tab at a time when possible.

Local recovery is not a substitute for downloaded backups.
Browser clearing, private browsing, device loss, or origin storage eviction can
remove local data.
Storage is not encrypted and is shared with other pages on `leej3.github.io`.

## Release checks

GitHub Actions validates supported version fixtures against JSON Schema,
exercises migrations and merges, and runs storage-failure and DOM integration
regressions on Node 22 and 24.
Static asset checks and dependency auditing also run before the deploy job.
Pull requests cannot deploy or access deployment permissions.
The Pages source is configured for Actions, not branch publishing.

For local checks:

```sh
npm ci --ignore-scripts
npm run check
npm test
npm audit --audit-level=high
```
