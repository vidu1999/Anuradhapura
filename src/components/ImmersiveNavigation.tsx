'use client';
import { useState } from 'react';
import { BookOpen, Compass, Expand, MapPin, Minimize2, Navigation, X } from 'lucide-react';
import { formatDistance } from '@/data/distance';
import type { HeritageSite } from '@/data/sites';
import type { Position } from './HeritageMap';
import type { RoadRoute } from '@/data/routing';

type Props = { site:HeritageSite; position:Position|null; route:RoadRoute|null; routeStatus:string; distance:number|null; tracking:boolean; onExit:()=>void; onToggleGps:()=>void; onHistory:()=>void; map:React.ReactNode; notice:string };
export default function ImmersiveNavigation({site,position,route,routeStatus,distance,tracking,onExit,onToggleGps,onHistory,map,notice}:Props){
 const [expanded,setExpanded]=useState(false);
 return <section className="immersive" aria-label="Heritage navigation experience">
  <div className="immersive-scene" aria-hidden="true"/>
  <div className="immersive-shade" aria-hidden="true"/>
  <div className="immersive-brand"><span>✥</span><div><b>HERITAGEVERSE</b><small>ANURADHAPURA</small></div></div>
  <div className="immersive-quest"><div className="immersive-quest-label"><Compass size={14}/> YOUR DESTINATION</div><strong>{site.name}</strong><span>{route?`${formatDistance(route.distance)} driving route`:distance!==null?`${formatDistance(distance)} straight-line`:'Waiting for location'}</span><small>Explore respectfully · follow local guidance</small></div>
  <div className="immersive-note"><span>✦</span><p><b>Welcome, explorer.</b><br/>Discover the stories of this ancient city.</p></div>
  <div className="artwork-label">ILLUSTRATIVE SCENE · NOT LIVE TERRAIN OR AR</div>
  <aside className="immersive-card"><div className="immersive-card-image"><span>ILLUSTRATIVE IMAGE</span></div><div className="immersive-card-content"><span className="eyebrow">YOUR SELECTED PLACE</span><h2>{site.name}</h2><b>{site.category}</b><p>{site.description}</p><div className="immersive-card-stat"><MapPin size={16}/><span>{route?`${formatDistance(route.distance)} · ~${Math.max(1,Math.round(route.duration/60))} min by road`:distance!==null?`${formatDistance(distance)} straight-line`:'Distance unavailable'}</span></div><small>Approximate locations · {route?'driving route, not walking':'route not available yet'}</small></div></aside>
  <div className={'immersive-map-panel '+(expanded?'expanded':'')}><div className="immersive-map-title"><span><span className="immersive-live-dot"/> LIVE MAP {position?'· GPS ON':'· GPS WAITING'}</span><button onClick={()=>setExpanded(v=>!v)} aria-label={expanded?'Minimize live map':'Expand live map'}>{expanded?<Minimize2 size={15}/>:<Expand size={15}/>}</button></div><div className="immersive-map-content">{map}</div></div>
  <div className="immersive-status" role="status">{notice||routeStatus}</div>
  <nav className="immersive-actions" aria-label="Navigation controls"><button onClick={()=>setExpanded(v=>!v)}><MapPin/><span>{expanded?'Small map':'Live map'}</span></button><button onClick={onHistory}><BookOpen/><span>History</span></button><button onClick={onToggleGps}><Navigation/><span>{tracking?'Stop GPS':'Start GPS'}</span></button><button onClick={onExit}><X/><span>Exit</span></button></nav>
 </section>;
}
