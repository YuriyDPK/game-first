'use client';

import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { Room } from '@/lib/game/kingdom';

function material(color: THREE.ColorRepresentation) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
}
function box(w: number, h: number, d: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function pivot(x: number, y: number, z: number) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  return group;
}

type Rig = {
  root: THREE.Group;
  body: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  tool: THREE.Group;
  carriedLogs: THREE.Group;
  carrying: number;
  target: THREE.Vector3;
  targetFacing: number;
  attackSeq: number;
  attackStart: number;
  walkAmount: number;
  phase: number;
};
function character(color: string, small = false, role = 'Воин'): Rig {
  const root = new THREE.Group();
  root.scale.setScalar(small ? .72 : 1);
  const body = new THREE.Group();
  root.add(body);
  body.add(box(.72, .85, .42, color, 0, 1.16, 0), box(.76, .16, .47, '#503b2c', 0, .81, 0),
    box(.53, .55, .48, '#d0a17b', 0, 1.88, 0), box(.58, .19, .53, '#6c6a5d', 0, 2.18, 0),
    box(.63, .09, .56, '#b39a69', 0, 2.28, 0));
  if (role === 'Следопыт') body.add(box(.8, .7, .12, '#425744', 0, 1.2, -.28));
  if (role === 'Страж') body.add(box(.95, .22, .55, '#a99978', 0, 1.55, 0));
  const leftLeg = pivot(-.22, .72, 0), rightLeg = pivot(.22, .72, 0);
  leftLeg.add(box(.25, .66, .29, '#43382f', 0, -.34, 0));
  rightLeg.add(box(.25, .66, .29, '#43382f', 0, -.34, 0));
  const leftArm = pivot(-.52, 1.47, 0), rightArm = pivot(.52, 1.47, 0);
  leftArm.add(box(.28, .75, .28, color, 0, -.37, 0));
  rightArm.add(box(.28, .75, .28, color, 0, -.37, 0));
  const axe = box(.1, .95, .1, '#6b4b32', .18, -.72, .1);
  axe.rotation.z = -.3;
  const tool = new THREE.Group(); tool.add(axe, box(.42, .3, .13, '#a9aa9a', .3, -.32, .1)); rightArm.add(tool);
  const carriedLogs = new THREE.Group();
  for (let i = 0; i < 5; i++) { const log = woodLog(); log.position.set(0, (Math.floor(i / 2) - 1) * .25, (i % 2) * .25 - .1); carriedLogs.add(log); }
  carriedLogs.position.set(0, 1.05, .64); carriedLogs.visible = false;
  body.add(leftLeg, rightLeg, leftArm, rightArm, carriedLogs);
  return { root, body, leftLeg, rightLeg, leftArm, rightArm, tool, carriedLogs, carrying: 0, target: new THREE.Vector3(), targetFacing: 0,
    attackSeq: 0, attackStart: -10000, walkAmount: 0, phase: Math.random() * Math.PI * 2 };
}
function woodLog() {
  const group = new THREE.Group();
  const bark = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, 1.05, 8), material('#79502f'));
  bark.rotation.z = Math.PI / 2; bark.castShadow = true; group.add(bark);
  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.CylinderGeometry(.145, .145, .025, 8), material('#d4a66e'));
    end.rotation.z = Math.PI / 2; end.position.x = side * .53; group.add(end);
  }
  return group;
}
function tree() {
  const group = new THREE.Group();
  group.add(box(.45, 2, .45, '#65503a', 0, 1, 0));
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(1.5 - i * .24, 2.5, 7), material(['#334d39', '#3d5d43', '#4c6b4b'][i]));
    mesh.position.y = 2.2 + i * .85;
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}
function building(type: string, color: string) {
  const group = new THREE.Group(), hall = type === 'hall';
  group.add(box(hall ? 3.2 : 2.8, 1.65, 2.4, '#82705a', 0, .9, 0), box(hall ? 3.4 : 3, .18, 2.6, '#b6a183', 0, .12, 0), box(.65, 1, .08, '#45392f', 0, .55, 1.23));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(hall ? 2.8 : 2.5, 1.5, 4), material('#493d34'));
  roof.rotation.y = Math.PI / 4; roof.position.y = 2.42; roof.castShadow = true; group.add(roof);
  group.add(box(.12, 2.5, .12, '#bca97d', 0, 3.3, 0), box(.9, .55, .06, color, .45, 4.25, 0));
  return group;
}
function disposeObject(object: THREE.Object3D) {
  object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
    else node.material.dispose();
  });
}
function direction(keys: Set<string>) {
  let x = 0, z = 0;
  if (keys.has('w') || keys.has('ц')) z--;
  if (keys.has('s') || keys.has('ы')) z++;
  if (keys.has('a') || keys.has('ф')) x--;
  if (keys.has('d') || keys.has('в')) x++;
  const length = Math.hypot(x, z);
  return length ? { x: x / length, z: z / length } : { x: 0, z: 0 };
}

