/** Shared by the server, client prediction, renderer and minimap. */
export const ARENA_RADIUS = 160;
export const PLAYER_RADIUS = .58;
export const PLAYER_HEIGHT = 3.65;
export const GRAVITY = 20;
export const JUMP_SPEED = 9.2;
export type WorldObject = {
  id: string; kind: 'house' | 'smith' | 'mill' | 'chapel' | 'stall' | 'crate' | 'barrel' | 'rock' | 'wall' | 'tree' | 'pillar' | 'altar' | 'canopy' | 'tower-platform';
  x: number; z: number; height: number; width?: number; depth?: number; radius?: number; bottom?:number;
};
export const WORLD_OBJECTS: WorldObject[] = [
  { id: 'longhouse', kind: 'house', x: 19, z: -15, width: 10, depth: 7, height: 6 },
  { id: 'forge', kind: 'smith', x: -18, z: -18, width: 9, depth: 7, height: 5.5 },
  { id: 'windmill', kind: 'mill', x: 20, z: 15, width: 6, depth: 7, height: 7 },
  { id: 'chapel', kind: 'chapel', x: -21, z: 19, width: 6, depth: 6, height: 6.4 },
  { id: 'market-west', kind: 'stall', x: -8, z: -11, width: 4.5, depth: 1.8, height: 1.15 },
  { id: 'market-east', kind: 'stall', x: 9, z: 12, width: 4.5, depth: 1.8, height: 1.15 },
  { id: 'market-west-roof', kind: 'canopy', x: -8, z: -11, width: 5.5, depth: 3.7, height: 4.85, bottom: 4.3 },
  { id: 'market-east-roof', kind: 'canopy', x: 9, z: 12, width: 5.5, depth: 3.7, height: 4.85, bottom: 4.3 },
  { id: 'altar', kind: 'altar', x: 0, z: 0, radius: 2, height: 1.25 },
  { id: 'ruin-left', kind: 'pillar', x: -3.7, z: -23, width: 1.5, depth: 2, height: 5.5 },
  { id: 'ruin-right', kind: 'pillar', x: 3.7, z: -23, width: 1.5, depth: 2, height: 5.5 },
  { id: 'low-wall-a', kind: 'wall', x: 1, z: 9, width: 6, depth: .75, height: 1 },
  { id: 'low-wall-b', kind: 'wall', x: 7, z: 5, width: .75, depth: 4, height: 1 },
  { id: 'crate-a', kind: 'crate', x: 8, z: -5, width: 1.65, depth: 1.65, height: 1.25 },
  { id: 'crate-b', kind: 'crate', x: 10, z: -5.2, width: 1.65, depth: 1.65, height: 2.3 },
  { id: 'crate-c', kind: 'crate', x: -10, z: -20, width: 1.6, depth: 1.6, height: 1.2 },
  { id: 'crate-d', kind: 'crate', x: 14, z: 18, width: 1.6, depth: 1.6, height: 1.2 },
  { id: 'barrel-a', kind: 'barrel', x: -12, z: -20, radius: .7, height: 1.45 },
  { id: 'barrel-b', kind: 'barrel', x: 23, z: 0, radius: .7, height: 1.45 },
  { id: 'barrel-c', kind: 'barrel', x: 13.5, z: 15.8, radius: .7, height: 1.45 },
  { id: 'rock-a', kind: 'rock', x: 12, z: 3, radius: 1.65, height: 1.8 },
  { id: 'rock-b', kind: 'rock', x: -9, z: 16, radius: 1.7, height: 1.6 },
  { id: 'rock-c', kind: 'rock', x: -12, z: -7, radius: 1.5, height: 1.7 },
  { id: 'tree-a', kind: 'tree', x: -26, z: -1, radius: .48, height: 10 },
  { id: 'tree-b', kind: 'tree', x: 25, z: -7, radius: .5, height: 11 },
  { id: 'tree-c', kind: 'tree', x: 9, z: 26, radius: .48, height: 10 },
  { id: 'tree-d', kind: 'tree', x: -4, z: -28, radius: .5, height: 12 },
  { id: 'bridge-rail-n', kind: 'wall', x: -15, z: 2.35, width: 15, depth: .18, height: 1.65 },
  { id: 'bridge-rail-s', kind: 'wall', x: -15, z: 5.65, width: 15, depth: .18, height: 1.65 },
];
// Elevated lookout buildings and their walkable stairs are shared by client and server.
export const TOWER_SITES = [
 {x:40,z:9,style:'watch'},{x:-48,z:-34,style:'hall'},
 {x:0,z:-116,style:'watch'},{x:114,z:25,style:'hall'},
 {x:-110,z:45,style:'watch'},{x:55,z:112,style:'hall'},
] as const;
for(const [i,t] of TOWER_SITES.entries())WORLD_OBJECTS.push({id:`tower-platform-${i}`,kind:'tower-platform',x:t.x,z:t.z,width:8,depth:7,height:3.2});
// Keep stairs and their approaches clear of generated scenery.
const nearTower=(x:number,z:number,padding=0)=>TOWER_SITES.some(t=>Math.abs(x-t.x)<6+padding&&z>t.z-5-padding&&z<t.z+14+padding);
export const FOREST_TREES = Array.from({length:220},(_,i)=>{const angle=i*2.399,r=39+(i%23)*5;return {x:Math.sin(angle)*r,z:Math.cos(angle)*r,h:7+(i%5)*1.3};}).filter(t=>!nearTower(t.x,t.z,2));
for(const [i,t] of FOREST_TREES.entries())WORLD_OBJECTS.push({id:`forest-${i}`,kind:'tree',x:t.x,z:t.z,radius:.28,height:t.h});
for(let i=0;i<60;i++){const a=i*Math.PI*2/60,x=Math.sin(a)*32.4,z=Math.cos(a)*32.4;if(Math.abs(x)<3&&z>0)continue;WORLD_OBJECTS.push({id:`palisade-${i}`,kind:'tree',x,z,radius:.4,height:3.3});}
for(const [i,point] of [[-55,-49],[58,-50],[-57,52],[57,50],[0,-76],[76,0],[-78,0],[0,77]].entries()){
 WORLD_OBJECTS.push({id:`outpost-${i}`,kind:i%3===0?'house':i%3===1?'smith':'chapel',x:point[0],z:point[1],width:7,depth:6,height:5.5});
}
export type ResourcePickup={id:string;x:number;z:number;item:'iron'|'wood'|'crystal';quantity:number;label:string};
export const WORLD_RESOURCES:ResourcePickup[]=Array.from({length:18},(_,i)=>{
 const angle=i*2.399+.3,r=i<12?44+(i%5)*10:105+(i%4)*12,types=['iron','wood','crystal'] as const,item=types[i%3];
 return {id:`resource-${i}`,x:Math.sin(angle)*r,z:Math.cos(angle)*r,item,quantity:1,label:({iron:'Редкая руда',wood:'Древесина',crystal:'Синий кристалл'})[item]};
});
// Scattered hamlets and roadside objects share their collision shapes with the renderer.
let hamlets=0,scenery=0;
for(let i=0;i<700&&(hamlets<16||scenery<32);i++){
 const angle=i*2.399+.83,r=43+(i%10)*4.8,x=Math.sin(angle)*r,z=Math.cos(angle)*r;
 const building=hamlets<16&&i%2===0,clearance=building?5.8:1.5;
 if(nearTower(x,z,clearance))continue;
 if(Math.hypot(x,z)>89||WORLD_OBJECTS.some(o=>containsObject(o,x,z,clearance))||WORLD_RESOURCES.some(p=>Math.hypot(p.x-x,p.z-z)<clearance+1.5))continue;
 if(building){WORLD_OBJECTS.push({id:`hamlet-${hamlets}`,kind:hamlets%5===0?'chapel':'house',x,z,width:6.5,depth:5.5,height:4.8});hamlets++;}
 else if(scenery<32){const kind=(['barrel','crate','rock'] as const)[scenery%3];WORLD_OBJECTS.push(kind==='crate'?{id:`roadside-${scenery}`,kind,x,z,width:1.5,depth:1.5,height:1.2}:{id:`roadside-${scenery}`,kind,x,z,radius:kind==='rock'?1.2:.7,height:kind==='rock'?1.4:1.45});scenery++;}
}
// New settlements on the outer ring, with room to walk around each building.
let outer=0;
for(let i=0;i<900&&outer<20;i++){
 const angle=i*2.399+.52,r=101+(i%10)*5.2,x=Math.sin(angle)*r,z=Math.cos(angle)*r;
 if(Math.hypot(x,z)>150||nearTower(x,z,7)||WORLD_OBJECTS.some(o=>containsObject(o,x,z,6.5))||WORLD_RESOURCES.some(p=>Math.hypot(p.x-x,p.z-z)<8))continue;
 const kind=(['house','smith','chapel','mill'] as const)[outer%4];
 WORLD_OBJECTS.push({id:`outer-${outer}`,kind,x,z,width:kind==='mill'?6:7,depth:6,height:kind==='mill'?7:5.5});outer++;
}
export const POND = { x: -15, z: 4, rx: 5.8, rz: 4.8 };
export const CAMP={x:0,z:20,radius:6.5};
export const inCamp=(p:{x:number;z:number})=>Math.hypot(p.x-CAMP.x,p.z-CAMP.z)<CAMP.radius;
export const SPAWNS = [{ x: 0, z: 20 }, { x: 1.5, z: 20 }, { x: -1.5, z: 20 }];
export type ItemId = 'potion' | 'bread' | 'arrows';
export const WORLD_PICKUPS: { id: string; x: number; z: number; item: ItemId; quantity: number; label: string }[] = [
  { id: 'camp-supplies', x: -3, z: 20, item: 'potion', quantity: 1, label: 'Целебный настой' },
  { id: 'market-food', x: 9, z: 14.2, item: 'bread', quantity: 2, label: 'Походный хлеб' },
  { id: 'forge-arrows', x: -12, z: -15, item: 'arrows', quantity: 12, label: 'Колчан стрел' },
  { id: 'ruins-potion', x: 0, z: -25, item: 'potion', quantity: 1, label: 'Целебный настой' },
  { id: 'mill-arrows', x: 16, z: 10, item: 'arrows', quantity: 12, label: 'Колчан стрел' },
  { id: 'bridge-food', x: -7, z: 4, item: 'bread', quantity: 1, label: 'Походный хлеб' },
  { id: 'north-food', x: 6, z: -70, item: 'bread', quantity: 2, label: 'Походный хлеб' },
  { id: 'east-potion', x: 70, z: 6, item: 'potion', quantity: 1, label: 'Целебный настой' },
  { id: 'west-arrows', x: -72, z: 7, item: 'arrows', quantity: 12, label: 'Колчан стрел' },
  { id: 'south-potion', x: 8, z: 71, item: 'potion', quantity: 1, label: 'Целебный настой' },
];
export type Body = { x: number; y: number; z: number; vy: number; grounded: boolean };
export function groundHeight(x: number, z: number) {
  for(const t of TOWER_SITES){
    const dz=z-t.z;
    if(Math.abs(x-t.x)<1.6&&dz>=3.5&&dz<=11.5)return (11.5-dz)*.4;
  }
  if (z > 2.45 && z < 5.55 && x > -23 && x < -7) {
    return Math.min(.55, Math.max(0, Math.min(x + 23, -7 - x) * .275));
  }
  return 0;
}
export function containsObject(o: WorldObject, x: number, z: number, padding = 0) {
  return o.radius !== undefined
    ? Math.hypot(x - o.x, z - o.z) < o.radius + padding
    : Math.abs(x-o.x) < o.width!/2+padding && Math.abs(z-o.z) < o.depth!/2+padding;
}
function waterPush(body: Body, radius: number) {
  const dx=body.x-POND.x, dz=body.z-POND.z;
  const rx=POND.rx+radius, rz=POND.rz+radius;
  const length=Math.hypot(dx/rx,dz/rz);
  const onBridge = Math.abs(dz) < 1.48-radius*.3;
  if(length<1&&!onBridge){
    // Leave a walkable opening exactly aligned with the rendered bridge.
    if(Math.abs(dz)<2.2&&Math.abs(dx)<POND.rx+1){body.z=POND.z+Math.sign(dz||1)*(1.48-radius*.3);}
    else {body.x=POND.x+(dx||.01)/(length||.01);body.z=POND.z+dz/(length||.01);}
  }
}
export function resolveWorld(body: Body, radius = PLAYER_RADIUS) {
  for(let pass=0;pass<3;pass++){
    for(const o of WORLD_OBJECTS){
      if(body.y >= o.height-.045 || body.y+PLAYER_HEIGHT <= (o.bottom??0)) continue;
      const dx=body.x-o.x,dz=body.z-o.z;
      // Let the final part of the ramp meet the raised deck without a collision lip.
      if(o.kind==='tower-platform'&&Math.abs(dx)<1.6&&dz>2.5&&body.y>=o.height-.3)continue;
      if(o.radius!==undefined){
        const r=o.radius+radius,d=Math.hypot(dx,dz);
        if(d<r){body.x=o.x+(d>.00001?dx/d:1)*r;body.z=o.z+(d>.00001?dz/d:0)*r;}
      }else{
        const hw=o.width!/2,hd=o.depth!/2;
        const nearX=Math.max(-hw,Math.min(hw,dx)),nearZ=Math.max(-hd,Math.min(hd,dz));
        const vx=dx-nearX,vz=dz-nearZ,d=Math.hypot(vx,vz);
        if(d>=radius)continue;
        if(d>.00001){body.x+=vx/d*(radius-d);body.z+=vz/d*(radius-d);}
        else if(hw-Math.abs(dx)<hd-Math.abs(dz)){body.x=o.x+Math.sign(dx||1)*(hw+radius);}
        else body.z=o.z+Math.sign(dz||1)*(hd+radius);
      }
    }
    waterPush(body,radius);
  }
  const distance=Math.hypot(body.x,body.z),boundary=ARENA_RADIUS-radius;
  if(distance>boundary){body.x*=boundary/distance;body.z*=boundary/distance;}
}
export function landingHeight(x: number, z: number, previousY: number) {
  let height=groundHeight(x,z);
  for(const o of WORLD_OBJECTS){
    if(o.height<=previousY+.055&&containsObject(o,x,z,.05))height=Math.max(height,o.height);
  }
  return height;
}
export function integrateBody(body: Body, direction: {x:number;z:number}, speed: number, elapsed: number) {
  const steps=Math.max(1,Math.ceil(elapsed/(1/60))),dt=elapsed/steps;
  const length=Math.max(1,Math.hypot(direction.x,direction.z));
  for(let i=0;i<steps;i++){
    const previousY=body.y;
    body.vy-=GRAVITY*dt;
    body.y+=body.vy*dt;
    body.x+=direction.x/length*speed*dt;body.z+=direction.z/length*speed*dt;
    if(body.vy>0)for(const o of WORLD_OBJECTS){
      if(o.bottom!==undefined&&previousY+PLAYER_HEIGHT<=o.bottom+.01&&body.y+PLAYER_HEIGHT>=o.bottom&&containsObject(o,body.x,body.z,PLAYER_RADIUS*.7)){
        body.y=o.bottom-PLAYER_HEIGHT-.01;body.vy=0;
      }
    }
    // Land before horizontal depenetration, so a fast descent cannot be pushed
    // sideways through the top of a platform on the frame it touches down.
    const floor=landingHeight(body.x,body.z,previousY);
    if(body.y<=floor&&body.vy<=0){body.y=floor;body.vy=0;body.grounded=true;}else body.grounded=false;
    resolveWorld(body);
  }
}
export function resolvePlayers(players: (Body&{id:string;hp:number})[]) {
  for(let pass=0;pass<3;pass++)for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
    const a=players[i],b=players[j];
    if(a.hp<=0||b.hp<=0||Math.abs(a.y-b.y)>PLAYER_HEIGHT-.15)continue;
    const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),minimum=PLAYER_RADIUS*2;
    if(d>=minimum)continue;
    const nx=d>.00001?dx/d:1,nz=d>.00001?dz/d:0,push=(minimum-d)/2+.0001;
    a.x-=nx*push;a.z-=nz*push;b.x+=nx*push;b.z+=nz*push;resolveWorld(a);resolveWorld(b);
  }
}
export function hasLineOfSight(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number}) {
  const distance=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(distance/.25);
  for(let i=1;i<steps;i++){
    const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=a.y+1.7+(b.y-a.y)*t;
    if(WORLD_OBJECTS.some(o=>o.height>y&&(o.bottom??0)<y&&containsObject(o,x,z)))return false;
  }
  return true;
}
/** Pick a collision-free intermediate direction; used by bots to go around cover. */
export function steer(x:number,z:number,y:number,dx:number,dz:number) {
  const length=Math.hypot(dx,dz)||1,angle=Math.atan2(dx,dz);
  for(const offset of [0,.6,-.6,1.15,-1.15,1.7,-1.7,Math.PI]){
    const nx=Math.sin(angle+offset),nz=Math.cos(angle+offset);
    const probe:Body={x:x+nx*1.4,y,z:z+nz*1.4,vy:0,grounded:true};
    const before={x:probe.x,z:probe.z};resolveWorld(probe);
    if(Math.hypot(probe.x-before.x,probe.z-before.z)<.15)return {x:nx,z:nz};
  }
  return {x:dx/length,z:dz/length};
}
