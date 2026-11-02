import { sites } from './sites';

// Public reference coordinates: approximate points, not surveyed entrances or AR anchors.
// They need authoritative review before use in safety-critical navigation.
const coordinates: Record<string, { lat: number; lon: number; reference: string }> = {
  ruwanwelisaya: { lat: 8.35000, lon: 80.39639, reference: 'https://en.wikipedia.org/wiki/Ruwanweliseya' },
  'sri-maha-bodhi': { lat: 8.34472, lon: 80.39667, reference: 'https://en.wikipedia.org/wiki/Jaya_Sri_Maha_Bodhi' },
  jetavanaramaya: { lat: 8.35162, lon: 80.40365, reference: 'https://mapcarta.com/W115767725' },
  abhayagiri: { lat: 8.370944, lon: 80.39525, reference: 'https://www.wikidata.org/wiki/Q320543' },
  thuparamaya: { lat: 8.35528, lon: 80.39611, reference: 'https://en.wikipedia.org/wiki/Thuparamaya' },
  isurumuniya: { lat: 8.3346, lon: 80.3904, reference: 'https://en.wikipedia.org/wiki/Isurumuniya' },
};
export const mapSites = sites.flatMap(site => coordinates[site.id] ? [{ ...site, ...coordinates[site.id] }] : []);
export type MapSite = typeof mapSites[number];
/** Straight-line distance, not walking or driving distance. */
export function distanceKm(a: {lat:number; lon:number}, b: {lat:number; lon:number}) {
  const radians = (degrees:number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat-a.lat), dLon = radians(b.lon-a.lon);
  const h = Math.sin(dLat/2)**2 + Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1-h)));
}
