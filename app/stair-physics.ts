/** World heights correspond to the first floor and three upper storeys. */
export const LEVEL_HEIGHTS = [0, 4.2, 7.3, 10.4] as const;
export const REAR_STAIR_SCALE = 9.2 / 10.3;

/** Convert the matching second stairwell into the main stairwell's local coordinates. */
export function rearStairToLocal(x: number, z: number) {
  return { x: (z + 28.4) / REAR_STAIR_SCALE - 18.25, z: x - .1 };
}

export function floorIndexAt(height: number): number {
  let floor = 0;
  for (let i = 1; i < LEVEL_HEIGHTS.length; i++) if (height >= LEVEL_HEIGHTS[i] - .25) floor = i;
  return floor;
}

/** Select a reachable surface on either of the two staircases or on a floor. */
export function supportHeight(x: number, z: number, previous: number): number | null {
  const rear = x >= -4.25 && x <= 8.4 && z >= -33 && z <= -23.8;
  const local = rear ? rearStairToLocal(x, z) : { x, z };
  const stairwell = local.x >= -23.4 && local.x <= -13.1 && local.z >= -4.35 && local.z <= 8.3;
  const surfaces: number[] = [];
  if (stairwell) {
    const sx = local.x, sz = local.z;
    if (sz >= 5.3) surfaces.push(...LEVEL_HEIGHTS);
    // A ground-level passage continues underneath the far landing.
    if (sz <= -2.8 || (sz < 6.2 && sx >= -14.8)) surfaces.push(0);
    if (sz <= 6.2 && sz >= -2.8) {
      for (let i = 0; i < LEVEL_HEIGHTS.length - 1; i++) {
        const base = LEVEL_HEIGHTS[i], half = (LEVEL_HEIGHTS[i + 1] - base) / 2;
        // The ascending flights are mirrored relative to the previous layout.
        if (sx >= -18.4 && sx <= -14.8) surfaces.push(base + (6.2 - sz) / 9 * half);
        if (sx >= -22.7 && sx <= -19.2) surfaces.push(base + half + (sz + 2.8) / 9 * half);
      }
    }
    if (sz <= -1.9 && sz >= -4.35 && sx >= -22.7 && sx <= -14.8) {
      for (let i = 0; i < LEVEL_HEIGHTS.length - 1; i++) surfaces.push((LEVEL_HEIGHTS[i] + LEVEL_HEIGHTS[i + 1]) / 2);
    }
  } else {
    surfaces.push(0);
    const upperArea = (x >= -32 && x <= 20.1 && z >= 8.3 && z <= 13.15)
      || (x >= -32 && x <= 12.4 && z >= -4.35 && z <= 8.3)
      || (x >= 12.4 && x <= 20.1 && z >= -28 && z <= 8.3)
      || (x >= 20.1 && x <= 32.4 && z >= -28 && z <= 13.15)
      || (x >= 8.4 && x <= 20.1 && z >= -33 && z <= -23.8);
    if (upperArea) surfaces.push(...LEVEL_HEIGHTS.slice(1));
  }
  let nearest: number | null = null, difference = Infinity;
  for (const surface of surfaces) {
    const d = Math.abs(surface - previous);
    if (d < difference) { difference = d; nearest = surface; }
  }
  return difference <= .3 ? nearest : null;
}
