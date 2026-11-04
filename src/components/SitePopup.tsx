'use client';
import MonumentViewer from './MonumentViewer';
import type { HeritageSite } from '@/data/sites';

/** The same anchored popup layout for every mapped site; images are never presented as site photographs. */
export default function SitePopup({site,image,loading,error,onGenerate}:{site:HeritageSite;image?:string;loading:boolean;error?:string;onGenerate:()=>void}){
 if(site.modelUrl)return <MonumentViewer inline title={site.name} category={site.category} description={site.description} source={site.source} modelUrl={site.modelUrl} onClose={()=>{}}/>;
 return <section className="map-model-preview" aria-label={`${site.name} place preview`}>
  <div className="map-model-canvas map-popup-image"><img src={image||"/images/heritage-placeholder.png"} alt={image?"AI-generated imagined illustration, not a photograph or verified reconstruction":"AI-generated generic heritage illustration, not a photograph of this location"}/><span>AI-GENERATED ILLUSTRATION</span></div>
  <div className="map-model-label"><strong>{site.name}</strong><span>{site.category}</span></div>
  <p className="map-model-status">No site-specific 3D model available.</p>
  <p className="map-model-note">{image?'Imagined AI illustration, not a photograph or verified reconstruction.':'Generic image, not a site photograph or reconstruction.'}</p>
  <p className="map-model-note">Generating sends this site’s name, category and description to OpenRouter and its providers. Text and image generation may incur charges.</p>
  <button className="map-model-toggle" type="button" disabled={loading} onClick={onGenerate}>{loading?'Generating…':image?'Generate another image (may cost)':'Generate AI image (may cost)'}</button>
  {error&&<p className="map-model-note" role="alert">{error}</p>}
  <a className="map-popup-source" href={site.source} target="_blank" rel="noreferrer">{site.source.includes('whc.unesco.org')?'UNESCO city context ↗':'Read source ↗'}</a>
 </section>;
}
