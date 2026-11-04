# HeritageVerse

A responsive Next.js heritage exploration prototype for Anuradhapura. It includes a 2D OpenStreetMap map, 30 requested catalog records (some awaiting coordinate review), opt-in live browser location and straight-line distances, a 3D monument viewer, an opt-in Gemini AI guide, locally saved notes, and partial English/Sinhala/Tamil interface text.

## Run on Windows

Install Node.js 20 or newer. In PowerShell, from this project directory:

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. Run `npm run build` to build, `npm start` to serve the production build, and `npm test` for checks. GPS requires permission and HTTPS (or localhost). Stopping GPS clears the position and watch. Journal notes remain in the browser only.

## Limitations

- Map tiles require internet and the public OpenStreetMap tile service may be blocked or rate-limited. Follow the OSM tile usage policy and choose an appropriate provider for production. The main map is 2D; navigation can show terrain and OSM-derived 3D building shapes when supported. A straight-line distance is not a road route.
- The catalog is incomplete; entries without reviewed coordinates appear only in the list, not as map pins. The shared fallback image is an AI-generated generic illustration, not a site photograph. Coordinates are approximate reference points, not surveyed entrances; historical details need expert review. Follow local restrictions.
- The Ruwanwelisaya viewer uses a supplied GLB; other sites use a **generic AI-generated illustration**, not a site photograph or verified reconstruction. AR, accounts, narration and offline maps are not connected.
- To use an authorized GLB, place it in `public/models/`, add `modelUrl: '/models/filename.glb'` to the corresponding record in `src/data/sites.ts`, and verify accuracy, attribution, rights and interpretation before publication. Missing models fall back to the illustration.
- Language selection translates only the introductory text; site details and most controls remain English.

## Location and road routes

Select **Locate & route** to start GPS and consent to sending the current location and destination coordinates to the external OSRM service. The first fix chooses the nearest starter site by straight-line distance unless a site has already been selected manually; selecting another site changes the destination. The nearest button reselects the nearest site. Stopping GPS stops routing and removes the position. OSRM returns a **driving** route, not walking directions. The public OSRM demo is a development service without production guarantees; configure a suitable OSRM-compatible service with `NEXT_PUBLIC_ROUTING_URL`, observe its terms and privacy policy, and rebuild before production. Requests are aborted when superseded, and movement-based rerouting is limited to 50 metres. The GPS heading is direction of travel when supported and moving, not a stationary device compass. If the service or map tiles fail, no route is fabricated. Coordinates are approximate, and road data may not reflect closures, pedestrian access, or protected-site restrictions.

Ruwanwelisaya is configured to load `public/models/ruwanwelisaya.glb`. Supply that exact filename (including spelling and case). If the file is missing or fails to load, the viewer says so and displays the generic illustration instead. The viewer shows the site's description and source with the model. The supplied GLB is included. Ensure you have rights to publish it and verify its historical accuracy. The Draco decoder is copied from Three.js into public/draco during installation and builds.

### 3D navigation view
The blue **Start 3D navigation** button switches from the 2D map to a tilted MapLibre view and starts the same opt-in location and external OSRM routing described above. The stylized 3D character is an illustration at the reported GPS position, not AR or a precise representation of the user. Its walk cycle runs only when the browser reports speed of at least 0.5 m/s; speed and heading are often unavailable, especially on desktop or while standing still. Drag the map to stop following; use **Recenter & follow** to resume. Exit 3D returns to the 2D map; use **Stop GPS & routing** to stop location tracking. Terrain uses public AWS Terrain Tiles (maximum source zoom 15, overzoomed at closer map zooms), the base map uses OSM tiles, and OSM-derived building footprints and render heights use OpenFreeMap vector tiles (OpenMapTiles schema). MapLibre extrudes those buildings into simple 3D shapes; coverage and heights may be incomplete or estimated, and they are not verified heritage reconstructions. See https://openfreemap.org/ and https://www.openstreetmap.org/copyright; review service terms and attribution before deployment. If terrain or tiles are blocked, the app reports the failure; do not use a blank map for navigation. This uses a driving route, not a pedestrian route, and is not a substitute for official directions.

The catalog records use approximate public reference coordinates where available; they are not verified by heritage authorities. Site descriptions, sources, image licensing and access restrictions need expert review. Reservoir and pond records with non-entrance points are excluded from road routing. No site-specific image is claimed where only the generic illustration is available.

If WebGL2 is unavailable, 3D navigation automatically falls back to the 2D map without stopping GPS or the road route. To try 3D, update the browser and graphics driver and enable hardware acceleration in browser settings, then restart the browser. WebGL2 may still be unsupported on some devices; 2D remains available. The React DevTools console message is informational, not an app error.

The navigation screen has an AI-generated scenic illustration, not actual terrain, AR or a reconstruction. The inset is the real OpenStreetMap-based navigation map; use **3D Map** or the expand control to make it large. Elevation tiles provide terrain when available; The 3D buildings are approximate extrusions of available OSM data, not photorealistic buildings or surveyed heritage models. On devices without WebGL2, the map falls back to 2D without stopping GPS.

