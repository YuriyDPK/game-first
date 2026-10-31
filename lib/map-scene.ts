import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD_OBJECTS, WORLD_PICKUPS, WORLD_RESOURCES, FOREST_TREES, TOWER_SITES, POND, groundHeight, containsObject, type WorldObject } from './world';
const mat=(color:string,metalness=0,roughness=.85)=>new T.MeshStandardMaterial({color,metalness,roughness});
function add(g:T.BufferGeometry,m:T.Material,p:T.Object3D,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
const box=(p:T.Object3D,m:T.Material,w:number,h:number,d:number,x:number,y:number,z:number)=>add(new T.BoxGeometry(w,h,d),m,p,x,y,z);
const cyl=(p:T.Object3D,m:T.Material,r:number,h:number,x:number,y:number,z:number)=>add(new T.CylinderGeometry(r,r,h,32),m,p,x,y,z);
function texture(kind:'wood'|'grass'|'stone'|'path'){
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d')!;let seed=34;const random=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
 ctx.fillStyle={wood:'#85735b',grass:'#75845d',stone:'#928e7d',path:'#a09373'}[kind];ctx.fillRect(0,0,512,512);
 if(kind==='stone')for(let y=0;y<512;y+=64)for(let x=-60;x<512;x+=92){ctx.fillStyle=`hsl(43 9% ${44+random()*15}%)`;ctx.strokeStyle='#514f43';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x+(y%128?45:0)+3,y+3,85,57,8);ctx.fill();ctx.stroke();}
 for(let i=0;i<16000;i++){ctx.fillStyle=random()>.5?'#fff4ce22':'#14220e22';ctx.fillRect(random()*512,random()*512,kind==='wood'?1:random()*3+.5,kind==='wood'?random()*90+4:random()*4+.5);}
 if(kind==='wood'){ctx.strokeStyle='#392d2180';ctx.lineWidth=2;for(let x=0;x<512;x+=25){ctx.beginPath();ctx.moveTo(x,0);for(let y=0;y<=512;y+=10)ctx.lineTo(x+Math.sin(y*.04+x)*3,y);ctx.stroke();}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;
}
export type MapScene={pickups:Map<string,T.Group>;cameraObstacles:T.Object3D[];update:(dt:number,time:number)=>void};
export function createWorld(scene:T.Scene):MapScene{
 scene.background=new T.Color('#afc2c2');scene.fog=new T.Fog('#afc2b7',85,240);
 scene.add(new T.HemisphereLight('#e3eff3','#4c5638',1.9));
 const sun=new T.DirectionalLight('#ffe2a7',3.2);sun.position.set(-28,52,24);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:1,far:110});sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;scene.add(sun);
 const wood=mat('#8e7451'),darkWood=mat('#514331'),stone=mat('#989b8b'),darkStone=mat('#626d65'),roof=mat('#4a6258'),gold=mat('#bfa36c',.65,.4),leaf=mat('#526d43'),iron=mat('#556363',.6,.45),red=mat('#803b31'),canvas=mat('#c5ae7e'),grass=mat('#82946b');
 wood.map=texture('wood');wood.bumpMap=wood.map;wood.bumpScale=.08;darkWood.map=wood.map;
 stone.map=texture('stone');stone.bumpMap=stone.map;stone.bumpScale=.075;
 grass.map=texture('grass');grass.map.repeat.set(30,30);
 const ground=add(new T.PlaneGeometry(370,370),grass,scene);ground.rotation.x=-Math.PI/2;
 const pathMat=new T.MeshStandardMaterial({map:texture('path'),color:'#9e967b',roughness:1});pathMat.map!.repeat.set(6,2);
 const stoneFloor=new T.MeshStandardMaterial({map:texture('stone'),color:'#bbb6a0',roughness:.93});stoneFloor.map!.repeat.set(5,5);stoneFloor.bumpMap=stoneFloor.map;stoneFloor.bumpScale=.06;
 const plaza=add(new T.CircleGeometry(9,96),stoneFloor,scene,0,.025,0);plaza.rotation.x=-Math.PI/2;
 const roads=[[-.5,15,5,30,0],[0,-15,5,30,0],[-15,0,30,4.5,0],[15,0,30,4.5,0],[12,12,5,19,-Math.PI/4],[-14,-13,5,23,Math.PI/4],[0,-88,4.2,110,0],[0,88,4.2,110,0],[-88,0,110,4.2,0],[88,0,110,4.2,0]];
 for(const [x,z,w,d,angle]of roads){const road=add(new T.PlaneGeometry(w,d),pathMat,scene,x,.018,z);road.rotation.set(-Math.PI/2,0,angle);road.castShadow=false;}
 const border=add(new T.TorusGeometry(9,.12,10,128),darkStone,scene,0,.08,0);border.rotation.x=Math.PI/2;
 const cameraObstacles:T.Object3D[]=[],pickups=new Map<string,T.Group>(),windmills:T.Group[]=[],smoke:T.Mesh[]=[],waterMaterials:T.MeshStandardMaterial[]=[];
 function build(o:WorldObject){
  const g=new T.Group();g.position.set(o.x,0,o.z);scene.add(g);if(o.kind!=='tree'&&o.kind!=='canopy')cameraObstacles.push(g);
  const w=o.width??o.radius!*2,d=o.depth??o.radius!*2,h=o.height;
  if(['house','smith','mill','chapel'].includes(o.kind)){
   box(g,darkStone,w,.45,d,0,.225,0);box(g,o.kind==='chapel'?stone:wood,w,h-.45,d,0,(h+.45)/2,0);
   for(let y=.7;y<h;y+=.65){box(g,darkWood,w+.12,.08,d+.1,0,y,0);}
   for(const x of [-w/2+.12,w/2-.12])for(const z of [-d/2+.08,d/2-.08])box(g,darkWood,.22,h,.22,x,h/2,z);
   const front=d/2+.055;box(g,darkWood,1.65,2.8,.1,0,1.4,front);box(g,wood,1.4,2.65,.08,0,1.35,front+.065);cyl(g,gold,.055,.1,.43,1.25,front+.12).rotation.x=Math.PI/2;
   for(const x of [-w*.32,w*.32]){box(g,darkWood,1.25,1.5,.16,x,3.2,front);box(g,mat('#d5b56b',.1,.45),.95,1.2,.04,x,3.2,front+.1);box(g,wood,.07,1.25,.06,x,3.2,front+.13);box(g,wood,1,.07,.06,x,3.2,front+.13);}
   const shape=new T.Shape();shape.moveTo(-w/2-.7,0);shape.lineTo(0,2.6);shape.lineTo(w/2+.7,0);shape.closePath();
   add(new T.ExtrudeGeometry(shape,{depth:d+1.4,bevelEnabled:false}),roof,g,0,h-.15,-d/2-.7);
   for(let i=0;i<Math.ceil(d/.6)+2;i++)box(g,darkWood,w+1.4,.12,.09,0,h-.05,-d/2-.5+i*.6);
   if(o.kind==='smith'){
    box(g,darkStone,1.25,4,1.3,w*.28,h+.7,-d*.2);
    for(let i=0;i<6;i++){const puff=add(new T.SphereGeometry(1,16,12),new T.MeshStandardMaterial({color:'#d5d5c4',transparent:true,opacity:.18,depthWrite:false}),scene,o.x+w*.28,h+3+i*.6,o.z-d*.2);puff.scale.setScalar(.45+i*.11);puff.castShadow=false;puff.userData.baseY=puff.position.y;puff.userData.phase=i;smoke.push(puff);}
    const fire=mat('#db8c3b');fire.emissive.set('#b95816');fire.emissiveIntensity=2;box(g,darkStone,2.4,1.3,1.1,-w*.35,.65,d*.65);add(new T.SphereGeometry(.35,24,16),fire,g,-w*.35,1.3,d*.65);const fireLight=new T.PointLight('#ffb04d',9,7);fireLight.position.set(-w*.35,2,d*.65);g.add(fireLight);
   }
   if(o.kind==='mill'){
    const blades=new T.Group();blades.position.set(0,h+1,d/2+1);g.add(blades);windmills.push(blades);cyl(blades,gold,.3,.6,0,0,0).rotation.x=Math.PI/2;
    for(let i=0;i<4;i++){const arm=new T.Group();arm.rotation.z=i*Math.PI/2;blades.add(arm);box(arm,darkWood,.17,5,.16,0,2.3,0);for(let j=0;j<11;j++)box(arm,wood,1.1,.18,.09,.4,.8+j*.34,.04);}
   }
   if(o.kind==='chapel'){
    cyl(g,stone,1,2.1,0,h+2,0);const points=[new T.Vector2(0,0),new T.Vector2(1.15,0),new T.Vector2(1.55,.9),new T.Vector2(1.2,1.7),new T.Vector2(.45,2.5),new T.Vector2(0,2.9)];add(new T.LatheGeometry(points,48),gold,g,0,h+2.7,0);cyl(g,gold,.04,1.4,0,h+6.1,0);box(g,gold,.8,.07,.08,0,h+6.2,0);
   }
  }else if(o.kind==='tower-platform'){
   const site=TOWER_SITES[Number(o.id.split('-').pop())];
   // The platform's solid collision volume matches its visible raised foundation.
   box(g,darkStone,w,h-.2,d,0,(h-.2)/2,0);box(g,wood,w+.25,.2,d+.25,0,h-.1,0);
   for(let i=0;i<16;i++){const z=3.5+(i+.5)*.5,top=(11.5-z)*.4;box(g,wood,3.2,Math.max(.08,top),.51,0,top/2,z);}
   for(const x of [-1.65,1.65]){const rail=box(g,darkWood,.12,.12,8.9,x,2.25,7.5);rail.rotation.x=-Math.atan(.4);for(let i=0;i<5;i++){const z=3.7+i*1.9,top=(11.5-z)*.4;cyl(g,darkWood,.07,1.1,x,top+.55,z);}}
   for(const x of [-3.6,3.6])for(const z of [-3,3])cyl(g,darkWood,.16,4.2,x,h+2.1,z);
   if(site.style==='watch'){
    const roofShape=new T.ConeGeometry(5.6,2.8,4);add(roofShape,roof,g,0,h+5.5,0).rotation.y=Math.PI/4;
    for(const x of [-3.6,3.6])box(g,darkWood,.12,1.05,6,x,h+.65,0);
    box(g,darkWood,7.2,1.05,.12,0,h+.65,-3);
   }else{
    const shape=new T.Shape();shape.moveTo(-4.8,0);shape.lineTo(0,2.2);shape.lineTo(4.8,0);shape.closePath();
    add(new T.ExtrudeGeometry(shape,{depth:8,bevelEnabled:false}),red,g,0,h+4,-4);
    for(const x of [-3.6,3.6])box(g,wood,.12,1.1,5.8,x,h+.6,0);
    box(g,wood,7.2,1.1,.12,0,h+.6,-3);
   }
  }else if(o.kind==='stall'){
   box(g,wood,w,.18,d,0,h-.09,0);for(const x of [-w/2,w/2])for(const z of [-1.5,1.5])cyl(g,darkWood,.08,4.6,x,2.3,z);
   const stripWidth=(w+1)/8;for(let i=0;i<8;i++){const cloth=add(new T.PlaneGeometry(stripWidth,3.7,2,10),new T.MeshStandardMaterial({color:i%2?'#c7b38a':'#824635',side:T.DoubleSide,roughness:1}),g,-(w+1)/2+stripWidth*(i+.5),4.6,0);const p=cloth.geometry.attributes.position;for(let j=0;j<p.count;j++)p.setZ(j,Math.cos(p.getY(j))*.22);cloth.geometry.computeVertexNormals();cloth.rotation.x=-Math.PI/2;}
   for(let i=0;i<9;i++){const apple=add(new T.SphereGeometry(.16,20,14),i%3?red:leaf,g,-w*.35+(i%5)*.6,h+.15,(i%2)*.45-.2);apple.scale.y=.8;}
  }else if(o.kind==='crate'){
   add(new RoundedBoxGeometry(w,h,d,2,.04),wood,g,0,h/2,0);for(const x of [-w*.39,w*.39])box(g,darkWood,.13,h+.04,d+.05,x,h/2,0);for(const y of [.12,h-.12])box(g,iron,w+.07,.1,d+.07,0,y,0);const diagonal=box(g,darkWood,.13,Math.hypot(w,h)*.9,.08,0,h/2,d/2+.05);diagonal.rotation.z=Math.atan2(w,h);
  }else if(o.kind==='barrel'){
   const points=[new T.Vector2(0,0),new T.Vector2(o.radius!*.8,0),new T.Vector2(o.radius!,h*.35),new T.Vector2(o.radius!,h*.65),new T.Vector2(o.radius!*.8,h),new T.Vector2(0,h)];add(new T.LatheGeometry(points,40),wood,g);for(const y of [.18,h/2,h-.18]){const hoop=add(new T.TorusGeometry(o.radius!*.95,.045,8,48),iron,g,0,y,0);hoop.rotation.x=Math.PI/2;}
  }else if(o.kind==='rock'){
   const rock=add(new T.SphereGeometry(1,40,28),darkStone,g,0,h/2,0);rock.scale.set(o.radius!,h/2,o.radius!);const p=rock.geometry.attributes.position;for(let i=0;i<p.count;i++){const k=1+.08*Math.sin(p.getX(i)*19)*Math.cos(p.getY(i)*16);p.setXYZ(i,p.getX(i)*k,p.getY(i)*k,p.getZ(i)*k);}rock.geometry.computeVertexNormals();
  }else if(o.kind==='wall'||o.kind==='pillar'){
   if(o.id.startsWith('bridge-rail')){box(g,darkWood,w,.13,d,0,h-.08,0);for(let x=-w/2;x<=w/2;x+=1.8)box(g,wood,.12,h,.14,x,h/2,0);}
   else{box(g,stone,w,h,d,0,h/2,0);box(g,darkStone,w+.15,.13,d+.15,0,h,0);for(let y=.35;y<h;y+=.45)box(g,darkStone,w+.02,.025,d+.02,0,y,0);}
  }else if(o.kind==='altar'){
   cyl(g,darkStone,2,h,0,h/2,0);cyl(g,stone,2.12,.15,0,h-.07,0);const rune=add(new T.TorusGeometry(1.45,.035,8,64),gold,g,0,h+.02,0);rune.rotation.x=Math.PI/2;for(let i=0;i<8;i++){const line=box(g,gold,.06,.035,2.5,0,h+.02,0);line.rotation.y=i*Math.PI/4;}
  }else if(o.kind==='tree'){
   cyl(g,darkWood,o.radius!,h*.7,0,h*.35,0);for(let i=0;i<9;i++){const a=i*2.4,clump=add(new T.SphereGeometry(1,24,18),i%2?leaf:mat('#697e4f'),g,Math.sin(a)*2,h*.7+Math.sin(i*3)*1.7,Math.cos(a)*2);clump.scale.set(2.5,1.9,2.1);}
  }
 }
 WORLD_OBJECTS.filter(o=>!o.id.startsWith('forest-')&&!o.id.startsWith('palisade-')).forEach(build);
 // Stone arch joins the two physical pillars; its opening is traversable.
 const arch=add(new T.TorusGeometry(3.7,.6,16,48,Math.PI),stone,scene,0,5.4,-23);cameraObstacles.push(arch);
 const pondMaterial=new T.MeshStandardMaterial({color:'#547f80',metalness:.35,roughness:.2,transparent:true,opacity:.93});waterMaterials.push(pondMaterial);
 const water=add(new T.CircleGeometry(1,96),pondMaterial,scene,POND.x,.045,POND.z);water.rotation.x=-Math.PI/2;water.scale.set(POND.rx,POND.rz,1);water.castShadow=false;
 const pondBank=add(new T.RingGeometry(1,1.1,96),pathMat,scene,POND.x,.035,POND.z);pondBank.rotation.x=-Math.PI/2;pondBank.scale.set(POND.rx,POND.rz,1);
 for(let x=-23;x<=-7;x+=.3){const plank=box(scene,wood,.285,.14,3.1,x,groundHeight(x,4)-.06,4);plank.castShadow=false;}
 for(let i=0;i<34;i++){const a=i*2.399,x=POND.x+Math.sin(a)*POND.rx*1.07,z=POND.z+Math.cos(a)*POND.rz*1.07;if(Math.abs(z-4)<1.7)continue;const reed=cyl(scene,leaf,.018,.9,x,.45,z);reed.rotation.z=Math.sin(i)*.12;const top=cyl(scene,darkWood,.045,.22,x,.97,z);top.rotation.z=reed.rotation.z;}
 for(const item of WORLD_PICKUPS){
  const g=new T.Group();g.position.set(item.x,groundHeight(item.x,item.z),item.z);scene.add(g);pickups.set(item.id,g);
  if(item.item==='potion'){
   const glass=mat('#8dc9a0',.15,.22);glass.transparent=true;glass.opacity=.82;
   const bottle=add(new T.SphereGeometry(.34,24,16),glass,g,0,.38,0);bottle.scale.set(1,1.2,.75);cyl(g,glass,.12,.24,0,.82,0);cyl(g,wood,.13,.11,0,.99,0);box(g,canvas,.3,.2,.04,0,.4,.26);
  }else if(item.item==='bread'){
   const loaf=add(new T.SphereGeometry(.42,24,16),mat('#bc8244'),g,0,.3,0);loaf.scale.set(1.3,.65,.75);
   for(const x of [-.2,0,.2]){const cut=box(g,canvas,.055,.02,.4,x,.56,0);cut.rotation.y=-.35;}
  }else{
   const quiver=cyl(g,darkWood,.27,.85,0,.45,0);quiver.rotation.z=-.2;
   for(let i=0;i<5;i++){const x=(i-2)*.09;const shaft=cyl(g,wood,.025,1.2,x,.85,0);shaft.rotation.z=.12;box(g,canvas,.12,.18,.025,x+.07,1.38,0);}
  }
  const glow=add(new T.TorusGeometry(.65,.025,8,40),new T.MeshBasicMaterial({color:item.item==='potion'?'#e5be6c':item.item==='arrows'?'#bed1c2':'#bdca78'}),g,0,.035,0);glow.rotation.x=-Math.PI/2;
  const gem=add(new T.OctahedronGeometry(.12,2),gold,g,0,1.1,0);gem.name='pickup-gem';
 }
 for(const item of WORLD_RESOURCES){
  const g=new T.Group();g.position.set(item.x,0,item.z);scene.add(g);pickups.set(item.id,g);
  const color=item.item==='crystal'?'#62aebb':item.item==='iron'?'#a8a9a3':'#a97845';
  const resourceMat=new T.MeshStandardMaterial({color,metalness:item.item==='iron'?.65:.15,roughness:.45,emissive:item.item==='crystal'?'#174b55':'#000000',emissiveIntensity:.7});
  if(item.item==='wood'){
   for(let i=0;i<3;i++){const log=cyl(g,resourceMat,.18,1.05,(i-1)*.34,.2+(i===1?.3:0),0);log.rotation.x=Math.PI/2;const end=cyl(g,canvas,.16,.02,(i-1)*.34,.2+(i===1?.3:0),.53);end.rotation.x=Math.PI/2;}
  }else if(item.item==='iron'){
   for(let i=0;i<3;i++){const ore=add(new T.SphereGeometry(.34,20,14),resourceMat,g,(i-1)*.32,.25+(i===1?.18:0),(i%2)*.12);ore.scale.set(1.2,.8,1);}
  }else{
   for(let i=0;i<3;i++){const crystal=add(new T.OctahedronGeometry(.33,0),resourceMat,g,(i-1)*.3,.43+(i===1?.2:0),(i%2)*.1);crystal.scale.y=i===1?2.1:1.4;}
  }
  const glow=add(new T.TorusGeometry(.8,.035,8,40),new T.MeshBasicMaterial({color}),g,0,.04,0);glow.rotation.x=-Math.PI/2;
  const gem=add(new T.OctahedronGeometry(.13,2),resourceMat,g,0,1.5,0);gem.name='pickup-gem';
 }
 // Distant forest, hills, palisade and watch towers frame the explorable village.
 const forest=new T.InstancedMesh(new T.SphereGeometry(1,12,8),leaf,FOREST_TREES.length*20),dummy=new T.Object3D();forest.castShadow=true;scene.add(forest);let index=0;
 const trunks=new T.InstancedMesh(new T.CylinderGeometry(.25,.25,1,12),darkWood,FOREST_TREES.length);trunks.castShadow=true;scene.add(trunks);
 for(let i=0;i<FOREST_TREES.length;i++){const {x,z,h}=FOREST_TREES[i];dummy.position.set(x,h*.4,z);dummy.scale.set(1,h*.8,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);for(let j=0;j<20;j++){const theta=j*2.4,spread=2.1*(1-(j%5)*.15);dummy.position.set(x+Math.sin(theta)*spread*.6,h*.45+(j%5)*h*.11,z+Math.cos(theta)*spread*.6);dummy.scale.set(spread,h*.13,spread*.8);dummy.updateMatrix();forest.setMatrixAt(index++,dummy.matrix);}}
 forest.instanceMatrix.needsUpdate=true;trunks.instanceMatrix.needsUpdate=true;
 for(let i=0;i<60;i++){const a=i*Math.PI*2/60,x=Math.sin(a)*32.4,z=Math.cos(a)*32.4;if(Math.abs(x)<3&&z>0)continue;cyl(scene,darkWood,.4,3.3,x,1.65,z);add(new T.ConeGeometry(.4,.7,24),wood,scene,x,3.65,z);}
 for(const x of [-27,27]){box(scene,wood,4,8,4,x,4,-27);add(new T.ConeGeometry(3.5,3,4),roof,scene,x,9.5,-27).rotation.y=Math.PI/4;for(const dx of [-1.4,1.4])box(scene,darkWood,.6,1.3,.1,x+dx,6,-24.95);}
 const grassMesh=new T.InstancedMesh(new T.PlaneGeometry(.045,.3,1,2),new T.MeshStandardMaterial({color:'#68814f',side:T.DoubleSide,roughness:1}),5000);scene.add(grassMesh);let seed=42,count=0;const random=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
 for(let attempts=0;attempts<12000&&count<5000;attempts++){const x=(random()-.5)*72,z=(random()-.5)*72;if(Math.hypot(x,z)<10||Math.abs(x)<3||Math.abs(z)<2.7||WORLD_OBJECTS.some(o=>containsObject(o,x,z,.5))||Math.hypot((x-POND.x)/(POND.rx+1),(z-POND.z)/(POND.rz+1))<1)continue;dummy.position.set(x,.15,z);dummy.scale.setScalar(.6+random());dummy.rotation.set(.12,random()*Math.PI*2,.12);dummy.updateMatrix();grassMesh.setMatrixAt(count++,dummy.matrix);}grassMesh.count=count;grassMesh.instanceMatrix.needsUpdate=true;
 for(let i=0;i<12;i++){const cloud=add(new T.SphereGeometry(1,24,16),new T.MeshBasicMaterial({color:'#eff1e6',transparent:true,opacity:.38,depthWrite:false}),scene,Math.sin(i*5)*75,45+(i%3)*7,Math.cos(i*5)*75);cloud.scale.set(12,2.2,6);cloud.castShadow=false;}
 return {pickups,cameraObstacles,update:(dt,time)=>{windmills.forEach(m=>m.rotation.z+=dt*.15);smoke.forEach(p=>{p.position.y=p.userData.baseY+((time*.35+p.userData.phase*.5)%3);p.position.x+=Math.sin(time+p.userData.phase)*dt*.05;});pickups.forEach(g=>{const gem=g.getObjectByName('pickup-gem');if(gem){gem.rotation.y+=dt;gem.position.y=1.05+Math.sin(time*2)*.12;}});waterMaterials.forEach(m=>m.roughness=.22+Math.sin(time*.7)*.04);}};
}
