'use client';
import { useState } from 'react';
import { Check, Coins, Crown, Shield, Sparkles } from 'lucide-react';
import { HEROES, SKINS, type HeroId } from '@/lib/heroes';
import { COSMETICS, type Appearance, type CosmeticItem, type CosmeticSlot } from '@/lib/cosmetics';
import HeroViewer from './hero-viewer';

type Props={hero:HeroId;skin:string;appearance:Appearance;level:number;coins:number;owned:string[];onHero:(hero:HeroId)=>void;onSkin:(skin:string)=>void;onItem:(item:CosmeticItem)=>void;onDefault:(slot:CosmeticSlot)=>void};
export default function Wardrobe({hero,skin,appearance,level,coins,owned,onHero,onSkin,onItem,onDefault}:Props){
 const [slot,setSlot]=useState<'skin'|CosmeticSlot>('skin');
 const choices=COSMETICS.filter(item=>item.hero===hero&&item.slot===slot);
 return <div className="wardrobe"><div className="wardrobe-header"><div><span className="eyebrow">МАГАЗИН И СНАРЯЖЕНИЕ</span><h2 id="modal-title">Облик богатыря</h2></div><div className="coin-balance"><Coins size={19}/> {coins} <small>монет</small></div></div>
 <div className="wardrobe-heroes">{HEROES.map(h=><button key={h.id} className={hero===h.id?'active':''} onClick={()=>onHero(h.id)}>{h.first}</button>)}</div>
 <div className="wardrobe-layout"><div className="wardrobe-preview"><HeroViewer hero={hero} skin={skin} appearance={appearance} styleLevel={level}/><span>РАНГ ОБЛИКА {level} · ПОВЕРНИ МЫШЬЮ</span></div><div className="wardrobe-content"><div className="wardrobe-tabs">{([['skin','Облики'],['head','Голова'],['shield','Щиты']] as const).map(([id,label])=><button key={id} onClick={()=>setSlot(id)} aria-pressed={slot===id} className={slot===id?'active':''}>{label}</button>)}</div><p className="wardrobe-tip">Монеты дают сбор ресурсов, крафт и победы. Вещи меняют внешний вид.</p><div className="wardrobe-list">
 {slot==='skin'?SKINS.map(option=><button className={`wardrobe-item ${skin===option.id?'equipped':''}`} key={option.id} onClick={()=>onSkin(option.id)}><span className="wardrobe-item-icon" style={{background:`linear-gradient(135deg,${option.metal},${option.color||'#75804e'})`}}><Sparkles size={18}/></span><span><strong>{option.name}</strong><small>{option.subtitle}</small></span><b>{skin===option.id?'Надето':'Выбрать'}</b></button>):<><button className={`wardrobe-item ${appearance[slot]==='default'?'equipped':''}`} onClick={()=>onDefault(slot)}><span className="wardrobe-item-icon">{slot==='head'?<Crown/>:<Shield/>}</span><span><strong>Походный {slot==='head'?'головной убор':'щит'}</strong><small>Базовое снаряжение</small></span><b>{appearance[slot]==='default'?'Надето':'Выбрать'}</b></button>{choices.map(item=>{const has=owned.includes(item.id),equipped=appearance[slot]===item.id,locked=level<item.level,affordable=coins>=item.price;return <button key={item.id} disabled={!has&&(locked||!affordable)} className={`wardrobe-item ${equipped?'equipped':''}`} onClick={()=>onItem(item)}><span className={`wardrobe-item-icon item-${item.style}`}>{slot==='head'?<Crown/>:<Shield/>}</span><span><strong>{item.name}</strong><small>{item.description} · уровень {item.level}</small></span><b>{equipped?<><Check size={14}/> Надето</>:has?'Выбрать':locked?`Ур. ${item.level}`:`${item.price} монет`}</b></button>;})}</>}
 </div></div></div></div>;
}
