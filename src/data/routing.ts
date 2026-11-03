import { calculateDistance } from './distance';

export type Coordinate = { latitude: number; longitude: number };
export type RoadRoute = { points: [number, number][]; distance: number; duration: number };

/** GPS heading is travel direction, not compass orientation. It is unreliable at rest. */
export function travelHeading(heading: number | null, speed: number | null): number | null {
  return heading !== null && Number.isFinite(heading) && speed !== null && speed >= 0.5
    ? ((heading % 360) + 360) % 360 : null;
}
export function headingLabel(heading: number | null): string {
  if (heading === null) return 'Direction unavailable — start moving';
  const names = ['N','NE','E','SE','S','SW','W','NW'];
  return `${names[Math.round(heading / 45) % 8]} · ${Math.round(heading) % 360}°`;
}
export function nearestSite<T extends Coordinate>(position: Coordinate, sites: T[]): T | null {
  return sites.reduce<T | null>((closest, site) => !closest || calculateDistance(position.latitude, position.longitude, site.latitude, site.longitude) < calculateDistance(position.latitude, position.longitude, closest.latitude, closest.longitude) ? site : closest, null);
}
/** Parse only genuine OSRM GeoJSON routes; never draw a fabricated fallback line. */
export function parseRoute(body: unknown): RoadRoute {
  const data = body as {code?: string; routes?: Array<{distance?:number;duration?:number;geometry?:{type?:string;coordinates?:unknown}}>};
  const route = data?.routes?.[0];
  if (data?.code !== 'Ok' || !route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration) || route.distance! < 0 || route.duration! < 0 || route.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2) throw new Error('No road route was found.');
  const points: [number,number][] = route.geometry.coordinates.map((coordinate: unknown) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2 || !Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1]) || Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90) throw new Error('The routing service returned an invalid route.');
    return [coordinate[1], coordinate[0]];
  });
  return {points,distance:route.distance!,duration:route.duration!};
}
