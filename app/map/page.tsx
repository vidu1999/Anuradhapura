import dynamic from 'next/dynamic';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';
const MapExperience = dynamic(() => import('./MapExperience'));
export default function MapPage(){ return <MapExperience/>; }
