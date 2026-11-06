import { action, createRoom, makePlayer, tick, type Room } from '@/lib/game/kingdom';
const globalRooms=globalThis as typeof globalThis & { kingdomRooms?:Map<string,Room> };
const rooms=globalRooms.kingdomRooms ||= new Map<string,Room>();
function clean(){const now=Date.now();for(const [code,room] of rooms)if(now-room.created>1000*60*60*4)rooms.delete(code)}
export async function POST(request:Request){try{clean();const body=await request.json();const {op,id}=body;if(typeof id!=='string'||id.length>80)return Response.json({error:'Некорректный игрок'},{status:400});
 if(op==='create'){let code='';do{code=Math.random().toString(36).slice(2,6).toUpperCase()}while(rooms.has(code));const room=createRoom(code,id,String(body.name||'Воин'),String(body.color||'#dfaa55'),String(body.role||'Воин'));rooms.set(code,room);return Response.json({room})}
 const room=rooms.get(String(body.code||'').toUpperCase());if(!room)return Response.json({error:'Комната не найдена. Проверьте код.'},{status:404});
 if(op==='join'){if(room.status!=='lobby')return Response.json({error:'Матч уже начался'},{status:400});if(!room.players.some(p=>p.id===id)){if(room.players.length>=4)return Response.json({error:'Комната заполнена'},{status:400});room.players.push(makePlayer(id,String(body.name||'Воин'),String(body.color||'#dfaa55'),room.players.length,false,String(body.role||'Воин')));}}
 else if(op==='leave'&&room.status==='lobby'){room.players=room.players.filter(p=>p.id!==id);if(room.host===id)room.host=room.players.find(p=>!p.bot)?.id||'';if(!room.host)rooms.delete(room.code);return Response.json({ok:true})}else if(op==='poll')tick(room);else if(op==='action'){const error=action(room,id,String(body.type),body.data||{});if(error){room.revision++;return Response.json({room,error});}}
 room.revision++;return Response.json({room});}catch{return Response.json({error:'Ошибка запроса'},{status:400})}}
