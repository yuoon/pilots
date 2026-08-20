# NYC Book Crawl — Walking Tour

An interactive, shareable walking tour for two Lower Manhattan indie &
used bookstore crawl routes: the **Literary Adventure** (Strand → Yu & Me
Books) and the **Used Book Adventure** (Strand → The Rabbit Books & Bar).

Map tiles are from [OpenStreetMap](https://www.openstreetmap.org/copyright)
via [Leaflet](https://leafletjs.com/) — free, no API key or account
required.

- Toggle Route 1, Route 2, or both on the map at once
- Numbered, route-colored markers connected by dashed walking paths
- Click a marker or a sidebar stop to fly to it and see hours, a short
  description, and the walk time to the next stop
- Bonus stops (Union Square Greenmarket, SoHo cafés, Chinatown) with a
  show/hide toggle
- "Open in Google Maps" links per stop and per route for real turn-by-turn
  walking directions (just a URL — no API key needed)
- Interactive Book Crawl Challenge checklist
- **Share**: uses the native share sheet where available, otherwise copies
  a link; the selected route is encoded in the URL (`?route=1`, `?route=2`,
  or omitted for both) so shared links open to the right view

## Setup

```bash
npm install
npm run dev
```

No environment variables or API keys needed.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint

## Deploying

The included GitHub Actions workflow (`.github/workflows/deploy.yml`)
builds and deploys `dist/` to GitHub Pages on push to `main`.
