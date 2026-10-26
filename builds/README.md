# Builds

Park prototype folders here, one directory per project.

Example:

```
builds/
  my-experiment/
    index.html
```

Then link it from `../projects.json`:

```json
{
  "id": "my-experiment",
  "title": "My experiment",
  "status": "hot",
  "updated": "2026-10",
  "blurb": "Short description.",
  "href": "builds/my-experiment/",
  "tags": ["wip"]
}
```
