# Berths

Park prototype folders here, one directory per project.

Example:

```
berths/
  my-experiment/
    index.html
```

Then link it from `../projects.json`:

```json
{
  "id": "my-experiment",
  "code": "B-05",
  "title": "My experiment",
  "status": "hot",
  "blurb": "Short description.",
  "href": "berths/my-experiment/",
  "tags": ["wip"]
}
```
