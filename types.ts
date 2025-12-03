export type FishSpecies = "Goldfish" | "Clownfish" | "Guppy" | "NeonTetra" | "Betta";

export interface Fish {
  id: string;
  species: FishSpecies;
  name: string;
  level: number;
  exp: number;
  hunger: number; // 0-100
  mood: number; // 0-100
  health: number; // 0-100
  alive: boolean;
  bornTime: number;
  // Visual position state
  x: number; 
  y: number;
  flip: boolean;
}

export interface FishDefinition {
  species: FishSpecies;
  displayName: string;
  price: number;
  color: string;
  desc: string;
  maxHealth: number;
  hungerRate: number; // Loss per tick
  moodRate: number;   // Loss per tick
  sensitivity: number; // Water quality sensitivity
  aggressive?: boolean;
}

export interface GameEvent {
  id: string;
  title: string;
  message: string;
  options: {
    label: string;
    action: () => void;
    cost?: number;
  }[];
  expiresAt: number;
}

export interface Quest {
  id: string;
  desc: string;
  target: number;
  current: number;
  completed: boolean;
  reward: number;
  type: 'LEVEL_UP' | 'CLEAN_WATER' | 'RELEASE_FISH' | 'HOARDER';
}

export interface GameState {
  fish: Fish[];
  coins: number;
  tankLevel: number;
  tankExp: number;
  waterQuality: number; // 0-100
  decorations: string[]; // IDs of bought decor
  lastTick: number;
}