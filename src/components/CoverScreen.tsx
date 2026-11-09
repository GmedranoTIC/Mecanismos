import React from 'react';
import { Play, Grid, Upload, Edit3, Volume2, VolumeX, Sparkles, Compass, ShieldCheck, Zap, Lock } from 'lucide-react';
import { sounds } from '../audio';
import coverImg from '../assets/images/gmedranotic_cover_1791217402653.jpg';
import teacherAvatar from '../assets/images/teacher_avatar_1791217416001.jpg';
import { GameDifficulty } from '../types';

interface CoverScreenProps {
  onPlay: () => void;
  onOpenLevels: () => void;
  onOpenEditor: () => void;
  onLoadFileClick: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  playerName: string;
  totalStars: number;
  maxStars: number;
  totalSavings: number;
  difficulty: GameDifficulty;
  onChangeDifficulty: (diff: GameDifficulty) => void;
  isHardUnlocked: boolean;
  normalStars: number;
  hardStars: number;
}

export const CoverScreen: React.FC<CoverScreenProps> = ({
  onPlay,
  onOpenLevels,
  onOpenEditor,
  onLoadFileClick,
  soundEnabled,
  onToggleSound,
  playerName,
  totalStars,
  maxStars,
  totalSavings,
  difficulty,
  onChangeDifficulty,
  isHardUnlocked,
  normalStars,
  hardStars,
}) => {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-2 sm:p-4 md:p-6 bg-[#0f171b] text-white overflow-y-auto">
      {/* Barra superior de perfil, dificultad y control de sonido */}
      <div className="w-full max-w-5xl flex flex-wrap items-center justify-between text-xs sm:text-sm font-medium z-10 px-2 py-1 gap-2">
        <div className="flex items-center gap-2.5 bg-[#18262d]/90 backdrop-blur px-3.5 py-1.5 rounded-full border border-slate-700/80 shadow-lg">
          <img
            src={teacherAvatar}
            alt="@GmedranoTIC"
            className="w-7 h-7 rounded-full border border-amber-400 object-cover shadow"
          />
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-extrabold tracking-wide">
              {playerName ? `👤 ${playerName}` : '👤 Alumno/a'}
            </span>
            <span className="text-slate-300 border-l border-slate-600 pl-2 font-mono">
              ★ {totalStars}/{maxStars} · 💰 {totalSavings.toLocaleString()} €
            </span>
          </div>
        </div>

        {/* Selector rápido de Dificultad */}
        <div className="flex items-center bg-[#18262d]/90 backdrop-blur p-1 rounded-full border border-slate-700/80 shadow-lg">
          <button
            onClick={() => {
              sounds.playClick();
              onChangeDifficulty('standard');
            }}
            className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
              difficulty === 'standard'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            🟢 Estándar ({normalStars}/150 ★)
          </button>

          <button
            onClick={() => {
              if (isHardUnlocked) {
                sounds.playClick();
                onChangeDifficulty('hard');
              } else {
                sounds.playBounce(300);
                alert(`🔒 ¡Modo Difícil Bloqueado! Requiere conseguir las 150 estrellas en Modo Estándar. Llevas ${normalStars}/150 ★.`);
              }
            }}
            className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              difficulty === 'hard'
                ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md border border-amber-400'
                : isHardUnlocked
                ? 'text-amber-400 hover:text-white'
                : 'text-slate-500'
            }`}
            title={isHardUnlocked ? 'Modo Difícil: -30% presupuesto · Rampas -10% · Meta +20% ⇡' : `Requiere 150 estrellas en Modo Estándar (${normalStars}/150)`}
          >
            {isHardUnlocked ? <span>⚔️ Modo Difícil</span> : <Lock size={12} />}
            <span>{isHardUnlocked ? `(${hardStars}/150 ★)` : 'Modo Difícil (150 ★)'}</span>
          </button>
        </div>

        <button
          onClick={onToggleSound}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#18262d]/90 hover:bg-[#22353f] transition border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer shadow-md"
          title={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
        >
          {soundEnabled ? (
            <Volume2 size={16} className="text-amber-400 animate-pulse" />
          ) : (
            <VolumeX size={16} className="text-rose-400" />
          )}
          <span>{soundEnabled ? 'Sonido ON' : 'Mute'}</span>
        </button>
      </div>

      {/* Portada 16:9 Central Atractiva para Alumnado Adolescente con Foto 3D del Docente */}
      <div className="relative w-full max-w-5xl flex-1 flex items-center justify-center my-2 sm:my-3">
        <div className="w-full max-w-[940px] aspect-[16/9] max-h-[70vh] rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.2)] border-2 border-amber-500/40 relative group bg-gradient-to-br from-[#102028] via-[#162731] to-[#2b1c12]">
          {/* Imagen de Portada 16:9 de Alta Definición */}
          <img
            src={coverImg}
            alt="Juego de Mecanismos de GmedranoTIC"
            className="w-full h-full object-cover object-center select-none transform transition-transform duration-700 group-hover:scale-[1.02]"
          />

          {/* Gradiente cinemático inferior para legibilidad perfecta */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#091116] via-[#091116]/40 to-transparent pointer-events-none" />

          {/* Rótulo superior con marca de agua y badge */}
          <div className="absolute top-3 left-3 sm:top-5 sm:left-5 flex flex-wrap items-center gap-2 pointer-events-none">
            <span className="bg-amber-500 text-slate-950 font-black text-[10px] sm:text-xs px-2.5 py-1 rounded-md tracking-wider uppercase shadow-md flex items-center gap-1">
              <Zap size={13} className="fill-current" />
              Tecnología ESO
            </span>
            <span className="bg-[#0f171b]/80 backdrop-blur border border-slate-600 text-slate-200 font-semibold text-[10px] sm:text-xs px-2.5 py-1 rounded-md shadow">
              Física Interactiva &amp; Rube Goldberg
            </span>
          </div>

          {/* Avatar del Docente flotante estilo videojuego */}
          <div className="absolute top-3 right-3 sm:top-5 sm:right-5 flex items-center gap-2.5 bg-[#0e171c]/85 backdrop-blur-md border border-amber-500/50 p-1.5 sm:p-2 rounded-2xl shadow-xl">
            <img
              src={teacherAvatar}
              alt="Profesor GmedranoTIC"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover border-2 border-amber-400 shadow-md"
            />
            <div className="text-left pr-2 hidden sm:block">
              <div className="text-[11px] font-black text-amber-400 leading-tight">Prof. @GmedranoTIC</div>
              <div className="text-[10px] text-slate-300 font-medium">Docente de Tecnología</div>
            </div>
          </div>

          {/* Bloque de Título y Subtítulo Oficiales */}
          <div className="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-6 pointer-events-none text-left">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] leading-none">
              Juego de mecanismos
            </h1>
            <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-amber-400 drop-shadow-[0_4px_16px_rgba(245,158,11,0.5)] mt-1">
              de GmedranoTIC
            </h2>

            {/* Subtítulo oficial requerido */}
            <div className="mt-2 sm:mt-3 bg-[#0a1216]/80 backdrop-blur-md border-l-4 border-amber-400 px-3 py-1.5 rounded-r-lg max-w-2xl shadow-lg">
              <p className="text-xs sm:text-sm font-bold text-slate-200 leading-snug">
                Juego educativo para aprender mecanismos en la ESO
              </p>
              <p className="text-[11px] sm:text-xs font-semibold text-amber-300">
                creado por <span className="underline decoration-amber-400">@GmedranoTIC</span>
              </p>
            </div>
          </div>

          {/* Marca de agua esquina inferior derecha */}
          <div className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5 pointer-events-none opacity-40 text-xs sm:text-sm font-black tracking-widest text-slate-400">
            GmedranoTIC
          </div>
        </div>
      </div>

      {/* Botonera de Acción Principal Adaptada y Llamativa */}
      <div className="w-full max-w-4xl flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 py-1 z-10">
        <button
          onClick={() => {
            sounds.playClick();
            onPlay();
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-base sm:text-lg px-8 sm:px-10 py-3.5 rounded-2xl shadow-[0_0_24px_rgba(245,158,11,0.4)] transition transform active:scale-95 cursor-pointer min-h-[50px] border-2 border-amber-300"
        >
          <Play size={22} className="fill-current" />
          <span>¡JUGAR AHORA!</span>
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            onOpenLevels();
          }}
          className="flex items-center justify-center gap-2 bg-[#1b2b33] hover:bg-[#243944] text-white font-bold text-sm sm:text-base px-6 py-3.5 rounded-2xl border border-slate-600 shadow-md transition transform active:scale-95 cursor-pointer min-h-[50px]"
        >
          <Grid size={19} className="text-amber-400" />
          <span>50 Retos Mecánicos</span>
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            onOpenEditor();
          }}
          className="flex items-center justify-center gap-2 bg-[#1b2b33] hover:bg-[#243944] text-white font-bold text-sm sm:text-base px-5 py-3.5 rounded-2xl border border-slate-600 shadow-md transition transform active:scale-95 cursor-pointer min-h-[50px]"
        >
          <Edit3 size={18} className="text-sky-400" />
          <span>Editor de Niveles</span>
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            onLoadFileClick();
          }}
          className="flex items-center justify-center gap-2 bg-[#142026] hover:bg-[#1a2c35] text-slate-300 font-semibold text-xs sm:text-sm px-5 py-3.5 rounded-2xl border border-slate-700 shadow transition transform active:scale-95 cursor-pointer min-h-[50px]"
        >
          <Upload size={17} className="text-emerald-400" />
          <span>Cargar Progreso (.json)</span>
        </button>
      </div>

      {/* Pie informativo de autoría */}
      <footer className="text-center text-[11px] sm:text-xs text-slate-400 py-1 flex items-center justify-center gap-1.5">
        <span>Diseñado para alumnos de Tecnología e Ingeniería ESO</span>
        <span>·</span>
        <span className="text-amber-400 font-bold">@GmedranoTIC</span>
        <span>·</span>
        <span className="text-emerald-400">100% Autónomo sin dependencias externas</span>
      </footer>
    </div>
  );
};
