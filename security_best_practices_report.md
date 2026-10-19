**AI-generated draft — not reviewed by John**

# Security review

Reviewed 2026-10-18 against the current working tree.
Scope: static JavaScript, snapshot migration/import, browser storage, program
updates, calendar export, offline worker, and the deployment workflow.
This is a source review with focused executable checks, not a penetration test
or guarantee of security.

## Executive summary

No critical or high-severity vulnerability was demonstrated.
Four low-severity findings have been mitigated: calendar control-character
injection, inherited-key snapshot merge failure, missing browser CSP, and unsafe
program identifiers.
Personal data remains local by design, but shares the GitHub Pages origin and is
not encrypted.
Storage recovery and concurrent-edit checks reduce accidental loss; they cannot
provide atomic cross-tab transactions or protection from browser eviction.

The review reran 33 focused calendar, snapshot/migration, persistence/recovery,
and program-validation tests; all passed.
Live hosting settings and the eventual GitHub Actions run were not independently
verified in this report.
After the final program-identifier fix, all five program-update tests passed
again.

## Mitigated findings

### 1. Calendar serialization accepted raw control characters — fixed

- Severity: Low; output-format validation.
- Current location: `docs/calendar.js:4` and `docs/calendar.js:10`.
- Original evidence: the serializer preserved bare CR, and inserted raw IDs into
  UID lines.
  Crafted imported notes or cached IDs could create malformed calendar
  properties; client-specific execution was not demonstrated.
- Resolution: CRLF, CR, and LF become escaped text; UID uses encodeURIComponent.
  The regression test verifies CR/LF cannot inject calendar properties.
- Standard: [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545), text escaping
  and content-line grammar.

### 2. Inherited object keys broke snapshot merging — fixed

- Severity: Low; JS-STORAGE-001 / prototype-safe lookup.
- Current location: `docs/planner-data.js:123` (`mergeNotes`).
- Original evidence: a note named `toString` caused
  `current.split is not a function` during merge.
  This was a local failed merge, not demonstrated prototype pollution or code
  execution.
- Resolution: merge now checks hasOwnProperty before reading a previous note.
  Regression tests cover ordinary Object.prototype names.
  Recursive safeCopy (`docs/planner-data.js:51`) rejects dangerous keys,
  excessive depth, and excessive traversal before processing preserved extension
  fields.

### 3. Content Security Policy absent from entry point — mitigated

- Severity: Low; JS-CSP-001, defense in depth.
- Current location: `docs/index.html:1`.
- Resolution: early meta CSP restricts scripts to self, connections to self and
  the official program origin, and denies objects, base changes, frames, and
  form submission.
  No unsafe-inline or unsafe-eval is allowed.
  Google font/style hosts are deliberately allowed; these requests reveal normal
  network metadata to those services, but do not upload note content.
- Limitation: meta CSP cannot enforce frame-ancestors.
  Response-header framing protection was not inspected.
  No exploitable DOM XSS was demonstrated.
  [MDN CSP guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP).

## Residual limitations and low-severity observations

### 4. GitHub Pages origin shares browser storage — informational

- Rule: JS-STORAGE-001.
- Locations: `docs/planner-storage.js:17`, `docs/app.js:9`,
  `docs/index.html:13` (recovery/privacy disclosure).
- The site shares `https://leej3.github.io` with other paths under that origin.
  Other same-origin JavaScript can read or modify these storage keys.
  Distinct paths, key names, and a service-worker scope are not storage access
  controls.
  This does not imply another application is malicious or vulnerable.
