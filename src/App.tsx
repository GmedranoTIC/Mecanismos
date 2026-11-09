import React, { useState, useEffect, useRef } from 'react';
import { CoverScreen } from './components/CoverScreen';
import { LevelSelect } from './components/LevelSelect';
import { GameScreen } from './components/GameScreen';
import { LevelEditor } from './components/LevelEditor';
import { VictoryModal } from './components/VictoryModal';
import { NameModal } from './components/NameModal';
import { LEVELS } from './levels';
import { GameDifficulty, LevelDef, LevelResult, PlayerData } from './types';
import { sounds } from './audio';

type Screen = 'cover' | 'select' | 'game' | 'editor';

const STORAGE_KEY = 'gmedranotic_mecanismos_save_v1';

export default function App() {
  // Estado de persistencia local
  const [playerData, setPlayerData] = useState<PlayerData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          name: parsed.name || '',
          levels: parsed.levels || {},
          levelsHard: parsed.levelsHard || {},
          custom: Array.isArray(parsed.custom) ? parsed.custom : [],
          soundEnabled: parsed.soundEnabled !== false,
          difficulty: parsed.difficulty === 'hard' ? 'hard' : 'standard',
        };
      }
    } catch {
      // Ignorar error de parseo
    }
    return {
      name: '',
      levels: {},
      levelsHard: {},
      custom: [],
      soundEnabled: true,
      difficulty: 'standard',
    };
  });

  // Pantalla actual
  const [screen, setScreen] = useState<Screen>('cover');

  // Nivel activo
  const [currentLevelId, setCurrentLevelId] = useState<number | string>(1);

  // Modales
  const [showNameModal, setShowNameModal] = useState<boolean>(false);
  const [isFirstTimeName, setIsFirstTimeName] = useState<boolean>(false);
  const [victoryData, setVictoryData] = useState<{
    stars: number;
    savedMoney: number;
  } | null>(null);

  // Dificultad activa ('standard' o 'hard')
  const [difficulty, setDifficulty] = useState<GameDifficulty>(
    playerData.difficulty || 'standard'
  );

  // Notificación de estado temporal
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Input de archivo oculto para cargar JSON
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sincronizar sonido global
  useEffect(() => {
    sounds.enabled = playerData.soundEnabled;
  }, [playerData.soundEnabled]);

  // Guardar en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playerData));
    } catch {
      // localStorage lleno o deshabilitado
    }
  }, [playerData]);

  // Mostrar toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Calcular estadísticas acumuladas del Modo Estándar
  let normalStars = 0;
  let normalSavings = 0;
  Object.values(playerData.levels).forEach((r) => {
    if (r) {
      normalStars += r.s || 0;
      normalSavings += r.m || 0;
    }
  });

  // Calcular estadísticas acumuladas del Modo Difícil
  let hardStars = 0;
  let hardSavings = 0;
  if (playerData.levelsHard) {
    Object.values(playerData.levelsHard).forEach((r) => {
      if (r) {
        hardStars += r.s || 0;
        hardSavings += r.m || 0;
      }
    });
  }

  // Desbloqueo del Modo Difícil: requiere conseguir las 150 estrellas (50 niveles x 3) en Estándar
  const isHardUnlocked = normalStars >= 150;

  // Estadísticas mostradas según la dificultad actual
  const totalStars = difficulty === 'hard' ? hardStars : normalStars;
  const totalSavings = difficulty === 'hard' ? hardSavings : normalSavings;
  const maxStars = LEVELS.length * 3;

  // Cambiar dificultad con validación de desbloqueo
  const handleChangeDifficulty = (newDiff: GameDifficulty) => {
    if (newDiff === 'hard' && !isHardUnlocked) {
      showToast(`🔒 Modo Difícil bloqueado: Requiere 150 ★ en Modo Estándar (${normalStars}/150)`);
      return;
    }
    setDifficulty(newDiff);
    setPlayerData((prev) => ({ ...prev, difficulty: newDiff }));
    showToast(newDiff === 'hard' ? '⚔️ Modo Difícil: -30% presupuesto · Rampas -10% · Meta +20% ⇡' : '🟢 Modo Estándar seleccionado');
  };

  // Obtener definición del nivel actual
  const getCurrentLevelDef = (): LevelDef => {
    if (typeof currentLevelId === 'number') {
      return LEVELS[currentLevelId - 1] || LEVELS[0];
    }
    // Nivel personalizado (ej. 'c0', 'c1'...)
    if (typeof currentLevelId === 'string' && currentLevelId.startsWith('c')) {
      const idx = parseInt(currentLevelId.slice(1), 10);
      return playerData.custom[idx] || LEVELS[0];
    }
    return LEVELS[0];
  };

  // Iniciar partida desde portada
  const handlePlayFromCover = () => {
    if (!playerData.name) {
      setIsFirstTimeName(true);
      setShowNameModal(true);
      return;
    }

    const currentMap = difficulty === 'hard' ? (playerData.levelsHard || {}) : playerData.levels;
    // Buscar primer nivel no completado o el nivel 1
    let nextLvl = 1;
    while (nextLvl < LEVELS.length && currentMap[nextLvl]) {
      nextLvl++;
    }
    setCurrentLevelId(nextLvl);
    setScreen('game');
  };

  // Abrir selector de niveles
  const handleOpenLevels = () => {
    if (!playerData.name) {
      setIsFirstTimeName(true);
      setShowNameModal(true);
      return;
    }
    setScreen('select');
  };

  // Guardar nombre del alumno
  const handleSaveName = (name: string) => {
    setPlayerData((prev) => ({ ...prev, name }));
    setShowNameModal(false);
    if (isFirstTimeName) {
      setIsFirstTimeName(false);
      setScreen('select');
    }
  };

  // Seleccionar un nivel específico
  const handleSelectLevel = (levelId: number | string) => {
    setCurrentLevelId(levelId);
    setVictoryData(null);
    setScreen('game');
  };

  // Cuando se supera un nivel
  const handleLevelComplete = (stars: number, savedMoney: number) => {
    setVictoryData({ stars, savedMoney });

    if (typeof currentLevelId === 'number') {
      setPlayerData((prev) => {
        if (difficulty === 'hard') {
          const currentLevelsHard = prev.levelsHard || {};
          const existing = currentLevelsHard[currentLevelId];
          const newStars = Math.max(stars, existing?.s || 0);
          const newSavings = Math.max(savedMoney, existing?.m || 0);

          return {
            ...prev,
            levelsHard: {
              ...currentLevelsHard,
              [currentLevelId]: {
                s: newStars,
                m: newSavings,
                date: new Date().toISOString(),
              },
            },
          };
        } else {
          const existing = prev.levels[currentLevelId];
          const newStars = Math.max(stars, existing?.s || 0);
          const newSavings = Math.max(savedMoney, existing?.m || 0);

          return {
            ...prev,
            levels: {
              ...prev.levels,
              [currentLevelId]: {
                s: newStars,
                m: newSavings,
                date: new Date().toISOString(),
              },
            },
          };
        }
      });
    }
  };

  // Pasar al siguiente nivel
  const handleNextLevel = () => {
    setVictoryData(null);
    if (typeof currentLevelId === 'number' && currentLevelId < LEVELS.length) {
      setCurrentLevelId(currentLevelId + 1);
    } else {
      setScreen('select');
    }
  };

  // Guardar nivel creado en el editor
  const handleSaveCustomLevel = (newLevel: LevelDef) => {
    setPlayerData((prev) => ({
      ...prev,
      custom: [...prev.custom, newLevel],
    }));
    const newIdx = playerData.custom.length;
    setCurrentLevelId(`c${newIdx}`);
    setScreen('game');
    showToast('¡Nivel personalizado guardado con éxito!');
  };

  // Exportar progreso a fichero JSON
  const handleDownloadProgressJson = () => {
    const dataBlob = new Blob([JSON.stringify(playerData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    const safeName = (playerData.name || 'jugador').toLowerCase().replace(/\s+/g, '_');
    link.href = url;
    link.download = `progreso-mecanismos-${safeName}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('💾 Fichero de progreso descargado');
  };

  // Cargar fichero JSON de progreso
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Formato inválido');
        }

        const validName = typeof parsed.name === 'string' ? parsed.name : 'Alumno';
        const validLevels = typeof parsed.levels === 'object' && parsed.levels !== null ? parsed.levels : {};
        const validLevelsHard = typeof parsed.levelsHard === 'object' && parsed.levelsHard !== null ? parsed.levelsHard : {};
        const validCustom = Array.isArray(parsed.custom) ? parsed.custom : [];
        const validDiff: GameDifficulty = parsed.difficulty === 'hard' ? 'hard' : 'standard';

        setPlayerData({
          name: validName,
          levels: validLevels,
          levelsHard: validLevelsHard,
          custom: validCustom,
          soundEnabled: parsed.soundEnabled !== false,
          difficulty: validDiff,
        });
        setDifficulty(validDiff);

        showToast(`✅ ¡Progreso de ${validName} cargado correctamente!`);
        setScreen('select');
      } catch {
        showToast('❌ Error: El archivo no es un progreso JSON válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const currentLevelDef = getCurrentLevelDef();

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#141d22] text-white flex flex-col font-sans select-none">
      {/* Input de archivo oculto para importar JSON */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Notificación flotante Toast */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-amber-300 border border-amber-500/50 px-5 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm font-bold animate-bounce flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Pantalla Activa */}
      {screen === 'cover' && (
        <CoverScreen
          onPlay={handlePlayFromCover}
          onOpenLevels={handleOpenLevels}
          onOpenEditor={() => setScreen('editor')}
          onLoadFileClick={() => fileInputRef.current?.click()}
          soundEnabled={playerData.soundEnabled}
          onToggleSound={() =>
            setPlayerData((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
          }
          playerName={playerData.name}
          totalStars={totalStars}
          maxStars={maxStars}
          totalSavings={totalSavings}
          difficulty={difficulty}
          onChangeDifficulty={handleChangeDifficulty}
          isHardUnlocked={isHardUnlocked}
          normalStars={normalStars}
          hardStars={hardStars}
        />
      )}

      {screen === 'select' && (
        <LevelSelect
          levels={LEVELS}
          customLevels={playerData.custom}
          completedLevels={difficulty === 'hard' ? (playerData.levelsHard || {}) : playerData.levels}
          onSelectLevel={handleSelectLevel}
          onGoToCover={() => setScreen('cover')}
          onOpenEditor={() => setScreen('editor')}
          onSaveProgressJson={handleDownloadProgressJson}
          onLoadFileClick={() => fileInputRef.current?.click()}
          onChangeName={() => setShowNameModal(true)}
          playerName={playerData.name}
          difficulty={difficulty}
          onChangeDifficulty={handleChangeDifficulty}
          isHardUnlocked={isHardUnlocked}
          normalStars={normalStars}
          hardStars={hardStars}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          level={currentLevelDef}
          onOpenLevelSelect={() => {
            setVictoryData(null);
            setScreen('select');
          }}
          onLevelComplete={handleLevelComplete}
          soundEnabled={playerData.soundEnabled}
          onToggleSound={() =>
            setPlayerData((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
          }
          difficulty={difficulty}
        />
      )}

      {screen === 'editor' && (
        <LevelEditor
          onSaveLevel={handleSaveCustomLevel}
          onCancel={() => setScreen('select')}
        />
      )}

      {/* Modal para pedir o cambiar el nombre del alumno */}
      {showNameModal && (
        <NameModal
          initialName={playerData.name}
          onSaveName={handleSaveName}
          onCancel={isFirstTimeName ? undefined : () => setShowNameModal(false)}
          isFirstTime={isFirstTimeName}
        />
      )}

      {/* Modal de Victoria con generador de Captura de Pantalla */}
      {victoryData && (
        <VictoryModal
          levelId={currentLevelDef.id}
          levelTitle={currentLevelDef.title}
          stars={victoryData.stars}
          savedMoney={victoryData.savedMoney}
          budget={difficulty === 'hard' ? Math.round(currentLevelDef.bud * 0.70) : currentLevelDef.bud}
          totalStars={totalStars}
          maxStars={maxStars}
          totalSavings={totalSavings}
          playerName={playerData.name}
          onNextLevel={handleNextLevel}
          onOpenLevelSelect={() => {
            setVictoryData(null);
            setScreen('select');
          }}
          hasNextLevel={typeof currentLevelId === 'number' && currentLevelId < LEVELS.length}
          difficulty={difficulty}
        />
      )}
    </div>
  );
}
