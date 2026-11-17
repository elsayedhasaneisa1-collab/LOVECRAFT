'use client';
import { useEffect, useRef, useState } from 'react';
import { GiftIllustration } from './GiftIllustration';

/** A real, procedural Three.js object. No model server, credentials or external assets. */
export default function GiftObject({ primary, stage }: { primary: string; stage: number }) {
  const host = useRef<HTMLDivElement>(null);
  const target = useRef(stage);
  const [rendered, setRendered] = useState(false);
  useEffect(() => { target.current = stage; }, [stage]);
  useEffect(() => {
    const el = host.current;
    if (!el || !window.WebGL2RenderingContext || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    let frame = 0;
    let release = () => {};
    void (async () => {
      const T = await import('three');
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      const geometries: import('three').BufferGeometry[] = [];
      const materials: import('three').Material[] = [];
      let observer: ResizeObserver | undefined;
      let intersection: IntersectionObserver | undefined;
      let pointerX = 0, pointerY = 0, visible = true;
      const move = (e: PointerEvent) => { const b = el.getBoundingClientRect(); pointerX = (e.clientX - b.left) / Math.max(b.width,1) - .5; pointerY = (e.clientY-b.top)/Math.max(b.height,1)-.5; };
      const leave = () => { pointerX=0; pointerY=0; };
      const lost = (e: Event) => { e.preventDefault(); visible=false; if(!cancelled)setRendered(false); };
      release = () => {
        cancelAnimationFrame(frame); observer?.disconnect(); intersection?.disconnect();
        el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',leave);canvas.removeEventListener('webglcontextlost',lost);
        for(const geometry of geometries) geometry.dispose(); for(const material of materials) material.dispose();
        renderer.dispose();renderer.forceContextLoss();canvas.remove();
      };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6)); renderer.setClearColor(0x000000,0);
      renderer.outputColorSpace = T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
      const scene=new T.Scene();
      const camera=new T.PerspectiveCamera(31,1,.1,30);camera.position.set(3.25,2.5,4.1);camera.lookAt(0,.22,0);
      const object=new T.Group(),lid=new T.Group();scene.add(object);object.add(lid);
      const wrap=new T.MeshStandardMaterial({color:primary,roughness:.33,metalness:.25});
      const satin=new T.MeshStandardMaterial({color:0xf0c68d,roughness:.25,metalness:.5});
      const trim=new T.MeshStandardMaterial({color:0xffddb2,roughness:.35,metalness:.2});
      materials.push(wrap,satin,trim);
      function box(parent:import('three').Group,width:number,height:number,depth:number,x:number,y:number,z:number,mat:import('three').Material) {
        const geo=new T.BoxGeometry(width,height,depth);geometries.push(geo);const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;
      }
      // Open vessel with four walls, rather than a solid box hidden under a floating lid.
      box(object,1.56,.09,1.36,0,-.7,0,wrap);
      box(object,1.56,1.04,.07,0,-.15,.665,wrap);box(object,1.56,1.04,.07,0,-.15,-.665,wrap);
      box(object,.07,1.04,1.32,-.745,-.15,0,wrap);box(object,.07,1.04,1.32,.745,-.15,0,wrap);
      for(const z of [-.708,.708])box(object,.21,1.06,.015,0,-.15,z,satin);
      for(const x of [-.791,.791])box(object,.015,1.06,.21,x,-.15,0,satin);
      box(lid,1.64,.22,1.46,0,0,0,wrap);box(lid,.22,.228,1.47,0,0,0,satin);box(lid,1.65,.23,.22,0,0,0,satin);
      for(const side of [-1,1]){
        const loop=new T.CatmullRomCurve3([new T.Vector3(0,.16,0),new T.Vector3(side*.3,.46,.02),new T.Vector3(side*.58,.41,.03),new T.Vector3(side*.49,.19,.04),new T.Vector3(side*.02,.15,0)]);
        const g=new T.TubeGeometry(loop,30,.047,7,false);geometries.push(g);lid.add(new T.Mesh(g,satin));
      }
      const knot=new T.IcosahedronGeometry(.13,1);geometries.push(knot);const knotMesh=new T.Mesh(knot,trim);knotMesh.position.y=.19;lid.add(knotMesh);
      const ambient=new T.HemisphereLight(0xfff8ee,0x84617e,2.4);scene.add(ambient);
      const key=new T.DirectionalLight(0xffe4c8,3.2);key.position.set(-3,5,4);scene.add(key);
      const rim=new T.DirectionalLight(0xcbb8ff,1.8);rim.position.set(3,1,-3);scene.add(rim);
      const resize=()=>{const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
      resize(); el.appendChild(canvas);
      if('ResizeObserver' in window){observer=new ResizeObserver(resize);observer.observe(el);}
      if('IntersectionObserver' in window){intersection=new IntersectionObserver(([e])=>{visible=Boolean(e?.isIntersecting);});intersection.observe(el);}
      el.addEventListener('pointermove',move,{passive:true});el.addEventListener('pointerleave',leave);canvas.addEventListener('webglcontextlost',lost);
      let last=-100,elapsed=0,lift=0;
      function draw(time:number){
        if(cancelled)return;frame=requestAnimationFrame(draw);
        if(document.hidden||!visible||time-last<32)return;
        const dt=Math.min((time-last)/1000,.06);last=time;elapsed+=dt;
        const opened=target.current>=3;const desired=opened?.86:target.current*.095;
        lift+=(desired-lift)*Math.min(1,dt*6);
        lid.position.set(0,.49+lift,opened?-.15*lift:0);lid.rotation.z=lift*.18;
        object.rotation.y+=(Math.sin(elapsed*.4)*.13+pointerX*.4-object.rotation.y)*.09;
        object.rotation.x+=(pointerY*.09-object.rotation.x)*.08;object.position.y=Math.sin(elapsed*.9)*.023-lift*.25;
        renderer.render(scene,camera);
      }
      draw(performance.now());setRendered(true);
    })().catch(()=>{release();release=()=>{};if(!cancelled)setRendered(false);});
    return ()=>{cancelled=true;release();};
  },[primary]);
  return <div ref={host} aria-hidden="true" data-gift-renderer={rendered?'webgl':'illustration'} className="gift-viewport">{!rendered&&<GiftIllustration primary={primary} stage={stage}/>}</div>;
}
