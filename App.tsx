import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Fish, FishSpecies, GameEvent, Quest } from './types';
import { SPECIES_DATA, FISH_NAMES, TICK_RATE, DECORATIONS, AUTO_SAVE_KEY } from './constants';
import { initAudio, playSound, toggleMute } from './utils/audio';
import { FishNode } from './components/FishNode';

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substring(2, 9);
const randomName = () => FISH_NAMES[Math.floor(Math.random() * FISH_NAMES.length)];
const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

const INITIAL_STATE: GameState = {
  fish: [],
  coins: 500,
  tankLevel: 1,
  tankExp: 0,
  waterQuality: 100,
  decorations: [],
  lastTick: Date.now(),
};

const INITIAL_QUESTS: Quest[] = [
  { id: 'q1', desc: '養一隻魚', target: 1, current: 0, completed: false, reward: 100, type: 'HOARDER' },
  { id: 'q2', desc: '維持水質100', target: 10, current: 0, completed: false, reward: 200, type: 'CLEAN_WATER' },
];

export default function App() {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);
  const [selectedFish, setSelectedFish] = useState<Fish | null>(null);
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
  
  // UI State
  const [menuOpen, setMenuOpen] = useState<'NONE' | 'SHOP_FISH' | 'SHOP_DECOR' | 'QUEST'>('NONE');
  const [isMuted, setIsMuted] = useState(false);
  const [showStartOverlay, setShowStartOverlay] = useState(true);

  // --- Game Loop ---
  useEffect(() => {
    // Load Save
    const saved = localStorage.getItem(AUTO_SAVE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGameState(prev => ({ ...prev, ...parsed, lastTick: Date.now() }));
      } catch (e) {
        console.error("Save file corrupted");
      }
    }
  }, []);

  useEffect(() => {
    if (showStartOverlay) return;

    const interval = setInterval(() => {
      setGameState(prev => {
        const now = Date.now();
        // Calculate delta time in seconds (incase lag)
        // For simplicity in this retro game, we treat every tick as 1 unit
        
        let newWaterQuality = prev.waterQuality;
        let newTankExp = prev.tankExp;
        let newCoins = prev.coins;

        // 1. Tank Environment logic
        // Quality drops faster with more fish
        const pollution = prev.fish.filter(f => f.alive).length * 0.5;
        // Decoration Logic
        const hasVolcano = prev.decorations.includes('volcano');
        const qualityDrop = hasVolcano ? pollution * 1.5 : pollution;
        
        newWaterQuality = clamp(newWaterQuality - (qualityDrop * 0.1), 0, 100);

        // 2. Fish Logic
        const hasBetta = prev.fish.some(f => f.species === 'Betta' && f.alive);
        const bettaCount = prev.fish.filter(f => f.species === 'Betta' && f.alive).length;

        const updatedFish = prev.fish.map(fish => {
          if (!fish.alive) return fish;

          const def = SPECIES_DATA[fish.species];
          let newHunger = clamp(fish.hunger - def.hungerRate, 0, 100);
          let newMood = clamp(fish.mood - def.moodRate, 0, 100);
          let newHealth = fish.health;
          let newExp = fish.exp + 1; // Passive exp

          // Movement logic (Random Walk)
          // 5% chance to change direction
          let newFlip = fish.flip;
          let newX = fish.x;
          let newY = fish.y;

          if (Math.random() < 0.1) {
             const moveX = (Math.random() - 0.5) * 10; // -5 to 5
             const moveY = (Math.random() - 0.5) * 5;
             newX = clamp(fish.x + moveX, 5, 90);
             newY = clamp(fish.y + moveY, 10, 80); // Keep within bounds
             if (moveX > 0) newFlip = true;
             if (moveX < 0) newFlip = false;
          }

          // Damage Logic
          if (newHunger <= 0) newHealth -= 5;
          if (newWaterQuality < 50) newHealth -= (def.sensitivity * 2);
          
          // Betta fighting Logic
          if (fish.species === 'Betta' && bettaCount > 1) {
             newHealth -= 10;
             newMood -= 20;
          }

          if (newHealth <= 0) {
            newHealth = 0;
            playSound('DEATH');
            return { ...fish, alive: false, health: 0, x: newX, y: newY, flip: newFlip };
          }

          // Decor bonuses
          if (prev.decorations.includes('coral') && fish.species === 'Clownfish') {
            newMood = clamp(newMood + 2, 0, 100);
          }

          // Level Up
          let newLevel = fish.level;
          if (newExp > fish.level * 100) {
             newLevel += 1;
             newExp = 0;
             newCoins += 10; // Bonus coin
             playSound('LEVELUP');
          }

          return {
            ...fish,
            hunger: newHunger,
            mood: newMood,
            health: newHealth,
            exp: newExp,
            level: newLevel,
            x: newX, 
            y: newY,
            flip: newFlip
          };
        });

        // 3. Tank Exp
        if (newWaterQuality > 80 && updatedFish.some(f => f.alive)) {
          newTankExp += 1;
        }

        // 4. Random Events (1% chance per tick)
        if (!activeEvent && Math.random() < 0.01) {
           triggerRandomEvent();
        }

        // Save
        const nextState = {
          ...prev,
          fish: updatedFish,
          waterQuality: newWaterQuality,
          tankExp: newTankExp,
          coins: newCoins,
          lastTick: now
        };
        localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(nextState));
        return nextState;
      });

      // Update Quests
      setQuests(prev => prev.map(q => {
        if (q.completed) return q;
        let newVal = q.current;
        
        if (q.type === 'HOARDER') newVal = gameState.fish.length;
        if (q.type === 'CLEAN_WATER') newVal = gameState.waterQuality >= 100 ? newVal + 1 : newVal;
        
        if (newVal >= q.target) {
           playSound('LEVELUP');
           setGameState(curr => ({...curr, coins: curr.coins + q.reward}));
           return { ...q, current: newVal, completed: true };
        }
        return { ...q, current: newVal };
      }));

    }, TICK_RATE);

    return () => clearInterval(interval);
  }, [showStartOverlay, gameState.fish.length, activeEvent]); // Dependencies simplified for stability

  // --- Handlers ---

  const triggerRandomEvent = () => {
    const events: GameEvent[] = [
      {
        id: 'gift',
        title: '神祕禮物',
        message: '魚缸邊撿到硬幣！',
        expiresAt: Date.now() + 5000,
        options: [{ 
          label: '撿起來 (+100)', 
          action: () => {
            setGameState(s => ({...s, coins: s.coins + 100}));
            setActiveEvent(null);
            playSound('UI');
          }
        }]
      }
    ];
    // Simple logic: just pick the first one for MVP
    setActiveEvent(events[0]);
  };

  const handleStart = () => {
    initAudio();
    setShowStartOverlay(false);
    playSound('UI');
  };

  const handleFeed = () => {
    if (gameState.coins < 5) return;
    playSound('FEED');
    setGameState(prev => ({
      ...prev,
      coins: prev.coins - 5,
      fish: prev.fish.map(f => f.alive ? {
        ...f, 
        hunger: clamp(f.hunger + 30, 0, 100),
        mood: clamp(f.mood + 10, 0, 100),
        exp: f.exp + 5
      } : f)
    }));
  };

  const handleClean = () => {
    if (gameState.coins < 20) return;
    playSound('WATER');
    setGameState(prev => ({
      ...prev,
      coins: prev.coins - 20,
      waterQuality: 100
    }));
  };

  const handleBuyFish = (species: FishSpecies) => {
    const def = SPECIES_DATA[species];
    if (gameState.coins < def.price) return;
    
    // Betta Check
    if (species === 'Betta' && gameState.fish.some(f => f.species === 'Betta' && f.alive)) {
       alert("一山不容二虎！缸裡已經有鬥魚了。");
       return;
    }

    if (gameState.fish.length >= 6 + gameState.tankLevel) {
      alert("魚缸太擠了！提升等級來擴充。");
      return;
    }

    const newFish: Fish = {
      id: generateId(),
      species,
      name: randomName(),
      level: 1,
      exp: 0,
      hunger: 80,
      mood: 80,
      health: def.maxHealth,
      alive: true,
      bornTime: Date.now(),
      x: 50,
      y: 50,
      flip: false
    };

    setGameState(prev => ({
      ...prev,
      coins: prev.coins - def.price,
      fish: [...prev.fish, newFish]
    }));
    playSound('UI');
    setMenuOpen('NONE');
  };

  const handleBuyDecor = (id: string, price: number) => {
    if (gameState.coins < price) return;
    setGameState(prev => ({
      ...prev,
      coins: prev.coins - price,
      decorations: [...prev.decorations, id]
    }));
    playSound('UI');
    setMenuOpen('NONE');
  };

  const handleFishClick = (fish: Fish) => {
    playSound('UI');
    if (!fish.alive) {
      // Clean up dead fish
      const confirm = window.confirm(`清理 ${fish.name} 的遺體？`);
      if (confirm) {
        setGameState(prev => ({
          ...prev,
          fish: prev.fish.filter(f => f.id !== fish.id)
        }));
      }
    } else {
      setSelectedFish(fish);
    }
  };

  // --- Render ---

  if (showStartOverlay) {
    return (
      <div className="h-screen w-screen bg-ps1-dark flex items-center justify-center flex-col text-ps1-light crt-flicker scanlines p-4">
        <h1 className="text-2xl mb-8 text-center text-ps1-blue bg-gray-200 px-2 border-4 border-gray-400">LAZY FISH TANK</h1>
        <p className="text-xs mb-8 text-center leading-6">
          VERTICAL MOBILE EXPERIENCE<br/>
          PS1 EDITION
        </p>
        <button 
          onClick={handleStart}
          className="bg-ps1-panel border-b-4 border-r-4 border-gray-900 text-black px-8 py-4 active:border-0 active:translate-y-1"
        >
          START GAME
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-ps1-dark flex flex-col relative overflow-hidden font-retro select-none text-xs sm:text-sm">
      <div className="scanlines absolute inset-0 z-50 pointer-events-none opacity-30"></div>
      
      {/* Top HUD */}
      <div className="h-14 bg-ps1-panel border-b-4 border-black p-2 flex justify-between items-center z-40 shadow-lg">
        <div className="flex flex-col">
          <span className="text-yellow-900 font-bold">LV.{gameState.tankLevel}</span>
          <span className="text-[10px] text-gray-700">EXP {gameState.tankExp}</span>
        </div>
        <div className="bg-green-800 text-green-100 px-2 py-1 border-2 border-green-900 font-mono">
          ${gameState.coins}
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1">
            <span className={gameState.waterQuality < 50 ? "text-red-600 animate-pulse" : "text-blue-900"}>
              水質 {Math.floor(gameState.waterQuality)}%
            </span>
          </div>
          <button onClick={() => setIsMuted(toggleMute())} className="text-[10px] mt-1 underline">
             {isMuted ? "SOUND OFF" : "SOUND ON"}
          </button>
        </div>
      </div>

      {/* Main Tank View */}
      <div className="flex-1 relative bg-gradient-to-b from-ps1-blue to-black overflow-hidden crt-flicker">
        {/* Decorations Layer */}
        <div className="absolute inset-0 pointer-events-none">
          {gameState.decorations.includes('coral') && (
            <div className="absolute bottom-10 left-4 text-4xl opacity-80 pixelated">🪸</div>
          )}
          {gameState.decorations.includes('volcano') && (
            <div className="absolute bottom-10 right-10 text-4xl opacity-80 pixelated">🌋</div>
          )}
          {gameState.decorations.includes('castle') && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-5xl opacity-80 pixelated">🏰</div>
          )}
          {/* Plants (Standard) */}
          <div className="absolute bottom-4 left-2 text-3xl text-green-600 animate-pulse origin-bottom rotate-3">🌿</div>
          <div className="absolute bottom-6 right-2 text-2xl text-green-700 animate-pulse origin-bottom -rotate-3">🌿</div>
          
          {/* Floor */}
          <div className="absolute bottom-0 w-full h-8 bg-[#3d342b] opacity-90 border-t-4 border-[#2a221a]"></div>
        </div>

        {/* Fish Layer */}
        {gameState.fish.map(fish => (
          <FishNode key={fish.id} fish={fish} onClick={handleFishClick} />
        ))}

        {/* Selected Fish Info (Floating) */}
        {selectedFish && (
          <div 
            className="absolute top-4 left-4 right-4 bg-ps1-panel border-2 border-white text-black p-2 z-30 shadow-xl"
            onClick={() => setSelectedFish(null)}
          >
             <div className="flex justify-between border-b border-gray-600 mb-1 pb-1">
               <span>{selectedFish.name}</span>
               <span className="text-[10px]">{SPECIES_DATA[selectedFish.species].displayName} Lv.{selectedFish.level}</span>
             </div>
             <div className="grid grid-cols-2 gap-x-2 text-[10px]">
               <div>飽食: {Math.floor(selectedFish.hunger)}/100</div>
               <div>心情: {Math.floor(selectedFish.mood)}/100</div>
               <div>健康: {Math.floor(selectedFish.health)}/{SPECIES_DATA[selectedFish.species].maxHealth}</div>
               <div>{selectedFish.alive ? "狀態: 良好" : "狀態: 已故"}</div>
             </div>
             <div className="mt-1 text-center text-[10px] italic text-gray-700">
               "{selectedFish.hunger < 50 ? "好餓喔..." : "游來游去真開心。"}"
             </div>
          </div>
        )}

        {/* Event Popup */}
        {activeEvent && (
          <div className="absolute bottom-20 left-4 right-4 bg-yellow-100 border-4 border-yellow-600 p-4 z-50 shadow-2xl animate-bounce">
            <h3 className="font-bold mb-2">{activeEvent.title}</h3>
            <p className="mb-4">{activeEvent.message}</p>
            <div className="flex gap-2">
              {activeEvent.options.map((opt, i) => (
                <button 
                  key={i} 
                  onClick={opt.action}
                  className="flex-1 bg-white border-2 border-black p-2 active:bg-gray-200"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Control Panel (Bottom) */}
      <div className="bg-ps1-panel border-t-4 border-gray-400 p-2 z-40 pb-6">
        {/* Quest Toggle */}
        <div 
          onClick={() => setMenuOpen(menuOpen === 'QUEST' ? 'NONE' : 'QUEST')}
          className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ps1-panel border-t-2 border-x-2 border-gray-400 px-4 py-1 rounded-t-lg text-[10px] cursor-pointer"
        >
          {menuOpen === 'QUEST' ? '▼' : '▲'} 任務
        </div>

        <div className="grid grid-cols-4 gap-2 h-16">
          <button 
            onClick={handleFeed}
            className="bg-gray-300 border-b-4 border-r-4 border-gray-600 active:border-0 active:translate-y-1 flex flex-col items-center justify-center"
          >
            <span className="text-xl">🍤</span>
            <span className="text-[10px]">餵食</span>
          </button>
          
          <button 
            onClick={handleClean}
            className="bg-blue-200 border-b-4 border-r-4 border-blue-600 active:border-0 active:translate-y-1 flex flex-col items-center justify-center"
          >
            <span className="text-xl">💧</span>
            <span className="text-[10px]">換水</span>
          </button>
          
          <button 
            onClick={() => setMenuOpen(menuOpen === 'SHOP_DECOR' ? 'NONE' : 'SHOP_DECOR')}
            className="bg-pink-200 border-b-4 border-r-4 border-pink-600 active:border-0 active:translate-y-1 flex flex-col items-center justify-center"
          >
            <span className="text-xl">🎨</span>
            <span className="text-[10px]">裝飾</span>
          </button>
          
          <button 
            onClick={() => setMenuOpen(menuOpen === 'SHOP_FISH' ? 'NONE' : 'SHOP_FISH')}
            className="bg-yellow-200 border-b-4 border-r-4 border-yellow-600 active:border-0 active:translate-y-1 flex flex-col items-center justify-center"
          >
            <span className="text-xl">🐟</span>
            <span className="text-[10px]">買魚</span>
          </button>
        </div>
      </div>

      {/* Drawers / Modals */}
      {menuOpen !== 'NONE' && (
        <div className="absolute inset-x-0 bottom-[80px] top-14 bg-black/80 z-30 flex flex-col justify-end">
          <div className="bg-ps1-light border-t-4 border-white p-4 max-h-[70%] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b-2 border-gray-400 pb-2">
              <h2 className="text-lg font-bold">
                {menuOpen === 'SHOP_FISH' && '水族館'}
                {menuOpen === 'SHOP_DECOR' && '裝飾店'}
                {menuOpen === 'QUEST' && '任務日誌'}
              </h2>
              <button onClick={() => setMenuOpen('NONE')} className="text-xl">X</button>
            </div>

            {menuOpen === 'QUEST' && (
              <div className="space-y-2">
                {quests.map(q => (
                  <div key={q.id} className={`p-2 border-2 ${q.completed ? 'border-green-500 bg-green-100' : 'border-gray-400 bg-white'}`}>
                    <div className="flex justify-between">
                      <span>{q.desc}</span>
                      <span>${q.reward}</span>
                    </div>
                    <div className="w-full bg-gray-300 h-2 mt-1">
                      <div 
                        className="bg-blue-600 h-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (q.current / q.target) * 100)}%` }} 
                      />
                    </div>
                    {q.completed && <div className="text-right text-green-700 text-[10px] mt-1">已完成</div>}
                  </div>
                ))}
              </div>
            )}

            {menuOpen === 'SHOP_FISH' && (
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(SPECIES_DATA) as FishSpecies[]).map(key => {
                  const fish = SPECIES_DATA[key];
                  const canAfford = gameState.coins >= fish.price;
                  return (
                    <button 
                      key={key}
                      disabled={!canAfford}
                      onClick={() => handleBuyFish(key)}
                      className={`flex items-center p-2 border-2 ${canAfford ? 'border-black bg-white active:bg-gray-200' : 'border-gray-300 bg-gray-100 opacity-50'}`}
                    >
                      <div className={`w-8 h-4 ${fish.color} mr-4 border border-black`}></div>
                      <div className="flex-1 text-left">
                        <div>{fish.displayName}</div>
                        <div className="text-[10px] text-gray-500">{fish.desc}</div>
                      </div>
                      <div className="font-bold">${fish.price}</div>
                    </button>
                  )
                })}
              </div>
            )}

            {menuOpen === 'SHOP_DECOR' && (
              <div className="grid grid-cols-1 gap-2">
                {DECORATIONS.map(decor => {
                  const owned = gameState.decorations.includes(decor.id);
                  const canAfford = gameState.coins >= decor.price;
                  return (
                    <button 
                      key={decor.id}
                      disabled={owned || !canAfford}
                      onClick={() => handleBuyDecor(decor.id, decor.price)}
                      className={`flex items-center p-2 border-2 ${owned ? 'border-green-500 bg-green-50' : canAfford ? 'border-black bg-white' : 'opacity-50'}`}
                    >
                      <div className="flex-1 text-left">
                        <div>{decor.name} {owned && '(已擁有)'}</div>
                        <div className="text-[10px] text-gray-500">{decor.effect}</div>
                      </div>
                      <div className="font-bold">${decor.price}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
