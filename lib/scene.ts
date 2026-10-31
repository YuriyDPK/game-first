import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cosmeticStyle, DEFAULT_APPEARANCE, type Appearance } from './cosmetics';
import { getHero, SKINS, WEAPONS, defaultWeapon, type WeaponId, type HeroId, type PlayerState } from './heroes';

function material(color: string | number, metalness = 0, roughness = .7) { return new T.MeshStandardMaterial({ color, metalness, roughness }); }
function mesh(geometry: T.BufferGeometry, mat: T.Material, parent: T.Object3D, x=0,y=0,z=0) {
  const m = new T.Mesh(geometry,mat); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function sphere(parent: T.Object3D, mat: T.Material, x:number,y:number,z:number, sx:number,sy:number,sz:number) { const m = mesh(new T.SphereGeometry(1,32,24),mat,parent,x,y,z);m.scale.set(sx,sy,sz);return m; }
function cylinder(parent:T.Object3D,mat:T.Material,rt:number,rb:number,h:number,x:number,y:number,z:number) {return mesh(new T.CylinderGeometry(rt,rb,h,32),mat,parent,x,y,z);}
function chainTexture() {
  const c = document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#535b59';ctx.fillRect(0,0,128,128);
  for(let y=-8;y<136;y+=12) for(let x=-8;x<136;x+=12){ctx.strokeStyle='#242b2c';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x+(y%24?6:0),y,4,6,-.35,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#a1aaa5';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x+(y%24?6:0)-1,y-1,3,5,-.35,Math.PI,Math.PI*2);ctx.stroke();}
  const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(3,4);tex.colorSpace=T.SRGBColorSpace;return tex;
}
export type Fighter = { root:T.Group; body:T.Group; leftLeg:T.Group; rightLeg:T.Group; leftKnee:T.Group; rightKnee:T.Group; arm:T.Group; leftArm:T.Group; elbow:T.Group; leftElbow:T.Group; hand:T.Group; leftHand:T.Group; armor:T.Group; boots:T.Group[]; shield:T.Group; weapons:Record<WeaponId,T.Group>; flask:T.Group; cape:T.Mesh; ring:T.Mesh; lastHp:number; phase:number; moveBlend:number; levelBadges:T.Group[] };
export function createFighter(heroId:HeroId,skinId:string,mine:boolean,appearance:Appearance=DEFAULT_APPEARANCE,styleLevel=1):Fighter {
  const hero=getHero(heroId),skin=SKINS.find(s=>s.id===skinId)??SKINS[0];
  const root=new T.Group(), steel=material(skin.metal,.8,.34), gold=material(skin.gold,.8,.3), dark=material('#302b25',.1), cloth=material(skin.color||hero.color), flesh=material('#b58b69',0,.8), hair=material(heroId==='ilya'?'#352820':heroId==='alyosha'?'#9a7546':'#67402d');
  const mail=new T.MeshStandardMaterial({map:chainTexture(),metalness:.7,roughness:.6});
  steel.map=surfaceTexture('metal');steel.bumpMap=steel.map;steel.bumpScale=.025;steel.roughness=.48;cloth.map=surfaceTexture('cloth');
  const body=sphere(root,mail,0,1.72,0,.47,.57,.27);
  if(heroId==='ilya')body.scale.x=.55;
  cylinder(root,cloth,.4,.52,.58,0,1.19,0);
  for(let i=0;i<10;i++) {const a=i*Math.PI/5;const plate=mesh(new T.BoxGeometry(.19,.43,.045),steel,root,Math.sin(a)*.44,1.13,Math.cos(a)*.29);plate.rotation.y=a;}
  for(let row=0;row<4;row++) for(let col=0;col<5;col++){const x=(col-2)*.16;const z=.27*Math.sqrt(Math.max(.2,1-x*x/.3));const plate=mesh(new RoundedBoxGeometry(.155,.2,.065,3,.018),steel,root,x,1.55+row*.15,z);plate.rotation.y=-x*.55;sphere(root,gold,x,1.61+row*.15,z+.04,.012,.012,.009);for(const side of [-1,1])sphere(root,gold,x+side*.05,1.48+row*.15,z+.035,.008,.008,.007);}
  cylinder(root,dark,.435,.44,.15,0,1.38,0);mesh(new T.BoxGeometry(.18,.16,.04),gold,root,0,1.38,.44);
  const leftLeg=new T.Group(),rightLeg=new T.Group();
  [leftLeg,rightLeg].forEach((leg,i)=>{leg.position.set(i===0?-.23:.23,1.05,0);root.add(leg);sphere(leg,mail,0,-.2,0,.18,.32,.18);sphere(leg,steel,0,-.48,.03,.17,.16,.18);cylinder(leg,dark,.145,.17,.45,0,-.68,0);sphere(leg,dark,0,-.89,.11,.18,.15,.27);cylinder(leg,gold,.15,.15,.045,0,-.55,0);});
  const arm=new T.Group(),leftArm=new T.Group();
  const hands=[leftArm,arm].map((a,i)=>{
    a.position.set(i===0?-.53:.53,2.02,0);a.rotation.z=i===0?-.12:.12;root.add(a);
    sphere(a,steel,0,-.02,0,.225,.19,.25);sphere(a,mail,0,-.28,0,.17,.31,.17);sphere(a,steel,0,-.56,.03,.17,.25,.18);cylinder(a,gold,.175,.175,.05,0,-.72,.03);
    const hand=new T.Group();hand.position.set(0,-.8,.05);a.add(hand);
    sphere(hand,flesh,0,0,0,.11,.13,.1);
    for(let finger=0;finger<4;finger++){const digit=sphere(hand,flesh,(finger-1.5)*.041,-.045,.055,.026,.055,.04);digit.rotation.x=-.55;}
    const thumb=sphere(hand,flesh,i===0?.095:-.095,-.015,.055,.035,.065,.045);thumb.rotation.z=i===0?-.6:.6;
    return hand;
  });
  const [leftHand,hand]=hands;
  hand.rotation.set(1.35,0,-.12);
  const headStart=root.children.length;
  cylinder(root,mail,.18,.2,.25,0,2.22,0);sphere(root,flesh,0,2.54,.02,.235,.29,.225);sphere(root,flesh,0,2.53,.24,.055,.085,.075);
  for(const x of [-.085,.085]){sphere(root,material('#e7d5b6'),x,2.59,.219,.042,.025,.018);sphere(root,material('#343b31'),x,2.59,.235,.015,.017,.01);}
  sphere(root,hair,0,2.34,.12,.2,heroId==='alyosha'?.045:.16,.155);
  for(const x of [-.24,.24])sphere(root,flesh,x,2.53,.015,.045,.075,.037);
  for(const side of [-1,1]){const brow=sphere(root,hair,side*.085,2.635,.22,.063,.017,.025);brow.rotation.z=side*.15;sphere(root,flesh,side*.11,2.49,.19,.07,.08,.04);} 
  const strandDark=material('#48372b'),strandLight=material('#5c4431');
  if(heroId!=='alyosha')for(let i=0;i<23;i++){const x=(i-11)*.015;const y=2.245+Math.abs(i-11)*.009;const strand=sphere(root,i%3?strandDark:strandLight,x,y,.22-Math.abs(x)*.15,.018,.11,.026);strand.rotation.z=-x*2;}
  if(heroId!=='alyosha'){
  const profile=[new T.Vector2(0,0),new T.Vector2(.25,0),new T.Vector2(.255,.16),new T.Vector2(.22,.3),new T.Vector2(.14,.43),new T.Vector2(.04,.55),new T.Vector2(0,.62)];
  mesh(new T.LatheGeometry(profile,48),steel,root,0,2.67,-.015);
  const rim=mesh(new T.TorusGeometry(.255,.025,12,48),gold,root,0,2.7,-.015);rim.rotation.x=Math.PI/2;
  mesh(new T.BoxGeometry(.045,.24,.035),gold,root,0,2.64,.247);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;sphere(root,gold,Math.sin(a)*.257,2.73,Math.cos(a)*.257,.019,.025,.019);}
  }else{sphere(root,hair,0,2.78,-.02,.25,.15,.23);for(let i=0;i<18;i++){const a=i*Math.PI*2/18;sphere(root,hair,Math.sin(a)*.22,2.77+Math.sin(i*5)*.04,Math.cos(a)*.2,.065,.08,.07);}}
  const headParts=root.children.slice(headStart),head=new T.Group();head.position.y=2.2;root.add(head);for(const part of headParts){part.position.y-=2.2;head.add(part);}head.scale.setScalar(.85);
  const headStyle=cosmeticStyle(appearance.head);
  if(headStyle==='plume'||headStyle==='crown'){
    if(heroId==='alyosha')sphere(head,steel,0,.65,-.02,.27,.22,.25);
    const rim=mesh(new T.TorusGeometry(.27,.028,12,40),gold,head,0,.51,0);rim.rotation.x=Math.PI/2;
    if(headStyle==='plume'){
      const plumeMat=material(heroId==='ilya'?'#ad4838':heroId==='dobrynya'?'#527c96':'#77945c');
      for(let i=0;i<7;i++){const feather=sphere(head,plumeMat,0,.86+i*.035,-.03-i*.045,.075,.18,.07);feather.rotation.x=-.5;}
      mesh(new T.BoxGeometry(.06,.25,.05),gold,head,0,.47,.255);
    }else{
      for(let i=0;i<8;i++){const a=i*Math.PI/4;const spike=mesh(new T.ConeGeometry(.045,.22,12),gold,head,Math.sin(a)*.23,.78,Math.cos(a)*.23);spike.rotation.z=-Math.sin(a)*.2;}
      sphere(head,material('#68baca',.5,.25),0,.62,.26,.075,.09,.035);
    }
  }
  const levelBadges:T.Group[]=[];
  for(let i=0;i<12;i++){
    const badge=new T.Group();badge.position.set((i%6-2.5)*.068,.52+Math.floor(i/6)*.09,.272);head.add(badge);
    sphere(badge,gold,0,0,0,.026,.026,.016);badge.userData.requiredLevel=i+2;badge.visible=styleLevel>=i+2;levelBadges.push(badge);
  }
  // Rank decorations accumulate as this class gains levels.
  for(const [required,x] of [[2,-.52],[3,.52]] as const){const pauldron=new T.Group();pauldron.position.set(x,2.14,0);root.add(pauldron);const plate=sphere(pauldron,gold,0,0,0,.25,.11,.25);plate.scale.y=.8;pauldron.userData.requiredLevel=required;pauldron.visible=styleLevel>=required;levelBadges.push(pauldron);}
  const sash=new T.Group();sash.position.set(0,1.76,.3);root.add(sash);const trim=mesh(new T.BoxGeometry(.08,.82,.04),gold,sash);trim.rotation.z=.72;for(let i=0;i<4;i++)sphere(sash,gold,(i-1.5)*.13,(i-1.5)*.14,.025,.035,.035,.02);sash.userData.requiredLevel=4;sash.visible=styleLevel>=4;levelBadges.push(sash);
  const crest=new T.Group();crest.position.set(0,.86,.05);head.add(crest);const star=mesh(new T.OctahedronGeometry(.12,1),gold,crest);star.scale.set(.7,1.2,.45);crest.userData.requiredLevel=5;crest.visible=styleLevel>=5;levelBadges.push(crest);
  const capeGeo=new T.PlaneGeometry(1.2,1.7,14,22),pos=capeGeo.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,Math.sin(x*15)*.045+( .85-y)*.17);pos.setX(i,x*(1+(.85-y)*.25));}capeGeo.computeVertexNormals();
  const capeMat=new T.MeshStandardMaterial({color:skin.color||hero.color,map:surfaceTexture('cloth'),side:T.DoubleSide,roughness:.95});
  const cape=mesh(capeGeo,capeMat,root,0,1.35,-.3);cape.rotation.y=Math.PI;
  sphere(root,gold,-.35,2.09,.17,.08,.08,.035);sphere(root,gold,.35,2.09,.17,.08,.08,.035);
    const shield=new T.Group();leftArm.add(shield);shield.position.set(-.12,-.53,.28);
    const shieldStyle=cosmeticStyle(appearance.shield);
    if(shieldStyle==='kite'){
      const shape=new T.Shape();shape.moveTo(-.52,.52);shape.quadraticCurveTo(0,.72,.52,.52);shape.lineTo(.45,-.23);shape.quadraticCurveTo(.35,-.58,0,-.83);shape.quadraticCurveTo(-.35,-.58,-.45,-.23);shape.closePath();
      mesh(new T.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3}),steel,shield,0,0,0);
      mesh(new T.BoxGeometry(.055,1,.03),gold,shield,0,-.06,.13);mesh(new T.BoxGeometry(.7,.055,.03),gold,shield,0,.15,.13);sphere(shield,gold,0,.15,.15,.15,.15,.1);
    }else{
      const disk=cylinder(shield,dark,.56,.56,.09,0,0,0);disk.rotation.x=Math.PI/2;
      const face=cylinder(shield,steel,.52,.52,.035,0,0,.06);face.rotation.x=Math.PI/2;
      mesh(new T.TorusGeometry(.54,.035,12,64),gold,shield,0,0,.08);sphere(shield,gold,0,0,.1,.15,.15,.12);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;const line=mesh(new T.BoxGeometry(shieldStyle==='rune'?.055:.025,.32,.02),gold,shield,Math.sin(a)*.3,Math.cos(a)*.3,.09);line.rotation.z=-a;sphere(shield,gold,Math.sin(a)*.46,Math.cos(a)*.46,.1,.02,.02,.015);}
      if(shieldStyle==='rune'){const emblem=mesh(new T.TorusGeometry(.35,.028,10,48),gold,shield,0,0,.12);sphere(shield,material('#61bbc7',.4,.25),0,0,.18,.09,.09,.05);emblem.rotation.z=Math.PI/4;}
    }

  const weapons={} as Record<WeaponId,T.Group>;
  for(const id of ['mace','sword','bow'] as WeaponId[]){
    const weapon=new T.Group();(id==='bow'?leftHand:hand).add(weapon);weapon.position.y=id==='mace'?-.12:id==='sword'?-.08:-.15;weapons[id]=weapon;weapon.visible=id===defaultWeapon(heroId);
    if(id==='mace'){
      cylinder(weapon,dark,.045,.045,.95,0,.25,0);cylinder(weapon,gold,.06,.06,.08,0,-.15,0);sphere(weapon,steel,0,.84,0,.25,.3,.25);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;const flange=mesh(new RoundedBoxGeometry(.04,.42,.19,2,.015),gold,weapon,Math.sin(a)*.21,.84,Math.cos(a)*.21);flange.rotation.y=a;}
    }else if(id==='sword'){
      cylinder(weapon,dark,.045,.045,.3,0,.1,0);mesh(new RoundedBoxGeometry(.43,.07,.08,2,.018),gold,weapon,0,.29,0);const blade=mesh(new RoundedBoxGeometry(.13,1.18,.045,2,.012),steel,weapon,0,.91,0);blade.rotation.z=-.025;mesh(new T.ConeGeometry(.07,.2,4),steel,weapon,0,1.59,0);
    }else{
      const curve=new T.CatmullRomCurve3([new T.Vector3(0,-.65,0),new T.Vector3(.25,-.3,0),new T.Vector3(.3,0,0),new T.Vector3(.25,.3,0),new T.Vector3(0,.75,0)]);
      mesh(new T.TubeGeometry(curve,40,.035,12,false),dark,weapon,0,.15,0);
      const string=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,-.5,0),new T.Vector3(0,.15,0),new T.Vector3(0,.9,0)]),new T.LineBasicMaterial({color:'#c9c4a8'}));weapon.add(string);weapon.userData.string=string;
      const arrow=new T.Group();arrow.position.set(0,.15,-.1);weapon.add(arrow);const shaft=cylinder(arrow,dark,.014,.014,1.3,0,0,.15);shaft.rotation.x=Math.PI/2;const tip=mesh(new T.ConeGeometry(.045,.16,12),steel,arrow,0,0,.85);tip.rotation.x=Math.PI/2;const feathers=mesh(new T.BoxGeometry(.16,.025,.18),cloth,arrow,0,0,-.48);feathers.rotation.z=.3;arrow.visible=false;weapon.userData.arrow=arrow;
    }
  }
  for(const id of ['mace','sword','bow'] as WeaponId[]){const upgrade=new T.Group();upgrade.visible=false;weapons[id].add(upgrade);const ring=mesh(new T.TorusGeometry(.08,.025,10,32),gold,upgrade,0,.24,0);ring.rotation.x=Math.PI/2;const jewel=mesh(new T.OctahedronGeometry(.09,2),material('#5ccad4',.4,.25),upgrade,0,.25,.07);jewel.scale.y=1.4;weapons[id].userData.upgrade=upgrade;}
  const armor=new T.Group();armor.position.y=1.7;root.add(armor);const armorPlate=mesh(new T.SphereGeometry(1,32,24),gold,armor,0,0,.255);armorPlate.scale.set(.4,.47,.12);const emblem=mesh(new T.TorusGeometry(.21,.025,10,40),steel,armor,0,0,.38);sphere(armor,steel,0,0,.39,.065,.065,.035);armor.visible=false;
  const boots=[leftLeg,rightLeg].map(leg=>{const group=new T.Group();group.position.y=-.72;leg.add(group);const cuff=mesh(new T.TorusGeometry(.16,.035,10,32),gold,group,0,0,0);cuff.rotation.x=Math.PI/2;sphere(group,gold,0,-.16,.1,.19,.13,.25);group.visible=false;return group;});
  const quiver=cylinder(root,dark,.14,.12,.7,.33,1.71,-.45);quiver.rotation.z=-.3;
  for(let i=0;i<5;i++){const shaft=cylinder(root,dark,.012,.012,.6,.26+i*.04,2.18,-.45);shaft.rotation.z=-.3;sphere(root,cloth,.17+i*.04,2.47,-.45,.025,.1,.06);}
  const flask=new T.Group();flask.position.set(0,-.05,.08);leftHand.add(flask);cylinder(flask,material('#7ca99a',.25,.3),.075,.075,.2,0,.04,0);cylinder(flask,gold,.04,.04,.09,0,.18,0);flask.visible=false;
  for(const child of [...root.children])if(child!==leftLeg&&child!==rightLeg)child.position.y+=.28;for(const leg of [leftLeg,rightLeg]){leg.position.y=1.33;leg.scale.y=1.3;}
  const knees=[leftLeg,rightLeg].map(leg=>{const knee=new T.Group();knee.position.y=-.44;const parts=leg.children.filter(p=>p.position.y<=-.44);leg.add(knee);for(const part of parts){part.position.y+=.44;knee.add(part);}return knee;});
  const elbows=[arm,leftArm].map(a=>{const elbow=new T.Group();elbow.position.y=-.41;const parts=a.children.filter(p=>p.position.y<=-.4);a.add(elbow);for(const part of parts){part.position.y+=.41;elbow.add(part);}return elbow;});
  const upper=new T.Group();upper.position.y=1.6;const upperParts=root.children.filter(c=>c!==leftLeg&&c!==rightLeg);root.add(upper);for(const part of upperParts){part.position.y-=1.6;upper.add(part);}
  cape.userData.restPositions=Float32Array.from(cape.geometry.attributes.position.array);
  const ring=mesh(new T.RingGeometry(.6,.67,64),new T.MeshBasicMaterial({color:mine?'#e3c789':'#bd644d',side:T.DoubleSide,transparent:true,opacity:.7}),root,0,.025,0);ring.rotation.x=-Math.PI/2;
  root.userData.mine=mine;
  root.scale.setScalar(heroId==='ilya'?1.13:1.04);
  shield.visible=defaultWeapon(heroId)!=='bow';
  mergeRigidMeshes(root);
  return {root,body:upper,leftLeg,rightLeg,leftKnee:knees[0],rightKnee:knees[1],arm,leftArm,elbow:elbows[0],leftElbow:elbows[1],hand,leftHand,armor,boots,shield,weapons,flask,cape,ring,lastHp:hero.hp,phase:0,moveBlend:0,levelBadges};
}

