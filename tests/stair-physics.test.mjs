import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_HEIGHTS, REAR_STAIR_SCALE, supportHeight } from '../app/stair-physics.ts';

const front = (x, z) => [x, z];
const rear = (x, z) => [z + .1, -28.4 + (x + 18.25) * REAR_STAIR_SCALE];

function walker(transform) {
  let [x, z] = transform(-17.7, 7.4), y = 0;
  return {
    move(targetX, targetZ) {
      const [worldX, worldZ] = transform(targetX, targetZ), originX = x, originZ = z;
      const steps = Math.max(1, Math.ceil(Math.hypot(worldX - x, worldZ - z) / .1));
      for (let i = 1; i <= steps; i++) {
        const nextX = originX + (worldX - originX) * i / steps;
        const nextZ = originZ + (worldZ - originZ) * i / steps;
        const nextY = supportHeight(nextX, nextZ, y);
        assert.notEqual(nextY, null, `no surface at ${nextX.toFixed(2)}, ${nextZ.toFixed(2)}, height ${y.toFixed(2)}`);
        x = nextX; z = nextZ; y = nextY;
      }
      return y;
    },
  };
}

for (const [name, transform] of [['front', front], ['rear', rear]]) {
  test(`${name} stairs connect all four floors in both directions`, () => {
    const player = walker(transform);
    for (let floor = 0; floor < 3; floor++) {
      player.move(-16.6, 7.4); player.move(-16.6, -3.5); player.move(-20.95, -3.5);
      assert.ok(Math.abs(player.move(-20.95, 7.4) - LEVEL_HEIGHTS[floor + 1]) < .02);
    }
    for (let floor = 2; floor >= 0; floor--) {
      player.move(-20.95, 7.4); player.move(-20.95, -3.5); player.move(-16.6, -3.5);
      assert.ok(Math.abs(player.move(-16.6, 7.4) - LEVEL_HEIGHTS[floor]) < .02);
    }
  });
}

test('a player cannot jump straight to the upper flight', () => {
  assert.equal(supportHeight(-20.95, 0, 0), null);
});

test('the courtyard exit remains reachable beneath the stairs', () => {
  const player = walker(front);
  player.move(-14.5, 7);
  player.move(-14.5, -3.5);
  assert.equal(player.move(-21.3, -4.3), 0);
});
