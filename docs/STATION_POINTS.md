# Station Points — Lifecycle

Transit station points used to snap pickup/dropoff for shared vehicles
(`taxi_shared`, `van_shared`, `microbus_shared`) in `/create`.

## 1. Storage

`Station` model ([src/models/Station.ts](../src/models/Station.ts)), collection `stations`.

| Field | Type | Source |
|---|---|---|
| `objectId` | Number, unique | `properties.OBJECTID` (or feature `id`) |
| `name` | String | `properties.name` |
| `direction` | String | `properties.direction` |
| `landmark` | String | `properties.landmark` |
| `stationType` | String | `properties.station_type` |
| `lat` / `lng` | Number | `geometry.coordinates` (GeoJSON is `[lng, lat]`) |
| `active` | Boolean | soft-delete flag, default `true` |

## 2. Seeding (starter data)

`public/geo/PT910ExcelToTab_FeaturesToJSO3.geojson` is the source-of-truth
starter file (fixed GeoJSON `FeatureCollection` of `Point` features).

Run once against a fresh DB:

```
npm run seed:stations
```

This wipes and reloads the `stations` collection from that file
(`scripts/seed-stations.cjs`). Safe to re-run.

## 3. CRUD API

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/stations` | GET | public | List active station points (used by the map) |
| `/api/stations` | POST | admin | Create one station point |
| `/api/stations/[id]` | PATCH | admin | Update a station point (`id` = `objectId`) |
| `/api/stations/[id]` | DELETE | admin | Remove a station point |
| `/api/stations/import` | POST (multipart `file`) | admin | **Full override** — replaces the entire collection with an uploaded GeoJSON/JSON file matching the fixed structure below |

### Fixed import structure

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "id": 1,
      "geometry": { "type": "Point", "coordinates": [lng, lat] },
      "properties": {
        "OBJECTID": 1,
        "name": "...",
        "direction": "...",
        "landmark": "...",
        "station_type": "..."
      }
    }
  ]
}
```

`/api/stations/import` validates every feature (`Point` geometry, numeric
coordinates, numeric `OBJECTID`/`id`) before committing. On success it does
`deleteMany({})` + `insertMany(docs)` — an all-or-nothing replace, so a bad
file never leaves the collection half-updated.

## 4. Runtime consumption (`/create`)

1. [CreateClient.tsx](../src/components/create/CreateClient.tsx) fetches
   `GET /api/stations` once on mount → `stations: Station[]` state, passed
   down to each `TripCycle`.
2. [TripCycle.tsx](../src/components/create/TripCycle.tsx): when the selected
   vehicle is shared (`isSharedVehicle()`) and both pickup+dropoff are set,
   `findNearestStation()` ([src/lib/geo/stations.ts](../src/lib/geo/stations.ts))
   haversine-snaps each point to its nearest station. The OSRM/ORS route is
   then fetched **station → station** (not raw pickup/dropoff), and walking
   time is computed at 4.5 km/h (`walkingMinutes()`).
3. Pickup time = `arrival − walkingMinFromStation − rideDuration − vehicleBuffer`
   (walking at the dropoff end is folded into the schedule).
4. [CreateMap.tsx](../src/components/create/CreateMap.tsx) renders amber `S`
   station markers + dashed amber walking polylines for pickup→station and
   station→dropoff on shared trips.

## 5. Booking persistence

`POST /api/trips` ([route.ts](../src/app/api/trips/route.ts)) receives
`pickupStation`, `dropoffStation`, `walkingMinToStation`,
`walkingMinFromStation` per trip (client-supplied), but **recomputes**
`pickupTime` server-side using the same walk-adjusted formula — client values
are never trusted for pricing/scheduling. These fields are stored on the
`Booking.trips[]` subdocument for shared-vehicle trips only.

## 6. Updating station data going forward

- Small edits (rename, move, deactivate): use `PATCH`/`DELETE /api/stations/[id]`.
- Bulk refresh (new survey, corrected coordinates): upload the new GeoJSON
  file via `POST /api/stations/import` — this is the same operation the seed
  script performs, just admin-triggered from the app instead of the CLI.
