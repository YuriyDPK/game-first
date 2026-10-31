import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function makeServer(){
 let now=100_000;const globals={},modules=new Map();
 class Clock extends Date{static now(){return now;}}
 function load(name){if(modules.has(name))return modules.get(name);const source=readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('require','module','exports','Date','globalThis',compiled)(id=>id.startsWith('./')?load(id.slice(2)):require(id),mod,mod.exports,Clock,globals);modules.set(name,mod.exports);return mod.exports;}
 return {...load('arena-server'),world:load('world'),heroes:load('heroes'),globals,advance(ms){now+=ms;}};
}
function pair(a='ilya',b='dobrynya',outside=true){
 const server=makeServer(),host=server.createRoom('Первый',a,'classic',false),guest=server.joinRoom(host.code,'Второй',b,'north');
 server.advance(2000);if(outside){const room=server.globals.bogatyrRoomsV2.get(host.code);room.players[0].x=0;room.players[0].z=-5;room.players[1].x=1.5;room.players[1].z=-5;}const inputs=new Map([[host.token,server.heroes.createInput(a)],[guest.token,server.heroes.createInput(b)]]);
 const update=(session,changes={})=>{const input={...inputs.get(session.token),...changes};inputs.set(session.token,input);return server.updateRoom(session.code,session.token,input);};
 const wait=ms=>{let state;for(let t=0;t<ms;t+=50){server.advance(Math.min(50,ms-t));state=update(host);update(guest);}return state;};
 return {server,host,guest,update,wait};
}
function approach(ctx,distance=2.3){
 const {server,host,guest,update}=ctx;let state=update(host);
 for(let i=0;i<250;i++){const a=state.players.find(p=>p.id===host.playerId),b=state.players.find(p=>p.id===guest.playerId),dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d<=distance){state=update(host,{x:0,z:0});return {state,angle:Math.atan2(dx,dz)};}const dir=server.world.steer(a.x,a.z,a.y,dx,dz);server.advance(100);state=update(host,{x:dir.x,z:dir.z,angle:Math.atan2(dx,dz)});update(guest);}
 throw new Error('Failed to navigate to the other player');
}
const body=(x=0,z=20,y=0)=>({x,z,y,vy:0,grounded:y===0});

test('shared rooms enforce capacity and never expose private input or tokens',()=>{const {server,host,guest,update}=pair();server.joinRoom(host.code,'Третий','alyosha','royal');assert.throws(()=>server.joinRoom(host.code,'Четвёртый','ilya','classic'),/три богатыря/);assert.throws(()=>server.updateRoom(host.code,'invalid'),/Подключение потеряно/);const s=update(host);assert.equal(s.players.length,3);assert.equal(s.players.find(p=>p.id===guest.playerId).skin,'north');for(const p of s.players){assert(!('token'in p));assert(!('input'in p));assert(!('sequences'in p));}});

test('diagonal movement is normalized and the physical world boundary is solid',()=>{const {world:w}=makeServer(),b=body();w.integrateBody(b,{x:1,z:1},4.4,.1);assert(Math.abs(Math.hypot(b.x,b.z-20)-.44)<.001);for(let i=0;i<400;i++)w.integrateBody(b,{x:1,z:1},8,.05);assert(Math.hypot(b.x,b.z)<=w.ARENA_RADIUS-w.PLAYER_RADIUS+.001);});

test('buildings, crates, barrels and trunks block bodies without tunnelling',()=>{const {world:w}=makeServer();for(const id of ['longhouse','crate-a','barrel-a','tree-a']){const o=w.WORLD_OBJECTS.find(o=>o.id===id),b=body(o.x,o.z-5);for(let i=0;i<30;i++)w.integrateBody(b,{x:0,z:1},10,.1);assert(!w.containsObject(o,b.x,b.z),'body entered '+id);assert(b.z<=o.z-(o.depth??o.radius*2)/2-w.PLAYER_RADIUS+.02,'body passed through '+id);}});

