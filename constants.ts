import { FishDefinition, FishSpecies } from './types';

export const TICK_RATE = 1000; // 1 second
export const AUTO_SAVE_KEY = 'LAZY_FISH_TANK_SAVE_V1';

export const FISH_NAMES = [
  "泡泡", "小尾", "丸子", "阿金", "點點", 
  "小紅", "波波", "大眼", "悠悠", "奇奇",
  "阿寶", "露露", "尼莫", "大師", "小強"
];

export const SPECIES_DATA: Record<FishSpecies, FishDefinition> = {
  Goldfish: {
    species: "Goldfish",
    displayName: "金魚",
    price: 100,
    color: "bg-orange-500",
    desc: "生命高，耐髒。",
    maxHealth: 100,
    hungerRate: 1,
    moodRate: 1,
    sensitivity: 0.5,
  },
  Clownfish: {
    species: "Clownfish",
    displayName: "小丑魚",
    price: 250,
    color: "bg-orange-400 border-white",
    desc: "喜歡裝飾，心情起伏大。",
    maxHealth: 80,
    hungerRate: 2,
    moodRate: 2,
    sensitivity: 0.8,
  },
  Guppy: {
    species: "Guppy",
    displayName: "孔雀魚",
    price: 50,
    color: "bg-teal-400",
    desc: "長得快，容易餓死。",
    maxHealth: 50,
    hungerRate: 4,
    moodRate: 1,
    sensitivity: 1.0,
  },
  NeonTetra: {
    species: "NeonTetra",
    displayName: "霓虹燈",
    price: 80,
    color: "bg-blue-600",
    desc: "水質差時會生病。",
    maxHealth: 40,
    hungerRate: 2,
    moodRate: 1,
    sensitivity: 2.0,
  },
  Betta: {
    species: "Betta",
    displayName: "鬥魚",
    price: 500,
    color: "bg-red-700",
    desc: "孤傲，一缸只能養一隻。",
    maxHealth: 120,
    hungerRate: 1.5,
    moodRate: 0.5,
    sensitivity: 0.8,
    aggressive: true,
  },
};

export const DECORATIONS = [
  { id: 'coral', name: '假珊瑚', price: 500, effect: '心情恢復+' },
  { id: 'volcano', name: '氣泡山', price: 1200, effect: '水質衰退-' },
  { id: 'castle', name: '沉船堡', price: 2500, effect: '經驗值+' },
];