function surfaceTexture(kind:'metal'|'cloth'|'wood'){
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;
 ctx.fillStyle=kind==='metal'?'#a4a79b':kind==='wood'?'#8c7760':'#d6d1b8';ctx.fillRect(0,0,256,256);
 let seed=231;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
 for(let i=0;i<6000;i++){ctx.fillStyle=rand()>.5?'#ffffff20':'#00000024';const x=rand()*256,y=rand()*256;ctx.fillRect(x,y,kind==='cloth'?1:rand()*2+.3,kind==='cloth'?rand()*3:rand()*24+1);}
 if(kind==='cloth'){ctx.strokeStyle='#33332218';ctx.lineWidth=.6;for(let i=0;i<256;i+=3){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}}
 if(kind==='metal'){ctx.strokeStyle='#ede3b130';ctx.lineWidth=1.6;for(let x=15;x<256;x+=45)for(let y=15;y<256;y+=45){ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*1.5);ctx.stroke();ctx.beginPath();ctx.arc(x+7,y,5,0,Math.PI*1.8);ctx.stroke();}}
 if(kind==='wood'){ctx.strokeStyle='#2b241e66';for(let x=0;x<256;x+=9){ctx.beginPath();ctx.moveTo(x,0);for(let y=0;y<256;y+=8)ctx.lineTo(x+Math.sin(y*.04+x)*3,y);ctx.stroke();}}
 const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;if(kind==='metal')tex.repeat.set(1,1);if(kind==='cloth')tex.repeat.set(3,3);return tex;
}
function groundTexture(){const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d')!;ctx.fillStyle='#746d54';ctx.fillRect(0,0,512,512);let seed=18;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};for(let y=0;y<512;y+=42)for(let x=-40;x<512;x+=65){const xx=x+(y%84?32:0);ctx.fillStyle=`hsl(43 10% ${36+rand()*18}%)`;ctx.beginPath();ctx.roundRect(xx+3,y+3,59,36,5);ctx.fill();ctx.strokeStyle='#3d3d30';ctx.lineWidth=2;ctx.stroke();}for(let i=0;i<12000;i++){ctx.fillStyle=rand()>.5?'#ffffff09':'#00000012';ctx.fillRect(rand()*512,rand()*512,rand()*3+1,rand()*3+1);}const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(16,16);t.colorSpace=T.SRGBColorSpace;return t;}
export { createWorld } from './map-scene';
export function animateFighter(f:Fighter,p:PlayerState,dt:number,now:number,moving:boolean){
  const blend=Math.min(1,dt*18),alive=p.hp>0;
  f.levelBadges.forEach(badge=>badge.visible=p.styleLevel>=badge.userData.requiredLevel);
  f.root.position.lerp(new T.Vector3(p.x,p.y,p.z),Math.min(1,dt*(f.root.userData.mine?30:15)));
  const diff=Math.atan2(Math.sin(p.angle-f.root.rotation.y),Math.cos(p.angle-f.root.rotation.y));f.root.rotation.y+=diff*blend;
  const gaitBlend=1-Math.exp(-dt*8);
  f.moveBlend=T.MathUtils.lerp(f.moveBlend,moving&&alive&&p.grounded?1:0,gaitBlend);
  const targetRun=p.sprint&&moving?1:0;
  const run=T.MathUtils.lerp((f.root.userData.runBlend as number|undefined)??0,targetRun,1-Math.exp(-dt*5));f.root.userData.runBlend=run;
  f.phase+=dt*(6.5+run*3.5)*f.moveBlend;
  const gait=Math.sin(f.phase)*(.48+run*.18)*f.moveBlend;
  const legBlend=1-Math.exp(-dt*14);
  f.leftLeg.rotation.x=T.MathUtils.lerp(f.leftLeg.rotation.x,gait,legBlend);f.rightLeg.rotation.x=T.MathUtils.lerp(f.rightLeg.rotation.x,-gait,legBlend);
  f.leftLeg.rotation.y=f.rightLeg.rotation.y=0;f.leftLeg.rotation.z=f.rightLeg.rotation.z=0;
  f.leftKnee.rotation.x=T.MathUtils.lerp(f.leftKnee.rotation.x,Math.max(0,-gait)*1.15,legBlend);f.rightKnee.rotation.x=T.MathUtils.lerp(f.rightKnee.rotation.x,Math.max(0,gait)*1.15,legBlend);
  f.arm.rotation.set(-gait*.5,0,.12);f.leftArm.rotation.set(gait*.5,0,-.12);f.elbow.rotation.x=-.12-.12*f.moveBlend;f.leftElbow.rotation.x=-.12-.12*f.moveBlend;
  f.body.rotation.set(.10*run+Math.sin(now*.0018)*.012,Math.sin(f.phase)*.035*f.moveBlend,Math.sin(f.phase)*.025*f.moveBlend);
  f.root.rotation.x=0;f.root.rotation.z=T.MathUtils.lerp(f.root.rotation.z,alive?0:Math.PI/2,Math.min(1,dt*6));
  const special=now-p.specialAt<900&&p.specialAt===p.attackAt;
  const duration=special?.9:WEAPONS[p.attackWeapon].duration,elapsed=(now-p.attackAt)/1000,attacking=elapsed>=0&&elapsed<duration;
  const equipped=attacking?p.attackWeapon:p.weapon;
  for(const id of ['mace','sword','bow'] as WeaponId[])f.weapons[id].visible=id===equipped;
  f.shield.visible=equipped!=='bow';f.flask.visible=false;f.armor.visible=p.upgrades.armor;f.boots.forEach(b=>b.visible=p.upgrades.boots);for(const id of ['mace','sword','bow'] as WeaponId[])(f.weapons[id].userData.upgrade as T.Group).visible=p.upgrades[id];
  // The grip is a separate joint: its position stays in the palm while the
  // weapon can change direction independently of the forearm.
  f.hand.rotation.set(1.35,0,-.12);f.leftHand.rotation.set(0,0,0);
  f.shield.rotation.x=p.block?1.6:0;
  const bowString=f.weapons.bow.userData.string as T.Line;
  const bowArrow=f.weapons.bow.userData.arrow as T.Group;
  bowString.geometry.attributes.position.setZ(1,0);bowString.geometry.attributes.position.needsUpdate=true;bowArrow.visible=false;
  f.root.position.y+=(1-Math.cos(f.phase*2))*.018*f.moveBlend*(p.grounded?1:0);
  if(!p.grounded&&alive){f.leftLeg.rotation.x=-.35;f.rightLeg.rotation.x=.45;f.leftKnee.rotation.x=.8;f.rightKnee.rotation.x=.9;f.arm.rotation.z=.35;f.leftArm.rotation.z=-.35;f.body.rotation.x=p.vy>0?-.12:.16;}
  if(p.aiming&&alive&&equipped==='bow'&&!attacking){f.leftArm.rotation.set(-1.25,-.15,-.12);f.leftElbow.rotation.x=-.12;f.leftHand.rotation.x=1.37;f.arm.rotation.set(-1.1,.4,.5);f.elbow.rotation.x=-.7-.7*p.drawAmount;f.body.rotation.y=-.3;bowString.geometry.attributes.position.setZ(1,-.05-.43*p.drawAmount);bowString.geometry.attributes.position.needsUpdate=true;bowArrow.visible=true;bowArrow.position.z=-.1-.43*p.drawAmount;}
  if(p.block&&alive){f.leftArm.rotation.set(-1.1,.25,-.35);f.leftElbow.rotation.x=-.55;f.arm.rotation.x=-.45;f.body.rotation.y=.25;f.leftLeg.rotation.x=.16;f.rightLeg.rotation.x=-.14;}
  if(attacking&&alive){
    const t=Math.min(1,elapsed/duration),pulse=Math.sin(t*Math.PI);
    const smooth=(x:number)=>{const v=T.MathUtils.clamp(x,0,1);return v*v*(3-2*v);};
    const pose=(rest:number,wind:number,impact:number,finish:number)=>{
      if(t<.3)return T.MathUtils.lerp(rest,wind,smooth(t/.3));
      if(t<.62)return T.MathUtils.lerp(wind,impact,smooth((t-.3)/.32));
      return T.MathUtils.lerp(impact,finish,smooth((t-.62)/.38));
    };
    if(equipped==='bow'){
      const draw=pose(0,1,1,0);
      f.leftArm.rotation.set(-1.25*draw,-.15*draw,-.12);f.leftElbow.rotation.x=-.12;
      // Counter-rotate the wrist so the bow stays upright as the arm rises.
      f.leftHand.rotation.x=1.37*draw;f.arm.rotation.set(-1.15*draw,.45*draw,.5*draw);
      f.elbow.rotation.x=-1.55*draw;f.body.rotation.y=-.3*draw;
      bowString.geometry.attributes.position.setZ(1,-.48*draw);bowString.geometry.attributes.position.needsUpdate=true;
      bowArrow.visible=t<.63;bowArrow.position.z=-.1-.48*draw;
    }else if(equipped==='mace'){
      // A heavy diagonal blow: turn the shoulders, load the arm, strike and recover.
      const side=p.combo%2?-1:1;
      f.arm.rotation.set(pose(-.12,1.05,-1.42,-.12),pose(0,-.48*side,.4*side,0),pose(.12,.6*side,-.32*side,.12));
      f.elbow.rotation.x=pose(-.12,-1.15,-.38,-.12);
      f.hand.rotation.set(pose(1.35,1.05,1.65,1.35),pose(0,-.16*side,.18*side,0),pose(-.12,-.18*side,.12*side,-.12));
      f.body.rotation.x=pose(0,-.13,.22,0);f.body.rotation.y=pose(0,-.5*side,.55*side,0);f.body.rotation.z=pose(0,-.08*side,.14*side,0);
      f.leftArm.rotation.set(pose(0,-.3,-.65,0),pose(0,.1,-.2,0),-.12);
      f.leftLeg.rotation.x=pose(0,.22,-.32,0);f.rightLeg.rotation.x=pose(0,-.28,.28,0);
      f.leftKnee.rotation.x=pose(0,.28,.42,0);f.rightKnee.rotation.x=pose(0,.45,.16,0);
    }else{
      // Alternate diagonal cuts with a visible wind-up and follow-through.
      const side=p.combo%2?-1:1;
      f.arm.rotation.set(pose(0,.65,-1.3,0),pose(0,-.65*side,.55*side,0),pose(.12,-.85*side,.65*side,.12));
      f.elbow.rotation.x=pose(-.12,-1,-.2,-.12);
      f.hand.rotation.set(pose(1.35,-.3,2.5,1.35),pose(0,-.45*side,.45*side,0),pose(-.12,-.5*side,.4*side,-.12));
      f.body.rotation.y=pose(0,-.7*side,.8*side,0);f.body.rotation.x=.18*pulse;
      f.leftArm.rotation.x=pose(0,-.4,-.7,0);f.leftLeg.rotation.x=pose(0,.18,-.28,0);f.rightLeg.rotation.x=pose(0,-.2,.24,0);
    }
    if(special){f.body.rotation.y+=Math.sin(t*Math.PI*2)*.75;f.arm.rotation.x-=.4*pulse;}
  }
  if(now-p.useAt<800&&alive){const t=(now-p.useAt)/800;f.flask.visible=true;f.leftArm.rotation.set(-1.5*Math.sin(t*Math.PI),.1,-.15);f.leftElbow.rotation.x=-1.35*Math.sin(t*Math.PI);}
  const roll=(now-p.dodgeAt)/550;
  f.root.scale.y=f.root.scale.x;
  if(roll>=0&&roll<1&&alive){
    const smooth=(v:number)=>{v=T.MathUtils.clamp(v,0,1);return v*v*(3-2*v);};
    const tuck=smooth(roll/.18)*(1-smooth((roll-.76)/.24));
    const angle=-Math.PI*2*smooth((roll-.12)/.72);
    // Rotate around the tucked torso so the shoulders and head stay near the ground.
    f.root.scale.y=f.root.scale.x*(1-.28*tuck);
    const pivot=1.85*f.root.scale.y,offsetZ=-Math.sin(angle)*pivot;
    f.root.rotation.x=angle;f.root.position.y=p.y+pivot-Math.cos(angle)*pivot-.18*tuck;
    f.root.position.x+=Math.sin(f.root.rotation.y)*offsetZ;f.root.position.z+=Math.cos(f.root.rotation.y)*offsetZ;
    f.leftLeg.rotation.x=T.MathUtils.lerp(f.leftLeg.rotation.x,-1.15,tuck);f.rightLeg.rotation.x=T.MathUtils.lerp(f.rightLeg.rotation.x,-.85,tuck);
    f.leftKnee.rotation.x=T.MathUtils.lerp(f.leftKnee.rotation.x,2.05,tuck);f.rightKnee.rotation.x=T.MathUtils.lerp(f.rightKnee.rotation.x,1.9,tuck);
    f.arm.rotation.set(-1.25*tuck,0,.12+.36*tuck);f.leftArm.rotation.set(-1.1*tuck,0,-.12-.32*tuck);
    f.elbow.rotation.x=-.12-1.05*tuck;f.leftElbow.rotation.x=-.12-.9*tuck;f.body.rotation.x=.15*tuck;
  }
  if(now-p.hitAt<240&&alive){const pulse=Math.sin((now-p.hitAt)/240*Math.PI);f.body.rotation.x-=pulse*.2;f.body.rotation.z+=pulse*.12;}
  const pos=f.cape.geometry.attributes.position,rest=f.cape.userData.restPositions as Float32Array;
  for(let i=0;i<pos.count;i++){const weight=(.85-rest[i*3+1])/1.7;pos.setZ(i,rest[i*3+2]+Math.sin(now*.004+rest[i*3]*6+weight*3)*.055*weight+f.moveBlend*.12*weight);}
  pos.needsUpdate=true;f.cape.geometry.computeVertexNormals();
  f.ring.visible=p.grounded&&alive&&!(roll>=0&&roll<1);f.root.visible=true;
  const ringMaterial=f.ring.material as T.MeshBasicMaterial;
  if(p.hp<f.lastHp){ringMaterial.color.set('#ff6e48');ringMaterial.opacity=1;}
  f.lastHp=p.hp;ringMaterial.color.lerp(new T.Color(f.root.userData.mine?'#e3c789':'#bd644d'),dt*2);ringMaterial.opacity=T.MathUtils.lerp(ringMaterial.opacity,.4,dt*3);
}
export function disposeObject(root:T.Object3D){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
 root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.Sprite){if('geometry' in o)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}}});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}

/** Bake only static meshes within each joint. Geometry detail stays intact. */
function mergeRigidMeshes(root:T.Object3D){
 const groups:T.Group[]=[];root.traverse(o=>{if(o instanceof T.Group)groups.push(o);});
 for(const group of groups){
  const byMaterial=new Map<T.Material,T.Mesh[]>();
  for(const child of [...group.children])if(child instanceof T.Mesh&&!Array.isArray(child.material)){
   const list=byMaterial.get(child.material)??[];list.push(child);byMaterial.set(child.material,list);
  }
  for(const [material,meshes]of byMaterial){
   if(meshes.length<2)continue;
   const geometries=meshes.map(m=>{m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);return g;});
   const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!geometry)continue;
   const merged=new T.Mesh(geometry,material);merged.castShadow=true;merged.receiveShadow=true;group.add(merged);
   meshes.forEach(m=>{group.remove(m);m.geometry.dispose();});
  }
 }
}