test('players cannot overlap and vertical separation is respected',()=>{const {world:w}=makeServer(),a={...body(0,20),id:'a',hp:100},b={...body(.1,20),id:'b',hp:100};w.resolvePlayers([a,b]);assert(Math.hypot(a.x-b.x,a.z-b.z)>=w.PLAYER_RADIUS*2-.001);b.x=a.x;b.z=a.z;b.y=4;w.resolvePlayers([a,b]);assert.equal(b.x,a.x);});

test('Space-style jump rises, falls and cannot be repeated in the air',()=>{const ctx=pair(),{host,update,wait}=ctx;update(host,{jump:1});let peak=0;for(let i=0;i<22;i++){const s=wait(50),p=s.players[0];peak=Math.max(peak,p.y);if(i===3)update(host,{jump:2});}const p=update(host).players[0];assert(peak>1.8&&peak<2.2);assert.equal(p.y,0);assert.equal(p.grounded,true);});

test('jump clears a low wall while walking stops against it',()=>{const {world:w}=makeServer(),walking=body(1,7),jumping=body(1,7);for(let i=0;i<20;i++)w.integrateBody(walking,{x:0,z:1},5,.05);assert(walking.z<8.1);jumping.vy=w.JUMP_SPEED;jumping.grounded=false;for(let i=0;i<20;i++)w.integrateBody(jumping,{x:0,z:1},5,.05);assert(jumping.z>11);});

test('landing on a crate is stable, and stepping off starts a fall',()=>{const {world:w}=makeServer(),b=body(8,-5,2.2);b.vy=-6;w.integrateBody(b,{x:0,z:0},0,.3);assert.equal(b.y,1.25);assert.equal(b.grounded,true);w.integrateBody(b,{x:0,z:1},5,.6);assert(b.z>-3);assert.equal(b.y,0);assert.equal(b.grounded,true);});

test('a market canopy stops upward motion but allows walking beneath it',()=>{const {world:w}=makeServer(),b=body(-8,-12.6);b.vy=w.JUMP_SPEED;b.grounded=false;let peak=0;for(let i=0;i<18;i++){w.integrateBody(b,{x:0,z:0},0,.025);peak=Math.max(peak,b.y);}assert(peak<=4.3-w.PLAYER_HEIGHT+.02);assert.equal(b.y,0);assert.equal(b.grounded,true);});

test('pond blocks entry but its bridge is walkable and raised',()=>{const {world:w}=makeServer(),water=body(-15,7);w.resolveWorld(water);assert(Math.hypot((water.x-w.POND.x)/(w.POND.rx+w.PLAYER_RADIUS),(water.z-w.POND.z)/(w.POND.rz+w.PLAYER_RADIUS))>=.99);const bridge=body(-23,4);for(let i=0;i<40;i++)w.integrateBody(bridge,{x:1,z:0},4,.05);assert(bridge.x>-16);assert.equal(bridge.y,.55);assert.equal(bridge.grounded,true);});

test('attacks respect range, facing, cooldown and directional shields',()=>{const ctx=pair(),{host,guest,update,wait}=ctx;let s=update(host,{attack:1});assert.equal(s.players[1].hp,150);const {angle}=approach(ctx);s=update(host,{angle:angle+Math.PI,attack:2});assert.equal(s.players[1].hp,150);wait(800);s=update(host,{angle,attack:3});assert.equal(s.players[1].hp,123);assert.equal(s.players[1].hitAmount,27);assert.equal(s.players[1].hitId,1);assert(s.players[0].attackId>0);s=update(host,{attack:4});assert.equal(s.players[1].hp,123);wait(800);update(guest,{block:true,angle:angle+Math.PI});s=update(host,{attack:5});assert.equal(s.players[1].hp,116);assert.equal(s.players[1].hitAmount,7);assert.equal(s.players[1].hitId,2);});

test('buildings obstruct attacks and line of sight',()=>{const {world:w}=makeServer();assert.equal(w.hasLineOfSight({x:-18,y:0,z:-25},{x:-18,y:0,z:-10}),false);assert.equal(w.hasLineOfSight({x:0,y:0,z:13},{x:0,y:0,z:18}),true);});

