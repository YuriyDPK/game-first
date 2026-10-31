import type { Appearance } from './cosmetics';
export type HeroId = 'ilya' | 'dobrynya' | 'alyosha';
export const HEROES = [
  { id: 'ilya' as HeroId, first: 'Илья', last: 'Муромец', role: 'НЕСОКРУШИМЫЙ ЗАЩИТНИК', weapon: 'Булава и щит', description: 'За его спиной — вся Русь. Сокрушает врагов тяжёлой булавой и принимает удар на себя.', ability: 'Сила земли', abilityDescription: 'Мощный удар по земле поражает всех врагов рядом и восстанавливает 20 здоровья.', hp: 180, speed: 4.4, damage: 27, range: 3.2, power: 95, agility: 48, defense: 96, color: '#a74935', portrait: 'ilya', number: '01' },
  { id: 'dobrynya' as HeroId, first: 'Добрыня', last: 'Никитич', role: 'МАСТЕР КЛИНКА', weapon: 'Меч и щит', description: 'Честь в каждом слове. Сталь в каждом движении. Искусный воин, которому нет равных в ближнем бою.', ability: 'Стальной вихрь', abilityDescription: 'Круговой удар мечом наносит 45 урона всем противникам в радиусе 4 метров.', hp: 150, speed: 5.3, damage: 23, range: 3.5, power: 82, agility: 75, defense: 79, color: '#547985', portrait: 'dobrynya', number: '02' },
  { id: 'alyosha' as HeroId, first: 'Алёша', last: 'Попович', role: 'МЕТКИЙ СТРЕЛОК', weapon: 'Лук и короткий меч', description: 'Молод, находчив и быстр. Его стрелы находят цель раньше, чем враг успеет поднять щит.', ability: 'Соколиный выстрел', abilityDescription: 'Дальняя стрела наносит 40 урона ближайшему противнику в направлении взгляда.', hp: 120, speed: 6.1, damage: 18, range: 13, power: 65, agility: 98, defense: 55, color: '#6c8050', portrait: 'alyosha', number: '03' },
];
export const SKINS = [
  { id: 'classic', name: 'Былинный', subtitle: 'Классические доспехи', metal: '#8e9690', gold: '#c3a16b', color: '' },
  { id: 'royal', name: 'Княжеский', subtitle: 'Золото княжьей дружины', metal: '#b5a788', gold: '#ebcb7b', color: '#73333e' },
  { id: 'north', name: 'Северный', subtitle: 'Закалённый зимою', metal: '#9cabb7', gold: '#c1d3df', color: '#344d64' },
];
export function getHero(id: HeroId) { return HEROES.find(h => h.id === id) ?? HEROES[0]; }
export type WeaponId = 'mace' | 'sword' | 'bow';
export const WEAPONS = {
  mace: { id: 'mace' as WeaponId, name: 'Богатырская булава', short: 'Булава', damage: 27, range: 3.35, cooldown: 780, duration: .68, stamina: 9, description: 'Тяжёлый удар. Высокий урон в ближнем бою.' },
  sword: { id: 'sword' as WeaponId, name: 'Дружинный меч', short: 'Меч', damage: 23, range: 3.6, cooldown: 550, duration: .48, stamina: 7, description: 'Быстрые чередующиеся удары клинком.' },
  bow: { id: 'bow' as WeaponId, name: 'Соколиный лук', short: 'Лук', damage: 18, range: 19, cooldown: 720, duration: .62, stamina: 5, description: 'Дальний выстрел. Расходует одну стрелу.' },
};
export const defaultWeapon = (id: HeroId): WeaponId => id === 'ilya' ? 'mace' : id === 'dobrynya' ? 'sword' : 'bow';
export type ResourceId = 'iron' | 'wood' | 'crystal' | 'ingot' | 'plank';
export type CraftId = 'sword' | 'mace' | 'bow' | 'boots' | 'armor' | 'ingot' | 'plank';
export type EquipmentId = 'sword' | 'mace' | 'bow' | 'boots' | 'armor';
export type SkillId = 'strength' | 'vitality' | 'agility';
export type Resources = Record<ResourceId,number>;
export type Upgrades = Record<EquipmentId,boolean>;
export type Skills = Record<SkillId,number>;
export type CraftGrid = (ResourceId | null)[];
export const RESOURCE_NAMES:Record<ResourceId,string> = {iron:'Железная руда',wood:'Древесина',crystal:'Синий кристалл',ingot:'Железный слиток',plank:'Доска'};
export const xpForLevel=(level:number)=>60+(level-1)*40;
export const maxHealth=(hero:HeroId,skills:Skills)=>getHero(hero).hp+skills.vitality*15;
export const speedBonus=(skills:Skills)=>1+skills.agility*.05;
export const RECIPES:Record<CraftId,{name:string; effect:string; cost:Partial<Resources>; pattern:CraftGrid; level:number; output?:'ingot'|'plank'}> = {
 ingot:{name:'Железный слиток',effect:'Материал для оружия и доспехов',cost:{iron:2,wood:1},pattern:[null,'iron',null,'wood','iron',null,null,null,null],level:1,output:'ingot'},
 plank:{name:'Доска',effect:'Материал для оружия и обуви',cost:{wood:2},pattern:[null,'wood',null,null,'wood',null,null,null,null],level:1,output:'plank'},
 sword:{name:'Меч витязя',effect:'+12 урона мечом',cost:{ingot:2,wood:1,crystal:1},pattern:[null,'ingot',null,null,'ingot',null,null,'wood','crystal'],level:2},
 mace:{name:'Кованая булава',effect:'+12 урона булавой',cost:{ingot:3,plank:2},pattern:['ingot','ingot',null,'ingot','plank',null,null,'plank',null],level:2},
 bow:{name:'Лук следопыта',effect:'+10 урона и +5 м дальности',cost:{plank:3,crystal:1},pattern:['plank','plank','crystal','plank',null,null,null,null,null],level:3},
 boots:{name:'Сапоги скорохода',effect:'+20% к скорости',cost:{plank:2,crystal:2},pattern:['plank',null,'plank','crystal',null,'crystal',null,null,null],level:2},
 armor:{name:'Доспех дружинника',effect:'−25% получаемого урона',cost:{ingot:4,crystal:2},pattern:['ingot',null,'ingot','ingot','crystal','ingot',null,'crystal',null],level:3},
};
export function findCraftRecipe(grid:CraftGrid):CraftId | undefined {
 if(!Array.isArray(grid)||grid.length!==9)return undefined;
 return (Object.keys(RECIPES) as CraftId[]).find(id=>RECIPES[id].pattern.every((item,index)=>grid[index]===item));
}
export type Inventory = { potion: number; bread: number; arrows: number };
export type PlayerState = {
 id:string; name:string; hero:HeroId; skin:string; x:number; y:number; z:number; vy:number; grounded:boolean; angle:number;
 hp:number; stamina:number; level:number; styleLevel:number; coinsEarned:number; appearance:Appearance; drawAmount:number; xp:number; skillPoints:number; skills:Skills; skillAck:number; skillNotice:string; kills:number; deaths:number; weapon:WeaponId; inventory:Inventory; resources:Resources; upgrades:Upgrades; craftAck:number; craftNotice:string; aiming:boolean; attackPitch:number; attackAim:boolean; protectedUntil:number;
 attackAt:number; attackId:number; attackWeapon:WeaponId; combo:number; specialAt:number; dodgeAt:number; jumpAt:number; useAt:number; usedItem:string; hitAt:number; hitId:number; hitAmount:number; respawnAt:number;
 block:boolean; sprint:boolean; moving:boolean; bot?:boolean;
};
export type ArenaState = { code:string; players:PlayerState[]; startedAt:number; now:number; winner:string|null; practice:boolean; pickups:Record<string,number> };
export type Session = { code:string; token:string; playerId:string };
export type PlayerInput = { x:number; z:number; angle:number; block:boolean; sprint:boolean; attack:number; special:number; dodge:number; jump:number; equip:WeaponId; use:number; item:'potion'|'bread'; interact:number; aim:boolean; draw:boolean; aimPitch:number; craft:number; craftGrid:CraftGrid; skill:number; skillChoice:SkillId };
export const createInput = (hero:HeroId='ilya'):PlayerInput => ({x:0,z:0,angle:Math.PI,block:false,sprint:false,attack:0,special:0,dodge:0,jump:0,equip:defaultWeapon(hero),use:0,item:'potion',interact:0,aim:false,draw:false,aimPitch:0,craft:0,craftGrid:Array(9).fill(null),skill:0,skillChoice:'strength'});
