# HeritageVerse

A responsive Next.js heritage exploration prototype for Anuradhapura. It includes a 2D OpenStreetMap map, six source-linked starter locations, opt-in live browser location and straight-line distances, a generic interactive 3D illustration, a static guide, locally saved notes, and partial English/Sinhala/Tamil interface text.

## Run on Windows

Install Node.js 20 or newer. In PowerShell, from this project directory:

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. Run `npm run build` to build, `npm start` to serve the production build, and `npm test` for checks. GPS requires permission and HTTPS (or localhost). Stopping GPS clears the position and watch. Journal notes remain in the browser only.

## Limitations

- Map tiles require internet and the public OpenStreetMap tile service may be blocked or rate-limited. Follow the OSM tile usage policy and choose an appropriate provider for production. The map is **2D**, not 3D terrain; a straight line is not a route.
- The catalog is incomplete. Coordinates are approximate reference points, not surveyed entrances; historical details need expert review. Follow local restrictions.
- The 3D stupa is a **generic artistic illustration**, not a model of the selected place. No AR, AI, accounts, narration, routing or offline map is connected.
- To use an authorized GLB, place it in `public/models/`, add `modelUrl: '/models/filename.glb'` to the corresponding record in `src/data/sites.ts`, and verify accuracy, attribution, rights and interpretation before publication. Missing models fall back to the illustration.
- Language selection translates only the introductory text; site details and most controls remain English.

## Location and road routes

Select **Locate & route** to start GPS and consent to sending the current location and destination coordinates to the external OSRM service. The first fix chooses the nearest starter site by straight-line distance unless a site has already been selected manually; selecting another site changes the destination. The nearest button reselects the nearest site. Stopping GPS stops routing and removes the position. OSRM returns a **driving** route, not walking directions. The public OSRM demo is a development service without production guarantees; configure a suitable OSRM-compatible service with `NEXT_PUBLIC_ROUTING_URL`, observe its terms and privacy policy, and rebuild before production. Requests are aborted when superseded, and movement-based rerouting is limited to 50 metres. The GPS heading is direction of travel when supported and moving, not a stationary device compass. If the service or map tiles fail, no route is fabricated. Coordinates are approximate, and road data may not reflect closures, pedestrian access, or protected-site restrictions.