test('roll grants a short immunity window and costs stamina',()=>{const ctx=pair(),{host,guest,update,wait}=ctx;const {angle}=approach(ctx);const before=update(guest).players[1].stamina;let s=update(guest,{dodge:1});assert(s.players[1].stamina<before);s=update(host,{angle,attack:1});assert.equal(s.players[1].hp,150);wait(850);});

test('weapons change on the server and bow consumes exactly one arrow per accepted shot',()=>{const ctx=pair('alyosha','ilya'),{host,update,wait}=ctx;const {angle}=approach(ctx,11);let s=update(host,{angle,attack:1});assert.equal(s.players[1].hp,162);assert.equal(s.players[0].inventory.arrows,23);s=update(host,{attack:2});assert.equal(s.players[0].inventory.arrows,23);wait(800);s=update(host,{equip:'sword'});assert.equal(s.players[0].weapon,'sword');});

test('special cooldown is independent and starts an animation event',()=>{const ctx=pair(),{host,update,wait}=ctx;const {angle}=approach(ctx);let s=update(host,{angle,special:1});assert.equal(s.players[1].hp,110);assert.equal(s.players[0].specialAt,s.players[0].attackAt);wait(1000);s=update(host,{special:2});assert.equal(s.players[1].hp,110);wait(7100);s=update(host,{special:3});assert.equal(s.players[1].hp,70);});

test('healing is capped and potions cannot be consumed at full health',()=>{const ctx=pair(),{host,guest,update,wait}=ctx;let s=update(host,{use:1,item:'potion'});assert.equal(s.players[0].inventory.potion,3);const {angle}=approach(ctx);update(guest,{angle:angle+Math.PI,attack:1});wait(650);s=update(host,{use:2,item:'potion'});assert.equal(s.players[0].hp,180);assert.equal(s.players[0].inventory.potion,2);assert.equal(s.players[0].usedItem,'potion');});

test('food restores stamina and nearby pickups are shared with a respawn timer',()=>{const ctx=pair('ilya','dobrynya',false),{server,host,update,wait}=ctx;update(host,{jump:1});let s=update(host,{use:1,item:'bread'});assert.equal(s.players[0].stamina,100);assert.equal(s.players[0].inventory.bread,1);wait(1100);for(let i=0;i<6;i++){server.advance(100);update(host,{x:-1,z:0});}s=update(host,{x:0,interact:1});assert.equal(s.players[0].inventory.potion,4);assert(s.pickups['camp-supplies']>s.now);s=update(host,{interact:2});assert.equal(s.players[0].inventory.potion,4);});

test('players respawn at the camp and the world continues after five defeats',()=>{const ctx=pair(),{host,guest,update,wait}=ctx;let count=0,s;for(let round=0;round<5;round++){wait(2000);const room=ctx.server.globals.bogatyrRoomsV2.get(host.code);room.players[0].x=0;room.players[0].z=-5;room.players[1].x=1.5;room.players[1].z=-5;const {angle}=approach(ctx);for(let hit=0;hit<6;hit++){wait(900);s=update(host,{angle,attack:++count});}assert.equal(s.players[1].hp,0);assert.equal(s.players[1].deaths,round+1);if(round<4){wait(3100);s=update(guest);assert.equal(s.players[1].hp,150);}}assert.equal(s.winner,null);});

test('practice bots and player leave remain isolated from friend rooms',()=>{const {server,host,guest,update}=pair();server.updateRoom(host.code,guest.token,undefined,true);assert.equal(update(host).players.length,1);const practice=server.createRoom('Практика','ilya','classic',true),s=server.updateRoom(practice.code,practice.token,server.heroes.createInput());assert.equal(s.players.filter(p=>p.bot).length,2);assert.throws(()=>server.joinRoom(practice.code,'Гость','alyosha','classic'),/тренировочная арена/);});


