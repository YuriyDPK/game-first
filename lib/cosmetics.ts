import type { HeroId } from './heroes';
export type CosmeticSlot='head'|'shield';
export type Appearance={head:string;shield:string};
export type CosmeticItem={id:string;hero:HeroId;slot:CosmeticSlot;name:string;description:string;price:number;level:number;style:'plume'|'crown'|'rune'|'kite'};
export const DEFAULT_APPEARANCE:Appearance={head:'default',shield:'default'};
export const COSMETICS:CosmeticItem[]=[
 {id:'ilya-plume',hero:'ilya',slot:'head',name:'Шлем защитника',description:'Алый гребень и кованая переносица',price:40,level:1,style:'plume'},
 {id:'ilya-crown',hero:'ilya',slot:'head',name:'Венец Муромца',description:'Позолоченный шлем с самоцветом',price:100,level:4,style:'crown'},
 {id:'ilya-rune',hero:'ilya',slot:'shield',name:'Щит земли',description:'Круглый щит с древней руной',price:40,level:1,style:'rune'},
 {id:'ilya-kite',hero:'ilya',slot:'shield',name:'Щит крепости',description:'Высокий дружинный щит',price:100,level:4,style:'kite'},
 {id:'dobrynya-plume',hero:'dobrynya',slot:'head',name:'Шлем клинка',description:'Синий гребень мастера меча',price:40,level:1,style:'plume'},
 {id:'dobrynya-crown',hero:'dobrynya',slot:'head',name:'Княжеский венец',description:'Золото и сапфир дружины',price:100,level:4,style:'crown'},
 {id:'dobrynya-rune',hero:'dobrynya',slot:'shield',name:'Щит дружины',description:'Стальной щит с узором',price:40,level:1,style:'rune'},
 {id:'dobrynya-kite',hero:'dobrynya',slot:'shield',name:'Щит витязя',description:'Вытянутый щит с гербом',price:100,level:4,style:'kite'},
 {id:'alyosha-plume',hero:'alyosha',slot:'head',name:'Шлем сокола',description:'Зелёный гребень следопыта',price:40,level:1,style:'plume'},
 {id:'alyosha-crown',hero:'alyosha',slot:'head',name:'Венец стрелка',description:'Позолоченный убор охотника',price:100,level:4,style:'crown'},
 {id:'alyosha-rune',hero:'alyosha',slot:'shield',name:'Щит следопыта',description:'Лёгкий круглый щит с руной',price:40,level:1,style:'rune'},
 {id:'alyosha-kite',hero:'alyosha',slot:'shield',name:'Щит сокола',description:'Высокий щит с узором',price:100,level:4,style:'kite'},
];
export function validAppearance(hero:HeroId,value:unknown):Appearance{
 const obj=value&&typeof value==='object'?value as Partial<Appearance>:{};
 const pick=(slot:CosmeticSlot)=>COSMETICS.some(item=>item.hero===hero&&item.slot===slot&&item.id===obj[slot])?obj[slot] as string:'default';
 return {head:pick('head'),shield:pick('shield')};
}
export function cosmeticStyle(id:string){return COSMETICS.find(item=>item.id===id)?.style;}
