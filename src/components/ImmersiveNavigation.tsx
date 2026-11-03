'use client';
import { useState } from 'react';
import { BookOpen, Compass, Expand, MapPin, Minimize2, Navigation, RefreshCw, X } from 'lucide-react';
import { formatDistance } from '@/data/distance';
import type { HeritageSite } from '@/data/sites';
import type { Position } from './HeritageMap';
import type { RoadRoute } from '@/data/routing';

type Props = { site:HeritageSite; position:Position|null; route:RoadRoute|null; routeStatus:string; distance:number|null; tracking:boolean; onExit:()=>void; onToggleGps:()=>void; onHistory:()=>void; map:React.ReactNode; notice:string; canRetry3d:boolean; onRetry3d:()=>void };
export default function ImmersiveNavigation({site,position,route,routeStatus,distance,tracking,onExit,onToggleGps,onHistory,map,notice,canRetry3d,onRetry3d}:Props){
 const [expanded,setExpanded]=useState(false);
 return <section className="immersive quest-navigation" aria-label="Heritage navigation experience">
  <div className="immersive-scene" aria-hidden="true"/><div className="immersive-shade" aria-hidden="true"/>
  <div className="immersive-brand"><span>✥</span><div><b>HERITAGEVERSE</b><small>ANURADHAPURA</small></div></div>
  <div className="immersive-quest"><div className="immersive-quest-label"><Compass size={14}/> YOUR DESTINATION</div><strong>{site.name}</strong><span>{route?`${formatDistance(route.distance)} driving`:distance!==null?`${formatDistance(distance)} straight-line`:'GPS unavailable'}</span><small>Explore respectfully · follow local guidance</small></div>
  <aside className="immersive-card"><div className="immersive-card-image"><span>AI-GENERATED ILLUSTRATION</span></div><div className="immersive-card-content"><span className="eyebrow">YOUR SELECTED PLACE</span><h2>{site.name}</h2><b>{site.category}</b><p>{site.description}</p><div className="immersive-card-stat"><MapPin size={16}/><span>{route?`${formatDistance(route.distance)} · ~${Math.max(1,Math.round(route.duration/60))} min by road`:distance!==null?`${formatDistance(distance)} straight-line`:'Distance unavailable'}</span></div><small>Approximate locations · {route?'driving route, not walking':'route not available yet'}</small></div></aside>
  <div className="quest-art-label">AI-GENERATED SCENE · NOT LIVE TERRAIN OR AR</div>
  <div className={'quest-map-panel '+(expanded?'expanded':'')}><div className="quest-map-title"><span>{canRetry3d?'2D MAP FALLBACK':'OSM 3D TERRAIN MAP'} · {position?'GPS ON':'GPS UNAVAILABLE'}</span><button onClick={()=>setExpanded(v=>!v)} aria-label={expanded?'Minimize map':'Expand map'}>{expanded?<Minimize2 size={17}/>:<Expand size={17}/>}</button></div><div className="quest-map-content">{map}</div></div>
  <div className={'quest-status '+(expanded?'map-expanded':'')} role="status">{notice||routeStatus}{canRetry3d&&<button className="retry-3d" onClick={onRetry3d}><RefreshCw size={13}/> Try 3D again</button>}</div>
  <nav className={'quest-actions '+(expanded?'map-expanded':'')} aria-label="Navigation controls"><button onClick={()=>setExpanded(v=>!v)}><MapPin/><span>{expanded?'Small map':'3D Map'}</span></button><button onClick={onHistory}><BookOpen/><span>History</span></button><button onClick={onToggleGps}><Navigation/><span>{tracking?'Stop GPS':'Start GPS'}</span></button><button onClick={onExit}><X/><span>Exit</span></button></nav>
 </section>;
}
