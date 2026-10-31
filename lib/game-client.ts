import * as T from 'three';
import { WEAPONS, getHero, maxHealth, speedBonus, type ArenaState, type PlayerInput, type PlayerState, type WeaponId, type CraftGrid, type SkillId } from './heroes';
import { createWorld, createFighter, animateFighter, disposeObject, type Fighter } from './scene';
import { integrateBody, resolveWorld, PLAYER_RADIUS, PLAYER_HEIGHT, JUMP_SPEED, inCamp, type Body } from './world';
export type ClientCallbacks={
  input:PlayerInput; playerId:string; getSnapshot:()=>{state:ArenaState|null;receivedAt:number;latency:number};
  onLock:(locked:boolean,fallback:boolean)=>void;onPanel:(panel:'inventory'|'menu'|null)=>void;
  onError:(text:string)=>void;onHint:(text:string)=>void;onSound:(kind:'hit'|'swing'|'jump'|'pickup')=>void;
};
export class GameClient{
 private renderer:T.WebGLRenderer;
 private scene=new T.Scene();private camera=new T.PerspectiveCamera(56,1,.12,180);
 private world:ReturnType<typeof createWorld>;
 private fighters=new Map<string,Fighter>();private labels=new Map<string,T.Sprite>();private lastEffects=new Map<string,number>();
 private effects:{mesh:T.Mesh;age:number;kind:string;angle:number;pitch:number}[]=[];
 private damageNumbers:{sprite:T.Sprite;age:number;targetId:string}[]=[];private correction={x:0,z:0};
 private body:Body={x:0,y:0,z:20,vy:0,grounded:true};private initialized=false;private cameraReady=false;private lastSnapshot:ArenaState|null=null;private history:ArenaState[]=[];private touchAim=false;private touchAttack=false;private sprinting=false;
 private yaw=Math.PI;private pitch=.29;private distance=8;private keys=new Set<string>();private panel:'inventory'|'menu'|null=null;
 private locked=false;private fallback=false;private leftDown=false;private rightDown=false;private dragging=false;private lastPointer={x:0,y:0};
 private raf=0;private lastFrame=0;private disposed=false;private observer:ResizeObserver;private ray=new T.Raycaster();
 private predicted={attackAt:0,attackId:0,attackWeapon:'mace' as WeaponId,attackPitch:0,attackAim:false,combo:0,specialAt:0,jumpAt:0,dodgeAt:0,useAt:0,usedItem:''};
 private rollDirection={x:0,z:-1};private jumpPendingUntil=0;private removers:(()=>void)[]=[];
 constructor(private el:HTMLDivElement,private options:ClientCallbacks){
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
  el.appendChild(this.renderer.domElement);this.world=createWorld(this.scene);
  const resize=()=>{this.renderer.setSize(el.clientWidth,el.clientHeight);this.camera.aspect=el.clientWidth/el.clientHeight;this.camera.updateProjectionMatrix();};
  this.observer=new ResizeObserver(resize);this.observer.observe(el);resize();
  this.listen(document,'mousemove',this.mouseMove);this.listen(document,'pointerlockchange',this.lockChange);this.listen(document,'pointerlockerror',this.lockError);
  this.listen(window,'keydown',this.keyDown);this.listen(window,'keyup',this.keyUp);this.listen(window,'blur',this.blur);
  this.listen(el,'pointerdown',this.pointerDown);this.listen(window,'pointerup',this.pointerUp);this.listen(el,'mousedown',this.mouseDown);this.listen(window,'mouseup',this.mouseUp);this.listen(el,'pointermove',this.pointerMove);this.listen(el,'pointercancel',this.pointerUp);
  this.listen(el,'contextmenu',(e:Event)=>e.preventDefault());this.listen(el,'wheel',this.wheel,{passive:false});
  this.lastFrame=performance.now();this.raf=requestAnimationFrame(this.frame);
 }
 private listen(target:EventTarget,event:string,fn:EventListenerOrEventListenerObject,opts?:AddEventListenerOptions){target.addEventListener(event,fn,opts);this.removers.push(()=>target.removeEventListener(event,fn,opts));}
 private now(){const s=this.options.getSnapshot();return s.state?s.state.now+performance.now()-s.receivedAt:Date.now();}
 private me(){return this.options.getSnapshot().state?.players.find(p=>p.id===this.options.playerId);}
 capture=(retry=false)=>{
  if(retry)this.fallback=false;
  this.setPanel(null);
  if(this.fallback){this.options.onHint('Вращай камеру, удерживая ПКМ. Блок — F.');return;}
  const canvas=this.renderer.domElement;
  if(!canvas.requestPointerLock){this.lockError();return;}
  try{const promise=canvas.requestPointerLock();if(promise&&typeof promise.catch==='function')void promise.catch(error=>{console.warn('Mouse capture unavailable:',error);this.lockError();});}catch{this.lockError();}
 };
 setPanel=(panel:'inventory'|'menu'|null)=>{
  this.panel=panel;this.keys.clear();this.options.input.x=this.options.input.z=0;this.options.input.block=this.options.input.sprint=this.options.input.aim=this.options.input.draw=false;this.leftDown=this.rightDown=this.touchAim=this.touchAttack=false;
  if(panel&&document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();this.options.onPanel(panel);
 };
 toggleInventory=()=>{if(this.panel==='inventory')this.capture();else this.setPanel('inventory');};
 setWeapon=(weapon:WeaponId)=>{this.options.input.equip=weapon;if(weapon==='bow')this.options.input.block=false;};
 upgradeSkill=(choice:SkillId)=>{const p=this.me();if(!p||p.hp<=0||p.skillPoints<1||p.skillAck<this.options.input.skill)return;this.options.input.skillChoice=choice;this.options.input.skill++;};
 craft=(grid:CraftGrid)=>{const p=this.me();if(!p||p.hp<=0||p.craftAck<this.options.input.craft)return;this.options.input.craftGrid=[...grid];this.options.input.craft++;};
 holdAim=(value:boolean)=>{this.touchAim=value;};
 holdAttack=(value:boolean)=>{if(value){this.updateInput();this.touchAttack=true;if(!(this.options.input.equip==='bow'&&this.options.input.aim))this.attack();}else{if(this.touchAttack&&this.options.input.equip==='bow'&&this.options.input.aim)this.attack();this.touchAttack=false;this.options.input.draw=false;}};
 useItem=(item:'potion'|'bread')=>{
  const p=this.me();if(!p||p.hp<=0)return;
  if(p.inventory[item]<=0){this.options.onHint('Этот предмет закончился. Ищи припасы на карте.');return;}
  if(item==='potion'&&p.hp>=maxHealth(p.hero,p.skills)){this.options.onHint('Здоровье уже полное.');return;}
  if(item==='bread'&&p.stamina>=98){this.options.onHint('Выносливость уже полная.');return;}
  const now=this.now();if(now-Math.max(p.useAt,this.predicted.useAt)<1200)return;
  this.options.input.item=item;this.options.input.use++;this.predicted.useAt=now;this.predicted.usedItem=item;
 };
 interact=()=>{this.options.input.interact++;};
 jump=()=>{
  const p=this.me();if(!p||p.hp<=0||this.panel||!this.body.grounded||p.stamina<10)return;
  this.options.input.jump++;this.body.vy=JUMP_SPEED;this.body.grounded=false;this.predicted.jumpAt=this.now();this.jumpPendingUntil=performance.now()+220;this.options.onSound('jump');
 };
 dodge=()=>{
  const p=this.me(),now=this.now();if(!p||p.hp<=0||this.panel||!this.body.grounded||p.stamina<18||now-Math.max(p.dodgeAt,this.predicted.dodgeAt)<1700)return;
  this.options.input.dodge++;this.predicted.dodgeAt=now;const d=Math.hypot(this.options.input.x,this.options.input.z);
  this.rollDirection=d>.01?{x:this.options.input.x/d,z:this.options.input.z/d}:{x:Math.sin(this.yaw),z:Math.cos(this.yaw)};
 };
 attack=(special=false)=>{
  const p=this.me(),now=this.now();if(!p||p.hp<=0||this.panel||this.options.input.block||this.options.getSnapshot().state?.winner)return;if(inCamp(p)){this.options.onHint('Лагерь — мирная зона. Для боя выйди за его границы.');return;}
  const weapon=WEAPONS[this.options.input.equip];
  if(now-Math.max(p.attackAt,this.predicted.attackAt)<weapon.cooldown||now-Math.max(p.dodgeAt,this.predicted.dodgeAt)<600||now-Math.max(p.useAt,this.predicted.useAt)<650)return;
  if(p.stamina<(special?20:weapon.stamina))return;
  if((this.options.input.equip==='bow'||special&&p.hero==='alyosha')&&p.inventory.arrows<(special?2:1)){this.options.onHint('Нет стрел. Подбери колчан у кузницы или мельницы.');return;}
  if(special&&now-Math.max(p.specialAt,this.predicted.specialAt)<8000)return;
  if(special){this.options.input.special++;this.predicted.specialAt=now;}else this.options.input.attack++;
  this.predicted.combo=now-Math.max(p.attackAt,this.predicted.attackAt)<1400?(Math.max(p.combo,this.predicted.combo)+1)%3:0;
  this.predicted.attackAt=now;this.predicted.attackId=Math.max(p.attackId,this.predicted.attackId)+1;this.predicted.attackWeapon=special&&p.hero==='alyosha'?'bow':this.options.input.equip;this.predicted.attackAim=this.predicted.attackWeapon==='bow'&&this.options.input.aim;this.predicted.attackPitch=this.options.input.aimPitch;this.options.onSound('swing');
 };
 holdBlock=(value:boolean)=>{this.rightDown=value;this.options.input.block=value;};
 holdKey=(code:string,value:boolean)=>{if(value)this.keys.add(code);else this.keys.delete(code);};
 private lockChange=()=>{this.locked=document.pointerLockElement===this.renderer.domElement;this.leftDown=this.rightDown=false;this.options.input.block=false;this.options.onLock(this.locked,this.fallback);};
 private lockError=()=>{this.fallback=true;this.locked=false;this.options.onLock(false,true);this.options.onHint('Браузер не захватил мышь. Удерживай ПКМ для вращения камеры; блок — F.');};
 private mouseMove=(e:Event)=>{if(!this.locked||this.panel)return;const m=e as MouseEvent;this.yaw-=m.movementX*.0027;this.pitch=T.MathUtils.clamp(this.pitch+m.movementY*.0023,-.18,1.05);};
 private pointerDown=(event:Event)=>{
  const e=event as PointerEvent;if(this.panel||e.pointerType!=='touch')return;
  this.dragging=true;this.lastPointer={x:e.clientX,y:e.clientY};
 };
 private pointerUp=(event:Event)=>{if((event as PointerEvent).pointerType==='touch')this.dragging=false;};
 private mouseDown=(event:Event)=>{
  const e=event as MouseEvent;if(this.panel)return;
  if(e.button===0){if(!this.locked&&!this.fallback){this.capture();return;}this.updateInput();this.leftDown=true;if(!(this.options.input.equip==='bow'&&this.options.input.aim))this.attack();}
  if(e.button===2){if(this.locked)this.rightDown=true;else{this.dragging=true;this.lastPointer={x:e.clientX,y:e.clientY};}this.updateInput();}
 };
 private mouseUp=(event:Event)=>{const e=event as MouseEvent;if(e.button===0){if(this.leftDown&&this.options.input.equip==='bow'&&this.options.input.aim)this.attack();this.leftDown=false;this.options.input.draw=false;}if(e.button===2){this.rightDown=false;this.dragging=false;this.options.input.block=false;}};
 private pointerMove=(event:Event)=>{const e=event as PointerEvent;if(!this.dragging||this.locked||this.panel)return;this.yaw-=(e.clientX-this.lastPointer.x)*.005;this.pitch=T.MathUtils.clamp(this.pitch+(e.clientY-this.lastPointer.y)*.004,-.18,1.05);this.lastPointer={x:e.clientX,y:e.clientY};};
 private wheel=(event:Event)=>{const e=event as WheelEvent;if(this.panel)return;e.preventDefault();this.distance=T.MathUtils.clamp(this.distance+e.deltaY*.008,4.5,12);};
 private keyDown=(event:Event)=>{
  const e=event as KeyboardEvent;if((e.target as HTMLElement)?.matches('input,textarea'))return;
  if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='KeyI'||e.code==='Tab'){this.toggleInventory();return;}
  if(e.code==='Escape'){this.setPanel(this.panel?null:'menu');return;}
  if(this.panel)return;this.keys.add(e.code);
  if(e.code==='Space')this.jump();if(e.code==='ControlLeft'||e.code==='ControlRight')this.dodge();if(e.code==='KeyQ')this.attack(true);if(e.code==='KeyJ'&&!(this.options.input.equip==='bow'&&this.options.input.aim))this.attack();
  if(e.code==='Digit1')this.setWeapon('mace');if(e.code==='Digit2')this.setWeapon('sword');if(e.code==='Digit3')this.setWeapon('bow');if(e.code==='Digit4')this.useItem('potion');if(e.code==='Digit5')this.useItem('bread');if(e.code==='KeyE')this.interact();
 };
 private keyUp=(event:Event)=>{const code=(event as KeyboardEvent).code;if(code==='KeyJ'&&this.keys.has(code)&&this.options.input.equip==='bow'&&this.options.input.aim)this.attack();this.keys.delete(code);if(code==='KeyJ')this.options.input.draw=false;};
 private blur=()=>{this.keys.clear();this.leftDown=this.rightDown=false;this.options.input.x=this.options.input.z=0;this.options.input.block=false;};
 private updateInput(){
  const i=this.options.input,k=this.keys;
  if(this.panel){i.x=i.z=0;i.block=i.sprint=false;return;}
  const forward=Number(k.has('KeyW')||k.has('ArrowUp'))-Number(k.has('KeyS')||k.has('ArrowDown'));
  const side=Number(k.has('KeyD')||k.has('ArrowRight'))-Number(k.has('KeyA')||k.has('ArrowLeft'));
  i.x=Math.sin(this.yaw)*forward-Math.cos(this.yaw)*side;i.z=Math.cos(this.yaw)*forward+Math.sin(this.yaw)*side;
  i.angle=this.yaw;i.aim=i.equip==='bow'&&(this.touchAim||k.has('KeyC')||(this.locked&&this.rightDown));i.draw=i.aim&&(this.leftDown||this.touchAttack||k.has('KeyJ'));i.aimPitch=this.pitch;i.block=i.equip!=='bow'&&(this.rightDown||k.has('KeyF'));i.sprint=k.has('ShiftLeft')||k.has('ShiftRight');if((this.leftDown||this.touchAttack||k.has('KeyJ'))&&!i.draw)this.attack();
 }
 private reconcile(state:ArenaState){
  const me=state.players.find(p=>p.id===this.options.playerId);if(!me)return;
  if(!this.initialized){Object.assign(this.body,{x:me.x,y:me.y,z:me.z,vy:me.vy,grounded:me.grounded});this.yaw=me.angle;this.initialized=true;}
  const old=this.lastSnapshot?.players.find(p=>p.id===me.id);
  const predicted={x:me.x,y:me.y,z:me.z,vy:me.vy,grounded:me.grounded};
  const i=this.options.input,lag=Math.min(.12,this.options.getSnapshot().latency/2000);
  if(me.moving&&me.hp>0&&Math.hypot(i.x,i.z)>.01&&lag>0){
    const speed=getHero(me.hero).speed*speedBonus(me.skills)*(me.upgrades.boots?1.2:1)*(me.aiming?.65:1)*(me.sprint?1.7:me.block?.4:1);
    integrateBody(predicted,i,speed,lag);
  }
  const dx=predicted.x-this.body.x,dz=predicted.z-this.body.z,error=Math.hypot(dx,dz);
  if(error>3||old&&old.hp<=0&&me.hp>0){this.body.x=me.x;this.body.z=me.z;this.body.y=me.y;this.body.vy=me.vy;this.body.grounded=me.grounded;this.correction={x:0,z:0};}
  else {this.correction.x=dx;this.correction.z=dz;}
  if(performance.now()>this.jumpPendingUntil&&Math.abs(me.y-this.body.y)>.5){this.body.y=me.y;this.body.vy=me.vy;this.body.grounded=me.grounded;}
  if(me.hp<=0){this.body.x=me.x;this.body.y=me.y;this.body.z=me.z;this.correction={x:0,z:0};}
  resolveWorld(this.body);
 }
 private predict(me:PlayerState,dt:number,now:number){
  if(me.hp<=0)return;
  const i=this.options.input,rolling=now-Math.max(me.dodgeAt,this.predicted.dodgeAt)<550;
  if(!i.sprint||i.block||rolling||Math.hypot(i.x,i.z)<.01||me.stamina<=0)this.sprinting=false;
  else if(me.stamina>=10)this.sprinting=true;
  const direction=rolling?this.rollDirection:i;
  const speed=getHero(me.hero).speed*speedBonus(me.skills)*(me.upgrades.boots?1.2:1)*(i.aim?.65:1)*(rolling?2.6:this.sprinting?1.7:i.block?.4:1)*(now-Math.max(me.attackAt,this.predicted.attackAt)<400?.62:now-Math.max(me.useAt,this.predicted.useAt)<650?.45:1);
  integrateBody(this.body,direction,speed,dt);
  const correctionBlend=Math.min(1,dt*7);this.body.x+=this.correction.x*correctionBlend;this.body.z+=this.correction.z*correctionBlend;this.correction.x*=1-correctionBlend;this.correction.z*=1-correctionBlend;resolveWorld(this.body);
  const snapshot=this.options.getSnapshot().state;
  for(const other of snapshot?.players??[]){
    if(other.id===me.id||other.hp<=0||Math.abs(other.y-this.body.y)>PLAYER_HEIGHT-.15)continue;
    const dx=this.body.x-other.x,dz=this.body.z-other.z,d=Math.hypot(dx,dz),minimum=PLAYER_RADIUS*2;
    if(d<minimum){this.body.x=other.x+(d>.00001?dx/d:1)*minimum;this.body.z=other.z+(d>.00001?dz/d:0)*minimum;resolveWorld(this.body);}
  }
 }
 private visualMe(me:PlayerState,now:number):PlayerState{
  const recent=now-this.predicted.attackAt<1100&&this.predicted.attackId>=me.attackId;
  return {...me,...this.body,angle:this.yaw,weapon:this.options.input.equip,block:this.options.input.block&&me.weapon!=='bow'&&me.stamina>0,
    aiming:this.options.input.aim,sprint:this.sprinting,moving:Math.hypot(this.options.input.x,this.options.input.z)>.01,
    ...(recent?{attackAt:this.predicted.attackAt,attackId:this.predicted.attackId,attackWeapon:this.predicted.attackWeapon,attackAim:this.predicted.attackAim,attackPitch:this.predicted.attackPitch,combo:this.predicted.combo}:{}),
    specialAt:Math.max(me.specialAt,this.predicted.specialAt),jumpAt:Math.max(me.jumpAt,this.predicted.jumpAt),dodgeAt:Math.max(me.dodgeAt,this.predicted.dodgeAt),
    useAt:Math.max(me.useAt,this.predicted.useAt),usedItem:this.predicted.useAt>me.useAt?this.predicted.usedItem:me.usedItem};
 }
 private effect(p:PlayerState,now:number){
  if(this.lastEffects.get(p.id)===p.attackId)return;this.lastEffects.set(p.id,p.attackId);
  if(p.attackId===0||now-p.attackAt>700)return;
  const special=p.specialAt===p.attackAt,kind=special&&p.hero!=='alyosha'?'shock':p.attackWeapon==='bow'?'arrow':'slash';
  const material=new T.MeshBasicMaterial({color:special?'#ffcf7f':'#e7e9d7',transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false});
  const geometry=kind==='shock'?new T.RingGeometry(.9,1,64):kind==='arrow'?new T.ConeGeometry(.06,1.5,8):new T.TorusGeometry(1.15,.025,8,40,Math.PI*.8);
  const m=new T.Mesh(geometry,material);m.position.set(p.x,p.y+(kind==='shock'?.12:2),p.z);
  if(kind==='arrow'){
    const pitch=p.attackAim?p.attackPitch:0,dir=new T.Vector3(Math.sin(p.angle)*Math.cos(pitch),-Math.sin(pitch),Math.cos(p.angle)*Math.cos(pitch));
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir);m.position.set(p.x-Math.cos(p.angle)*.75,p.y+2.55,p.z+Math.sin(p.angle)*.75);
  }
  else if(kind==='shock')m.rotation.set(-Math.PI/2,0,p.angle-Math.PI/2);
  else {const side=p.combo%2?-1:1;m.position.x+=Math.sin(p.angle)*1.4-Math.cos(p.angle)*side*.55;m.position.z+=Math.cos(p.angle)*1.4+Math.sin(p.angle)*side*.55;m.rotation.set(0,p.angle,side*.8);}
  this.scene.add(m);this.effects.push({mesh:m,age:kind==='arrow'?-.24:-.15,kind,angle:p.angle,pitch:p.attackAim?p.attackPitch:0});m.visible=false;
 }
 private showDamage(p:PlayerState){
  if(p.hitAmount<=0)return;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const ctx=canvas.getContext('2d')!;
  ctx.font='bold 62px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=9;ctx.strokeStyle='#25160f';ctx.strokeText(`−${p.hitAmount}`,128,48);ctx.fillStyle=p.id===this.options.playerId?'#ff7474':'#ffe397';ctx.fillText(`−${p.hitAmount}`,128,48);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.position.set(p.x,p.y+4.3,p.z);sprite.scale.set(2.3,.86,1);sprite.renderOrder=20;this.scene.add(sprite);this.damageNumbers.push({sprite,age:0,targetId:p.id});
 }
 private label(p:PlayerState,f:Fighter){
  if(p.id===this.options.playerId)return;
  let sprite=this.labels.get(p.id);
  if(!sprite){sprite=new T.Sprite(new T.SpriteMaterial({transparent:true,depthTest:true}));sprite.position.y=4;sprite.scale.set(2.5,.55,1);f.root.add(sprite);this.labels.set(p.id,sprite);}
  sprite.visible=p.hp>0;if(sprite.userData.hp===p.hp)return;sprite.userData.hp=p.hp;
  const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d')!;ctx.fillStyle='#142019b8';ctx.beginPath();ctx.roundRect(5,1,246,59,8);ctx.fill();ctx.fillStyle='#e5e4c9';ctx.font='17px Arial';ctx.textAlign='center';ctx.fillText(p.name+(p.bot?' · бот':''),128,25);ctx.fillStyle='#46513a';ctx.fillRect(18,38,220,6);ctx.fillStyle='#cf9c7c';ctx.fillRect(18,38,220*p.hp/maxHealth(p.hero,p.skills),6);const m=sprite.material;m.map?.dispose();m.map=new T.CanvasTexture(c);m.needsUpdate=true;
 }
 private updateCamera(f:Fighter,dt:number){
  const p=f.root.position,forward=new T.Vector3(Math.sin(this.yaw),0,Math.cos(this.yaw)),right=new T.Vector3(-Math.cos(this.yaw),0,Math.sin(this.yaw));
  const pivot=new T.Vector3(p.x,this.body.y+2.55,p.z).addScaledVector(right,.75);
  const offset=new T.Vector3(-forward.x*Math.cos(this.pitch),Math.sin(this.pitch),-forward.z*Math.cos(this.pitch));
  const wantedDistance=this.options.input.aim?Math.min(this.distance,5):this.distance;
  const targetFov=this.options.input.aim?35:56;this.camera.fov=T.MathUtils.lerp(this.camera.fov,targetFov,Math.min(1,dt*10));this.camera.updateProjectionMatrix();
  this.ray.set(pivot,offset);this.ray.far=wantedDistance;
  const obstruction=this.ray.intersectObjects(this.world.cameraObstacles,true).find(hit=>hit.distance>.15);
  const distance=obstruction?Math.max(.6,Math.min(wantedDistance,obstruction.distance-.3)):wantedDistance;
  const desired=pivot.clone().addScaledVector(offset,distance);desired.y=Math.max(.5,desired.y);
  if(!this.cameraReady||distance<wantedDistance-.5)this.camera.position.copy(desired);else this.camera.position.lerp(desired,Math.min(1,dt*14));this.cameraReady=true;
  f.root.visible=!this.options.input.aim&&distance>2.15;this.camera.lookAt(pivot);this.el.dataset.cameraYaw=this.yaw.toFixed(3);this.el.dataset.cameraPitch=this.pitch.toFixed(3);
 }
 private interpolatePlayer(current:PlayerState,renderTime:number):PlayerState {
  if(this.history.length<2)return current;
  let older=this.history[0],newer=this.history[this.history.length-1];
  for(let i=1;i<this.history.length;i++)if(this.history[i].now>=renderTime){older=this.history[i-1];newer=this.history[i];break;}
  const a=older.players.find(p=>p.id===current.id),b=newer.players.find(p=>p.id===current.id);
  if(!a||!b||a.hp<=0||b.hp<=0||Math.hypot(b.x-a.x,b.z-a.z)>10)return current;
  const span=Math.max(1,newer.now-older.now),past=Math.max(0,renderTime-newer.now);
  const t=T.MathUtils.clamp((renderTime-older.now)/span,0,b.moving?1+Math.min(past,80)/span:1),diff=Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle));
  const projected:Body={x:T.MathUtils.lerp(a.x,b.x,t),y:T.MathUtils.lerp(a.y,b.y,Math.min(t,1)),z:T.MathUtils.lerp(a.z,b.z,t),vy:b.vy,grounded:b.grounded};
  if(t>1)resolveWorld(projected);
  return {...current,...projected,angle:a.angle+diff*Math.min(t,1),moving:a.moving||b.moving};
 }
 private frame=(time:number)=>{
  if(this.disposed)return;if(document.hidden&&time-this.lastFrame<90){this.raf=requestAnimationFrame(this.frame);return;}const dt=Math.min(.045,(time-this.lastFrame)/1000);this.lastFrame=time;
  this.updateInput();const {state}=this.options.getSnapshot();
  if(state){
    if(state!==this.lastSnapshot){
      if(this.lastSnapshot)for(const p of state.players){const old=this.lastSnapshot.players.find(previous=>previous.id===p.id);if(old&&p.hitId>old.hitId)this.showDamage(p);}
      this.reconcile(state);this.lastSnapshot=state;this.history.push(state);if(this.history.length>8)this.history.shift();
    }
    const now=this.now(),me=state.players.find(p=>p.id===this.options.playerId);
    if(me&&!state.winner)this.predict(me,dt,now);
    const ids=new Set(state.players.map(p=>p.id));
    for(const [id,f]of this.fighters)if(!ids.has(id)){this.scene.remove(f.root);disposeObject(f.root);this.fighters.delete(id);this.labels.delete(id);}
    for(const authoritative of state.players){
      const p=authoritative.id===this.options.playerId?this.visualMe(authoritative,now):this.interpolatePlayer(authoritative,now-110);
      let f=this.fighters.get(p.id);if(!f){f=createFighter(p.hero,p.skin,p.id===this.options.playerId,p.appearance,p.styleLevel);f.root.position.set(p.x,p.y,p.z);this.scene.add(f.root);this.fighters.set(p.id,f);}
      animateFighter(f,p,dt,now,p.moving);this.effect(p,now);this.label(p,f);
    }
    const mine=this.fighters.get(this.options.playerId);if(mine)this.updateCamera(mine,dt);
    this.world.pickups.forEach((g,id)=>{g.visible=(state.pickups[id]??0)<=now;});
  }
  for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.age+=dt;e.mesh.visible=e.age>=0;
    (e.mesh.material as T.MeshBasicMaterial).opacity=Math.max(0,e.kind==='arrow'?.8*(1-e.age/.85):.8-e.age*1.8);
    if(e.kind==='shock')e.mesh.scale.setScalar(1+Math.max(0,e.age)*11);
    if(e.kind==='arrow'&&e.age>=0){e.mesh.position.x+=Math.sin(e.angle)*Math.cos(e.pitch)*dt*31;e.mesh.position.z+=Math.cos(e.angle)*Math.cos(e.pitch)*dt*31;e.mesh.position.y-=Math.sin(e.pitch)*dt*31;}
    if(e.age>(e.kind==='arrow'?.85:.55)){this.scene.remove(e.mesh);disposeObject(e.mesh);this.effects.splice(i,1);}
  }
  for(let i=this.damageNumbers.length-1;i>=0;i--){const item=this.damageNumbers[i];item.age+=dt;const target=this.fighters.get(item.targetId);if(target){item.sprite.position.x=target.root.position.x;item.sprite.position.z=target.root.position.z;item.sprite.position.y=target.root.position.y+4.3+item.age*.85;}(item.sprite.material as T.SpriteMaterial).opacity=Math.max(0,1-Math.max(0,item.age-.55)/.5);if(item.age>1.05){this.scene.remove(item.sprite);disposeObject(item.sprite);this.damageNumbers.splice(i,1);}}
  this.world.update(dt,time/1000);this.renderer.render(this.scene,this.camera);this.raf=requestAnimationFrame(this.frame);
 };
 destroy(){this.damageNumbers.forEach(item=>{this.scene.remove(item.sprite);disposeObject(item.sprite);});this.damageNumbers=[];this.disposed=true;cancelAnimationFrame(this.raf);this.observer.disconnect();this.removers.forEach(fn=>fn());if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();disposeObject(this.scene);this.renderer.dispose();this.renderer.domElement.remove();}
}
