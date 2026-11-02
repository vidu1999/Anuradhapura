# Architecture & delivery plan

## Current scope and boundaries
This repository starts with a Next.js web catalog, not the requested finished mobile platform. The catalog is static, English-only, and includes six editorial starter records. Coordinates are approximate public-reference points, not authoritative surveyed entrances or AR anchors. Saved places and suggestion drafts stay in browser localStorage; they are not synced, submitted, authenticated, or reviewed. A browser-based MapLibre map offers optional live location, approximate sourced starter coordinates, and 3D terrain. No camera, route, AR, offline download, or AI integration is active. Generated imagery is explicitly illustrative, not documentary. These limitations are intentional, not substitutes for real integrations.

## Target architecture
- Flutter/Dart Android-first app: Explore, Map, Discover, Guide, Profile; permission onboarding; local encrypted database and opt-in offline packs. Native bridges launch Unity AR only after consent.
- Next.js/TypeScript admin: Supabase Auth, server-side authorization, review queues, site/source/translation/asset management; Three.js preview. The current web catalog is a separate early slice, not an authenticated admin panel.
- Supabase PostgreSQL/PostGIS: normalized site and user data, RLS, spatial GiST index, private storage and edge functions. Separate editorial publication states and immutable review audit. Use least-privilege staff roles. Auth user provisioning needs a server-side transaction/trigger before use.
- Geospatial: MapLibre for low-bandwidth maps, CesiumJS/3D Tiles where terrain and licensing permit. Query nearby published sites with ST_DWithin on geography, ordered by ST_Distance; never persist live location by default. Route provider and map data require licensing review; public OSM services are not a production SLA.
- AR: Unity AR Foundation + ARCore Geospatial/ARKit via native bridge. Explicit camera permission, capability checks, VPS availability and horizontal/vertical/heading accuracy thresholds; calibrated manual anchors and non-AR fallback. GPS alone is not precise placement. Reconstructions carry evidence/interpretation labels and asset provenance.
- AI: reviewed source corpus -> chunking + versioned embeddings (pgvector) -> filtered retrieval -> multilingual model -> cited response with uncertainty and fact/legend distinction. Refuse unsupported questions. Audio via consented speech recognition and platform TTS; avoid sending private location unless necessary.
- Sync: versioned offline manifests, licensed tile/asset packs, checksums and conflict handling; explicit download size and connectivity status. Do not cache copyrighted tiles without permission.

## Proposed structure
```
app/                 Next.js catalog and future admin routes
lib/                 shared domain data and later API clients
supabase/migrations/ schema and RLS
mobile/              future Flutter app (not yet created)
unity/               future AR Foundation project (not yet created)
docs/                architecture, data and operations
```
## Schema relationships and API contract
The SQL migration is the authoritative initial schema. Sites reference categories and periods; translations, events, photos, assets, experiences and guides belong to sites; sources relate to sites through site_sources and optionally to events/assets; anchors belong to experiences. Auth users map to users, profiles and roles. Routes contain ordered stops; favorites, visits, submissions and reviews belong to users; content reviews reference submissions. app_settings holds configuration. RLS is default-deny with limited policies: this is a foundation, not a production-ready backend. In particular, publication, storage and reviewer write policies, provisioning, and testing are pending. Role assignment must only be performed by a trusted server/admin, never client self-assignment.

Planned versioned endpoints: `GET /sites?query=&category=` (published only), `GET /sites/{id}`, `GET /sites/nearby?lat=&lon=&radius_m=` (ephemeral coordinates), `POST /submissions` (authenticated draft), `POST /admin/submissions/{id}/review` (authorized reviewer), `POST /guide/questions` (retrieval-backed citations). None are currently implemented; validate inputs, enforce RLS, rate-limit, and document response/error schemas before release.

## Screen designs
- Explore: cinematic introduction, category chips, searchable site cards, clear source and image provenance.
- Site detail: verified facts, interpretation labels, sources, access guidance, optional media and accessibility; unavailable information explicitly marked.
- Map: full-screen map, filter sheet, location permission explanation and accessible list alternative.
- Discover/itinerary: time and travel constraints, route details, accessibility and safety notices.
- Guide: cited answers, language/length selection and optional voice controls.
- Profile/onboarding: consent, saved content, offline downloads, account and privacy settings.
- Admin: role-scoped review queues, edit forms with provenance, asset licensing and publication audit.

## Data acquisition and verification
Start with UNESCO Sacred City of Anuradhapura (https://whc.unesco.org/en/list/200/) as city-level context, then obtain site-specific official Department of Archaeology / Central Cultural Fund records and appropriately licensed surveys. Agree permissions before bulk imports. Cross-check site names, coordinates and dates against authoritative sources and independent references; record source, retrieval date, license, precision, reviewer and confidence for each assertion. Geocoding candidates are never automatically published. Review sensitive/restricted locations with authorities; avoid exposing protected coordinates. The starter records are not a complete inventory and UNESCO is a general city-level reference, not evidence for every site-specific assertion.

## Roadmap
1. Foundation: provision Supabase, auth and account lifecycle; complete RLS and tests; authenticated role-scoped site/review admin; source-led verified seed data and storage policies. Current work implements schema skeleton and local catalog only.
2. Map: licensed map/terrain, reviewed coordinates, search, accessible list, consent-based GPS, PostGIS nearby queries and detail pages.
3. AR: device integration, assets with provenance, localization accuracy and user calibration; extensive device testing.
4. AI: reviewed corpus, retrieval evaluation, citation verification, multilingual and audio.
5. Planner/offline/community: routing provider, licensed packs, sync, moderated submissions.
6. Production: threat modelling, RLS/security tests, accessibility, performance, field/device tests, deployment approval.

## Dependencies and cost
Current: Node.js, Next.js, React, TypeScript, lucide-react. Target: Flutter SDK, Unity/AR Foundation, ARCore/ARKit, Supabase CLI/PostGIS/pgvector, MapLibre, CesiumJS and Three.js. Supabase, hosted terrain/maps, routing, geospatial VPS and LLM/voice providers may incur usage charges or have restrictive free tiers. Alternatives include self-hosted Postgres/PostGIS, self-hosted licensed OSM-derived maps/routing, local/platform TTS and non-AI sourced text; evaluate operational costs and licenses. No deployment is authorized by this document.
