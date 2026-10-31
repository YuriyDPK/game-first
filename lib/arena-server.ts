import { randomBytes } from 'node:crypto';
import { getHero, createInput, defaultWeapon, WEAPONS, RECIPES, findCraftRecipe, xpForLevel, maxHealth, speedBonus, type ArenaState, type HeroId, type PlayerInput, type PlayerState } from './heroes';
import { validAppearance, type Appearance } from './cosmetics';
import { integrateBody, resolveWorld, resolvePlayers, hasLineOfSight, steer, SPAWNS, WORLD_PICKUPS, WORLD_RESOURCES, inCamp, JUMP_SPEED } from './world';

type Sequences = { attack:number; special:number; dodge:number; jump:number; use:number; interact:number; craft:number; skill:number };
type ServerPlayer = PlayerState & { token:string; input:PlayerInput; seen:number; sequences:Sequences; rollX:number; rollZ:number };
type Room = { code:string; players:ServerPlayer[]; startedAt:number; tick:number; practice:boolean; winner:string|null; pickups:Record<string,number> };
const globalStore = globalThis as unknown as { bogatyrRoomsV2?:Map<string,Room> };
const rooms = globalStore.bogatyrRoomsV2 ??= new Map<string,Room>();
const angleDifference = (a:number,b:number) => Math.atan2(Math.sin(a-b),Math.cos(a-b));

