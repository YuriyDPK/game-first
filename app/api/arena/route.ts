import { createRoom, joinRoom, updateRoom } from '@/lib/arena-server';
import { validAppearance } from '@/lib/cosmetics';
import { HEROES, SKINS, WEAPONS, type HeroId, type PlayerInput } from '@/lib/heroes';
export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (data.action === 'create' || data.action === 'join') {
      const name = typeof data.name === 'string' ? data.name.trim().slice(0, 20) : '';
      if (!name) return Response.json({ error: 'Введите своё имя.' }, { status: 400 });
      const hero = HEROES.some(h => h.id === data.hero) ? data.hero as HeroId : 'ilya';
      const skin = SKINS.some(s => s.id === data.skin) ? data.skin : 'classic';
      const appearance=validAppearance(hero,data.appearance),styleLevel=typeof data.styleLevel==='number'&&Number.isFinite(data.styleLevel)?Math.max(1,Math.min(100,Math.floor(data.styleLevel))):1;
      const session = data.action === 'create' ? createRoom(name,hero,skin,data.practice === true,appearance,styleLevel) : joinRoom(String(data.code).trim().toUpperCase(),name,hero,skin,appearance,styleLevel);
      return Response.json(session);
    }
    if (data.action !== 'update' && data.action !== 'leave') return Response.json({ error: 'Неизвестное действие.' }, { status: 400 });
    if (typeof data.code !== 'string' || typeof data.token !== 'string') return Response.json({ error: 'Неверное подключение.' }, { status: 400 });
    let input: PlayerInput | undefined;
    if (data.input) {
      const i = data.input;
      const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? n : 0;
      const sequence=(n:unknown)=>Math.max(0,Math.min(1e9,Math.floor(finite(n))));
      input = {
        x:Math.max(-1,Math.min(1,finite(i.x))),z:Math.max(-1,Math.min(1,finite(i.z))),angle:finite(i.angle)%(Math.PI*2),
        block:i.block===true,sprint:i.sprint===true,attack:sequence(i.attack),special:sequence(i.special),dodge:sequence(i.dodge),jump:sequence(i.jump),
        equip:typeof i.equip==='string'&&Object.hasOwn(WEAPONS,i.equip)?i.equip:'mace',use:sequence(i.use),item:i.item==='bread'?'bread':'potion',interact:sequence(i.interact),aim:i.aim===true,draw:i.draw===true,aimPitch:Math.max(-.18,Math.min(1.05,finite(i.aimPitch))),craft:sequence(i.craft),craftGrid:Array.isArray(i.craftGrid)&&i.craftGrid.length===9&&i.craftGrid.every((v:unknown)=>v===null||v==='iron'||v==='wood'||v==='crystal'||v==='ingot'||v==='plank')?i.craftGrid:Array(9).fill(null),skill:sequence(i.skill),skillChoice:i.skillChoice==='vitality'||i.skillChoice==='agility'?i.skillChoice:'strength',
      } as PlayerInput;
    }
    return Response.json(updateRoom(data.code, data.token, input, data.action === 'leave'), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Не удалось подключиться к арене.' }, { status: 400 }); }
}
