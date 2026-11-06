/** Shared domain vocabulary. These contracts do not imply a running backend. */
export type House = "gryffindor" | "slytherin" | "ravenclaw" | "hufflepuff";
export type CharacterAppearance = { face: string; hairstyle: string; hairColor: string; outfit: string };
export type Character = {
  id: string;
  ownerId: string;
  name: string;
  appearance: CharacterAppearance;
  house: House | null;
  level: number;
  experience: number;
  learnedSpells: string[];
  inventory: string[];
};
export type Lobby = { id: string; hostId: string; playerIds: string[]; capacity: 4; storyId: string };
export type StoryProgress = { storyId: string; chapter: string; completedQuests: string[]; choices: Record<string, string> };

/** Server commands are intended to be validated and applied by an authoritative game server. */
export type GameCommand =
  | { type: "move"; sequence: number; direction: { x: number; z: number } }
  | { type: "cast-spell"; sequence: number; spellId: string; targetId?: string }
  | { type: "interact"; sequence: number; targetId: string };
