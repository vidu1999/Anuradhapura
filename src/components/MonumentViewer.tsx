'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

function illustration() {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({color:0xe9e5d9,roughness:.85});
  const gold = new THREE.MeshStandardMaterial({color:0xc5a15f,roughness:.5,metalness:.25});
  const add = (geometry:THREE.BufferGeometry, material:THREE.Material, y:number) => {const mesh=new THREE.Mesh(geometry,material);mesh.position.y=y;group.add(mesh)};
  add(new THREE.CylinderGeometry(1.7,1.85,.24,48),stone,-.8);
  add(new THREE.CylinderGeometry(1.55,1.7,.2,48),stone,-.58);
  add(new THREE.SphereGeometry(1.45,48,32,0,Math.PI*2,0,Math.PI/2),stone,-.48);
  add(new THREE.CylinderGeometry(.18,.3,.2,24),gold,1.02);
  add(new THREE.CylinderGeometry(.025,.13,.7,24),gold,1.46);
  return group;
}
function disposeObject(object:THREE.Object3D){object.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{for(const v of Object.values(m)){if(v instanceof THREE.Texture)v.dispose()}m.dispose()})}})}
type Props={title:string;category:string;description:string;source:string;modelUrl?:string;onClose:()=>void;inline?:boolean};
export default function MonumentViewer({title,category,description,source,modelUrl,onClose,inline=false}:Props){
  const host=useRef<HTMLDivElement>(null);
  const controlsRef=useRef<OrbitControls|null>(null);
  const [rotating,setRotating]=useState(false);
  const [status,setStatus]=useState(modelUrl?'Loading supplied model…':'Generic illustration ready.');
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    const element=host.current;if(!element)return;
    setLoaded(false);setStatus(modelUrl?'Loading supplied model…':'Generic illustration ready.');
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true})}catch{setStatus('3D viewing is unavailable in this browser.');return}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0x203c2d);element.appendChild(renderer.domElement);
    const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(40,1,.01,1000);camera.position.set(4,3,5);
    scene.add(new THREE.HemisphereLight(0xffffff,0x536c52,2));const light=new THREE.DirectionalLight(0xffe4b2,2);light.position.set(4,8,5);scene.add(light);
    const controls=new OrbitControls(camera,renderer.domElement);controlsRef.current=controls;controls.enableDamping=true;controls.autoRotateSpeed=1;controls.minDistance=.05;controls.maxDistance=1000;
    let disposed=false;
    const draco = new DRACOLoader();draco.setDecoderPath('/draco/');
    const fallback=()=>{if(!disposed)scene.add(illustration())};
    if(modelUrl){new GLTFLoader().setDRACOLoader(draco).load(modelUrl,gltf=>{
      if(disposed){disposeObject(gltf.scene);return}
      const bounds=new THREE.Box3().setFromObject(gltf.scene);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());const max=Math.max(size.x,size.y,size.z);
      if(!Number.isFinite(max)||max<=0){disposeObject(gltf.scene);fallback();setStatus('Model has no visible geometry. Showing a generic illustration instead.');return}
      // Normalize and center arbitrary GLBs so their original scale or origin cannot hide them.
      const wrapper=new THREE.Group();const scale=3/max;gltf.scene.scale.multiplyScalar(scale);gltf.scene.position.sub(center.multiplyScalar(scale));wrapper.add(gltf.scene);scene.add(wrapper);controls.target.set(0,0,0);controls.update();setLoaded(true);setStatus(`${title} model loaded.`);
    },undefined,()=>{fallback();if(!disposed)setStatus('Model could not be loaded. Showing a generic illustration instead.')})}else fallback();
    const resize=()=>{const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(element);resize();
    let frame=0;const render=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render)};render();
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controlsRef.current=null;controls.dispose();draco.dispose();disposeObject(scene);renderer.dispose();renderer.domElement.remove()};
  },[modelUrl]);
  useEffect(()=>{setRotating(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)},[]);
  useEffect(()=>{if(controlsRef.current)controlsRef.current.autoRotate=rotating},[rotating]);
  useEffect(()=>{if(inline)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[onClose,inline]);
  if(inline) return <section className="map-model-preview" aria-label={`${title} 3D preview`}>
    <div className="map-model-canvas" ref={host}/>
    <div className="map-model-label"><strong>{title}</strong><span>{category}</span></div>
    <p className="map-model-status" role="status">{status}</p>
    <p className="map-model-note">{loaded?'Model accuracy and rights require verification.':'Generic illustration, not a reconstruction.'}</p>
    <button type="button" className="map-model-toggle" onClick={()=>setRotating(value=>!value)} aria-pressed={rotating}>{rotating?'Pause rotation':'Start rotation'}</button>
  </section>;
  return <div className="modal-backdrop" onClick={onClose}><section className="viewer-panel" role="dialog" aria-modal="true" aria-labelledby="viewer-title" onClick={e=>e.stopPropagation()}><header className="viewer-header"><div><span className="eyebrow">INTERACTIVE 3D HERITAGE</span><h2 id="viewer-title">{title}</h2><span className="category-tag">{category}</span></div><button className="close" onClick={onClose} aria-label="Close 3D viewer">×</button></header><div className="viewer-canvas" ref={host}/><p role="status">{status}</p><p className="viewer-warning">{loaded?'Model supplied by the operator; historical accuracy, provenance and rights must be verified.':'Generic artistic illustration only. This is not a model of the selected site or a measured archaeological reconstruction.'}</p><p>{description} <a className="source-link" href={source} target="_blank" rel="noreferrer">Read source ↗</a></p><button className="viewer-rotation" onClick={()=>setRotating(value=>!value)} aria-pressed={rotating}>{rotating?"Pause rotation":"Start rotation"}</button><p>Drag to rotate · Scroll or pinch to zoom · Right-drag to pan.</p></section></div>;
}
