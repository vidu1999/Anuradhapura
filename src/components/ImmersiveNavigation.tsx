'use client';
import { useState } from 'react';
import { BookOpen, MapPin, Navigation, RefreshCw, X } from 'lucide-react';
import { formatDistance } from '@/data/distance';
import type { HeritageSite } from '@/data/sites';
import type { Position } from './HeritageMap';
import type { RoadRoute } from '@/data/routing';

type Props = { site:HeritageSite; position:Position|null; route:RoadRoute|null; routeStatus:string; distance:number|null; tracking:boolean; onExit:()=>void; onToggleGps:()=>void; onHistory:()=>void; map:React.ReactNode; notice:string; canRetry3d:boolean; onRetry3d:()=>void };
export default function ImmersiveNavigation({site,position,route,routeStatus,distance,tracking,onExit,onToggleGps,onHistory,map,notice,canRetry3d,onRetry3d}:Props){
 const [showDetails,setShowDetails]=useState(false);
 return <section className="immersive terrain-navigation" aria-label="Heritage navigation experience">
  <div className="terrain-map-surface">{map}</div>
  <div className="terrain-heading"><span className="eyebrow">LIVE NAVIGATION · {position?'GPS CONNECTED':'GPS NOT AVAILABLE'}</span><strong>{site.name}</strong><small>{route?`${formatDistance(route.distance)} · ~${Math.max(1,Math.round(route.duration/60))} min driving`:distance!==null?`${formatDistance(distance)} straight-line`:'Location not available'}</small></div>
  {showDetails&&<aside className="terrain-details"><button onClick={()=>setShowDetails(false)} aria-label="Close destination details"><X size={17}/></button><span className="eyebrow">SELECTED DESTINATION</span><h2>{site.name}</h2><b>{site.category}</b><p>{site.description}</p><small>Approximate location · follow official signs and local restrictions.</small></aside>}
  {!position&&<div className="character-preview" aria-label="Temporary character preview, not your location"><svg viewBox="0 0 64 96" aria-hidden="true"><ellipse cx="32" cy="90" rx="22" ry="4" fill="#0006"/><circle cx="32" cy="16" r="10" fill="#dfb592"/><path d="M20 28 Q32 23 44 28 L47 55 L17 55 Z" fill="#3187d3"/><path d="M20 31 L13 56 M44 31 L51 56" stroke="#dfb592" strokeWidth="7" strokeLinecap="round"/><path d="M25 55 L23 82 M39 55 L41 82" stroke="#213a62" strokeWidth="9" strokeLinecap="round"/></svg><small>Character preview<br/>Not your location</small></div>}
  <div className="terrain-status" role="status">{notice||routeStatus}{canRetry3d&&<button className="retry-3d" onClick={onRetry3d}><RefreshCw size={13}/> Try 3D again</button>}</div>
  <nav className="terrain-actions" aria-label="Navigation controls"><button onClick={()=>setShowDetails(v=>!v)}><MapPin/><span>{showDetails?'Hide details':'Destination'}</span></button><button onClick={onHistory}><BookOpen/><span>History</span></button><button onClick={onToggleGps}><Navigation/><span>{tracking?'Stop GPS':'Start GPS'}</span></button><button onClick={onExit}><X/><span>Exit</span></button></nav>
 </section>;
}
