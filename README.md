# Character Forge

Character Forge is a mobile-first offline-ready web game for collaboratively creating a fictional character in one short session.

## Core loop

- Standard game: 20 questions
- 7 fixed foundation prompts
- 10 random prompts with category guarantees
- 3 fixed final prompts
- Players answer in a circle

## Features

- Fully client-side
- Works offline after first load
- `localStorage` session restore
- TXT, Markdown, and JSON export
- Light and dark themes
- Installable PWA

## Run locally

Serve the folder with any static file server. Example with Python:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy

The project is static and can be published directly to GitHub Pages.

## GitHub Pages

The repository includes a GitHub Actions workflow that deploys the root folder to GitHub Pages on every push to `main`.
