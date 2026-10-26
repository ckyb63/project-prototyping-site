# Prototypes

A working index of what I'm building right now: prototypes, experiments, and tools before they ship to their own homes.

## Local preview

Serve the folder (needed so `projects.json` loads):

```bash
python -m http.server 8080
```

Or use `support/run_server.py` if you have it.

## Add a project

1. Edit `projects.json` and add an entry with `id`, `title`, `status` and `blurb`. Optional fields:
   - `href`: link to the live build. Leave `null` while it's private.
   - `updated`: `YYYY-MM`, shown as "Updated Oct 2026".
   - `tags`: short stack or topic labels.
   - `art`: which illustration to draw: `scan`, `swatch`, `resistor`, `download`, `dash` or `noise` (anything else gets a plain placeholder).
2. Optionally put the build under `builds/<name>/` and point `href` at it.
3. Statuses: `hot` (in progress) · `queued` (up next) · `shipped` · `empty`

Entries that are `queued` or `empty` with no `href` show as a dashed open slot.

## Stack

Static HTML / CSS / JS on GitHub Pages. No framework. No backend.
