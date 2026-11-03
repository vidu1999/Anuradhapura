# HeritageVerse

A responsive Next.js heritage exploration prototype for Anuradhapura. It includes a 2D OpenStreetMap map, 30 requested catalog records (some awaiting coordinate review), opt-in live browser location and straight-line distances, a generic interactive 3D illustration, a static guide, locally saved notes, and partial English/Sinhala/Tamil interface text.

## Run on Windows

Install Node.js 20 or newer. In PowerShell, from this project directory:

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. Run `npm run build` to build, `npm start` to serve the production build, and `npm test` for checks. GPS requires permission and HTTPS (or localhost). Stopping GPS clears the position and watch. Journal notes remain in the browser only.

## Limitations

- Map tiles require internet and the public OpenStreetMap tile service may be blocked or rate-limited. Follow the OSM tile usage policy and choose an appropriate provider for production. The map is **2D**, not 3D terrain; a straight line is not a route.
- The catalog is incomplete; entries without reviewed coordinates appear only in the list, not as map pins. The shared fallback image is an AI-generated generic illustration, not a site photograph. Coordinates are approximate reference points, not surveyed entrances; historical details need expert review. Follow local restrictions.
- The 3D stupa is a **generic artistic illustration**, not a model of the selected place. No AR, AI, accounts, narration, routing or offline map is connected.
- To use an authorized GLB, place it in `public/models/`, add `modelUrl: '/models/filename.glb'` to the corresponding record in `src/data/sites.ts`, and verify accuracy, attribution, rights and interpretation before publication. Missing models fall back to the illustration.
- Language selection translates only the introductory text; site details and most controls remain English.

## Location and road routes

Select **Locate & route** to start GPS and consent to sending the current location and destination coordinates to the external OSRM service. The first fix chooses the nearest starter site by straight-line distance unless a site has already been selected manually; selecting another site changes the destination. The nearest button reselects the nearest site. Stopping GPS stops routing and removes the position. OSRM returns a **driving** route, not walking directions. The public OSRM demo is a development service without production guarantees; configure a suitable OSRM-compatible service with `NEXT_PUBLIC_ROUTING_URL`, observe its terms and privacy policy, and rebuild before production. Requests are aborted when superseded, and movement-based rerouting is limited to 50 metres. The GPS heading is direction of travel when supported and moving, not a stationary device compass. If the service or map tiles fail, no route is fabricated. Coordinates are approximate, and road data may not reflect closures, pedestrian access, or protected-site restrictions.

Ruwanwelisaya is configured to load `public/models/ruwanwelisaya.glb`. Supply that exact filename (including spelling and case). If the file is missing or fails to load, the viewer says so and displays the generic illustration instead. The viewer shows the site's description and source with the model. The supplied GLB is included. Ensure you have rights to publish it and verify its historical accuracy. The Draco decoder is copied from Three.js into public/draco during installation and builds.

### 3D navigation view
The blue **Start 3D navigation** button switches from the 2D map to a tilted MapLibre view and starts the same opt-in location and external OSRM routing described above. The stylized 3D character is an illustration at the reported GPS position, not AR or a precise representation of the user. Its walk cycle runs only when the browser reports speed of at least 0.5 m/s; speed and heading are often unavailable, especially on desktop or while standing still. Drag the map to stop following; use **Recenter & follow** to resume. Exit 3D returns to the 2D map; use **Stop GPS & routing** to stop location tracking. Terrain uses public AWS Terrain Tiles (maximum source zoom 15, overzoomed at closer map zooms), and the base map uses OSM tiles. If terrain or tiles are blocked, the app reports the failure; do not use a blank map for navigation. This uses a driving route, not a pedestrian route, and is not a substitute for official directions.

The catalog records use approximate public reference coordinates where available; they are not verified by heritage authorities. Site descriptions, sources, image licensing and access restrictions need expert review. Reservoir and pond records with non-entrance points are excluded from road routing. No site-specific image is claimed where only the generic illustration is available.

If WebGL2 is unavailable, 3D navigation automatically falls back to the 2D map without stopping GPS or the road route. To try 3D, update the browser and graphics driver and enable hardware acceleration in browser settings, then restart the browser. WebGL2 may still be unsupported on some devices; 2D remains available. The React DevTools console message is informational, not an app error.

The navigation screen displays the live map as its main view. Elevation tiles provide terrain when available; OSM tiles are a map, not satellite imagery or a photorealistic 3D reconstruction. On devices without WebGL2, the view falls back to the 2D map without stopping GPS.