If the graphics context is lost or fails to initialize, navigation falls back to the 2D map and offers **Try 3D again**. With a GPS fix, the 3D map uses an illustrative visitor marker at the reported position; the character in the AI-generated scene is not the user or their location. Browser GPU crashes, blocked tile providers and relatively flat local terrain can still prevent a visible 3D terrain effect; the application cannot repair browser or driver failures.

### Visitor character asset
The supplied `public/models/malecharacter.glb` contains authored `idle`, `walk`, and `run` animation clips. The **wait** state plays the `idle` clip; the app crossfades between clips as reported GPS speed changes. A GPS fix is required before placing the character on the map; no location is fabricated. Speed (m/s) selects wait below 0.5 or when unavailable, walk from 0.5 to below 3, and run from 3 upward. These thresholds do not identify transport mode; GPS speed can be noisy or unavailable. Reduced-motion settings show a still wait pose. If a replacement model lacks the clips, a compatible Mixamo-style rig gets approximate procedural animation; otherwise it is shown static. A labelled generic character is used if the model cannot load. Verify rights and provenance of the supplied model before publication.

### Gemini place experience
To enable on-demand generated stories and 3D-style illustrations, copy `.env.example` to `.env.local`, set `GEMINI_API_KEY` to your own key on the server, and restart Next.js. Never put the key in client code, chat, or a `NEXT_PUBLIC_` variable. The **Generate AI experience** button sends the selected site's catalog name, category, period, description, history and facts to Google's Gemini API; it does not send GPS coordinates or journal notes. Requests can incur charges and are subject to Google's model availability, quotas, terms and privacy policies. The server calls `gemini-2.5-flash` for text and `gemini-2.5-flash-image` for the image, with independent error reporting; results remain in browser memory and are not persisted by the app. The cinematic camera movement is a CSS effect over a static AI-generated image, not generated video, real-time imagery, a 3D model or a verified reconstruction. Text is AI-generated from existing catalog notes only, can still be incorrect, and must be reviewed against linked sources; some links provide only city-level context. It does not fetch fresh source content. This prototype endpoint has no user authentication, rate limiting, abuse protection or budget controls; add them and review privacy, rights, content safety and hosting before any public deployment. The key must remain private.

**Gemini access troubleshooting:** The app uses a Gemini Developer API key with `generativelanguage.googleapis.com` from the server, not a browser request or Vertex AI credentials. If Google rejects both story and image, confirm the key belongs to the intended Google Cloud project and that the Generative Language API is enabled. If the key has API restrictions, allow that API; if it has application restrictions, ensure they support the server's outbound IP. A website-referrer-restricted key cannot authenticate this server-to-server call. Keep restrictions appropriate for your environment; do not expose the key in client code. Check model access, quotas, billing and supported-region requirements where applicable. After changing `.env.local`, restart Next.js. Diagnostic messages use only allowlisted Google reason codes and do not include Google's raw message, metadata or key.

### King Dutugemunu AI guide

Open **AI Guide** from the 3D navigation screen or **Meet the guide** on the selected-site panel. The companion is an AI persona inspired by the historical king, not a historical record. It receives the selected catalog site's name, category, period, description, history, facts and reference URL plus the visitor's chat messages. No GPS position or journal data is sent automatically; visitors must avoid including private information in their messages. Conversation is held in React memory while the page remains open and is cleared on refresh or with **Clear**. The latest six exchanges are sent for context. Select English, Sinhala or Tamil for replies; output quality and historical accuracy are not guaranteed. Catalog links are references, not retrieved or verified source material, and some are UNESCO city-level context.

`POST /api/ai-guide` validates a maximum 24 KB body, 1,200 characters per message, up to six completed exchanges, a catalog site ID and one of the three language codes. It invokes the official `@google/genai` SDK server-side using `GEMINI_API_KEY` and optional `GEMINI_GUIDE_MODEL` (default `gemini-2.5-flash`). Errors are sanitized; API keys never go to the browser. The 20-requests-per-minute in-memory process-wide limit is a prototype guard only: it is not a per-user limit, persistent across restarts, shared across instances, or a substitute for authentication, distributed throttling, budget limits and monitoring before deployment. Gemini can be wrong or manipulated, even with safety instructions; historical review and source-based retrieval should precede public use. Text-to-speech, voice input, quizzes and RAG are not implemented.

PowerShell setup and API check, from the repository directory:

```powershell
npm ci
Copy-Item .env.example .env.local # Skip this if you already have .env.local
notepad .env.local # Set GEMINI_API_KEY locally; never share it
npm test
npm run build
npm run dev
```

In a second PowerShell window, with the server running:

```powershell
$body = @{ siteId = 'ruwan'; language = 'EN'; message = 'Tell me about this place'; history = @() } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/ai-guide' -ContentType 'application/json' -Body $body
```

Change `language` to `SI` or `TA` for a language check. Missing key returns 503; malformed input returns 400. Google connectivity requires a supported account, available model, network access and appropriate API key permissions, and may incur charges. Never include your key in this test request or screenshots.
