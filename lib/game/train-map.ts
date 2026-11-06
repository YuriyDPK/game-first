export type Point = { x: number; y: number };
export type TrainInteraction = { id: string; title: string; description: string; position: Point; cue: string };
export const TRAIN_SIZE = { width: 15, height: 9 };
export const TRAIN_SPAWN: Point = { x: 1, y: 4 };
export const TRAIN_INTERACTIONS: TrainInteraction[] = [
  { id: "window", title: "Окно", description: "За окном проплывают холмы. Хогвартс становится всё ближе.", position: { x: 3, y: 2 }, cue: "train.window" },
  { id: "seat", title: "Купе", description: "Свободное место у окна. Здесь однажды встретятся ваши друзья.", position: { x: 7, y: 2 }, cue: "train.seat" },
  { id: "trunk", title: "Чемодан", description: "Внутри — вещи для первого года обучения и письмо из Хогвартса.", position: { x: 12, y: 6 }, cue: "train.trunk" },
];
export function isWalkable({ x, y }: Point): boolean {
  if (x < 1 || x >= TRAIN_SIZE.width - 1 || y < 1 || y >= TRAIN_SIZE.height - 1) return false;
  return !((x === 5 || x === 10) && y !== 4);
}
export function nearbyInteraction(point: Point): TrainInteraction | undefined {
  return TRAIN_INTERACTIONS.find(({ position }) => Math.abs(position.x - point.x) + Math.abs(position.y - point.y) <= 1);
}
