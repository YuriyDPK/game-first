export type Player = { id:string; name:string; color:string; role:string; x:number; z:number; wood:number; carrying:number; bot:boolean; alive:boolean; hp:number; facing:number; attackSeq:number; lastChopAt:number; lastTrainAt:number; botNav?:BotNavigation };
type BotNavigation = { targetX:number; targetZ:number; nextPlan:number; path:{x:number;z:number}[] };
export type Tree = { id:number; x:number; z:number; hp:number };
export type Log = { id:string; x:number; z:number; amount:number; availableAt:number };
export type Building = { id:string; owner:string; type:'hall'|'barracks'; x:number; z:number; hp:number };
export type Unit = { id:string; owner:string; x:number; z:number; hp:number; cooldown:number; attackSeq:number };
export type Room = { code:string; host:string; status:'lobby'|'playing'|'finished'; players:Player[]; trees:Tree[]; logs:Log[]; buildings:Building[]; units:Unit[]; winner?:string; lastTick:number; created:number; revision:number };
const colors=['#dfaa55','#e16c55','#77a9bd','#b99ac8'];
const starts=[[-19,19],[19,-19],[19,19],[-19,-19]];
const names=['Рагнар','Фрейя','Бьорн'];
export const dist=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
function makeTrees():Tree[]{ const t:Tree[]=[]; let seed=2819; const rand=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646}; for(let i=0;i<84;i++){const x=(rand()-.5)*58,z=(rand()-.5)*58;if(starts.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<6)||Math.hypot(x,z)<3)continue;t.push({id:i,x,z,hp:5})} return t; }
export function createRoom(code:string,id:string,name:string,color:string,role:string):Room {return {code,host:id,status:'lobby',players:[makePlayer(id,name,color,0,false,role)],trees:makeTrees(),logs:[],buildings:[],units:[],lastTick:Date.now(),created:Date.now(),revision:0};}
export function makePlayer(id:string,name:string,color:string,index:number,bot:boolean,role="Воин"):Player {const [x,z]=starts[index];return {id,name:name.slice(0,18)||'Воин',color:color||colors[index],role:['Воин','Следопыт','Страж'].includes(role)?role:'Воин',x,z,wood:0,carrying:0,bot,alive:true,hp:100,facing:0,attackSeq:0,lastChopAt:0,lastTrainAt:0};}
export function addBot(room:Room){if(room.status!=='lobby'||room.players.length>=4)return;const i=room.players.length;room.players.push(makePlayer('bot-'+Math.random().toString(36).slice(2,9),names[i-1]||'Бот',colors[i],i,true));}
function moveToward(o:{x:number;z:number},target:{x:number;z:number},distance:number,trees:Tree[]){
 // Short steps prevent soldiers from passing through trees during a slow update.
 const steps=Math.max(1,Math.ceil(distance/.3)),step=distance/steps;
 for(let i=0;i<steps;i++){
  const dx=target.x-o.x,dz=target.z-o.z,remaining=Math.hypot(dx,dz);if(remaining<.15)return;
  const heading=Math.atan2(dz,dx),length=Math.min(step,remaining);
  const angles=[0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI*3/4,-Math.PI*3/4,Math.PI];
  const angle=angles.find(offset=>{const x=o.x+Math.cos(heading+offset)*length,z=o.z+Math.sin(heading+offset)*length;return Math.abs(x)<=29&&Math.abs(z)<=29&&!trees.some(t=>t.hp>0&&Math.hypot(t.x-x,t.z-z)<1.05)});
  if(angle===undefined)return;o.x+=Math.cos(heading+angle)*length;o.z+=Math.sin(heading+angle)*length;
 }
}
function formationPosition(room:Room,p:Player,index:number){
 const lateral=(index%3-1)*1.25,back=1.6+Math.floor(index/3)*1.05,c=Math.cos(p.facing),s=Math.sin(p.facing);
 const target={x:p.x+c*lateral-s*back,z:p.z-s*lateral-c*back};
 const free=(x:number,z:number)=>Math.abs(x)<=29&&Math.abs(z)<=29&&!room.trees.some(t=>t.hp>0&&Math.hypot(t.x-x,t.z-z)<1.1);
 if(free(target.x,target.z))return target;
 for(let radius=1.3;radius<=3.3;radius+=.5)for(let i=0;i<12;i++){const angle=(i+index*3)*Math.PI/6,x=p.x+Math.cos(angle)*radius,z=p.z+Math.sin(angle)*radius;if(free(x,z))return {x,z};}
 return {x:p.x,z:p.z};
}
function spawnUnit(room:Room,p:Player){
 const index=room.units.filter(u=>u.owner===p.id).length;
 const target=formationPosition(room,p,index);
 // New soldiers appear close to the hero, even when their eventual formation slot is farther away.
 const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1,scale=Math.min(1,1.6/d);
 const point={x:p.x+dx*scale,z:p.z+dz*scale};
 const blocked=room.trees.some(t=>t.hp>0&&dist(t,point)<1.05);
 room.units.push({id:Math.random().toString(36).slice(2),owner:p.id,x:blocked?p.x:point.x,z:blocked?p.z:point.z,hp:50,cooldown:0,attackSeq:0});
}
// Buildings are placed around the original collection point, keeping it accessible.
function buildNearBase(room:Room,p:Player,kind:'hall'|'barracks'){
 const index=room.players.indexOf(p),[sx,sz]=starts[index];
 const offsets=kind==='hall'?[[2,2],[-2,2],[2,-2],[-2,-2],[4,0],[-4,0],[0,4],[0,-4]]:[[-3,2],[2,-3],[-3,-3],[4,3],[-4,3],[3,-4],[-4,-4],[0,5],[5,0],[0,-5],[-5,0]];
 for(const [ox,oz] of offsets){const x=sx+ox,z=sz+oz;if(Math.abs(x)>27||Math.abs(z)>27)continue;
  if(room.trees.some(t=>t.hp>0&&Math.hypot(t.x-x,t.z-z)<2.3)||room.buildings.some(b=>Math.hypot(b.x-x,b.z-z)<3.4))continue;
  room.buildings.push({id:kind+p.id,owner:p.id,type:kind,x,z,hp:kind==='hall'?300:200});return true;
 }
 return false;
}
function updateEconomy(room:Room,p:Player,now:number){
 // Logs are world objects: anyone nearby can collect them, up to the carrying limit.
 for(const log of room.logs){if(log.amount>0&&now>=log.availableAt&&p.carrying+log.amount<=10&&dist(p,log)<1.55){p.carrying+=log.amount;log.amount=0;}}
 const [sx,sz]=starts[room.players.indexOf(p)];
 if(p.carrying>0&&dist(p,{x:sx,z:sz})<3.2){p.wood+=p.carrying;p.carrying=0;}
 if(p.carrying<10&&now-p.lastChopAt>=700){
  const nearest=room.trees.filter(t=>t.hp>0&&dist(p,t)<2.4).sort((a,b)=>dist(p,a)-dist(p,b))[0];
  if(nearest){p.lastChopAt=now;p.facing=Math.atan2(nearest.x-p.x,nearest.z-p.z);p.attackSeq++;nearest.hp--;
   if(nearest.hp===0){
    const dx=p.x-nearest.x,dz=p.z-nearest.z,length=Math.hypot(dx,dz)||1,ux=dx/length,uz=dz/length;
    for(let i=0;i<5;i++){const side=(i-2)*.38;room.logs.push({id:Math.random().toString(36).slice(2),x:nearest.x+ux*1.15-uz*side,z:nearest.z+uz*1.15+ux*side,amount:2,availableAt:now+900});}
   }
  }
 }
 let hall=room.buildings.find(b=>b.owner===p.id&&b.type==='hall');
 if(!hall&&p.wood>=10&&buildNearBase(room,p,'hall')){p.wood-=10;hall=room.buildings.find(b=>b.owner===p.id&&b.type==='hall');}
 let barracks=room.buildings.find(b=>b.owner===p.id&&b.type==='barracks');
 if(hall&&!barracks&&p.wood>=30&&buildNearBase(room,p,'barracks')){p.wood-=30;barracks=room.buildings.find(b=>b.owner===p.id&&b.type==='barracks');}
 if(barracks&&p.wood>=12&&now-p.lastTrainAt>=2000&&room.units.filter(u=>u.owner===p.id).length<12){
  p.wood-=12;p.lastTrainAt=now;spawnUnit(room,p);
 }
}
// Compute a route on a small grid so bots can carry logs around trees.
function botRoute(start:{x:number;z:number},target:{x:number;z:number},trees:Tree[]){
 const size=59,offset=29,total=size*size,blocked=new Uint8Array(total);
 const key=(x:number,z:number)=>z*size+x;
 for(const tree of trees){if(tree.hp<=0)continue;const cx=Math.round(tree.x)+offset,cz=Math.round(tree.z)+offset;
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const x=cx+dx,z=cz+dz;if(x>=0&&z>=0&&x<size&&z<size&&Math.hypot(x-offset-tree.x,z-offset-tree.z)<1.2)blocked[key(x,z)]=1;}}
 const clamp=(n:number)=>Math.max(0,Math.min(size-1,Math.round(n)+offset));
 const sx=clamp(start.x),sz=clamp(start.z),tx=clamp(target.x),tz=clamp(target.z);
 let gx=tx,gz=tz,best=Infinity;
 for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const x=tx+dx,z=tz+dz;if(x<0||z<0||x>=size||z>=size||blocked[key(x,z)])continue;const score=Math.hypot(x-offset-target.x,z-offset-target.z);if(score<best){best=score;gx=x;gz=z;}}
 if(!Number.isFinite(best))return [];
 const startKey=key(sx,sz),goal=key(gx,gz),scores=new Float64Array(total),parent=new Int32Array(total),closed=new Uint8Array(total);
 scores.fill(Infinity);parent.fill(-1);scores[startKey]=0;
 const open=[startKey],inOpen=new Uint8Array(total);inOpen[startKey]=1;
 while(open.length){let bestIndex=0,bestScore=Infinity;
  for(let i=0;i<open.length;i++){const n=open[i],x=n%size,z=Math.floor(n/size),score=scores[n]+Math.hypot(x-gx,z-gz);if(score<bestScore){bestScore=score;bestIndex=i;}}
  const current=open.splice(bestIndex,1)[0];inOpen[current]=0;if(current===goal)break;closed[current]=1;
  const x=current%size,z=Math.floor(current/size);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=size||nz>=size)continue;
   const next=key(nx,nz);if(blocked[next]||closed[next]||(dx&&dz&&(blocked[key(x+dx,z)]||blocked[key(x,z+dz)])))continue;
   const score=scores[current]+Math.hypot(dx,dz);if(score>=scores[next])continue;scores[next]=score;parent[next]=current;if(!inOpen[next]){open.push(next);inOpen[next]=1;}
  }
 }
 if(goal!==startKey&&parent[goal]===-1)return [];
 const path:{x:number;z:number}[]=[];let node=goal;
 while(node!==startKey&&node!==-1){path.push({x:node%size-offset,z:Math.floor(node/size)-offset});node=parent[node];}
 path.reverse();if(best<1.5)path.push({x:target.x,z:target.z});return path;
}
function moveBot(room:Room,p:Player,target:{x:number;z:number},now:number,dt:number){
 let nav=p.botNav;
 if(!nav||now>=nav.nextPlan||Math.hypot(nav.targetX-target.x,nav.targetZ-target.z)>2){
  nav={targetX:target.x,targetZ:target.z,nextPlan:now+2200,path:botRoute(p,target,room.trees)};p.botNav=nav;
 }
 while(nav.path.length>1&&dist(p,nav.path[0])<.55)nav.path.shift();
 const waypoint=nav.path[0]||target,oldX=p.x,oldZ=p.z;
 moveToward(p,waypoint,dt*3.8,room.trees);
 const dx=p.x-oldX,dz=p.z-oldZ;if(Math.hypot(dx,dz)>.01)p.facing=Math.atan2(dx,dz);
}
function updateBot(room:Room,p:Player,now:number,dt:number){
 const army=room.units.filter(unit=>unit.owner===p.id).length;
 if(army>=3){const enemy=room.players.filter(other=>other.id!==p.id&&other.alive).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(enemy){moveBot(room,p,enemy,now,dt);return;}}
 // Pick up nearby fallen logs first, including logs still completing their fall animation.
 const nearbyLog=room.logs.filter(log=>log.amount>0&&p.carrying+log.amount<=10&&dist(p,log)<5).sort((a,b)=>dist(p,a)-dist(p,b))[0];
 if(nearbyLog){if(dist(p,nearbyLog)>1.25)moveBot(room,p,nearbyLog,now,dt);return;}
 if(p.carrying>0){const [x,z]=starts[room.players.indexOf(p)];if(dist(p,{x,z})>3)moveBot(room,p,{x,z},now,dt);return;}
 const tree=room.trees.filter(tree=>tree.hp>0).sort((a,b)=>dist(p,a)-dist(p,b))[0];
 if(!tree||dist(p,tree)<2.25)return;
 const dx=p.x-tree.x,dz=p.z-tree.z,length=Math.hypot(dx,dz)||1;
 moveBot(room,p,{x:tree.x+dx/length*1.85,z:tree.z+dz/length*1.85},now,dt);
}
export function tick(room:Room){const now=Date.now(),dt=Math.min((now-room.lastTick)/1000,1);room.lastTick=now;if(room.status!=='playing'||dt<=0)return;
 for(const p of room.players.filter(p=>p.bot&&p.alive))updateBot(room,p,now,dt);
 for(const p of room.players.filter(p=>p.alive))updateEconomy(room,p,now);
 room.logs=room.logs.filter(log=>log.amount>0);
 for(const u of room.units){
  const owner=room.players.find(p=>p.id===u.owner);if(!owner?.alive)continue;u.cooldown-=dt;
  const targets=[...room.units.filter(v=>v.owner!==u.owner&&v.hp>0),...room.buildings.filter(b=>b.owner!==u.owner&&b.hp>0),...room.players.filter(p=>p.id!==u.owner&&p.alive&&p.hp>0)];
  // Every army protects the area around its own hero.
  const nearest=targets.filter(target=>dist(u,target)<7&&dist(owner,target)<9).sort((a,b)=>dist(u,a)-dist(u,b))[0];
  if(nearest){
   if(dist(u,nearest)<1.7){if(u.cooldown<=0){nearest.hp-=12;u.cooldown=.8;u.attackSeq++;}}
   else moveToward(u,nearest,dt*3.4,room.trees);
  }else{
   const index=room.units.filter(v=>v.owner===u.owner).indexOf(u),target=formationPosition(room,owner,index);
   if(dist(u,target)>.45)moveToward(u,target,dt*5.4,room.trees);
  }
 }
 room.units=room.units.filter(u=>u.hp>0);for(const p of room.players)if(p.alive&&p.hp<=0){p.alive=false;room.units=room.units.filter(u=>u.owner!==p.id);room.buildings=room.buildings.filter(b=>b.owner!==p.id);}const destroyed=room.buildings.filter(b=>b.hp<=0);room.buildings=room.buildings.filter(b=>b.hp>0);for(const b of destroyed)if(b.type==='hall'){const p=room.players.find(p=>p.id===b.owner);if(p)p.alive=false;room.units=room.units.filter(u=>u.owner!==b.owner);room.buildings=room.buildings.filter(v=>v.owner!==b.owner);}
 const alive=room.players.filter(p=>p.alive);if(room.players.length>1&&alive.length===1){room.status='finished';room.winner=alive[0].name;}}
export function action(room:Room,id:string,type:string,data:Record<string,unknown>){tick(room);const p=room.players.find(p=>p.id===id);if(!p)return 'Игрок не найден';if(type==='bot'&&id===room.host){addBot(room);return}if(type==='start'&&id===room.host&&room.status==='lobby'){if(room.players.length<2)return 'Добавьте бота или дождитесь игрока';room.status='playing';room.lastTick=Date.now();return}if(room.status!=='playing'||!p.alive)return;
 if(type==='move'){const x=Number(data.x),z=Number(data.z);if(Number.isFinite(x)&&Number.isFinite(z)){const target={x:Math.max(-29,Math.min(29,x)),z:Math.max(-29,Math.min(29,z))};if(dist(p,target)<1.5&&!room.trees.some(t=>t.hp>0&&dist(t,target)<.85)){p.facing=Math.atan2(target.x-p.x,target.z-p.z);p.x=target.x;p.z=target.z;}}}

}