export function Scene({ room, playerId, previewColor, previewRole, keys }: {
  room: Room | null; playerId: string; previewColor: string; previewRole: string;
  keys: RefObject<Set<string>>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const data = useRef({ room, playerId });
  useEffect(() => { data.current = { room, playerId }; }, [room, playerId]);
  const inGame = Boolean(room);
  useEffect(() => {
    if (!host.current) return;
    const el = host.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(inGame ? '#aab9a4' : '#899c87');
    scene.fog = new THREE.Fog(inGame ? '#aab9a4' : '#899c87', 35, 95);
    const camera = new THREE.PerspectiveCamera(39, 1, .1, 180);
    scene.add(new THREE.HemisphereLight('#e2edda', '#4e5c40', 2.3));
    const sun = new THREE.DirectionalLight('#ffe3b2', 3);
    sun.position.set(-15, 35, 12); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -35; sun.shadow.camera.right = 35; sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), material('#788e69'));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const world = new THREE.Group(); scene.add(world);
    let seed = 42;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 320; i++) {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(.08 + rand() * .18, 0), material(i % 3 === 0 ? '#9ba58b' : '#6d825e'));
      stone.position.set((rand() - .5) * 70, .08, (rand() - .5) * 70); stone.scale.y = .35; world.add(stone);
    }
    let preview: Rig | undefined;
    if (!inGame) {
      for (let i = 0; i < 50; i++) {
        const angle = i * 2.4, radius = 7 + rand() * 25, object = tree();
        object.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius - 4); object.scale.setScalar(.7 + rand() * .6); world.add(object);
      }
      preview = character(previewColor, false, previewRole); preview.root.scale.setScalar(1.55); world.add(preview.root);
      const platform = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, .35, 8), material('#777d68'));
      platform.position.y = -.12; platform.receiveShadow = true; world.add(platform);
      camera.position.set(6, 5.7, 11); camera.lookAt(0, 1.5, 0);
    }
    const trees = new Map<number, { root: THREE.Group; hp: number; hitAt: number; fallAt: number }>(), buildings = new Map<string, THREE.Group>();
    const players = new Map<string, Rig>(), units = new Map<string, Rig>(), spawns = new Map<string, THREE.Mesh>(), logs = new Map<string, THREE.Group>();
    const ring = new THREE.Mesh(new THREE.RingGeometry(.8, .9, 32), new THREE.MeshBasicMaterial({ color: '#f0cd7e', side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .04; ring.visible = false; scene.add(ring);
    const remove = <T extends THREE.Object3D>(map: Map<string, T>, wanted: Set<string>) => {
      for (const [id, object] of map) if (!wanted.has(id)) { scene.remove(object); disposeObject(object); map.delete(id); }
    };
    const sync = (snapshot: Room, now: number) => {
      for (const item of snapshot.trees) {
        const existing = trees.get(item.id);
        if (existing && item.hp < existing.hp) { existing.hp = item.hp; existing.hitAt = now; if (item.hp <= 0) existing.fallAt = now; }
        else if (!existing && item.hp > 0) {
          const object = tree(); object.position.set(item.x, 0, item.z); object.scale.setScalar(.8 + (item.id % 4) * .08); scene.add(object);
          trees.set(item.id, { root: object, hp: item.hp, hitAt: -10000, fallAt: -1 });
        }
      }
      remove(logs, new Set(snapshot.logs.map(log => log.id)));
      for (const item of snapshot.logs) if (!logs.has(item.id)) {
        const object = woodLog(); object.position.set(item.x, .18, item.z); object.rotation.y = (item.x + item.z) * 3; scene.add(object); logs.set(item.id, object);
      }
      remove(buildings, new Set(snapshot.buildings.map(b => b.id)));
      for (const item of snapshot.buildings) if (!buildings.has(item.id)) {
        const object = building(item.type, snapshot.players.find(p => p.id === item.owner)?.color || '#ddd');
        object.position.set(item.x, 0, item.z); scene.add(object); buildings.set(item.id, object);
      }
      const alive = snapshot.players.filter(p => p.alive);
      for (const [id, rig] of players) if (!alive.some(p => p.id === id)) { scene.remove(rig.root); disposeObject(rig.root); players.delete(id); }
      for (const item of alive) {
        let rig = players.get(item.id);
        if (!rig) { rig = character(item.color, false, item.role); rig.root.position.set(item.x, 0, item.z); rig.root.rotation.y = item.facing; rig.attackSeq = item.attackSeq; scene.add(rig.root); players.set(item.id, rig); if (item.id === data.current.playerId) { camera.position.set(item.x + 17, 22, item.z + 20); camera.lookAt(item.x, 0, item.z); } }
        rig.target.set(item.x, 0, item.z); rig.targetFacing = item.facing; rig.carrying = item.carrying;
        rig.carriedLogs.visible = item.carrying > 0; rig.tool.visible = item.carrying === 0;
        rig.carriedLogs.children.forEach((log, index) => { log.visible = index < Math.ceil(item.carrying / 2); });
        if (item.attackSeq > rig.attackSeq) { rig.attackSeq = item.attackSeq; rig.attackStart = now; }
      }
      for (const [id, rig] of units) if (!snapshot.units.some(u => u.id === id)) { scene.remove(rig.root); disposeObject(rig.root); units.delete(id); }
      for (const item of snapshot.units) {
        let rig = units.get(item.id);
        if (!rig) { rig = character(snapshot.players.find(p => p.id === item.owner)?.color || '#fff', true); rig.root.position.set(item.x, 0, item.z); rig.attackSeq = item.attackSeq; scene.add(rig.root); units.set(item.id, rig); }
        const dx = item.x - rig.target.x, dz = item.z - rig.target.z;
        if (Math.hypot(dx, dz) > .015 && (rig.target.x !== 0 || rig.target.z !== 0)) rig.targetFacing = Math.atan2(dx, dz);
        rig.target.set(item.x, 0, item.z);
        if (item.attackSeq > rig.attackSeq) { rig.attackSeq = item.attackSeq; rig.attackStart = now; }
      }
      const noHall = snapshot.players.filter(p => p.alive);
      remove(spawns, new Set(noHall.map(p => p.id)));
      for (const player of noHall) if (!spawns.has(player.id)) {
        const marker = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.85, 32), new THREE.MeshBasicMaterial({ color: player.color, side: THREE.DoubleSide }));
        const positions = [[-19, 19], [19, -19], [19, 19], [-19, -19]], pos = positions[snapshot.players.indexOf(player)];
        marker.rotation.x = -Math.PI / 2; marker.position.set(pos[0], .05, pos[1]); scene.add(marker); spawns.set(player.id, marker);
      }
    };
    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize(); window.addEventListener('resize', resize);
    let frame = 0, previous = performance.now(), lastRoom: Room | null = null;
    const animateRig = (rig: Rig, dt: number, now: number, local: boolean, snapshot: Room) => {
      let x = rig.target.x, z = rig.target.z;
      if (local && snapshot.status === 'playing') {
        const input = direction(keys.current), nextX = Math.max(-29, Math.min(29, x + input.x * .32)), nextZ = Math.max(-29, Math.min(29, z + input.z * .32));
        if (!snapshot.trees.some(t => t.hp > 0 && Math.hypot(t.x - nextX, t.z - nextZ) < .85)) { x = nextX; z = nextZ; }
        if (input.x || input.z) rig.targetFacing = Math.atan2(input.x, input.z);
      }
      const oldX = rig.root.position.x, oldZ = rig.root.position.z;
      const alpha = 1 - Math.exp(-(local ? 15 : 8) * dt);
      rig.root.position.x += (x - oldX) * alpha; rig.root.position.z += (z - oldZ) * alpha;
      const speed = Math.hypot(rig.root.position.x - oldX, rig.root.position.z - oldZ) / Math.max(dt, .001);
      const moving = Math.min(1, speed / 1.5);
      rig.walkAmount += (moving - rig.walkAmount) * (1 - Math.exp(-dt * 10));
      rig.phase += dt * (7 + Math.min(speed, 5) * 2);
      const swing = Math.sin(rig.phase) * rig.walkAmount;
      rig.leftLeg.rotation.x = swing * .6; rig.rightLeg.rotation.x = -swing * .6;
      rig.leftArm.rotation.x = rig.carrying ? -1.1 + swing * .08 : -swing * .48;
      const attack = Math.max(0, 1 - (now - rig.attackStart) / 480);
      rig.tool.visible = rig.carrying === 0 || attack > 0;
      rig.rightArm.rotation.x = attack > 0 ? -Math.sin((1 - attack) * Math.PI) * 2.2 : rig.carrying ? -1.1 - swing * .08 : swing * .48;
      rig.body.position.y = Math.abs(Math.sin(rig.phase)) * .07 * rig.walkAmount + Math.sin(now / 900) * .012;
      rig.body.rotation.z = Math.sin(rig.phase) * .045 * rig.walkAmount;
      const diff = Math.atan2(Math.sin(rig.targetFacing - rig.root.rotation.y), Math.cos(rig.targetFacing - rig.root.rotation.y));
      rig.root.rotation.y += diff * (1 - Math.exp(-dt * 12));
    };
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const dt = Math.min((now - previous) / 1000, .05); previous = now;
      const snapshot = data.current.room;
      if (snapshot) {
        if (snapshot !== lastRoom) { lastRoom = snapshot; sync(snapshot, now); }
        for (const [id, view] of trees) {
          if (view.fallAt >= 0) {
            const progress = Math.min(1, (now - view.fallAt) / 650);
            view.root.rotation.z = progress * progress * 1.5;
            if (progress >= 1) { scene.remove(view.root); disposeObject(view.root); trees.delete(id); }
          } else {
            const elapsed = now - view.hitAt;
            view.root.rotation.z = elapsed < 450 ? Math.sin(elapsed / 45) * .09 * (1 - elapsed / 450) : 0;
          }
        }
        for (const [id, rig] of players) animateRig(rig, dt, now, id === data.current.playerId, snapshot);
        for (const rig of units.values()) animateRig(rig, dt, now, false, snapshot);
        const me = players.get(data.current.playerId);
        if (me) {
          ring.visible = true; ring.position.x = me.root.position.x; ring.position.z = me.root.position.z;
          const target = new THREE.Vector3(me.root.position.x + 17, 22, me.root.position.z + 20);
          camera.position.lerp(target, 1 - Math.exp(-dt * 6)); camera.lookAt(me.root.position.x, 0, me.root.position.z);
        } else ring.visible = false;
      } else if (preview) {
        preview.body.position.y = Math.sin(now / 850) * .025;
        preview.body.rotation.z = Math.sin(now / 1500) * .015;
        preview.leftArm.rotation.x = Math.sin(now / 1100) * .035;
        preview.rightArm.rotation.x = Math.sin(now / 1100 + 1) * .035;
        camera.position.x = 6 + Math.sin(now / 4500) * .45;
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame); window.removeEventListener('resize', resize);
      scene.traverse(node => { if (node instanceof THREE.Mesh) { node.geometry.dispose(); if (Array.isArray(node.material)) node.material.forEach(m => m.dispose()); else node.material.dispose(); } });
      renderer.dispose(); el.removeChild(renderer.domElement);
    };
  }, [inGame, previewColor, previewRole, keys]);
  return <div className="scene" ref={host} />;
}
