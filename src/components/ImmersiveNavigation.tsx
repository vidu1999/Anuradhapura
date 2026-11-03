'use client';
import { useState } from 'react';
import { BookOpen, MapPin, Navigation, X } from 'lucide-react';
import { formatDistance } from '@/data/distance';
import type { HeritageSite } from '@/data/sites';
import type { Position } from './HeritageMap';
import type { RoadRoute } from '@/data/routing';

type Props = { site:HeritageSite; position:Position|null; route:RoadRoute|null; routeStatus:string; distance:number|null; tracking:boolean; onExit:()=>void; onToggleGps:()=>void; onHistory:()=>void; map:React.ReactNode; notice:string };
export default function ImmersiveNavigation({site,position,route,routeStatus,distance,tracking,onExit,onToggleGps,onHistory,map,notice}:Props){
 const [showDetails,setShowDetails]=useState(false);
 return <section className="immersive terrain-navigation" aria-label="Heritage navigation experience">
  <div className="terrain-map-surface">{map}</div>
  <div className="terrain-heading"><span className="eyebrow">LIVE NAVIGATION · {position?'GPS CONNECTED':'GPS NOT AVAILABLE'}</span><strong>{site.name}</strong><small>{route?`${formatDistance(route.distance)} · ~${Math.max(1,Math.round(route.duration/60))} min driving`:distance!==null?`${formatDistance(distance)} straight-line`:'Location not available'}</small></div>
  {showDetails&&<aside className="terrain-details"><button onClick={()=>setShowDetails(false)} aria-label="Close destination details"><X size={17}/></button><span className="eyebrow">SELECTED DESTINATION</span><h2>{site.name}</h2><b>{site.category}</b><p>{site.description}</p><small>Approximate location · follow official signs and local restrictions.</small></aside>}
  <div className="terrain-status" role="status">{notice||routeStatus}</div>
  <nav className="terrain-actions" aria-label="Navigation controls"><button onClick={()=>setShowDetails(v=>!v)}><MapPin/><span>{showDetails?'Hide details':'Destination'}</span></button><button onClick={onHistory}><BookOpen/><span>History</span></button><button onClick={onToggleGps}><Navigation/><span>{tracking?'Stop GPS':'Start GPS'}</span></button><button onClick={onExit}><X/><span>Exit</span></button></nav>
 </section>;
}
