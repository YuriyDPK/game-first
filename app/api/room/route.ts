type Player = { id: string; name: string; x: number; y: number; z: number; hidden: boolean; seen: number };
type Room = { players: Record<string, Player> };
const globalRooms = globalThis as typeof globalThis & { schoolRooms?: Record<string, Room> };
const rooms = globalRooms.schoolRooms ??= {};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const id = String(body.id || '').slice(0, 40);
    if (!code || !id || !Number.isFinite(body.x) || !Number.isFinite(body.z)) return Response.json({ error: 'Некорректные данные' }, { status: 400 });
    const room = rooms[code] ??= { players: {} };
    const now = Date.now();
    for (const [key, player] of Object.entries(room.players)) if (now - player.seen > 10000) delete room.players[key];
    if (!room.players[id] && Object.keys(room.players).length >= 4) return Response.json({ error: 'Комната заполнена' }, { status: 409 });
    room.players[id] = { id, name: String(body.name || 'Игрок').slice(0, 14), x: Math.max(-65, Math.min(60, body.x)), y: Number.isFinite(body.y) ? Math.max(0, Math.min(10.4, body.y)) : 0, z: Math.max(-70, Math.min(41, body.z)), hidden: !!body.hidden, seen: now };
    return Response.json({ players: Object.values(room.players) });
  } catch { return Response.json({ error: 'Ошибка комнаты' }, { status: 400 }); }
}
