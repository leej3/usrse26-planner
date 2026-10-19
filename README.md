# USRSE’26 Fieldnotes

A mobile-friendly, browser-local conference planner for USRSE’26.

[Use the planner](https://leej3.github.io/usrse26-planner/)

- Browse all three days, search abstracts and presenters, and filter session
  types.
- Select sessions, review overlaps, and export an iCalendar itinerary.
- Write autosaved session notes, also searchable in the program.
- Download JSON snapshots and restore them on another browser or phone.
  Restore previews the contents and asks before replacing the current plan.
- No account, backend, analytics, or transmission of notes and selections.
  Browser storage can be cleared or unavailable: keep downloaded backups.
  Snapshots and exported calendars contain your notes; share deliberately.

## Development

Serve `docs/` with any static server:

```sh
python -m http.server 8765 --directory docs
```

Update the program snapshot from the official source:

```sh
python scripts/update_program.py
```

GitHub Pages serves `/docs` on the `main` branch.
No build dependencies.
All conference times are displayed in America/Los_Angeles regardless of the
visitor's device timezone.
Calendar exports use UTC for portability.
Individual talk times are not published, so planning is at session level.

## Data and licensing

Planner source code is MIT licensed.
The conference program and abstracts in
`docs/program.json` come from the [official US-RSE program](https://us-rse.org/usrse26/program/llms-full.txt).
That third-party content remains under its original owners' rights and is not
relicensed by this repository.
This is an independent, unofficial tool.
The program is a dated snapshot; check the official program for changes.
Fonts are loaded from Google Fonts, with system fallbacks.
