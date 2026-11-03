export function calculateDistance(lat1:number, lon1:number, lat2:number, lon2:number) {
  const rad = (n:number) => n * Math.PI / 180;
  const dLat = rad(lat2-lat1), dLon = rad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0,1-a)));
}
export function formatDistance(metres:number|null) { return metres===null?'GPS unavailable':metres<1000?`${Math.round(metres)} m`:`${(metres/1000).toFixed(2)} km`; }
