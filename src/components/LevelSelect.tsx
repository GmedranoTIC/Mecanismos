import React, { useState } from 'react';
import { Home, Edit3, Download, Upload, Lock, Star, AlertCircle, Sparkles, User, ShieldAlert, Zap } from 'lucide-react';
import { GameDifficulty, LevelDef, LevelResult } from '../types';
import { MECHANISMS } from '../mechanisms';
import { sounds } from '../audio';
import teacherAvatar from '../assets/images/teacher_avatar_1791217416001.jpg';

interface LevelSelectProps {
  levels: LevelDef[];
  customLevels: LevelDef[];
  completedLevels: Record<number, LevelResult>;
  onSelectLevel: (levelId: number | string) => void;
  onGoToCover: () => void;
  onOpenEditor: () => void;
  onSaveProgressJson: () => void;
  onLoadFileClick: () => void;
  onChangeName: () => void;
  playerName: string;
  difficulty: GameDifficulty;
  onChangeDifficulty: (diff: GameDifficulty) => void;
  isHardUnlocked: boolean;
  normalStars: number;
  hardStars: number;
}

export const LevelSelect: React.FC<LevelSelectProps> = ({
  levels,
  customLevels,
  completedLevels,
  onSelectLevel,
  onGoToCover,
  onOpenEditor,
  onSaveProgressJson,
  onLoadFileClick,
  onChangeName,
  playerName,
  difficulty,
  onChangeDifficulty,
  isHardUnlocked,
  normalStars,
  hardStars,
}) => {
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);

  // Calcular estadísticas globales
  let totalStars = 0;
  let totalSavings = 0;
  let levelsPassed = 0;

  Object.values(completedLevels).forEach((res) => {
    if (res) {
      totalStars += res.s || 0;
      totalSavings += res.m || 0;
      if (res.s > 0) levelsPassed++;
    }
  });

  const maxStars = levels.length * 3;

  const isUnlocked = (lvlId: number): boolean => {
    if (lvlId === 1) return true;
    // Unlocked if previous level has been passed
    return !!completedLevels[lvlId - 1];
  };

  const handleLevelClick = (lvlId: number) => {
    if (isUnlocked(lvlId)) {
      sounds.playClick();
      onSelectLevel(lvlId);
    } else {
      sounds.playBounce(200);
      setLockedNotice(`¡El nivel ${lvlId} está bloqueado! 🔒 Debes superar antes el nivel ${lvlId - 1}.`);
      setTimeout(() => setLockedNotice(null), 3500);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#182328] text-white overflow-hidden">
      {/* Marca de agua GmedranoTIC fija de fondo requerida */}
      <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center -rotate-12 opacity-[0.04] text-[13vw] font-black tracking-wider text-white z-0">
        GmedranoTIC
      </div>

      {/* Cabecera del selector */}
      <header className="relative z-10 bg-[#121c20]/90 backdrop-blur border-b border-slate-700/70 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sounds.playClick();
              onGoToCover();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow transition active:scale-95 cursor-pointer"
            title="Volver a la portada principal"
          >
            <Home size={18} />
            <span>Portada</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onOpenEditor();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold text-sm border border-slate-600 shadow transition active:scale-95 cursor-pointer"
          >
            <Edit3 size={16} className="text-sky-400" />
            <span>Editor</span>
          </button>
        </div>

        {/* Selector de Dificultad (Modo Estándar / Modo Difícil con desbloqueo de 150 estrellas) */}
        <div className="flex items-center bg-[#1e2f38] p-1 rounded-2xl border border-slate-600/90 shadow-md">
          <button
            onClick={() => {
              sounds.playClick();
              onChangeDifficulty('standard');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              difficulty === 'standard'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <span>🟢 Estándar</span>
            <span className="text-[11px] font-mono opacity-80 font-bold">★ {normalStars}/150</span>
          </button>

          <button
            onClick={() => {
              if (isHardUnlocked) {
                sounds.playClick();
                onChangeDifficulty('hard');
              } else {
                sounds.playBounce(300);
                setLockedNotice(
                  `🔒 ¡Modo Difícil Bloqueado! Requiere conseguir las 150 estrellas en Modo Estándar (3 estrellas en cada uno de los 50 niveles). Llevas ${normalStars}/150 ★.`
                );
                setTimeout(() => setLockedNotice(null), 4500);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              difficulty === 'hard'
                ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-lg border border-amber-300'
                : isHardUnlocked
                ? 'text-amber-400 hover:bg-slate-700/50'
                : 'text-slate-500 hover:text-slate-400 opacity-70'
            }`}
            title={
              isHardUnlocked
                ? 'Jugar en Modo Difícil (-30% presupuesto · Rampas -10% · Meta +20% ⇡)'
                : `Bloqueado: Requiere 150 ★ en Modo Estándar (${normalStars}/150)`
            }
          >
            {isHardUnlocked ? <span>⚔️ Modo Difícil</span> : <Lock size={14} className="text-amber-400" />}
            <span className="text-[11px] font-mono font-bold">
              {isHardUnlocked ? `★ ${hardStars}/150` : '150 ★'}
            </span>
          </button>
        </div>

        {/* Datos del Jugador y Progreso */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onChangeName}
            className="flex items-center gap-1.5 bg-[#22323a] hover:bg-[#2b3e48] border border-slate-600 px-3 py-1.5 rounded-full text-xs sm:text-sm text-amber-300 font-bold transition cursor-pointer"
            title="Cambiar nombre"
          >
            <User size={15} />
            <span>{playerName || 'Jugador'}</span>
          </button>

          <div className="bg-[#22323a] border border-slate-600 px-3 py-1.5 rounded-full text-xs sm:text-sm text-slate-200 flex items-center gap-2">
            <span className="text-amber-400 font-bold">★ {totalStars}/{maxStars}</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-bold">💰 {totalSavings.toLocaleString()} €</span>
          </div>
        </div>

        {/* Acciones de Guardar y Cargar JSON */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sounds.playClick();
              onSaveProgressJson();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-600 shadow transition cursor-pointer"
            title="Descargar fichero JSON con tu progreso"
          >
            <Download size={16} className="text-amber-400" />
            <span className="hidden sm:inline">Guardar JSON</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onLoadFileClick();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-600 shadow transition cursor-pointer"
            title="Subir fichero JSON de progreso"
          >
            <Upload size={16} className="text-emerald-400" />
            <span className="hidden sm:inline">Cargar JSON</span>
          </button>
        </div>
      </header>

      {/* Notificación flotante de bloqueo */}
      {lockedNotice && (
        <div className="relative z-20 mx-4 mt-2 p-3 bg-red-950/95 border-2 border-red-500 rounded-xl text-white text-xs sm:text-sm flex items-center justify-between shadow-2xl animate-bounce">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-300 shrink-0" />
            <span className="font-semibold">{lockedNotice}</span>
          </div>
          <button onClick={() => setLockedNotice(null)} className="ml-2 font-bold px-2 py-0.5 text-xs text-red-200 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Contenedor desplazable con los 50 niveles */}
      <main className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 max-w-6xl mx-auto w-full">
        {/* Banner de aviso especial si está en Modo Difícil */}
        {difficulty === 'hard' && (
          <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-red-950/90 via-amber-950/80 to-slate-900 border-2 border-amber-500/80 shadow-lg flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <h3 className="text-sm font-black text-amber-300">MODO DIFÍCIL ACTIVO (50 RETOS EXPERTOS)</h3>
              <p className="text-xs text-slate-200">
                El presupuesto de cada reto se reduce un <strong>30%</strong>, las rampas de los niveles son un <strong>10% más cortas</strong> y la meta está un <strong>20% más arriba</strong>. Debes resolver cada máquina con la máxima precisión y eficiencia técnica para ganar las 3 estrellas de maestría.
              </p>
            </div>
          </div>
        )}

        {/* Título de sección con avatar del docente */}
        <div className="mb-4 flex flex-wrap items-center justify-between border-b border-slate-700/60 pb-3 gap-3">
          <div className="flex items-center gap-3">
            <img
              src={teacherAvatar}
              alt="Prof. @GmedranoTIC"
              className="w-12 h-12 rounded-xl object-cover border-2 border-amber-400 shadow-md"
            />
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                <span>Selección de Retos</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  difficulty === 'hard'
                    ? 'bg-red-500/30 text-amber-300 border-red-400/50'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {difficulty === 'hard' ? '⚔️ 50 Niveles Modo Difícil' : '🟢 50 Niveles Modo Estándar'}
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Cada reto exige interactuar con mecanismos específicos: poleas, bielas, engranajes, cañones, cremalleras y levas.
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-slate-400 hidden sm:block">
            <span>Completados: </span>
            <span className="font-bold text-amber-400">{levelsPassed}</span>
            <span> / 50</span>
          </div>
        </div>

        {/* Cuadrícula de Niveles Oficiales (1..50) */}
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2.5 sm:gap-3">
          {levels.map((lvl) => {
            const id = lvl.id as number;
            const unlocked = isUnlocked(id);
            const result = completedLevels[id];
            const stars = result ? result.s : 0;
            const mechIcon = lvl.requiredMech
              ? MECHANISMS.find((m) => m.id === lvl.requiredMech)?.i
              : null;

            return (
              <button
                key={`lvl-${id}`}
                onClick={() => handleLevelClick(id)}
                disabled={!unlocked}
                className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-150 min-h-[78px] sm:min-h-[86px] border ${
                  unlocked
                    ? stars > 0
                      ? 'bg-gradient-to-b from-[#253942] to-[#1c2c33] border-amber-500/50 hover:border-amber-400 hover:scale-105 shadow-md shadow-black/30 cursor-pointer'
                      : 'bg-gradient-to-b from-[#1f3139] to-[#17252b] border-slate-600 hover:border-slate-400 hover:scale-105 shadow cursor-pointer'
                    : 'bg-[#151c20]/70 border-slate-800 text-slate-600 cursor-not-allowed opacity-60'
                }`}
                title={unlocked ? `${lvl.title}\n${lvl.mechFocus || ''}` : `Nivel ${id} bloqueado`}
              >
                {/* Icono del mecanismo clave si está desbloqueado */}
                {unlocked && mechIcon && (
                  <span className="absolute top-1 right-1.5 text-xs opacity-80" title={`Mecanismo clave: ${lvl.requiredMech}`}>
                    {mechIcon}
                  </span>
                )}

                {/* Número o Candado */}
                {unlocked ? (
                  <span className="text-base sm:text-lg font-black text-slate-100">{id}</span>
                ) : (
                  <Lock size={18} className="text-slate-600 mb-1" />
                )}

                {/* Estrellas obtenidas */}
                {unlocked && (
                  <div className="flex items-center gap-0.5 mt-1 text-xs">
                    {[1, 2, 3].map((sIndex) => (
                      <span
                        key={sIndex}
                        className={sIndex <= stars ? 'text-amber-400 font-bold drop-shadow' : 'text-slate-600'}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                )}

                {/* Dinero ahorrado si lo ha superado */}
                {result && result.m > 0 && (
                  <span className="text-[10px] text-emerald-400/90 font-mono mt-0.5">
                    +{result.m}€
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sección de Niveles Personalizados del Editor si existen */}
        {customLevels && customLevels.length > 0 && (
          <div className="mt-8 border-t border-slate-700/60 pt-4">
            <h3 className="text-base font-bold text-sky-400 flex items-center gap-2 mb-3">
              <Sparkles size={16} />
              <span>Niveles Personalizados ({customLevels.length})</span>
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {customLevels.map((cLevel, cIdx) => (
                <button
                  key={`custom-${cIdx}`}
                  onClick={() => {
                    sounds.playClick();
                    onSelectLevel(`c${cIdx}`);
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-sky-950/40 hover:bg-sky-900/60 border border-sky-600/50 hover:border-sky-400 transition hover:scale-105 cursor-pointer shadow min-h-[74px]"
                >
                  <span className="text-xs text-sky-300 font-bold">✎ Reto</span>
                  <span className="text-lg font-black text-white">{cIdx + 1}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Pie de pantalla */}
      <footer className="relative z-10 bg-[#121c20] border-t border-slate-800 px-4 py-2 text-center text-xs text-slate-400 flex flex-wrap items-center justify-between">
        <span>Mecanismos ESO · Creado por <strong className="text-amber-400">@GmedranoTIC</strong></span>
        <span>Guarda tu archivo .json para no perder tus avances</span>
      </footer>
    </div>
  );
};
