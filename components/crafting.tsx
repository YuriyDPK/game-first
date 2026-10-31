'use client';
import { useEffect, useRef, useState } from 'react';
import { Hammer, ArrowRight } from 'lucide-react';
import { RECIPES, RESOURCE_NAMES, findCraftRecipe, type CraftGrid, type CraftId, type EquipmentId, type PlayerState, type ResourceId } from '@/lib/heroes';

const resources:ResourceId[]=['iron','wood','crystal','ingot','plank'];
export function ResourceArt({id}:{id:ResourceId}) {
 if(id==='ingot') return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#aeb9b7" stroke="#e5eae0" strokeWidth="2" d="M12 17h25l5 14-5 6H7l-2-6z"/><path fill="#dce2dc" d="M12 17h25l-5 10H9z"/><path fill="none" stroke="#778582" strokeWidth="2" d="M9 27h23l5-10m-5 10 5 10"/></svg>;
 if(id==='plank') return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#c9985c" stroke="#edc589" strokeWidth="2" d="M8 9h32v30H8z"/><path stroke="#805631" strokeWidth="2" d="M8 19h32M8 29h32"/><path stroke="#9e7040" d="M12 14h21M17 24h19M11 34h18"/></svg>;
 if(id==='wood') return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#80502d" stroke="#d09a62" strokeWidth="2" d="M7 32 31 10l10 5-24 22z"/><path fill="#dba86d" stroke="#80502d" strokeWidth="2" d="M31 10c4-3 11 0 10 5s-6 6-10 3-3-6 0-8Z"/><path fill="none" stroke="#a76f3d" strokeWidth="1.5" d="M33 13c4-2 6 1 3 3M12 28l18-16M17 32l15-13"/></svg>;
 if(id==='crystal') return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4da4bd" stroke="#b2f0f2" strokeWidth="2" d="M24 4 38 18 31 41 17 41 10 18Z"/><path fill="#a5e8e8" d="m24 5-5 15 5 20 7-20z"/><path fill="none" stroke="#d0ffff" strokeWidth="1" d="M10 18h28M19 20l5-15 7 15-7 20z"/></svg>;
 return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#778181" stroke="#d3d5c8" strokeWidth="2" d="m7 31 5-14 12-8 13 6 5 16-9 9H15Z"/><path fill="#bfc5bd" d="m12 21 8-8 4 7-5 7zM28 17l7 3-2 6-6-2z"/><path fill="none" stroke="#4a5756" strokeWidth="2" d="m12 32 9-3 5 6m7-7 5 4"/></svg>;
}
export default function Crafting({me,pending,onCraft}:{me:PlayerState;pending:boolean;onCraft:(grid:CraftGrid)=>void}) {
 const [grid,setGrid]=useState<CraftGrid>(Array(9).fill(null));
 const [selected,setSelected]=useState<ResourceId>('iron');
 const submitted=useRef<string|null>(null);
 useEffect(()=>{if(!pending&&submitted.current){if(me.craftNotice.startsWith('Создано:'))setGrid(current=>JSON.stringify(current)===submitted.current?Array(9).fill(null):current);submitted.current=null;}},[me.craftAck,me.craftNotice,pending]);
 const id=findCraftRecipe(grid),recipe=id?RECIPES[id]:null;
 const available=(resource:ResourceId,index:number)=>grid.filter((v,i)=>v===resource&&i!==index).length<me.resources[resource];
 const put=(index:number,resource:ResourceId)=>{if(available(resource,index))setGrid(current=>current.map((v,i)=>i===index?resource:v));};
 const remove=(index:number)=>setGrid(current=>current.map((v,i)=>i===index?null:v));
 const owned=!!id&&!RECIPES[id].output&&me.upgrades[id as EquipmentId];
 const ready=!!id&&!owned&&me.level>=RECIPES[id].level&&!pending&&me.hp>0&&resources.every(resource=>grid.filter(v=>v===resource).length<=me.resources[resource]);
 return <div className="craft-workspace">
  <div className="inventory-section-title"><Hammer size={16}/><h3>Создание предметов</h3><span>Без верстака · сетка 3 × 3</span></div>
  <p className="craft-help">Выбери рецепт ниже или разложи ресурсы вручную. Слитки и доски создаются из сырья.</p>
  <div className="craft-layout"><div><div className="craft-label">РЕСУРСЫ В СУМЕ</div><div className="resource-slots">{resources.map(resource=><button key={resource} type="button" draggable={me.resources[resource]>0} onDragStart={e=>e.dataTransfer.setData('text/plain',resource)} onClick={()=>setSelected(resource)} aria-pressed={selected===resource} className={`resource-slot ${selected===resource?'selected':''}`} title={RESOURCE_NAMES[resource]}><ResourceArt id={resource}/><span>{RESOURCE_NAMES[resource]}</span><b>×{me.resources[resource]}</b></button>)}</div></div>
  <div><div className="craft-label">РАЗЛОЖИ РЕСУРСЫ</div><div className="craft-grid-area"><div className="craft-grid">{grid.map((resource,index)=><button key={index} type="button" className="craft-cell" aria-label={`Ячейка ${index+1}: ${resource?RESOURCE_NAMES[resource]:'пусто'}`} onClick={()=>resource?remove(index):put(index,selected)} onContextMenu={e=>{e.preventDefault();remove(index);}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const value=e.dataTransfer.getData('text/plain') as ResourceId;if(resources.includes(value))put(index,value);}}>{resource&&<ResourceArt id={resource}/>}</button>)}</div><ArrowRight className="craft-arrow" size={20}/><div className="craft-result"><span>РЕЗУЛЬТАТ</span><strong>{recipe?.name??'Нет рецепта'}</strong><small>{recipe?.effect??'Разложи ресурсы по схеме'}</small><button type="button" disabled={!ready} onClick={()=>{submitted.current=JSON.stringify(grid);onCraft(grid);}}>{owned?'Уже создано':id&&me.level<RECIPES[id].level?`Нужен ${RECIPES[id].level} уровень`:pending?'Создаём…':'Создать'}</button></div></div></div></div>
  <div className="craft-label recipes-label">РЕЦЕПТЫ · НАЖМИ, ЧТОБЫ ЗАПОЛНИТЬ СЕТКУ</div><div className="recipe-guide">{(Object.keys(RECIPES) as CraftId[]).map(key=>{const available=Object.entries(RECIPES[key].cost).every(([resource,count])=>me.resources[resource as ResourceId]>=(count??0));return <button type="button" disabled={!available} className={`recipe-guide-item ${id===key?'selected':''}`} key={key} onClick={()=>setGrid([...RECIPES[key].pattern])} aria-label={`Выбрать рецепт: ${RECIPES[key].name}`} title={available?'Выбрать рецепт':'Не хватает ресурсов'}><div className="recipe-mini-grid">{RECIPES[key].pattern.map((resource,index)=><span key={index}>{resource&&<ResourceArt id={resource}/>}</span>)}</div><div><strong>{RECIPES[key].name}</strong><small>{RECIPES[key].effect} · ур. {RECIPES[key].level}{!RECIPES[key].output&&me.upgrades[key as EquipmentId]?' · создано':''}{!available?' · не хватает ресурсов':''}</small></div></button>})}</div>
 </div>;
}