function addPlayer(room:Room,name:string,hero:HeroId,skin:string,bot=false,appearance:Appearance={head:'default',shield:'default'},styleLevel=1) {
  const usedSpawns=room.players.map(p=>p.id);
  const spawn=SPAWNS[usedSpawns.length%SPAWNS.length];
  const weapon=defaultWeapon(hero);
  const player:ServerPlayer={
    id:randomBytes(8).toString('hex'),token:randomBytes(24).toString('hex'),name,hero,skin,...spawn,y:0,vy:0,grounded:true,angle:Math.PI,
    hp:getHero(hero).hp,stamina:100,level:1,styleLevel,coinsEarned:0,appearance:validAppearance(hero,appearance),drawAmount:0,xp:0,skillPoints:0,skills:{strength:0,vitality:0,agility:0},skillAck:0,skillNotice:'',kills:0,deaths:0,weapon,inventory:{potion:3,bread:2,arrows:24},resources:{iron:0,wood:0,crystal:0,ingot:0,plank:0},upgrades:{mace:false,sword:false,bow:false,boots:false,armor:false},craftAck:0,craftNotice:'',aiming:false,attackPitch:0,attackAim:false,protectedUntil:Date.now()+1800,
    attackAt:0,attackId:0,attackWeapon:weapon,combo:0,specialAt:0,dodgeAt:0,jumpAt:0,useAt:0,usedItem:'',hitAt:0,hitId:0,hitAmount:0,respawnAt:0,
    block:false,sprint:false,moving:false,bot,input:createInput(hero),seen:Date.now(),sequences:{attack:0,special:0,dodge:0,jump:0,use:0,interact:0,craft:0,skill:0},rollX:0,rollZ:0,
  };
  resolveWorld(player);room.players.push(player);return player;
}
export function createRoom(name:string,hero:HeroId,skin:string,practice:boolean,appearance?:Appearance,styleLevel=1) {
  const now=Date.now();
  for(const [code,r] of rooms)if(now-r.tick>900_000)rooms.delete(code);
  if(rooms.size>=200)throw new Error('Слишком много комнат. Попробуйте позже.');
  let code:string;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));
  const room:Room={code,players:[],startedAt:now,tick:now,practice,winner:null,pickups:{}};rooms.set(code,room);
  const player=addPlayer(room,name,hero,skin,false,appearance,styleLevel);
  if(practice)(['ilya','dobrynya','alyosha'] as HeroId[]).filter(h=>h!==hero).forEach(h=>addPlayer(room,({ilya:'Силач',dobrynya:'Мечник',alyosha:'Стрелок'})[h],h,'classic',true));
  return {code,token:player.token,playerId:player.id};
}
export function joinRoom(code:string,name:string,hero:HeroId,skin:string,appearance?:Appearance,styleLevel=1) {
  const room=rooms.get(code);
  if(!room||Date.now()-room.tick>900_000)throw new Error('Комната не найдена. Проверьте код.');
  if(room.practice)throw new Error('Это тренировочная арена. Создайте комнату для друзей.');
  room.players=room.players.filter(p=>Date.now()-p.seen<30_000);
  if(room.players.length>=3)throw new Error('В комнате уже три богатыря.');
  if(room.winner)throw new Error('Этот бой уже завершён. Создайте новую комнату.');
  const player=addPlayer(room,name,hero,skin,false,appearance,styleLevel);return {code,token:player.token,playerId:player.id};
}
function gainXp(p:ServerPlayer,amount:number) {
 p.xp+=amount;if(!p.bot)p.coinsEarned+=amount;
 while(p.xp>=xpForLevel(p.level)){p.xp-=xpForLevel(p.level);p.level++;p.styleLevel=Math.max(p.styleLevel,p.level);p.skillPoints++;}
}
function upgradeSkill(p:ServerPlayer) {
 p.skillAck=p.input.skill;
 const id=p.input.skillChoice;
 if(!Object.hasOwn(p.skills,id)){p.skillNotice='Неизвестное улучшение';return;}
 if(p.skillPoints<1){p.skillNotice='Нет очков улучшения';return;}
 if(p.skills[id]>=5){p.skillNotice='Достигнут предел улучшения';return;}
 p.skills[id]++;p.skillPoints--;if(id==='vitality')p.hp+=15;
 p.skillNotice=`Улучшено: ${{strength:'сила',vitality:'здоровье',agility:'скорость'}[id]}`;
}
function attack(room:Room,p:ServerPlayer,now:number,special=false) {
  const weapon=WEAPONS[p.weapon];
  if(inCamp(p)||p.block||now-p.dodgeAt<600||now-p.useAt<650||now-p.attackAt<weapon.cooldown)return;
  if(special&&now-p.specialAt<8000)return;
  const attackWeapon=special&&p.hero==='alyosha'?'bow':p.weapon;
  p.attackPitch=p.input.aimPitch;p.attackAim=attackWeapon==='bow'&&p.input.aim;
  const cost=special?20:weapon.stamina;
  if(p.stamina<cost||(attackWeapon==='bow'&&p.inventory.arrows<(special?2:1)))return;
  p.protectedUntil=0;p.stamina-=cost;if(attackWeapon==='bow')p.inventory.arrows-=special?2:1;
  p.combo=now-p.attackAt<1400?(p.combo+1)%3:0;p.attackAt=now;p.attackId++;p.attackWeapon=attackWeapon;
  if(special){p.specialAt=now;if(p.hero==='ilya')p.hp=Math.min(maxHealth(p.hero,p.skills),p.hp+20);}
  const range=special?(p.hero==='alyosha'?22:5):weapon.range+(p.weapon==='bow'&&p.upgrades.bow?5:0);
  const targets=room.players.filter(t=>t.id!==p.id&&t.hp>0&&!inCamp(t)&&Math.hypot(t.x-p.x,t.z-p.z)<range&&Math.abs(t.y-p.y)<3)
    .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
  for(const target of targets){
    const direction=Math.atan2(target.x-p.x,target.z-p.z);
    if(attackWeapon==='bow'&&p.attackAim){
      const sx=p.x-Math.cos(p.angle)*.75,sz=p.z+Math.sin(p.angle)*.75;
      const dx=target.x-sx,dz=target.z-sz,forward=dx*Math.sin(p.angle)+dz*Math.cos(p.angle);
      const lateral=Math.abs(dx*Math.cos(p.angle)-dz*Math.sin(p.angle));
      const rayY=p.y+2.55-Math.tan(p.attackPitch)*forward;
      if(forward<0||lateral>.8||rayY<target.y||rayY>target.y+3.65)continue;
    }else if((!special||p.hero==='alyosha')&&Math.abs(angleDifference(direction,p.angle))>(attackWeapon==='bow'?.38:1.25))continue;
    if(now<target.protectedUntil||now-target.dodgeAt<350||!hasLineOfSight(p,target))continue;
    const facing=Math.abs(angleDifference(direction+Math.PI,target.angle))<1.5;
    const blocked=target.block&&facing&&target.stamina>=5;
    const charge=attackWeapon==='bow'&&p.attackAim&&!special?.45+.55*p.drawAmount:1;
    const damage=((special?(p.hero==='dobrynya'?45:40):weapon.damage)+(p.upgrades[attackWeapon]?(attackWeapon==='bow'?10:12):0)+p.skills.strength*3)*charge;
    const previousHp=target.hp;target.hp=Math.max(0,target.hp-Math.round(damage*(blocked?.25:1)*(target.upgrades.armor?.75:1)));target.hitAt=now;target.hitAmount=previousHp-target.hp;target.hitId++;
    if(blocked)target.stamina=Math.max(0,target.stamina-13);
    if(target.hp===0){target.deaths++;target.respawnAt=now+3000;target.block=false;target.moving=false;p.kills++;gainXp(p,50);}
    if(attackWeapon==='bow')break;
  }
  if(attackWeapon==='bow')p.drawAmount=0;
}
function useItem(p:ServerPlayer,now:number) {
  const item=p.input.item;
  if(now-p.useAt<1200||now-p.attackAt<500||p.inventory[item]<=0)return;
  if(item==='potion'){if(p.hp>=maxHealth(p.hero,p.skills))return;p.hp=Math.min(maxHealth(p.hero,p.skills),p.hp+55);}
  else{if(p.stamina>=98)return;p.stamina=Math.min(100,p.stamina+60);}
  p.inventory[item]--;p.useAt=now;p.usedItem=item;p.block=false;
}
function interact(room:Room,p:ServerPlayer,now:number) {
  const pickup=[...WORLD_PICKUPS,...WORLD_RESOURCES].filter(item=>(room.pickups[item.id]??0)<=now&&Math.hypot(item.x-p.x,item.z-p.z)<2.7&&p.y<1.5)
    .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
  if(!pickup)return;
  if(pickup.item==='iron'||pickup.item==='wood'||pickup.item==='crystal'){if(p.resources[pickup.item]>=99)return;p.resources[pickup.item]=Math.min(99,p.resources[pickup.item]+pickup.quantity);room.pickups[pickup.id]=now+90_000;gainXp(p,20);return;}
  const max=pickup.item==='arrows'?60:5;
  if(p.inventory[pickup.item]>=max)return;
  p.inventory[pickup.item]=Math.min(max,p.inventory[pickup.item]+pickup.quantity);room.pickups[pickup.id]=now+18_000;
}
function craft(p:ServerPlayer) {
 const id=findCraftRecipe(p.input.craftGrid);p.craftAck=p.input.craft;
 if(!id){p.craftNotice='Неизвестный рецепт';return;}
 const recipe=RECIPES[id];
 if(p.level<recipe.level){p.craftNotice=`Нужен уровень ${recipe.level}`;return;}
 if(!recipe.output&&p.upgrades[id as keyof typeof p.upgrades]){p.craftNotice='Это улучшение уже создано';return;}
 const entries=Object.entries(recipe.cost) as [keyof typeof p.resources,number][];
 if(entries.some(([resource,count])=>p.resources[resource]<count)){p.craftNotice='Не хватает ресурсов';return;}
 if(recipe.output&&p.resources[recipe.output]>=99){p.craftNotice='В суме нет места';return;}
 for(const [resource,count] of entries)p.resources[resource]-=count;
 if(recipe.output)p.resources[recipe.output]++;else p.upgrades[id as keyof typeof p.upgrades]=true;
 gainXp(p,recipe.output?10:30);p.craftNotice=`Создано: ${recipe.name}`;
}
function prepareBot(room:Room,p:ServerPlayer,now:number) {
  if(inCamp(p)){
    const index=room.players.indexOf(p),goal={x:index%2?10:-10,z:10};
    const d=steer(p.x,p.z,p.y,goal.x-p.x,goal.z-p.z);p.input.x=d.x;p.input.z=d.z;p.input.angle=Math.atan2(d.x,d.z);p.input.block=false;p.input.sprint=false;return;
  }
  const target=room.players.filter(t=>t.id!==p.id&&t.hp>0&&!inCamp(t)).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
  if(!target){const a=(room.players.indexOf(p)%2?1:-1)*Math.PI/2;p.input.x=Math.sin(a);p.input.z=Math.cos(a);p.input.angle=a;p.input.block=false;return;}
  const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),range=p.weapon==='bow'?9:2.5;
  const direction=steer(p.x,p.z,p.y,dx,dz);
  p.input.x=d>range?direction.x:0;p.input.z=d>range?direction.z:0;p.input.angle=Math.atan2(dx,dz);
  p.input.block=p.weapon!=='bow'&&d<4&&Math.sin(now/1100+p.x)>.75;p.input.sprint=d>12&&p.stamina>45;
  if(p.hp<getHero(p.hero).hp*.4&&p.inventory.potion>0)p.input.use++;
  if(d<WEAPONS[p.weapon].range&&now-p.attackAt>1100)p.input.attack++;
  if(d<4.5&&now-p.specialAt>10000)p.input.special++;
  if(p.grounded&&Math.sin(now/1700+p.x)>.98)p.input.jump++;
}
function processActions(room:Room,p:ServerPlayer,now:number) {
  const i=p.input;
  if(WEAPONS[i.equip]&&now-p.attackAt>WEAPONS[p.weapon].duration*1000)p.weapon=i.equip;
  if(i.jump>p.sequences.jump){p.sequences.jump=i.jump;if(p.grounded&&p.stamina>=10&&now-p.dodgeAt>600){p.vy=JUMP_SPEED;p.grounded=false;p.jumpAt=now;p.stamina-=10;}}
  if(i.dodge>p.sequences.dodge){p.sequences.dodge=i.dodge;if(p.grounded&&now-p.dodgeAt>1700&&p.stamina>=18){p.dodgeAt=now;p.stamina-=18;const d=Math.hypot(i.x,i.z);p.rollX=d>.01?i.x/d:Math.sin(p.angle);p.rollZ=d>.01?i.z/d:Math.cos(p.angle);}}
  if(i.use>p.sequences.use){p.sequences.use=i.use;useItem(p,now);}
  if(i.skill>p.sequences.skill){p.sequences.skill=i.skill;upgradeSkill(p);}
  if(i.craft>p.sequences.craft){p.sequences.craft=i.craft;craft(p);}
  if(i.interact>p.sequences.interact){p.sequences.interact=i.interact;interact(room,p,now);}
  if(i.special>p.sequences.special){p.sequences.special=i.special;attack(room,p,now,true);}
  if(i.attack>p.sequences.attack){p.sequences.attack=i.attack;attack(room,p,now);}
}
function publicPlayer(p:ServerPlayer):PlayerState {
  const {token:_token,input:_input,seen:_seen,sequences:_sequences,rollX:_rx,rollZ:_rz,...visible}=p;
  return {...visible,inventory:{...p.inventory},resources:{...p.resources},upgrades:{...p.upgrades},skills:{...p.skills},appearance:{...p.appearance}};
}
export function updateRoom(code:string,token:string,input?:PlayerInput,leave=false):ArenaState {
  const room=rooms.get(code);if(!room)throw new Error('Комната закрыта. Вернитесь в главное меню.');
  const player=room.players.find(p=>p.token===token&&!p.bot);if(!player)throw new Error('Подключение потеряно. Войдите в комнату снова.');
  const now=Date.now(),dt=Math.min(.15,Math.max(0,(now-room.tick)/1000));room.tick=now;
  if(input){player.input={...createInput(player.hero),...input};player.seen=now;}
  if(leave)room.players=room.players.filter(p=>p.id!==player.id);
  room.players=room.players.filter(p=>p.bot||now-p.seen<30_000);
  if(!room.winner){
    for(const p of room.players){
      if(p.hp<=0){
        if(now<p.respawnAt)continue;
        Object.assign(p,SPAWNS[room.players.indexOf(p)%SPAWNS.length],{y:0,vy:0,grounded:true});resolveWorld(p);
        p.hp=maxHealth(p.hero,p.skills);p.protectedUntil=now+1800;p.stamina=100;p.inventory.arrows=Math.max(12,p.inventory.arrows);p.respawnAt=0;
      }
      if(p.bot)prepareBot(room,p,now);
      const active=p.bot||now-p.seen<700,i=p.input;p.angle=i.angle;
      p.aiming=active&&i.aim&&p.weapon==='bow';
      p.block=active&&i.block&&p.weapon!=='bow'&&p.stamina>4&&now-p.dodgeAt>600&&now-p.useAt>650;
      if(active&&i.draw&&p.aiming&&p.hp>0)p.drawAmount=Math.min(1,p.drawAmount+dt/1.2);
      if(active)processActions(room,p,now);
      if(!active||!i.draw||!p.aiming)p.drawAmount=0;
      const rolling=now-p.dodgeAt<550;
      p.sprint=active&&i.sprint&&!p.block&&!rolling&&Math.hypot(i.x,i.z)>.01&&p.stamina>0&&(p.sprint||p.stamina>=10);
      const direction=rolling?{x:p.rollX,z:p.rollZ}:active?i:{x:0,z:0};
      const actionSlow=now-p.attackAt<400?.62:now-p.useAt<650?.45:1;
      const speed=getHero(p.hero).speed*speedBonus(p.skills)*(p.upgrades.boots?1.2:1)*(p.aiming?.65:1)*(rolling?2.6:p.sprint?1.7:p.block?.4:1)*actionSlow;
      const oldX=p.x,oldZ=p.z;integrateBody(p,direction,speed,dt);p.moving=Math.hypot(p.x-oldX,p.z-oldZ)>.001;
      if(p.sprint&&p.moving)p.stamina=Math.max(0,p.stamina-20*dt);
      else if(now-p.attackAt>650&&now-p.dodgeAt>650)p.stamina=Math.min(100,p.stamina+(p.block?4:15)*dt);
    }
    resolvePlayers(room.players);
  }
  return {code,startedAt:room.startedAt,now,winner:room.winner,practice:room.practice,players:room.players.map(publicPlayer),pickups:{...room.pickups}};
}
