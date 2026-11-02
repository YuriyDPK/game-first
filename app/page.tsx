'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { makeSurfaceMaterials } from './game-textures';
import { LEVEL_HEIGHTS, REAR_STAIR_SCALE, floorIndexAt, supportHeight } from './stair-physics';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Remote = { id: string; name: string; x: number; y: number; z: number; hidden: boolean };
type Conversation = { name: string; text: string };
type GameStatus = { hidden: boolean; near: boolean; danger: boolean; stamina: number; time: number; caught: boolean; won: boolean; location: string; x: number; z: number; door: string | null; floor: number; npc: string | null; dialogue: Conversation | null };
const initial: GameStatus = { hidden: false, near: false, danger: false, stamina: 100, time: 180, caught: false, won: false, location: 'Школьный двор', x: -16.5, z: 38, door: null, floor: 1, npc: null, dialogue: null };
const wallRects: number[][] = [];

function createWorld(container: HTMLDivElement, onUpdate: (s: GameStatus) => void, state: { current: { playing: boolean; exploring: boolean; reset: number; remotes: Remote[]; send: (x: number, y: number, z: number, hidden: boolean) => void } }) {
  wallRects.length = 0;
  const upperRects:number[][][]=[[],[],[],[]];
  const levels=LEVEL_HEIGHTS;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#b8d6d0'); scene.fog = new THREE.Fog('#b8d6d0', 110, 200);
  const sky=document.createElement('canvas');sky.width=4;sky.height=256;const skyContext=sky.getContext('2d')!;const gradient=skyContext.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'#8fb8ce');gradient.addColorStop(.55,'#c9dfe0');gradient.addColorStop(1,'#e9e5ce');skyContext.fillStyle=gradient;skyContext.fillRect(0,0,4,256);scene.background=new THREE.CanvasTexture(sky);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15; container.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight('#eaf6ff', '#b0a994', 2.3));
  const sun = new THREE.DirectionalLight('#fff1ce', 2.5); sun.position.set(-18, 35, 20); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -38; sun.shadow.camera.right = 38; sun.shadow.camera.top = 38; sun.shadow.camera.bottom = -38; sun.shadow.camera.near=1;sun.shadow.camera.far=100;sun.shadow.normalBias = .025; scene.add(sun);scene.add(sun.target);
  const surfaces=makeSurfaceMaterials();
  const mat = (color: string, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness });
  const materials: Record<string, THREE.MeshStandardMaterial> = {};
  const plasterMaterials: Record<string, THREE.MeshStandardMaterial> = {};
  const material = (color: string) => materials[color] ??= mat(color);
  function box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, shadow = true) {
    const geometry=new THREE.BoxGeometry(w,h,d);let surface:THREE.Material=material(color);
    if(w>4&&d>4&&(h<.3||color==='#899e70')){
      if(color==='#899e70')surface=surfaces.grass;
      else if(color==='#a9aaa0'||color==='#b3b2a5')surface=surfaces.asphalt;
      else if(color==='#c7c4b7')surface=surfaces.paving;
      else if(color==='#a65f46')surface=surfaces.wood;
      else if(['#b7a489','#dad4c1','#d7d0b9','#d8c8a8','#d5d8c9','#d9d2bf'].includes(color))surface=surfaces.tile;
      if(surface!==material(color)){
        const uv=geometry.attributes.uv;for(let i=8;i<12;i++)uv.setXY(i,uv.getX(i)*w/3,uv.getY(i)*d/3);
        const m=new THREE.Mesh(geometry,[material(color),material(color),surface,material(color),material(color),material(color)]);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;scene.add(m);return m;
      }
    }
    if(['#b97870','#b5d3b5'].includes(color)||(h>3&&(w>3||d>3)&&color==='#c5dbcb')){
      const uv=geometry.attributes.uv;for(let face=0;face<6;face++){const u=face<2?d: w;const v=face===2||face===3?d:h;for(let i=face*4;i<face*4+4;i++)uv.setXY(i,uv.getX(i)*u/3,uv.getY(i)*v/3);}
      surface=color==='#b97870'?surfaces.exteriorPink:color==='#b5d3b5'?surfaces.exteriorGreen:(plasterMaterials[color] ??= new THREE.MeshStandardMaterial({color,map:surfaces.plaster,roughness:1}));
    }
    const m = new THREE.Mesh(geometry,surface); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m;
  }
  function cylinder(x: number, y: number, z: number, r: number, h: number, color: string, r2 = r) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, 8), material(color)); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; }
  // Coordinates are traced from the supplied first-floor plan: one unit is about one metre.
  // The entrance is at the bottom of the plan; the workshop is at the far end.
  const WALL_HEIGHT = 4.1;
  function wall(x: number, z: number, w: number, d: number, color = '#c5dbcb') {
    box(x, WALL_HEIGHT/2, z, w, WALL_HEIGHT, d, color);
    box(x, .25, z, w+.03, .5, d+.03, '#9db9aa');
    wallRects.push([x-w/2-.32,x+w/2+.32,z-d/2-.32,z+d/2+.32]);
  }
  // Exterior walls are assembled around actual window openings; collision remains
  // continuous so the glass cannot be walked through.
  const glass=new THREE.MeshPhysicalMaterial({color:'#b7d0cd',transparent:true,opacity:.3,roughness:.18,metalness:.08,depthWrite:false,side:THREE.DoubleSide});
  function facade(x:number,z:number,w:number,d:number,ground=true){
    const horizontal=w>d,length=horizontal?w:d,thickness=horizontal?d:w;
    const segment=(start:number,end:number,cy:number,height:number,color:string)=>{
      if(end-start<.005)return;const mid=(start+end)/2;
      box(horizontal?x+mid:x,cy,horizontal?z:z+mid,horizontal?end-start:thickness,height,horizontal?thickness:end-start,color);
    };
    const framePart=(offset:number,y:number,span:number,h:number,depth:number,color:string)=>{
      box(horizontal?x+offset:x,y,horizontal?z:z+offset,horizontal?span:depth,h,horizontal?depth:span,color,false);
    };
    const count=length>=3.1?Math.max(1,Math.floor((length-.8)/3.1)):0;
    const windowWidth=Math.min(1.35,(length-.8)/Math.max(count,1));
    const gap=count?(length-count*windowWidth)/(count+1):0;
    const slots=Array.from({length:count},(_,i)=>({a:-length/2+gap+i*(windowWidth+gap),b:-length/2+gap+i*(windowWidth+gap)+windowWidth}));
    function story(bottom:number,top:number,sill:number,head:number,color:string){
      segment(-length/2,length/2,(bottom+sill)/2,sill-bottom,color);
      segment(-length/2,length/2,(head+top)/2,top-head,color);
      let cursor=-length/2;
      for(const slot of slots){
        segment(cursor,slot.a,(sill+head)/2,head-sill,color);cursor=slot.b;
        const center=(slot.a+slot.b)/2,winHeight=head-sill,mid=(head+sill)/2;
        const pane=new THREE.Mesh(new THREE.BoxGeometry(horizontal?windowWidth-.06:thickness*.45,winHeight-.06,horizontal?thickness*.45:windowWidth-.06),glass);
        pane.position.set(horizontal?x+center:x,mid,horizontal?z:z+center);scene.add(pane);
        for(const edge of [slot.a,slot.b])framePart(edge,mid,.085,winHeight+.15,thickness+.12,'#e9e8dc');
        for(const yy of [sill,head])framePart(center,yy,windowWidth+.12,.1,thickness+.13,'#e9e8dc');
        framePart(center,mid,.055,winHeight,thickness+.14,'#eeeae0');
        framePart(center,sill+winHeight*.48,windowWidth,.055,thickness+.14,'#eeeae0');
        framePart(center,sill-.07,windowWidth+.28,.11,thickness+.32,'#eee9dd');
      }
      segment(cursor,length/2,(sill+head)/2,head-sill,color);
    }
    if(ground){story(0,4.05,.9,2.9,'#b97870');segment(-length/2,length/2,.24,.48,'#997c72');}
    story(4.2,7.15,4.75,6.45,'#b5d3b5');
    story(7.3,10.25,7.85,9.55,'#b5d3b5');
    story(10.4,13.35,10.95,12.65,'#b5d3b5');
    for(const y of [4.13,7.22,10.32])segment(-length/2,length/2,y,.16,'#ebe8dd');
    segment(-length/2,length/2,13.43,.22,'#eee7da');segment(-length/2,length/2,13.68,.3,'#975c52');
  }
  function exterior(x:number,z:number,w:number,d:number){
    facade(x,z,w,d);wallRects.push([x-w/2-.32,x+w/2+.32,z-d/2-.32,z+d/2+.32]);
  }
  function floor(x1:number,z1:number,x2:number,z2:number,color:string,ceiling=true) {
    box((x1+x2)/2,.04,(z1+z2)/2,x2-x1,.12,z2-z1,color,false);
    if(ceiling) box((x1+x2)/2,4.15,(z1+z2)/2,x2-x1,.12,z2-z1,'#e6e7dc',false);
  }
  function strip(x:number,z:number,w:number,d:number,color:string) {box(x,.12,z,w,.025,d,color,false);}
  function hwall(x1:number,x2:number,z:number,outer=false) { (outer?exterior:wall)((x1+x2)/2,z,x2-x1,.32); }
  function vwall(x:number,z1:number,z2:number,outer=false) { (outer?exterior:wall)(x,(z1+z2)/2,.32,z2-z1); }
  function sign(text:string,x:number,z:number,rotation=0,height=3.25) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.fillStyle='#e9eee1';ctx.fillRect(0,0,512,128);ctx.fillStyle='#49695b';ctx.font='bold 48px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,66);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const board=new THREE.Mesh(new THREE.PlaneGeometry(2.1,.52),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));board.position.set(x,height,z);board.rotation.y=rotation;scene.add(board);
  }
  // School grounds and the courtyard inside the L-shaped school.
  box(0,-.3,-17,170,.5,170,'#899e70',false);
  box(-5,-.02,30,115,.08,25,'#a9aaa0',false);
  box(-26,-.01,-19,30,.08,54,'#b3b2a5',false);
  box(-16.5,.01,30,8,.08,13,'#c7c4b7',false);
  for(let z=-42;z<4;z+=4) strip(-28,z,17,.04,'#c1c3b4');
  // First floor: rooms, passageways and their actual relative positions.
  floor(-4.25,-55,32.4,-33,'#b7a489'); // two workshop rooms
  floor(-4.25,-33,8.4,-23.8,'#dad4c1',false); // second open stairwell
  floor(8.4,-33,32.4,-23.8,'#dad4c1'); // rear corridor
  floor(12.4,-28,20.1,13.15,'#d7d0b9'); // long corridor
  floor(20.1,-28,32.4,13.15,'#d8c8a8'); // canteen
  floor(-13.1,-4.35,12.4,8.3,'#a65f46'); // gym
  floor(-32,-4.35,-23.4,8.3,'#d5d8c9'); // PE store
  floor(-23.4,-4.35,-13.1,8.3,'#d5d8c9',false); // open stairwell
  floor(-32,8.3,20.1,13.15,'#d7d0b9'); // transverse corridor
  floor(-32,13.15,-1,27,'#d9d2bf'); // cloakrooms and main entrance
  // Outer boundary of the workshop and the rear stair wing.
  hwall(-4.25,32.4,-55,true);vwall(-4.25,-55,-50,true);vwall(-4.25,-47,-42.25,true);
  vwall(-4.25,-42.25,-33,true);vwall(32.4,-55,-33,true);
  vwall(12.4,-55,-47.5);vwall(12.4,-44.5,-33); // partition between workshops
  hwall(12.4,20,-33);hwall(23,32.4,-33); // workshop doorway from the back hall
  hwall(-4.25,12.4,-33,true);vwall(-4.25,-33,-23.8,true);hwall(-4.25,12.4,-23.8,true);
  vwall(12.4,-33,-29.5);vwall(12.4,-27.3,-23.8); // entry to the rear stairs
  vwall(32.4,-33,-31,true);vwall(32.4,-28.5,13.15,true); // rear exit
  // Long corridor, canteen and courtyard-facing wall.
  vwall(12.4,-23.8,-4.35,true);
  vwall(20.1,-28,-14);vwall(20.1,-10,3);vwall(20.1,6,13.15);
  hwall(20.1,32.4,-28);hwall(-1,32.4,13.15,true);
  hwall(20.1,25.3,-15.4);hwall(27.5,32.4,-15.4); // locked kitchen
  // Gym, PE store and the staircase exit to the courtyard.
  hwall(-32,-22.8,-4.35,true);hwall(-19.8,-13.1,-4.35,true);hwall(-13.1,12.4,-4.35,true);
  vwall(-32,-4.35,27,true);vwall(-13.1,-4.35,8.3);vwall(12.4,-4.35,2);vwall(12.4,5,8.3);
  hwall(-13.1,-5.5,8.3);hwall(-2,12.4,8.3); // gym entrance from corridor
  vwall(-23.4,-4.35,8.3);hwall(-32,-29,8.3);hwall(-26,-23.4,8.3); // PE store
  hwall(-23.4,-19.2,8.3);hwall(-16.2,-13.1,8.3); // staircase door from corridor
  // Entry hall, large cloakroom and two changing rooms.
  hwall(-32,-27,13.15);hwall(-24,-20.4,13.15);
  vwall(-20.4,13.15,27);
  vwall(-12.65,13.15,15.2);vwall(-12.65,18.2,21.5);vwall(-12.65,24.5,27);
  hwall(-12.65,-1,13.15);hwall(-12.65,-1,20.2); // separate changing rooms open from entry
  vwall(-1,13.15,27,true);
  hwall(-32,-18.5,27,true);hwall(-14.5,-1,27,true); // main entrance
  // Entrance canopy and steps.
  box(-16.5,3.08,28,6.8,.22,2.8,'#8c7770');for(const x of [-19.55,-13.45]) box(x,1.5,29,.2,3,.2,'#e5e0d3');
  box(-16.5,.13,27.8,6,.22,1.5,'#c2b9a8');box(-16.5,.1,28.7,7,.17,.5,'#d4cbbb');
  // Hinged doors have a visible frame, two animated leaves and a real closed collision.
  type Door = {x:number;z:number;width:number;vertical:boolean;name:string;level:number;locked:boolean;left:THREE.Group;right:THREE.Group;open:number;target:number;closeAt:number};
  const doors:Door[]=[];
  function door(x:number,z:number,width:number,vertical:boolean,name:string,outer=false,level=0,locked=false){
    const frame=new THREE.Group();frame.position.set(x,levels[level],z);frame.rotation.y=vertical?Math.PI/2:0;scene.add(frame);
    const part=(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),color==='#71564b'||color==='#907053'?surfaces.door:color==='#b97870'?surfaces.exteriorPink:color==='#b5d3b5'?surfaces.exteriorGreen:material(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    const wood=outer?'#71564b':'#907053',trim=outer?'#e5dfd0':'#e4e1d3',clear=Math.min(width,2.2),half=clear/2,fill=(width-clear)/2,storyHeight=level===0?4.08:2.96;
    for(const side of [-1,1]){
      if(fill>.02){
        const offset=side*(half+fill/2);part(frame,offset,storyHeight/2,0,fill,storyHeight,.32,outer?'#b97870':'#c5dbcb');
        const colliders=level===0?wallRects:upperRects[level];
        if(vertical){const center=z-offset;colliders.push([x-.48,x+.48,center-fill/2-.32,center+fill/2+.32]);}
        else{const center=x+offset;colliders.push([center-fill/2-.32,center+fill/2+.32,z-.48,z+.48]);}
      }
      part(frame,side*(half-.04),1.25,0,.12,2.5,.45,trim);
    }
    part(frame,0,2.52,0,clear,.14,.45,trim);part(frame,0,(storyHeight+2.6)/2,0,clear,storyHeight-2.6,.32,outer?'#b97870':'#c5dbcb');
    function leaf(side:number){
      const hinge=new THREE.Group();hinge.position.x=side*(half-.09);frame.add(hinge);const span=half-.12,offset=-side*span/2;
      part(hinge,offset,1.22,0,span,2.4,.11,wood);
      part(hinge,offset,1.72,.07,span*.72,.8,.035,'#94afaa');part(hinge,offset,1.72,-.07,span*.72,.8,.035,'#94afaa');
      for(const face of [-1,1]){part(hinge,offset,1.72,face*.09,.035,.8,.025,trim);part(hinge,offset,1.72,face*.09,span*.72,.035,.025,trim);part(hinge,-side*(span-.15),1.02,face*.1,.11,.04,.06,'#d7bc7b');}
      return hinge;
    }
    const left=leaf(-1),right=leaf(1);doors.push({x,z,width:clear,vertical,name,level,locked,left,right,open:0,target:0,closeAt:0});
    if(outer)facade(x,z,vertical?.32:width,vertical?width:.32,false);
  }
  door(-16.5,27,4,false,'главный вход',true);
  door(-21.3,-4.35,3,false,'выход во двор',true);
  door(32.4,-29.75,2.5,true,'задний вход',true);
  door(-4.25,-48.5,3,true,'выход из мастерской',true);
  door(-3.75,8.3,3.5,false,'спортзал');
  door(12.4,3.5,3,true,'спортзал');
  door(20.1,-12,4,true,'столовая');door(20.1,4.5,3,true,'столовая');
  door(21.5,-33,3,false,'мастерская');
  door(-27.5,8.3,3,false,'коморка физрука');
  door(-25.5,13.15,3,false,'гардероб');
  door(-17.7,8.3,3,false,'лестница');
  door(12.4,-28.4,2.2,true,'дальняя лестница');
  door(-12.65,16.7,3,true,'первая раздевалка');door(-12.65,23,3,true,'вторая раздевалка');
  door(12.4,-46,3,true,'вторая мастерская');
  door(26.4,-15.4,2.2,false,'кухня',false,0,true);
  // Upper floors are an inferred classroom layout; only the first floor has a supplied plan.
  function upperWall(level:number,x:number,z:number,w:number,d:number){
    const y=levels[level];box(x,y+1.48,z,w,2.96,d,'#c5dbcb');box(x,y+.18,z,w+.03,.36,d+.03,'#9db9aa');
    upperRects[level].push([x-w/2-.32,x+w/2+.32,z-d/2-.32,z+d/2+.32]);
  }
  function upperH(level:number,a:number,b:number,z:number){if(b>a)upperWall(level,(a+b)/2,z,b-a,.32);}
  function upperV(level:number,x:number,a:number,b:number){if(b>a)upperWall(level,x,(a+b)/2,.32,b-a);}
  function upperBoundary(level:number,x:number,z:number,w:number,d:number){upperRects[level].push([x-w/2-.32,x+w/2+.32,z-d/2-.32,z+d/2+.32]);}
  function upperFloor(level:number,x1:number,z1:number,x2:number,z2:number,color='#d7d0b9'){
    box((x1+x2)/2,levels[level]-.02,(z1+z2)/2,x2-x1,.16,z2-z1,color,false);
    if(level===3)box((x1+x2)/2,13.36,(z1+z2)/2,x2-x1,.13,z2-z1,'#e6e7dc',false);
  }
  function doorRow(level:number,a:number,b:number,position:number,vertical:boolean,openings:{center:number;name:string}[]){
    let cursor=a;for(const opening of openings){const left=opening.center-1.1,right=opening.center+1.1;if(vertical)upperV(level,position,cursor,left);else upperH(level,cursor,left,position);door(vertical?position:opening.center,vertical?opening.center:position,2.2,vertical,opening.name,false,level);cursor=right;}if(vertical)upperV(level,position,cursor,b);else upperH(level,cursor,b,position);
  }
  function classroom(level:number,cx:number,zNorth=-4.35){
    const y=levels[level];
    box(cx,y+1.95,zNorth+.2,4.4,1.25,.08,'#3d6255');box(cx,y+1.29,zNorth+.17,4.6,.08,.14,'#a68c6d');
    box(cx,y+.75,zNorth+2.1,1.9,.12,.85,'#9a7454');for(const dx of [-.75,.75])box(cx+dx,y+.36,zNorth+2.1,.08,.72,.08,'#5c7169');
    for(const dx of [-2,0,2])for(const dz of [4.1,6.9,9.7]){
      box(cx+dx,y+.75,zNorth+dz,1.35,.1,.7,'#b28e6a');
      for(const a of [-.52,.52])for(const b of [-.24,.24])box(cx+dx+a,y+.36,zNorth+dz+b,.06,.72,.06,'#6d7d70');
      box(cx+dx,y+.43,zNorth+dz+.75,1,.08,.42,'#829989');box(cx+dx,y+.78,zNorth+dz+1.03,1,.68,.07,'#829989');
      box(cx+dx-.2,y+.82,zNorth+dz,.35,.04,.26,'#d5d3bb');
    }
  }
  function classroomSide(level:number,centerZ:number){
    const y=levels[level];
    box(31.95,y+1.95,centerZ,.08,1.25,3.8,'#3d6255');
    box(29.5,y+.74,centerZ,1.4,.1,1.8,'#a27e5d');
    for(const x of [23,26,29])for(const dz of [-3,0,3]){box(x,y+.75,centerZ+dz,1.2,.1,.7,'#b28e6a');for(const dx of [-.45,.45])box(x+dx,y+.37,centerZ+dz,.07,.74,.07,'#738579');box(x,y+.42,centerZ+dz+.7,.9,.09,.4,'#829989');}
  }
  for(let level=1;level<=3;level++){
    upperFloor(level,-32,-4.35,-23.4,8.3);upperFloor(level,-13.1,-4.35,12.4,8.3);
    upperFloor(level,-32,8.3,20.1,13.15);upperFloor(level,12.4,-28,20.1,8.3);upperFloor(level,20.1,-28,32.4,13.15);
    upperFloor(level,-23.4,5.3,-13.1,8.3); // front landing, open shaft beyond it
    upperFloor(level,5.4,-33,20.1,-23.8); // rear landing and its corridor
    upperBoundary(level,-32,4.4,.32,17.5);upperBoundary(level,-9.8,-4.35,44.4,.32);upperBoundary(level,32.4,-7.4,.32,41.2);
    upperBoundary(level,15.7,13.15,33.4,.32);upperH(level,-32,-1,13.15);upperH(level,20.1,32.4,-28);
    upperBoundary(level,-4.25,-28.4,.32,9.2);upperBoundary(level,4.075,-33,16.65,.32);upperBoundary(level,4.075,-23.8,16.65,.32);upperH(level,12.4,20.1,-33);
    for(const x of [-23.4,-13.1,-4.6,3.9,12.4])upperV(level,x,-4.35,8.3);
    upperV(level,12.4,-23.8,-4.35);upperH(level,20.1,32.4,-14.5);upperH(level,20.1,32.4,-.5);
    doorRow(level,-32,12.4,8.3,false,[{center:-27.5,name:'кабинет'},{center:-17.7,name:'лестница'},{center:-9,name:'кабинет'},{center:-.35,name:'кабинет'},{center:8,name:'кабинет'}]);
    doorRow(level,-33,-23.8,12.4,true,[{center:-28.4,name:'дальняя лестница'}]);
    doorRow(level,-28,13.15,20.1,true,[{center:-21,name:'кабинет'},{center:-7,name:'кабинет'},{center:6.5,name:'кабинет'}]);
    classroom(level,-8.85);classroom(level,-.35);classroom(level,8.15);classroomSide(level,-21.25);classroomSide(level,-7.5);classroomSide(level,6.3);
    const y=levels[level];for(let x=-29;x<18;x+=8)box(x,y+2.85,10.7,1.7,.08,.36,'#fff5db',false);
    for(let z=-24;z<8;z+=8)box(16.2,y+2.85,z,1.7,.08,.36,'#fff5db',false);
    sign(`${level+1} ЭТАЖ`,-17.7,8.5,0,y+2.68);
  }
  // Two matching switchback stairwells, both mirrored from the previous orientation.
  function buildStairwell(rear=false){
    const stairBox=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>rear
      ?box(z+.1,y,-28.4+(x+18.25)*REAR_STAIR_SCALE,d,h,w*REAR_STAIR_SCALE,color)
      :box(x,y,z,w,h,d,color);
    const railTilt=(rail:THREE.Mesh,angle:number)=>{if(rear)rail.rotation.z=-angle;else rail.rotation.x=angle;};
    for(let level=0;level<3;level++){
      const base=levels[level],rise=levels[level+1]-base,half=rise/2;
      stairBox(-18.8,base+half-.1,-3.55,7.8,.2,1.5,'#bcc7be');
      for(let i=0;i<12;i++){
        const lowZ=6.2-(i+.5)*.75,highZ=-2.8+(i+.5)*.75;
        stairBox(-16.6,base+(i+1)*half/12-.1,lowZ,3.3,.2,.76,'#c5ccc2');
        stairBox(-20.95,base+half+(i+1)*half/12-.1,highZ,3.3,.2,.76,'#c5ccc2');
        if(i%3===0){
          for(const x of [-18.2,-15])stairBox(x,base+(i+1)*half/12+.43,lowZ,.055,.95,.055,'#728b7d');
          for(const x of [-22.55,-19.35])stairBox(x,base+half+(i+1)*half/12+.43,highZ,.055,.95,.055,'#728b7d');
        }
      }
      for(const x of [-18.2,-15])railTilt(stairBox(x,base+half/2+.95,1.7,.08,.08,9.4,'#566f61'),Math.atan2(half,9));
      for(const x of [-22.55,-19.35])railTilt(stairBox(x,base+half*1.5+.95,1.7,.08,.08,9.4,'#566f61'),-Math.atan2(half,9));
    }
    stairBox(-18.25,13.36,1.9,10.3,.13,12.5,'#e6e7dc');
  }
  buildStairwell();buildStairwell(true);
  // The large gym: varnished boards, court markings, benches, bars and hoops.
  for(const z of [-3,6.95])strip(-.35,z,23,.09,'#d6e1cb');
  for(const x of [-11.85,11.15,-.35])strip(x,1.97,.09,10,'#d6e1cb');
  const circle = new THREE.Mesh(new THREE.RingGeometry(1.7,1.78,48),material('#e1e2ce'));circle.rotation.x=-Math.PI/2;circle.position.set(-.35,.15,1.97);scene.add(circle);
  for(const x of [-11.8,-9.4,-.8,1.6,4,6.4,8.8]){box(x,2,8.05,.08,3.2,.12,'#9d673e');box(x+1.65,2,8.05,.08,3.2,.12,'#9d673e');for(let y=.65;y<3.5;y+=.4)box(x+.82,y,8,1.7,.06,.08,'#a57544');}
  box(-.5,.4,-3.92,18,.32,.42,'#445f60');
  for(const x of [-12.7,12]) {box(x,2.85,1.8,.08,1.3,2,'#536c6a');const hoop=new THREE.Mesh(new THREE.TorusGeometry(.4,.045,8,24),material('#c9956e'));hoop.rotation.x=Math.PI/2;hoop.position.set(x+(x<0?.65:-.65),2.45,1.8);scene.add(hoop);}
  // Canteen tables, serving counter and workroom benches.
  for(const x of [23,27,30.5])for(let z=-11;z<10;z+=5.5){box(x,.8,z,2.4,.16,1.5,'#b48d62');for(const dx of [-.9,.9])for(const dz of [-.5,.5])box(x+dx,.4,z+dz,.1,.8,.1,'#708178');box(x,.43,z+1.2,2,.12,.4,'#86a293');box(x,.43,z-1.2,2,.12,.4,'#86a293');}
  box(29,1,-26.9,6,2,.8,'#91aca0');
  // Serving counter and props; the kitchen is a separate locked room behind it.
  box(29,1,-15.0,5,1.9,.65,'#8ea79a');box(29,2.2,-15,4.5,.7,.2,'#d3dacd');
  for(const x of [27.2,28,28.8,29.6,30.4]){cylinder(x,1.12,-14.58,.32,.08,'#e9e8db');cylinder(x,1.23,-14.58,.2,.16,'#d2a76a');}
  box(23,1,-25.5,4,1.9,.8,'#9caea1');box(27,1,-25.5,3,1.9,.8,'#899c94');
  for(const x of [25.8,26.8,27.8])cylinder(x,2,-25.5,.34,.14,'#5d6961');
  for(const [x,z] of [[23,-10],[27,-4],[30,2],[23,7]] as number[][]){cylinder(x,.9,z,.22,.06,'#e9e8db');const fruit=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),material('#b96850'));fruit.position.set(x,.99,z);scene.add(fruit);}

  for(const x of [1,7,15,23,29])for(const z of [-51,-46,-38]){box(x,.9,z,3,.2,1.3,'#a87c58');for(const dx of [-1.2,1.2])for(const dz of [-.45,.45])box(x+dx,.45,z+dz,.12,.9,.12,'#71816f');}
  // Lockers, cloakroom rails and stair flights.
  for(let z=15;z<26;z+=1.7){box(-30.9,1.15,z,1.4,2.25,1.4,'#99b0a1');box(-2.1,1.15,z,1.4,2.25,1.4,'#93aa9b');}
  for(let x=-30;x<-23;x+=2.2)for(let z=15;z<26;z+=3){box(x,1.7,z,.08,2.5,.08,'#778e7e');box(x,2.9,z,1.7,.08,.08,'#778e7e');}
  box(-22, .6, 10.4, 2.5, 1.1, 1.1, '#a47a58');box(-22,1.18,10.4,2.7,.1,1.2,'#d8c5a6');

  for(let z=-20;z<12;z+=7)box(16.3,4.04,z,1.8,.06,.4,'#f8f4dd',false);
  for(let x=-28;x<18;x+=8)box(x,4.04,10.7,1.8,.06,.4,'#f8f4dd',false);
  sign('ШКОЛА',-16.5,27.2,0,4.62);
  sign('СПОРТЗАЛ',-3.8,8.49);sign('СТОЛОВАЯ',19.92,-12,Math.PI/2);sign('МАСТЕРСКАЯ',21.5,-32.82);sign('РАЗДЕВАЛКА',-25.5,12.96);
  // Schoolyard trees, bushes and fences, with clear paths to the exits.
  // Layered branches and rounded needle clusters give the firs a natural silhouette.
  function tree(x:number,z:number,scale=1){
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.13*scale,.33*scale,7.3*scale,12,5),material('#685a43'));trunk.position.set(x,3.65*scale,z);trunk.castShadow=true;scene.add(trunk);
    const needleGeometry=new THREE.SphereGeometry(1,10,7),branchGeometry=new THREE.CylinderGeometry(.045,.09,1,7);
    for(let tier=0;tier<7;tier++){
      const y=(1.15+tier*.84)*scale,radius=(2.15-tier*.245)*scale;
      for(let n=0;n<7;n++){
        const angle=(n/7)*Math.PI*2+tier*.51,drop=(.2+(6-tier)*.045)*scale;
        const end=new THREE.Vector3(x+Math.cos(angle)*radius,y-drop,z+Math.sin(angle)*radius);
        const origin=new THREE.Vector3(x,y,z),direction=end.clone().sub(origin),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
        const branch=new THREE.Mesh(branchGeometry,material('#605842'));branch.position.copy(origin.clone().add(end).multiplyScalar(.5));branch.quaternion.copy(q);branch.scale.set(scale,direction.length(),scale);branch.castShadow=true;scene.add(branch);
        for(let k=0;k<2;k++){const p=origin.clone().lerp(end,.46+k*.32);const needles=new THREE.Mesh(needleGeometry,material(['#355940','#3d6547','#486e4b'][(tier+n+k)%3]));needles.position.copy(p);needles.quaternion.copy(q);needles.scale.set((.34+(6-tier)*.018)*scale,radius*.38,(.28+(6-tier)*.015)*scale);needles.castShadow=true;scene.add(needles);}
      }
    }
    const top=new THREE.Mesh(new THREE.ConeGeometry(.48*scale,1.7*scale,12),material('#355940'));top.position.set(x,6.65*scale,z);top.castShadow=true;scene.add(top);
  }
  function deciduous(x:number,z:number,scale=1){
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16*scale,.32*scale,4.8*scale,12),material('#79654a'));trunk.position.set(x,2.4*scale,z);trunk.castShadow=true;scene.add(trunk);
    const crownGeometry=new THREE.SphereGeometry(1,14,10);
    for(let i=0;i<15;i++){const angle=i*2.4,r=(i%4)*.58;const crown=new THREE.Mesh(crownGeometry,material(['#5f8055','#749262','#517549','#819a66'][i%4]));crown.position.set(x+Math.cos(angle)*r*scale,(4.3+(i%4)*.42)*scale,z+Math.sin(angle)*r*scale);crown.scale.set(1.12*scale,.82*scale,1.05*scale);crown.castShadow=true;scene.add(crown);}
  }
  for(const [x,z,s] of [[-43,30,1.4],[-36,18,1.2],[-40,5,1.5],[-40,-10,1.3],[-40,-28,1.4],[-32,-39,1.1],[-23,-29,1.2],[-13,-16,1.3],[40,-45,1.4],[40,-20,1.4],[40,8,1.3],[4,31,1.1],[-4,34,1.3]] as number[][])tree(x,z,s);
  for(const [x,z,scale] of [[-49,20,1.2],[-43,-17,1.1],[-30,-31,1],[46,-9,1.2],[14,34,1.1]] as number[][])deciduous(x,z,scale);
  // Low curbs, paving and garden beds frame the school entrance like the references.
  function planter(x:number,z:number,w:number,d:number){box(x,.2,z,w,.4,d,'#ebe9da');box(x,.43,z,w-.2,.12,d-.2,'#756f53');for(let i=0;i<Math.floor(w*2);i++){const bloom=new THREE.Mesh(new THREE.SphereGeometry(.19,7,5),material(['#6e8b59','#9da76e','#d5b175'][i%3]));bloom.position.set(x-w/2+.4+i*.48,.57,z+Math.sin(i*2)*d*.22);scene.add(bloom);}}
  planter(-26,31.5,6,1.6);planter(-7,31.5,6,1.6);planter(-36,-14,5,1.5);planter(-36,-27,5,1.5);
  for(const x of [-21,-12])box(x,.14,31.5,.16,.28,9,'#ddd9cc');
  function bench(x:number,z:number,rotation=0){const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=rotation;scene.add(group);const part=(px:number,py:number,pz:number,w:number,h:number,d:number,color:string)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(px,py,pz);m.castShadow=true;group.add(m);};for(const dz of [-.26,0,.26])part(0,.55,dz,3,.09,.2,'#aa805a');for(const y of [.93,1.23])part(0,y,-.35,3,.18,.08,'#aa805a');for(const dx of [-1.1,1.1]){part(dx,.27,0,.12,.55,.7,'#536f62');part(dx,.9,-.35,.1,1.1,.1,'#536f62');}}
  bench(-31,35,0);bench(0,35,0);bench(-34,-8,Math.PI/2);bench(-34,-22,Math.PI/2);
  for(const [x,z] of [[-29,35],[-2,35],[-34,-3],[-34,-30]] as number[][]){cylinder(x,.48,z,.29,.95,'#667d6d');cylinder(x,.96,z,.32,.08,'#c1c9b2');}
  // Radiators, noticeboards and wall treatment make the hall recognisably school-like.
  // Mint gym walls leave the original tall window openings unobstructed.
  box(-.35,.46,-4.12,25.2,.85,.035,'#a8cfca',false);box(-.35,3.5,-4.12,25.2,1.12,.035,'#a8cfca',false);
  const gymGap=(25.5-7*1.35)/8;let gymCursor=-13.1;
  for(let i=0;i<7;i++){const start=-13.1+gymGap+i*(1.35+gymGap);box((gymCursor+start)/2,1.9,-4.12,start-gymCursor,2,.035,'#a8cfca',false);gymCursor=start+1.35;}
  box((gymCursor+12.4)/2,1.9,-4.12,12.4-gymCursor,2,.035,'#a8cfca',false);
  for(let i=0;i<7;i++){const x=-13.1+gymGap+i*(1.35+gymGap)+.675;box(x,.46,-3.99,1.2,.65,.16,'#d8e1d7');for(let dx=-.48;dx<.5;dx+=.2)box(x+dx,.46,-3.89,.035,.57,.05,'#aabeb2');}
  box(11.95,2.05,6.3,.08,1.5,2,'#5f7e70');box(11.88,2.05,6.3,.04,1.3,1.8,'#d6cfa9');
  for(const x of [-7,-1,5]){const ball=new THREE.Mesh(new THREE.SphereGeometry(.24,16,10),material('#d59358'));ball.position.set(x,.35,7.1);ball.castShadow=true;scene.add(ball);}
  for(const [x,z] of [[-19,17],[16,-17],[25,-17],[-2,2],[22,-45]] as number[][]){const lamp=new THREE.PointLight('#fff1d1',13,14,2);lamp.position.set(x,3.7,z);scene.add(lamp);}
  const bushes:[number,number][]=[[-30,19],[-5,20],[-37,0],[-31,-20],[-19,-24],[-4,-15],[7,-18],[37,-12],[37,5],[-23,33]];
  bushes.forEach(([x,z])=>{for(let i=0;i<3;i++){const b=new THREE.Mesh(new THREE.SphereGeometry(.85,8,6),material(i===1?'#73945c':'#648754'));b.position.set(x+(i-1)*.75,.55,z);b.scale.y=.75;b.castShadow=true;scene.add(b);}});
  for(let x=-55;x<=50;x+=4)box(x,.8,43,.12,1.6,.12,'#a46d64');box(-2.5,1.3,43,105,.09,.09,'#a46d64');box(-2.5,.35,43,105,.09,.09,'#a46d64');
  box(-25,.5,33,2,1,2,'#c2bca8');box(-25,1.15,33,.7,.5,.55,'#5e6d63');cylinder(-25,1.6,33,.28,.45,'#5e6d63');
  // Merge static pieces with the same material to reduce draw calls and shadow passes.
  const batches=new Map<string,{material:THREE.Material;meshes:THREE.Mesh[]}>();
  for(const object of [...scene.children]){
    if(!(object instanceof THREE.Mesh)||Array.isArray(object.material))continue;
    const key=`${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    const batch: {material:THREE.Material;meshes:THREE.Mesh[]} = batches.get(key)??{material:object.material,meshes:[]};batch.meshes.push(object);batches.set(key,batch);
  }
  for(const {material:batchMaterial,meshes} of batches.values()){
    if(meshes.length<3)continue;
    const geometries=meshes.map(mesh=>{mesh.updateMatrix();const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrix);return geometry;});
    const merged=mergeGeometries(geometries);for(const geometry of geometries)geometry.dispose();if(!merged)continue;
    const combined=new THREE.Mesh(merged,batchMaterial);combined.castShadow=meshes[0].castShadow;combined.receiveShadow=meshes[0].receiveShadow;scene.add(combined);
    for(const mesh of meshes){scene.remove(mesh);mesh.geometry.dispose();}
  }
  // Characters are visible to other players and from the first-person camera.
  // Rounded, anatomically proportioned figures, with joints for a walking cycle.
  function character(shirt:string, skirt=false) {
    const g=new THREE.Group();
    const mesh=(parent:THREE.Group,geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m;};
    const sphere=new THREE.SphereGeometry(1,18,12),skin='#d5a58a',trousers=skirt?'#4f5357':'#354c5b';
    mesh(g,sphere,shirt,0,1.18,0,.255,.35,.14);
    mesh(g,sphere,shirt,0,.93,0,.21,.18,.13);
    mesh(g,new THREE.CylinderGeometry(.072,.075,.13,12),skin,0,1.51,0);
    mesh(g,sphere,skin,0,1.68,0,.145,.19,.13);
    mesh(g,sphere,skirt?'#493d39':'#4b3e32',0,1.79,-.025,.147,.09,.132);
    mesh(g,sphere,skirt?'#493d39':'#4b3e32',0,1.7,-.105,.145,.15,.07);
    if(skirt)mesh(g,sphere,'#493d39',0,1.64,-.155,.095,.11,.07);
    for(const x of [-.13,.13])mesh(g,sphere,skin,x,1.68,0,.028,.055,.025);
    for(const x of [-.052,.052]){mesh(g,sphere,'#f0e7da',x,1.7,.119,.028,.014,.01);mesh(g,sphere,'#3c403e',x,1.7,.13,.01,.012,.007);mesh(g,sphere,'#51403a',x,1.735,.119,.033,.008,.01);}
    mesh(g,sphere,skin,0,1.66,.13,.022,.038,.025);mesh(g,sphere,'#a9706a',0,1.61,.124,.035,.008,.009);
    function limb(x:number,y:number,upperColor:string,lowerColor:string,arm:boolean){
      const joint=new THREE.Group();joint.position.set(x,y,0);g.add(joint);
      const upper=arm?.29:.37,lower=arm?.27:.37,r=arm?.075:.105;
      mesh(joint,new THREE.CapsuleGeometry(r,Math.max(.01,upper-2*r),6,12),upperColor,0,-upper/2,0);
      const lowerJoint=new THREE.Group();lowerJoint.position.y=-upper;joint.add(lowerJoint);
      mesh(lowerJoint,new THREE.CapsuleGeometry(r*.85,Math.max(.01,lower-2*r*.85),6,12),lowerColor,0,-lower/2,0);
      if(arm)mesh(lowerJoint,sphere,skin,0,-lower-.025,0,.065,.085,.055);
      else mesh(lowerJoint,sphere,'#343a3a',0,-lower+.015,.055,.1,.055,.17);
      return {joint,lower:lowerJoint};
    }
    const leftArm=limb(-.27,1.4,shirt,shirt,true),rightArm=limb(.27,1.4,shirt,shirt,true);
    const leftLeg=limb(-.115,.82,trousers,trousers,false),rightLeg=limb(.115,.82,trousers,trousers,false);
    if(skirt){const hem=new THREE.Mesh(new THREE.CylinderGeometry(.2,.29,.3,20),material('#5b6171'));hem.position.y=.86;g.add(hem);}
    else{const pack=new THREE.Mesh(new THREE.BoxGeometry(.33,.43,.13,3,3,2),material('#806550'));pack.position.set(0,1.15,-.18);g.add(pack);g.scale.setScalar(.89);}
    g.userData.limbs={leftArm,rightArm,leftLeg,rightLeg};scene.add(g);return g;
  }
  function animateCharacter(g:THREE.Group,phase:number,moving:number){
    type Limb={joint:THREE.Group;lower:THREE.Group};const limbs=g.userData.limbs as {leftArm:Limb;rightArm:Limb;leftLeg:Limb;rightLeg:Limb};const amount=Math.min(1,moving),swing=Math.sin(phase)*amount*.52;
    limbs.leftLeg.joint.rotation.x=swing;limbs.rightLeg.joint.rotation.x=-swing;limbs.leftArm.joint.rotation.x=-swing*.8;limbs.rightArm.joint.rotation.x=swing*.8;
    limbs.leftLeg.lower.rotation.x=Math.max(0,-swing)*.7;limbs.rightLeg.lower.rotation.x=Math.max(0,swing)*.7;limbs.leftArm.lower.rotation.x=-.12-amount*.15;limbs.rightArm.lower.rotation.x=-.12-amount*.15;
  }
  const teacher=character('#ad6271',true); const others: Record<string, THREE.Group> = {};
  type Npc={name:string;text:string;level:number;x:number;z:number;model:THREE.Group;label:THREE.Sprite};
  const npcs:Npc[]=[];
  function npc(name:string,text:string,level:number,x:number,z:number,shirt:string,adult=false,sitting=false){
    const model=character(shirt,adult);model.position.set(x,levels[level]+(sitting?.43:0),z);model.rotation.y=Math.PI;
    if(name==='Светлана Алексеевна')model.scale.set(1.48,1,1.28);
    if(sitting){
      const limbs=model.userData.limbs as {leftLeg:{joint:THREE.Group;lower:THREE.Group};rightLeg:{joint:THREE.Group;lower:THREE.Group}};
      limbs.leftLeg.joint.rotation.x=-1.15;limbs.rightLeg.joint.rotation.x=-1.15;limbs.leftLeg.lower.rotation.x=1.15;limbs.rightLeg.lower.rotation.x=1.15;
      box(x,levels[level]+.43,z, .9,.12,.8,'#839b8b');box(x,levels[level]+.85,z+.36,.9,.75,.08,'#839b8b');
    }
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='rgba(35,57,47,.82)';ctx.roundRect(4,6,504,84,18);ctx.fill();ctx.fillStyle='#f6f6ed';ctx.font='bold 30px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,256,49);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:true}));label.position.set(x,levels[level]+2.1+(sitting?.43:0),z);label.scale.set(3.6,.68,1);scene.add(label);
    npcs.push({name,text,level,x,z,model,label});
  }
  npc('Максим Котелков','Эй, Ерин, чего притих? На моём iPhone 6 SE открыт 1xBet — спорим, ты опять счёт не угадаешь? Ха, слабак!',1,-7,10.6,'#b77957');
  npc('Вадим Асланян','Футболка у тебя, конечно, говно!',1,.2,10.7,'#64899a');
  npc('Ирина Владимировна','Так, ребята, садимся по местам и открываем тетради.',1,8.15,-2.65,'#927188',true,true);
  npc('Математичка','Так, Ерин, ты ничего не сдашь, дворником будешь работать — у тебя на лбу написано! Как козлы на капусте!',2,-8.8,-2.65,'#807997',true);
  npc('Учитель истории','Открыли тетради! Сегодня выясним, что было раньше: звонок или ваша домашняя работа.',2,-.35,-2.65,'#718477',true);
  npc('Михаил Евгеньевич','Я сейчас от ярости Халком стану! Да у меня от ваших ответов даже парты подпрыгнут!',2,29,-7.5,'#787e88',true);
  npc('Светлана Алексеевна','Горшки мои с цветами разбили, ироды!',3,-8.85,-2.65,'#a5757d',true,true);
  let px=-16.5,py=0,pz=38,tx=16,tz=-5,stamina=100,time=180,hidden=false,caught=false,won=false, reset=state.current.reset, tick=0, lastSend=0, lastUi=0; const keys: Record<string,boolean>={}; let interact=false, interactDoor=false, yaw=0, pitch=.1;let activeDialogue:Npc|null=null;
  const look=(e:MouseEvent)=>{if(document.pointerLockElement===renderer.domElement || (e.buttons===1 && e.target===renderer.domElement && state.current.playing)){yaw+=e.movementX*.0025;pitch=Math.max(-1.2,Math.min(1.2,pitch-e.movementY*.0025));}};
  const lock=()=>{if(state.current.playing&&!caught&&!won) renderer.domElement.requestPointerLock()?.catch(()=>{});};
  const clearKeys=()=>{for(const key of Object.keys(keys)) keys[key]=false;};
  document.addEventListener('mousemove',look);renderer.domElement.addEventListener('click',lock);window.addEventListener('blur',clearKeys);
  const down=(e:KeyboardEvent)=>{ if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyE','KeyF','Space'].includes(e.code)) e.preventDefault(); keys[e.code]=true; if(e.code==='KeyE'&&!e.repeat) interact=true; if(e.code==='KeyF'&&!e.repeat) interactDoor=true; }; const up=(e:KeyboardEvent)=>{keys[e.code]=false;}; window.addEventListener('keydown',down);window.addEventListener('keyup',up);
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};window.addEventListener('resize',resize);resize();
  function baseBlocked(x:number,z:number,level=0){const rects=level===0?wallRects:upperRects[level];return x < -65 || x > 60 || z < -70 || z > 41 || rects.some(([a,b,c,d])=>x>a&&x<b&&z>c&&z<d);}
  function blocked(x:number,z:number,height=0){const level=floorIndexAt(height);return baseBlocked(x,z,level)||doors.some(door=>door.level===level&&door.open<.74&&(door.vertical?Math.abs(x-door.x)<.38&&Math.abs(z-door.z)<door.width/2-.12:Math.abs(z-door.z)<.38&&Math.abs(x-door.x)<door.width/2-.12));}
  function movePlayer(x:number,z:number){const height=supportHeight(x,z,py);if(height===null||blocked(x,z,Math.max(py,height)))return;px=x;pz=z;py=height;}
  function locationAt(x:number,z:number,level:number){
    if(x>=-23.4&&x<=-13.1&&z>=-4.35&&z<=8.3)return 'Лестница';
    if(x>=-4.25&&x<=12.4&&z>=-33&&z<=-23.8)return 'Дальняя лестница';
    if(level>0){if(z>=8.3||x>=12.4&&x<20.1)return 'Коридор';return 'Школьный кабинет';}
    if(z>27&&x>-32&&x<-1)return 'Школьный двор';
    if(z>=13.15&&z<=27){if(x>=-32&&x<-20.4)return 'Раздевалка для одежды';if(x>=-20.4&&x<=-12.65)return 'Главный вход';if(x>-12.65&&x<-1)return 'Раздевалки';}
    if(z>=8.3&&z<=13.15&&x>=-32&&x<=20.1)return 'Коридор';
    if(z>=-4.35&&z<8.3&&x>=-13.1&&x<=12.4)return 'Спортзал';
    if(z>=-4.35&&z<8.3&&x>=-32&&x<-13.1)return x<-23.4?'Коморка физрука':'Лестница';
    if(z>=-28&&z<13.15&&x>=20.1&&x<=32.4)return 'Столовая';
    if(z>=-33&&z<-28&&x>=20.1&&x<=32.4)return 'Задний вход';
    if(z>=-33&&z<13.15&&x>=12.4&&x<20.1)return 'Длинный коридор';
    if(z>=-33&&z<-23.8&&x>=-4.25&&x<12.4)return 'Дальняя лестница';
    if(z>=-55&&z<-33&&x>=-4.25&&x<=32.4)return 'Мастерская';
    return 'Школьный двор';
  }
  // Find a route around walls and through doorways, rather than walking through rooms.
  const gridWidth=126, gridHeight=112, gridSize=gridWidth*gridHeight;
  const gridBlocked=new Uint8Array(gridSize);
  for(let gz=0;gz<gridHeight;gz++)for(let gx=0;gx<gridWidth;gx++)gridBlocked[gz*gridWidth+gx]=baseBlocked(gx-65,gz-70)?1:0;
  const indexAt=(x:number,z:number)=>Math.max(0,Math.min(gridHeight-1,Math.round(z+70)))*gridWidth+Math.max(0,Math.min(gridWidth-1,Math.round(x+65)));
  function nearestOpen(x:number,z:number){const gx=Math.round(x+65),gz=Math.round(z+70);for(let radius=0;radius<4;radius++)for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){const a=gx+dx,b=gz+dz;if(a>=0&&a<gridWidth&&b>=0&&b<gridHeight&&!gridBlocked[b*gridWidth+a])return b*gridWidth+a;}return indexAt(x,z);}
  function routeTo(x1:number,z1:number,x2:number,z2:number){
    const start=nearestOpen(x1,z1),goal=nearestOpen(x2,z2),parent=new Int32Array(gridSize);parent.fill(-1);const queue=new Int32Array(gridSize);let head=0,tail=0;queue[tail++]=start;parent[start]=start;
    while(head<tail&&parent[goal]===-1){const current=queue[head++],cx=current%gridWidth,cz=Math.floor(current/gridWidth);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,nz=cz+dz;if(nx<0||nx>=gridWidth||nz<0||nz>=gridHeight)continue;const next=nz*gridWidth+nx;if(!gridBlocked[next]&&parent[next]===-1){parent[next]=current;queue[tail++]=next;}}}
    if(parent[goal]===-1)return [] as {x:number;z:number}[];const path:{x:number;z:number}[]=[];for(let at=goal;at!==start;at=parent[at])path.push({x:at%gridWidth-65,z:Math.floor(at/gridWidth)-70});return path.reverse();
  }
  const patrol=[{x:16,z:-20},{x:16,z:10},{x:-17,z:10},{x:-16,z:22},{x:-3,z:4},{x:25,z:1}];let patrolIndex=0,route:{x:number;z:number}[]=[],routeAt=0;
  let previousFrame=performance.now(),walkBlend=0; let frame=0;
  function animate(){frame=requestAnimationFrame(animate);const now=performance.now();if(document.hidden){previousFrame=now;return;}const dt=Math.min((now-previousFrame)/1000,.05);previousFrame=now;tick+=dt;
    if(reset!==state.current.reset){reset=state.current.reset;px=-16.5;py=0;pz=38;activeDialogue=null;tx=16;tz=-5;time=180;stamina=100;hidden=false;caught=false;won=false;yaw=0;pitch=.1;route=[];routeAt=0;patrolIndex=0;for(const door of doors){door.open=0;door.target=0;door.closeAt=0;}}
    const oldTeacherX=tx,oldTeacherZ=tz;let playerMoving=false;
    const currentLevel=floorIndexAt(py);
    const near=currentLevel===0&&(bushes.some(([x,z])=>Math.hypot(px-x,pz-z)<2.3) || (pz>14&&pz<27&&((px>-32&&px<-28)||(px>-5&&px<-1))));
    const nearbyNpc=npcs.find(npc=>Math.abs(py-levels[npc.level])<.65&&Math.hypot(px-npc.x,pz-npc.z)<2.4)??null;
    if(activeDialogue&&activeDialogue!==nearbyNpc)activeDialogue=null;
    const nearbyDoor=doors.reduce<Door|null>((best,door)=>{if(Math.abs(py-levels[door.level])>.65)return best;const distance=Math.hypot(px-door.x,pz-door.z);return distance<Math.max(2.5,door.width*.65)&&(!best||distance<Math.hypot(px-best.x,pz-best.z))?door:best;},null);
    if(state.current.playing&&!caught&&!won){
      if(interactDoor&&nearbyDoor&&!nearbyDoor.locked){nearbyDoor.target=nearbyDoor.target?0:1;nearbyDoor.closeAt=tick+8;}interactDoor=false;
      if(interact){if(nearbyNpc)activeDialogue=activeDialogue===nearbyNpc?null:nearbyNpc;else if(hidden)hidden=false;else if(near)hidden=true;interact=false;}
      const strafe=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0), forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0); let dx=Math.cos(yaw)*strafe+Math.sin(yaw)*forward, dz=Math.sin(yaw)*strafe-Math.cos(yaw)*forward; const length=Math.hypot(dx,dz); if(length){playerMoving=true;dx/=length;dz/=length;if(hidden)hidden=false;const running=(keys.ShiftLeft||keys.ShiftRight)&&stamina>1;const speed=running?6.5:3.8;stamina=Math.max(0,Math.min(100,stamina+(running?-27:15)*dt));movePlayer(px+dx*speed*dt,pz);movePlayer(px,pz+dz*speed*dt);} else stamina=Math.min(100,stamina+18*dt);
      if(!state.current.exploring){
      time=Math.max(0,time-dt);if(time===0)won=true;
      const distance=Math.hypot(px-tx,pz-tz),chasing=py<1.3&&!hidden&&distance<18;
      if(!chasing&&Math.hypot(tx-patrol[patrolIndex].x,tz-patrol[patrolIndex].z)<1.5)patrolIndex=(patrolIndex+1)%patrol.length;
      if(tick>=routeAt){const destination=chasing?{x:px,z:pz}:patrol[patrolIndex];route=routeTo(tx,tz,destination.x,destination.z);routeAt=tick+1.3;}
      if(route.length){let step=route[0],dd=Math.hypot(step.x-tx,step.z-tz);if(dd<.3){route.shift();step=route[0];dd=step?Math.hypot(step.x-tx,step.z-tz):0;}if(step&&dd>.01){const speed=chasing?3.1:1.8,travel=Math.min(dd,speed*dt),vx=(step.x-tx)/dd*travel,vz=(step.z-tz)/dd*travel;if(!blocked(tx+vx,tz))tx+=vx;if(!blocked(tx,tz+vz))tz+=vz;teacher.rotation.y=Math.atan2(vx,vz);}}
      if(py<1.3&&distance<1.05&&!hidden)caught=true;
      }
    } else {interact=false;interactDoor=false;}
    for(const door of doors){
      const teacherDistance=Math.hypot(tx-door.x,tz-door.z),playerDistance=Math.hypot(px-door.x,pz-door.z);
      if(state.current.playing&&!state.current.exploring&&door.level===0&&!door.locked&&teacherDistance<2.1){door.target=1;door.closeAt=tick+6;}
      if(door.target&&tick>door.closeAt&&(Math.abs(py-levels[door.level])>.65||playerDistance>2.5)&&(door.level!==0||teacherDistance>2.5))door.target=0;
      door.open=THREE.MathUtils.lerp(door.open,door.target,Math.min(1,dt*4));door.left.rotation.y=door.open*1.45;door.right.rotation.y=-door.open*1.45;
    }
    sun.position.set(px-18,35,pz+20);sun.target.position.set(px,0,pz);sun.target.updateMatrixWorld();
    teacher.visible=!state.current.exploring;teacher.position.set(tx,0,tz);animateCharacter(teacher,tick*8,Math.min(1,Math.hypot(tx-oldTeacherX,tz-oldTeacherZ)/Math.max(dt,.001)));
    walkBlend=THREE.MathUtils.lerp(walkBlend,playerMoving?1:0,Math.min(1,dt*7));
    const eyeHeight=py+(hidden?.85:1.65)+Math.sin(tick*10)*.035*walkBlend;camera.position.set(px,eyeHeight,pz);camera.lookAt(px+Math.sin(yaw)*Math.cos(pitch),eyeHeight+Math.sin(pitch),pz-Math.cos(yaw)*Math.cos(pitch));
    const ids=new Set(state.current.remotes.map(p=>p.id)); for(const id of Object.keys(others))if(!ids.has(id)){scene.remove(others[id]);delete others[id];} state.current.remotes.forEach((p,i)=>{if(!others[p.id]){others[p.id]=character(['#759eb5','#c98278','#a899c7'][i%3]);others[p.id].position.set(p.x,0,p.z);}const other=others[p.id],dx=p.x-other.position.x,dz=p.z-other.position.z,amount=Math.min(1,dt*8);other.position.x+=dx*amount;other.position.z+=dz*amount;other.position.y+=(Number(p.y||0)+(p.hidden?-.35:0)-other.position.y)*amount;if(Math.hypot(dx,dz)>.05)other.rotation.y=Math.atan2(dx,dz);animateCharacter(other,tick*8,Math.min(1,Math.hypot(dx,dz)*2));});
    if(tick-lastSend>.45){lastSend=tick;state.current.send(px,py,pz,hidden);} if(tick-lastUi>.12){lastUi=tick;onUpdate({hidden,near,danger:!state.current.exploring&&py<1.3&&!hidden&&Math.hypot(px-tx,pz-tz)<9,stamina,time,caught,won,location:locationAt(px,pz,currentLevel),x:px,z:pz,floor:currentLevel+1,npc:nearbyNpc?.name??null,dialogue:activeDialogue?{name:activeDialogue.name,text:activeDialogue.text}:null,door:nearbyDoor?(nearbyDoor.locked?`${nearbyDoor.name} закрыта`:`${nearbyDoor.target?'Закрыть':'Открыть'}: ${nearbyDoor.name}`):null});} renderer.render(scene,camera);
  } animate();
  return ()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clearKeys);document.removeEventListener('mousemove',look);renderer.domElement.removeEventListener('click',lock);surfaces.dispose();renderer.dispose();container.removeChild(renderer.domElement);};
}

export default function Home(){
  const canvas=useRef<HTMLDivElement>(null); const [status,setStatus]=useState(initial); const [playing,setPlaying]=useState(false); const [exploring,setExploring]=useState(false); const [locked,setLocked]=useState(false); const [mapOpen,setMapOpen]=useState(false); const [roomOpen,setRoomOpen]=useState(false); const [room,setRoom]=useState(''); const [input,setInput]=useState(''); const [players,setPlayers]=useState<Remote[]>([]); const [error,setError]=useState(''); const [copied,setCopied]=useState(false); const id=useRef(''); const game=useRef({playing:false,exploring:false,reset:0,remotes:[] as Remote[],send:(_x:number,_y:number,_z:number,_hidden:boolean)=>{}});
  useEffect(()=>{id.current=globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)+Date.now().toString(36);if(canvas.current)return createWorld(canvas.current,setStatus,game);},[]);
  useEffect(()=>{game.current.playing=playing;},[playing]);
  useEffect(()=>{const update=()=>setLocked(document.pointerLockElement===canvas.current?.querySelector('canvas'));document.addEventListener('pointerlockchange',update);return()=>document.removeEventListener('pointerlockchange',update);},[]);
  useEffect(()=>{if((status.caught||status.won)&&document.pointerLockElement)document.exitPointerLock();},[status.caught,status.won]);
  useEffect(()=>{game.current.remotes=players.filter(p=>p.id!==id.current);},[players]);
  useEffect(()=>{if(!room){game.current.send=()=>{};return;} let busy=false;game.current.send=async(x,y,z,hidden)=>{if(busy)return;busy=true;try{const res=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:room,id:id.current,name:'Школьник',x,y,z,hidden})});const data=await res.json();if(!res.ok){setError(data.error);setRoom('');}else{setPlayers(data.players);setError('');}}catch{setError('Нет связи с комнатой');}finally{busy=false;}};return()=>{game.current.send=()=>{};};},[room]);
  const start=(explore=false)=>{game.current.reset++;game.current.exploring=explore;setExploring(explore);setStatus(initial);setMapOpen(false);game.current.playing=true;setPlaying(true);canvas.current?.querySelector('canvas')?.requestPointerLock()?.catch(()=>{});};
  const createRoom=()=>{const code=Math.random().toString(36).slice(2,6).toUpperCase();setRoom(code);setInput(code);setError('');};
  const joinRoom=()=>{const code=input.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);if(code){setRoom(code);setError('');}};
  const seconds=Math.ceil(status.time); const time=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
  return <main className={`game-shell ${playing ? "is-playing" : ""} ${locked ? "is-locked" : ""} ${roomOpen ? "show-room" : ""}`} ><div className="world" ref={canvas}/><div className="vignette"/>
    <header className="topbar"><div className="brand"><div className="brand-icon">✳</div><div><span className="brand-name">ПОСЛЕ ЗВОНКА</span><span className="brand-sub">ШКОЛЬНЫЕ ПРЯТКИ</span></div></div><div className="top-center"><span className="live-dot"/> {playing?(exploring?'ИССЛЕДОВАНИЕ':'ИГРА ИДЁТ'):'ВСЁ ГОТОВО К ИГРЕ'} <span className="top-divider"/> <span>◷</span> {exploring?'∞':time}</div><div className="top-right">{playing&&<button className="room-toggle" onClick={()=>{if(document.pointerLockElement)document.exitPointerLock();setRoomOpen(!roomOpen);}}>{roomOpen?"✕":"☰"} Комната</button>}<span className="desktop-label">ИГРОКИ</span><span className="player-count">♟ &nbsp;{room?Math.max(players.length,1):1} <i>/ 4</i></span></div></header>
    <aside className="left-panel"><div className="chapter"><span>01</span><i/> ПЕРЕМЕНА НАЧАЛАСЬ</div><h1>Тише едешь —<br/><em>дольше прячешься.</em></h1><p>Звонок прозвенел, а учительница уже ищет вас. Продержитесь до конца перемены!</p><div className="objective"><div className="objective-icon">✦</div><div><small>ТВОЯ ЗАДАЧА</small><strong>Не попадись учительнице</strong><span>Прячься и следи за временем</span></div></div><div className="location"><span className="location-pin">⌖</span><div><small>ТЫ СЕЙЧАС ЗДЕСЬ</small><strong>{status.location}</strong></div><span className="location-arrow">↗</span></div></aside>
    <aside className="right-panel"><div className="panel-title"><div><small>ВАША КОМАНДА</small><h2>Школьники <span>✳</span></h2></div><span className="team-count">{room?Math.max(players.length,1):1}/4</span></div><div className="team-row"><span className="avatar amber">☺</span><div><strong>Ты</strong><small>{status.hidden?'В укрытии':'В игре'}</small></div><span className="you-tag">ЭТО ТЫ</span></div>{(room?players.filter(p=>p.id!==id.current):[]).map((p,i)=><div className="team-row" key={p.id}><span className="avatar blue">☺</span><div><strong>Школьник {i+2}</strong><small>{p.hidden?'В укрытии':'В игре'}</small></div><span className="online-dot"/></div>)}{Array.from({length:Math.max(0,3-(room?players.filter(p=>p.id!==id.current).length:0))}).map((_,i)=><div className="team-row empty" key={i}><span className="avatar empty-avatar">+</span><div><strong>Свободное место</strong><small>Ждём игрока</small></div></div>)}<div className="room-box"><small>ИГРАТЬ С ДРУЗЬЯМИ</small>{room?<><div className="room-code"><span>КОД КОМНАТЫ</span><strong>{room}</strong><button onClick={()=>{navigator.clipboard?.writeText(room);setCopied(true);setTimeout(()=>setCopied(false),1800);}} title="Скопировать код">{copied?'✓':'⧉'}</button></div><p>Передай код друзьям, чтобы играть вместе.</p><button className="text-button" onClick={()=>{setRoom('');setPlayers([]);}}>Покинуть комнату</button></>:<><div className="join"><input value={input} onChange={e=>setInput(e.target.value.toUpperCase())} maxLength={6} placeholder="КОД КОМНАТЫ"/><button onClick={joinRoom} aria-label="Войти в комнату">→</button></div><button className="create-room" onClick={createRoom}>+ Создать комнату</button></>}{error&&<p className="error">{error}</p>}</div></aside>
    {playing&&!status.caught&&!status.won&&<><div className="game-location">⌖ {status.location} · {status.floor} этаж</div><div className="crosshair"/><div className="mouse-hint">{locked?"ESC — ОСВОБОДИТЬ КУРСОР":"НАЖМИ НА ИГРУ ИЛИ ПОТЯНИ МЫШЬЮ, ЧТОБЫ ОСМОТРЕТЬСЯ"}</div></>}
    <div className="map-control"><button className="map-toggle" onClick={()=>{if(document.pointerLockElement)document.exitPointerLock();setMapOpen(!mapOpen);}}>{mapOpen?'✕ Закрыть план':`⌖ План ${status.floor} этажа`}</button>{mapOpen&&<div className="map-panel"><div className="map-header"><strong>{status.floor} этаж</strong><span>ВАШЕ МЕСТО — ЖЁЛТАЯ ТОЧКА</span></div>{status.floor===1?<svg viewBox="-38 -58 76 98" role="img" aria-label="План первого этажа школы"><rect x="-4.25" y="-55" width="36.65" height="22" fill="#cad9c6"/><path d="M12.4 -55V-33" stroke="#96aa98" strokeWidth=".3"/><rect x="-4.25" y="-33" width="36.65" height="9.2" fill="#f2f0df"/><rect x="12.4" y="-28" width="7.7" height="41.15" fill="#f2f0df"/><rect x="20.1" y="-28" width="12.3" height="41.15" fill="#d7c7a9"/><path d="M20.1 -15.4H32.4" stroke="#a39a84" strokeWidth=".3"/><rect x="-13.1" y="-4.35" width="25.5" height="12.65" fill="#bd8067"/><rect x="-32" y="-4.35" width="18.9" height="12.65" fill="#d3dfcf"/><rect x="-32" y="8.3" width="52.1" height="4.85" fill="#f2f0df"/><rect x="-32" y="13.15" width="31" height="13.85" fill="#d4dfd0"/><rect x="-20.4" y="13.15" width="7.75" height="13.85" fill="#f2f0df"/><path d="M-20.4 13.15V27 M-12.65 13.15V27 M-12.65 20.2H-1 M20.1 -28V13.15 M-23.4 -4.35V8.3 M-13.1 -4.35V8.3" fill="none" stroke="#a3b6a6" strokeWidth=".28"/><g fill="#50675a" textAnchor="middle" fontSize="2.5" fontWeight="700"><text x="14" y="-48">МАСТЕРСКАЯ</text><text x="4" y="-28">ЛЕСТНИЦА</text><text x="26" y="-20" fontSize="1.9">КУХНЯ 🔒</text><text x="26" y="-5" transform="rotate(90 26 -5)">СТОЛОВАЯ</text><text x="-.4" y="2.5">СПОРТЗАЛ</text><text x="-18" y="2.5" fontSize="2">ЛЕСТНИЦА</text><text x="-26" y="19" fontSize="1.8">ГАРДЕРОБ</text><text x="-6.8" y="18" fontSize="1.6">РАЗДЕВАЛКИ</text><text x="-16.5" y="30" fontSize="2">ВХОД ↑</text></g><circle cx={status.x} cy={status.z} r="1.3" fill="#f4c968" stroke="#fff" strokeWidth=".45"/></svg>:<svg viewBox="-36 -35 72 51" role="img" aria-label={`План ${status.floor} этажа`}><rect x="-4.25" y="-33" width="16.65" height="9.2" fill="#aebfae"/><rect x="12.4" y="-33" width="7.7" height="9.2" fill="#f2f0df"/><rect x="-32" y="-4.35" width="55" height="12.65" fill="#cad9c6"/><rect x="-23.4" y="-4.35" width="10.3" height="12.65" fill="#aebfae"/><rect x="-32" y="8.3" width="52.1" height="4.85" fill="#f2f0df"/><rect x="12.4" y="-28" width="7.7" height="36.3" fill="#f2f0df"/><rect x="20.1" y="-28" width="12.3" height="41.15" fill="#d8cbb7"/><path d="M-23.4 -4.35V8.3 M-13.1 -4.35V8.3 M-4.6 -4.35V8.3 M3.9 -4.35V8.3 M12.4 -4.35V8.3 M20.1 -28V13.15 M20.1 -14.5H32.4 M20.1 -.5H32.4" fill="none" stroke="#91a794" strokeWidth=".35"/><g fill="#50675a" textAnchor="middle" fontSize="2" fontWeight="700"><text x="-18.3" y="2">ЛЕСТНИЦА</text><text x="-.5" y="2">КАБИНЕТЫ</text><text x="26" y="-8" transform="rotate(90 26 -8)">КАБИНЕТЫ</text><text x="-2" y="11.5">КОРИДОР</text></g><circle cx={status.x} cy={status.z} r=".9" fill="#f4c968" stroke="#fff" strokeWidth=".35"/></svg>}<p>{status.floor===1?"Первый этаж по вашему плану.":"Схема кабинетов верхнего этажа — ориентировочная."}</p></div>}</div>
    <div className="bottom-left"><div className="controls-title">УПРАВЛЕНИЕ <span>⌁</span></div><div className="control-row"><div className="wasd"><kbd>W</kbd><div><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div></div><span>Двигаться</span><kbd>МЫШЬ</kbd><span>Осмотреться</span><kbd>SHIFT</kbd><span>Бежать</span><kbd>E</kbd><span>Разговор / укрытие</span><kbd>F</kbd><span>Дверь</span></div></div>
    {status.dialogue&&playing&&!status.caught&&!status.won&&<div className="dialogue-card" role="status"><small>РАЗГОВОР · E — ЗАКРЫТЬ</small><strong>{status.dialogue.name}</strong><p>«{status.dialogue.text}»</p></div>}
    <div className="bottom-center">{status.danger&&playing&&!status.caught?<div className="danger">⚠ &nbsp; УЧИТЕЛЬНИЦА РЯДОМ!</div>:<div className="hint"><span>✦</span> {status.npc?`E — поговорить: ${status.npc}`:status.door?(status.door.endsWith('закрыта')?`🔒 ${status.door}`:`F — ${status.door}`):status.hidden?'Ты в укрытии. Нажми E, чтобы выйти':status.near?'Нажми E, чтобы спрятаться':status.location.includes('лестница')||status.location==='Лестница'?'Поднимись по маршу до площадки, затем поверни на второй':'Кусты и шкафчики — отличное укрытие'}</div>}<div className="stamina"><span>⚡</span><div><div style={{width:`${status.stamina}%`}}/></div><small>ВЫНОСЛИВОСТЬ</small></div></div>
    {!playing&&!status.caught&&!status.won&&<div className="start-card"><div className="start-label"><span/> ШКОЛА ЖДЁТ</div><h2>Готовы играть<br/><em>в прятки?</em></h2><p>Исследуйте школу от первого лица, найдите укрытие и не попадитесь учительнице.</p><button onClick={()=>start(false)}>Начать игру <span>↗</span></button><button className="explore-button" onClick={()=>start(true)}>Исследовать школу <span>↗</span></button><small>ОДИН ИЛИ С ДРУЗЬЯМИ · 1–4 ИГРОКА</small></div>}
    {(status.caught||status.won)&&<div className="result-overlay"><div className="result-card"><div className="start-label">{status.won?'✦ ПЕРЕМЕНА ОКОНЧЕНА':'! ВАС НАШЛИ'}</div><h2>{status.won?'Вы отлично спрятались!':'Учительница поймала вас!'}</h2><p>{status.won?'Звонок спас вас. До следующей перемены!':'Попробуйте ещё раз и найдите укрытие получше.'}</p><button onClick={()=>start(false)}>Играть ещё раз ↗</button></div></div>}
    <div className="mobile-note">Для управления игрой используй клавиатуру на компьютере</div>
  </main>;
}
