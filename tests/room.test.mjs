import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/room/route.ts';

const send = (id, y) => POST(new Request('http://localhost/api/room', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code: 'STAIR1', id, name: 'Игрок', x: -17, y, z: 8, hidden: false }),
}));

test('a room shares each player’s height and admits at most four players', async () => {
  assert.equal((await send('first', 4.2)).status, 200);
  const second = await send('second', 10.4);
  const data = await second.json();
  assert.equal(data.players.find(player => player.id === 'first').y, 4.2);
  assert.equal(data.players.find(player => player.id === 'second').y, 10.4);
  assert.equal((await send('third', 7.3)).status, 200);
  assert.equal((await send('fourth', 0)).status, 200);
  assert.equal((await send('fifth', 0)).status, 409);
});
