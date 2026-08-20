# NYC Book Crawl — Walking Tour

An interactive, shareable Google Maps walking tour for two Lower Manhattan
indie & used bookstore crawl routes: the **Literary Adventure** (Strand →
Yu & Me Books) and the **Used Book Adventure** (Strand → The Rabbit Books &
Bar).

- Toggle Route 1, Route 2, or both on the map at once
- Numbered, route-colored markers connected by dashed walking paths
- Click a marker or a sidebar stop to fly to it and see hours, a short
  description, and the walk time to the next stop
- Bonus stops (Union Square Greenmarket, SoHo cafés, Chinatown) with a
  show/hide toggle
- "Open full walking route in Google Maps" per route for real turn-by-turn
  walking directions
- Interactive Book Crawl Challenge checklist
- **Share**: uses the native share sheet where available, otherwise copies
  a link; the selected route is encoded in the URL (`?route=1`, `?route=2`,
  or omitted for both) so shared links open to the right view

## Setup

```bash
npm install
cp .env.example .env
```

Add a Google Maps API key to `.env`:

```
VITE_GOOGLE_MAPS_API_KEY=your-key-here
```

Get a key from the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials),
enable the **Maps JavaScript API** on it, and restrict it by HTTP referrer
to the domain(s) you run/deploy this app on (and `localhost` for dev). The
map pane shows setup instructions in place of the map until a valid key is
configured — no key is committed to the repo.

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint

## Deploying

The included GitHub Actions workflow (`.github/workflows/deploy.yml`)
builds and deploys `dist/` to GitHub Pages on push to `main`. Add
`VITE_GOOGLE_MAPS_API_KEY` as a repository secret and reference it in the
workflow's build step if you want the deployed site to have a working map.
