# Anuradhapura HeritageVerse

Explore the past. Experience history.

Early Phase 1 web foundation: source-linked starter catalog, search/category filters, site details, a MapLibre terrain map with opt-in browser location, device-local favorites and device-local suggestion drafts. This is not yet an authenticated admin, verified comprehensive dataset, or the Flutter/AR/AI product. See [architecture, schema relationships, screen designs, acquisition plan and roadmap](docs/ARCHITECTURE.md).

## Run
Requires Node.js 20+ and npm.
```sh
npm ci
npm run dev
```
Open http://localhost:3000. Build with `npm run build`, run checks with `npm test`. Browser storage is local to the device and may be cleared by the browser. Suggestions are not transmitted or reviewed.

## Database foundation
`supabase/migrations/20261101000000_foundation.sql` targets a Supabase project with PostGIS. It is not connected to the web app. Apply using the Supabase CLI to a development project only after reviewing schema and RLS; do not use in production until policies, auth provisioning, storage and tests are complete. Never commit credentials. No external deployment is performed.

## Manual checks
Search for a site, filter by category, open and close details, save and remove a favorite, refresh and confirm persistence, create and delete a local suggestion, and verify the layout at mobile widths. Verify links open UNESCO and that images are identified as illustrations.

## Map limitations
`/map` uses public OpenStreetMap raster tiles and AWS Terrarium elevation tiles over the network, with attribution on the map. Public OSM tile servers are not a production SLA: use a licensed provider or self-host before production and follow their tile usage policy. Terrain is elevation-based, not reconstructed 3D buildings; site coordinates are approximate and linked to public references, not validated entrances. Location stays in the browser and runs only until switched off or the map is closed. Distance is straight-line, not a route. AR, offline maps and a comprehensive site inventory are not yet available. External map services may receive the visitor’s IP address and map tile requests.

If map tiles return 403, the browser cannot use the current tile provider. Set `NEXT_PUBLIC_MAP_TILE_URL` in `.env.local` to the HTTPS raster tile template of a provider you are authorized to use (including `{z}`, `{x}`, `{y}`), then restart the server. Update the map attribution to match that provider before release. The public environment variable is visible to browsers: do not use secret credentials. Terrain tiles are separately hosted on AWS and may also be blocked; the map displays a warning if either provider fails.

The MapLibre worker is copied from the installed package to `public/maplibre/` during `npm ci`, `npm run dev`, and `npm run build`. It is served from the same origin as the app. Reverse proxies must serve this `.mjs` file as JavaScript and allow same-origin workers; if a custom Content Security Policy is used, permit `worker-src 'self'` and the necessary map tile origins. A failed tile request is a separate issue from a worker failing to load.

3D terrain is off by default because its separate external elevation service may be blocked. Use the terrain button to enable it; if the service fails the app attempts to revert to the flat map. The OpenStreetMap base tiles still require network access and may also be blocked in some previews.