- Notes, snapshots, and recovery copies are unencrypted.
  A dedicated origin is the appropriate isolation improvement if stronger
  separation is needed.
  No note-upload or telemetry implementation was found.
  [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
  documents the origin-wide boundary.

### 5. Concurrent writes and browser quota remain fallible — informational

- Locations:
  `docs/planner-storage.js:34` (`write`), especially checks at lines 39/47 and
  primary setItem at line 48; recovery backup at line 23.
- Two comparisons detect ordinary stale tabs and the tests cover those cases.
  They are not an atomic compare-and-swap across browser processes: another tab
  can write between the final comparison and setItem.
  No test proves all simultaneous interleavings safe.
  Use a single editing tab; a future stronger implementation could coordinate
  with Web Locks or an IndexedDB transaction.
- Recovery stores up to five copies before protected edits.
  Full storage can prevent the backup and therefore block saving even when a
  primary-only write might fit.
  This deliberately retains prior saved data.
  The UI reports failure and permits exporting in-memory edits; it must not
  imply those edits persisted.
- Individual setItem operations are atomic, but the history and primary writes
  are not one transaction.
  A failed primary write can leave an extra recovery entry.
  Browser clearing/eviction removes both primary and local recovery.
  Keep downloaded snapshots outside browser storage.
- Canonical v3 uses a separate key and never overwrites the legacy key.
  Unsupported future or corrupt primary data blocks normal writes rather than
  silently resetting it (`docs/planner-storage.js:29`).
  Recovery explicitly preserves original bytes before replacement.
  These controls address accidental loss, not an adversarial same-origin script.

### 6. Inherited-name program IDs could break search — fixed

- Severity: Low; JS-STORAGE-001, input validation / availability.
- Current location: `docs/program-update.js:3` (`validateSessions`).
- Original evidence: cached session IDs such as `toString` could cause note
  search to read an inherited function and call toLowerCase on it.
  Exploitation required manipulating same-origin program storage; ordinary
  snapshot import cannot replace that cache.
  No remote code execution was demonstrated.
- Resolution: safeId rejects empty, prototype-related, and control-character
  IDs.
  Duplicate session IDs and malformed optional type/chair/notes fields are
  rejected.
  Bundled, cached, and fetched programs share this validation.
- Verification: all five program-update tests passed, including rejection of
  duplicate/prototype-name IDs and malformed cache shapes.
  No concrete finding remains unmitigated in this review; items 4 and 5 are
  architectural limitations.

## Other verified controls

- HTML templates escape dynamic values, including identifiers and quoted
  attributes (`docs/app.js:6`, `docs/app.js:32`).
  Notes and quick-note controls use textContent/value rather than parsing user
  HTML.
  Talk links require HTTPS and noreferrer.
  Exported Markdown is not rendered inside the app.
- Snapshots reject unsafe keys recursively, malformed shapes, duplicate task
  IDs, unsupported future versions, and oversize values.
  The import file limit is 10 MB
  (`docs/app.js:67`), and normalized snapshots enforce a UTF-8 byte limit (`docs/planner-data.js:96`).
  Unknown JSON fields survive migration safely.
- Program inputs share validateSessions
  (`docs/program-update.js:3`; `docs/app.js:74`), with limits on session/talk
  counts and text fields.
  Official updates enforce a response-text limit before parsing.
  The program-identifier issue in item 6 is mitigated by the final validator.
- Worker requests require same-origin GET inside registration scope and
  application assets are allowlisted (`docs/sw.js:19`).
  Cache cleanup is limited to this app's prefix (`docs/sw.js:10`).
  Worker messages only request activation; no message text is evaluated or
  written as executable code.
- No third-party runtime JavaScript, eval, document.write, account token,
  embedded secret, or network upload of personal snapshots was found.

## CI and deployment review

`.github/workflows/ci.yml:7` grants read-only contents by default.
Pull requests run tests with checkout credentials disabled and npm lifecycle
scripts disabled at install.
Actions are pinned to commit SHAs, and Node
22/24 run asset checks, tests, and npm audit. Only the deploy job has pages/id-token
write permission (`.github/workflows/ci.yml:36`); it requires successful tests
and a non-PR main ref (`.github/workflows/ci.yml:32`).
Only docs is uploaded (`line 50`).
No pull_request_target trigger or interpolation of untrusted PR text into
commands was found.
Pinned action provenance and live repository protection settings were not
independently audited here.

Configure GitHub Pages to use the Actions workflow, otherwise a separate legacy
branch deploy could bypass this gate.
The workflow's presence alone does not prove the live deployment uses it or that
a particular run passed.