test('rare resources and crafted equipment survive death; recipes are atomic',()=>{
 const ctx=pair(),{server,host,guest,update}=ctx,room=server.globals.bogatyrRoomsV2.get(host.code),player=room.players.find(p=>p.id===host.playerId),other=room.players.find(p=>p.id===guest.playerId);
 const node=server.world.WORLD_RESOURCES.find(p=>p.item==='iron');player.x=node.x;player.z=node.z;let state=update(host,{interact:1});assert.equal(state.players[0].resources.iron,1);assert(state.pickups[node.id]>state.now);
 other.x=node.x;other.z=node.z;state=update(guest,{interact:1});assert.equal(state.players[1].resources.iron,0);
 player.level=2;Object.assign(player.resources,{iron:2,wood:3,crystal:3,ingot:1,plank:2});
 const ingot=server.heroes.RECIPES.ingot.pattern,sword=server.heroes.RECIPES.sword.pattern,boots=server.heroes.RECIPES.boots.pattern;
 state=update(host,{craft:1,craftGrid:ingot});assert.equal(state.players[0].resources.ingot,2);assert.equal(state.players[0].resources.iron,0);
 state=update(host,{craft:2,craftGrid:sword});assert.equal(state.players[0].upgrades.sword,true);assert.equal(state.players[0].resources.ingot,0);assert.equal(state.players[0].resources.crystal,2);
 state=update(host,{craft:3,craftGrid:sword});assert.equal(state.players[0].resources.crystal,2);state=update(host,{craft:4,craftGrid:boots});assert.equal(state.players[0].upgrades.boots,true);assert.equal(state.players[0].resources.crystal,0);
 player.resources.iron=2;player.hp=0;player.respawnAt=state.now+1;server.advance(50);state=update(host);assert.equal(state.players[0].resources.iron,2);assert.equal(state.players[0].upgrades.sword,true);assert.equal(state.players[0].upgrades.boots,true);assert(Math.hypot(state.players[0].x,state.players[0].z-20)<3);
});

test('aimed bow draws over time, changes damage, and follows the crosshair',()=>{
 const ctx=pair('alyosha','ilya'),{server,host,update,wait}=ctx,room=server.globals.bogatyrRoomsV2.get(host.code),target=room.players[1];room.players[0].x=3;room.players[0].z=11;target.x=3.75;target.z=-1;
 let state=update(host,{angle:Math.PI,aim:true,aimPitch:0,attack:1});assert.equal(state.players[1].hp,172);assert.equal(state.players[0].inventory.arrows,23);
 server.advance(800);state=update(host,{angle:Math.PI,aim:true,aimPitch:.8,attack:2});assert.equal(state.players[1].hp,172);assert.equal(state.players[0].inventory.arrows,22);
 update(host,{aimPitch:0,draw:true});wait(1250);state=update(host);assert(state.players[0].drawAmount>.95);
 state=update(host,{draw:false,attack:3});assert.equal(state.players[1].hp,154);assert.equal(state.players[0].drawAmount,0);assert.equal(state.players[0].inventory.arrows,21);
});

test('camp protects players and sends bots out of the safe area',()=>{const ctx=pair('ilya','dobrynya',false),{host,guest,update,server}=ctx;let state=update(host,{angle:Math.PI/2,attack:1});assert.equal(state.players[1].hp,150);const practice=server.createRoom('Тест','ilya','classic',true);const before=server.updateRoom(practice.code,practice.token,server.heroes.createInput());for(let i=0;i<40;i++){server.advance(100);state=server.updateRoom(practice.code,practice.token,server.heroes.createInput());}assert(state.players.some(p=>p.bot&&Math.hypot(p.x,p.z-20)>6.5));assert.equal(state.players.find(p=>p.id===practice.playerId).hp,before.players.find(p=>p.id===practice.playerId).hp);});

