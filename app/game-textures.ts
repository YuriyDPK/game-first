import * as THREE from 'three';

// Small, tileable hand-painted materials. These are created locally so the game
// does not depend on a texture server or disclose any game state to one.
export function makeSurfaceMaterials() {
  let seed = 1986;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function texture(paint: (ctx: CanvasRenderingContext2D, size: number) => void) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!; paint(ctx, 256);
    const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace;
    result.wrapS = result.wrapT = THREE.RepeatWrapping; result.anisotropy = 8;
    return result;
  }
  function flecks(ctx: CanvasRenderingContext2D, amount: number, alpha: number) {
    for (let i = 0; i < amount; i++) { const light = random() > .5; ctx.fillStyle = light ? `rgba(255,255,255,${random()*alpha})` : `rgba(32,35,28,${random()*alpha})`; const size = .5 + random()*2; ctx.fillRect(random()*256, random()*256, size, size); }
  }
  const asphalt = texture(ctx => { ctx.fillStyle='#858a81'; ctx.fillRect(0,0,256,256); flecks(ctx,12000,.15); for(let i=0;i<20;i++){ctx.fillStyle='rgba(57,62,54,.08)';ctx.beginPath();ctx.arc(random()*256,random()*256,random()*11,0,Math.PI*2);ctx.fill();} });
  const paving = texture(ctx => { ctx.fillStyle='#92998e';ctx.fillRect(0,0,256,256);for(let y=0;y<4;y++)for(let x=0;x<4;x++){const tone=170+Math.floor(random()*25);ctx.fillStyle=`rgb(${tone},${tone+1},${tone-8})`;ctx.fillRect(x*64+2,y*64+2,60,60);}flecks(ctx,4500,.1); });
  const grass = texture(ctx => {ctx.fillStyle='#718a57';ctx.fillRect(0,0,256,256);flecks(ctx,11000,.22);for(let i=0;i<1500;i++){ctx.strokeStyle=random()>.5?'rgba(174,185,116,.25)':'rgba(48,82,43,.23)';const x=random()*256,y=random()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*3-1.5,y-2-random()*5);ctx.stroke();}});
  const wood = texture(ctx => {ctx.fillStyle='#a65a3e';ctx.fillRect(0,0,256,256);for(let y=0;y<8;y++){ctx.fillStyle=y%2?'#a95c3e':'#b56847';ctx.fillRect(0,y*32,256,31);ctx.fillStyle='rgba(68,34,25,.38)';ctx.fillRect(0,y*32,256,1);for(let i=0;i<24;i++){const yy=y*32+random()*31;ctx.strokeStyle=`rgba(82,43,29,${.05+random()*.15})`;ctx.beginPath();ctx.moveTo(0,yy);ctx.bezierCurveTo(70,yy+random()*3,180,yy-random()*3,256,yy+random()*2);ctx.stroke();}ctx.fillStyle='rgba(58,35,28,.2)';ctx.fillRect((y%2)*128,y*32,1,32);}flecks(ctx,1800,.06);});
  const doorWood = texture(ctx => {ctx.fillStyle='#71513e';ctx.fillRect(0,0,256,256);for(let x=0;x<256;x+=64){ctx.fillStyle=x%128?'#79563f':'#80604b';ctx.fillRect(x,0,63,256);ctx.fillStyle='rgba(45,29,22,.3)';ctx.fillRect(x,0,2,256);for(let i=0;i<24;i++){const xx=x+random()*64;ctx.strokeStyle=`rgba(35,20,15,${.04+random()*.14})`;ctx.beginPath();ctx.moveTo(xx,0);ctx.bezierCurveTo(xx+random()*5,80,xx-random()*5,170,xx+random()*3,256);ctx.stroke();}}flecks(ctx,1800,.06);});
  const tile = texture(ctx => {ctx.fillStyle='#aeb7a7';ctx.fillRect(0,0,256,256);for(let y=0;y<4;y++)for(let x=0;x<4;x++){const shade=214+Math.floor(random()*10);ctx.fillStyle=`rgb(${shade},${shade-2},${shade-15})`;ctx.fillRect(x*64+2,y*64+2,60,60);}flecks(ctx,2600,.08);});
  const plaster = texture(ctx => {ctx.fillStyle='#e5e5df';ctx.fillRect(0,0,256,256);flecks(ctx,9000,.1);for(let i=0;i<140;i++){ctx.fillStyle='rgba(76,79,69,.025)';ctx.fillRect(random()*256,random()*256,3+random()*10,1+random()*4);}});
  const make = (map:THREE.Texture,color='#ffffff') => new THREE.MeshStandardMaterial({map,color,roughness:.94});
  const materials={asphalt:make(asphalt),paving:make(paving),grass:make(grass),wood:make(wood),door:make(doorWood),tile:make(tile),plaster,
    exteriorGreen:make(plaster,'#b5d3b5'),exteriorPink:make(plaster,'#b97870')};
  const photographic:THREE.Texture[]=[];let disposed=false;
  const atlas=new Image();atlas.onload=()=>{
    if(disposed)return;
    const halfW=atlas.naturalWidth/2,halfH=atlas.naturalHeight/2;
    const regions:[[number,number,THREE.MeshStandardMaterial],[number,number,THREE.MeshStandardMaterial],[number,number,THREE.MeshStandardMaterial],[number,number,THREE.MeshStandardMaterial]]=[
      [0,0,materials.exteriorGreen],[1,0,materials.exteriorPink],[0,1,materials.wood],[1,1,materials.asphalt]];
    for(const [column,row,mat] of regions){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(atlas,column*halfW+2,row*halfH+2,halfW-4,halfH-4,0,0,512,512);
      const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.MirroredRepeatWrapping;map.anisotropy=8;
      mat.map=map;mat.bumpMap=map;mat.bumpScale=mat===materials.wood?.025:.035;mat.color.set('#ffffff');mat.needsUpdate=true;photographic.push(map);
    }
  };atlas.src='/textures/school-surfaces-v1.png';
  return {...materials,dispose(){disposed=true;atlas.onload=null;for(const t of [asphalt,paving,grass,wood,doorWood,tile,plaster,...photographic])t.dispose();}};
}
