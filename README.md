# BAY

Staging ground for prototypes, experiments, and unfinished work.

Projects land here as **berths**. When a build is ready, it ships to its own home (or stays linked).

## Local preview

Serve the folder (needed so `projects.json` loads):

```bash
python -m http.server 8080
```

Or use `support/run_server.py` if you have it.

## Add a project

1. Edit `projects.json` — add a berth with `code`, `title`, `status`, `blurb`, optional `href` / `tags`.
2. Optionally put the build under `berths/<name>/` and point `href` at it.
3. Statuses: `empty` · `queued` · `hot` · `shipped`

## Stack

Static HTML / CSS / JS on GitHub Pages. No framework. No backend.