test('sprint waits for ten stamina before restarting',()=>{
 const {server,host,update}=pair(),player=server.globals.bogatyrRoomsV2.get(host.code).players[0];
 player.stamina=0;player.sprint=false;
 for(let i=0;i<10;i++){server.advance(50);const state=update(host,{x:0,z:-1,sprint:true});assert.equal(state.players[0].sprint,false);}
 assert(player.stamina<10);
 let state;for(let i=0;i<10&&!player.sprint;i++){server.advance(50);state=update(host);}
 assert.equal(state.players[0].sprint,true);
});

test('crafting rejects wrong arrangements, missing ingredients, and locked recipes',()=>{
 const {server,host,update}=pair(),player=server.globals.bogatyrRoomsV2.get(host.code).players[0];
 Object.assign(player.resources,{iron:2,wood:1,crystal:1,ingot:2});
 let state=update(host,{craft:1,craftGrid:['iron',null,'iron','wood',null,null,null,null,null]});assert.equal(state.players[0].resources.iron,2);
 state=update(host,{craft:2,craftGrid:server.heroes.RECIPES.sword.pattern});assert.equal(state.players[0].upgrades.sword,false);assert.equal(state.players[0].resources.ingot,2);
 player.level=2;player.resources.crystal=0;state=update(host,{craft:3,craftGrid:server.heroes.RECIPES.sword.pattern});assert.equal(state.players[0].upgrades.sword,false);assert.equal(state.players[0].resources.ingot,2);
});

test('experience and skill upgrades persist after death and affect health',()=>{
 const {server,host,update}=pair(),player=server.globals.bogatyrRoomsV2.get(host.code).players[0];
 const node=server.world.WORLD_RESOURCES.find(p=>p.item==='iron');player.x=node.x;player.z=node.z;player.xp=40;
 let state=update(host,{interact:1});assert.equal(state.players[0].level,2);assert.equal(state.players[0].skillPoints,1);
 state=update(host,{skill:1,skillChoice:'vitality'});assert.equal(state.players[0].skills.vitality,1);assert.equal(state.players[0].hp,195);assert.equal(state.players[0].skillPoints,0);
 state=update(host,{skill:2,skillChoice:'strength'});assert.equal(state.players[0].skills.strength,0);
 player.hp=0;player.respawnAt=state.now+1;server.advance(50);state=update(host);assert.equal(state.players[0].level,2);assert.equal(state.players[0].hp,195);assert.equal(state.players[0].skills.vitality,1);
});

test('tower stairs lead up to the deck and back down without jumping',()=>{
 const {world:w}=makeServer();
 for(const site of w.TOWER_SITES){
  const b=body(site.x,site.z+12.5);
  for(let i=0;i<130;i++)w.integrateBody(b,{x:0,z:-1},3,.025);
  assert(b.z<site.z+3.5,`cannot reach deck at ${site.x},${site.z}: ${b.z}`);
  assert(Math.abs(b.y-3.2)<.05,'not standing on deck');assert(b.grounded);
  for(let i=0;i<150;i++)w.integrateBody(b,{x:0,z:1},3,.025);
  assert(b.z>site.z+11.5,'cannot descend stairs');assert.equal(b.y,0);assert(b.grounded);
 }
});

test('class cosmetics reach other players and collection earns shop coins',()=>{
 const server=makeServer(),host=server.createRoom('Первый','ilya','classic',false,{head:'ilya-plume',shield:'ilya-rune'},4);
 const guest=server.joinRoom(host.code,'Второй','dobrynya','classic',{head:'ilya-plume',shield:'dobrynya-kite'},2);
 const room=server.globals.bogatyrRoomsV2.get(host.code),node=server.world.WORLD_RESOURCES.find(p=>p.item==='wood');room.players[0].x=node.x;room.players[0].z=node.z;
 const state=server.updateRoom(host.code,host.token,{...server.heroes.createInput(),interact:1});
 assert.equal(state.players[0].appearance.head,'ilya-plume');assert.equal(state.players[0].styleLevel,4);assert.equal(state.players[0].coinsEarned,20);
 assert.equal(state.players[1].appearance.head,'default');assert.equal(state.players[1].appearance.shield,'dobrynya-kite');assert.equal(state.players[1].id,guest.playerId);
});
