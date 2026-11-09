import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Play, Trash2, Check, Plus, Minus, Key, Box, Settings, Sparkles, Filter } from 'lucide-react';
import { LevelDef, MechanismCategory } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, BALL_RADIUS } from '../physics';
import { sounds } from '../audio';
import { MECHANISMS, CATEGORIES } from '../mechanisms';

interface LevelEditorProps {
  onSaveLevel: (level: LevelDef) => void;
  onCancel: () => void;
}

type EditorTool = 'spawn' | 'basket' | 'wall';
type EditorTab = 'canvas' | 'mechs';

export const LevelEditor: React.FC<LevelEditorProps> = ({ onSaveLevel, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeTab, setActiveTab] = useState<EditorTab>('canvas');
  const [tool, setTool] = useState<EditorTool>('wall');
  const [spawn, setSpawn] = useState<[number, number]>([80, 80]);
  const [basket, setBasket] = useState<[number, number]>([680, 430]);
  const [walls, setWalls] = useState<[number, number, number, number][]>([
    [380, 490, 380, 240],
  ]);
  const [budget, setBudget] = useState<number>(180);
  const [title, setTitle] = useState<string>('Mi Reto Personalizado');

  // Estado de mecanismos permitidos y número de unidades
  // Por defecto, todos los mecanismos están habilitados con 2 unidades
  const [enabledMechs, setEnabledMechs] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    MECHANISMS.forEach((m) => {
      map[m.id] = true;
    });
    return map;
  });

  const [mechUnits, setMechUnits] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    MECHANISMS.forEach((m) => {
      // Valor por defecto: 2 unidades (o 3 para rampas)
      map[m.id] = m.id === 'rampa' ? 4 : 2;
    });
    return map;
  });

  // Elemento clave obligatorio del nivel
  const [requiredMech, setRequiredMech] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Arrastre para dibujar muro
  const dragWall = useRef<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    return [
      Math.round(Math.max(10, Math.min(CANVAS_WIDTH - 10, x))),
      Math.round(Math.max(10, Math.min(CANVAS_HEIGHT - 10, y))),
    ];
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [x, y] = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (canvas) canvas.setPointerCapture(e.pointerId);

    if (tool === 'spawn') {
      sounds.playClick();
      setSpawn([x, Math.min(y, CANVAS_HEIGHT - 40)]);
    } else if (tool === 'basket') {
      sounds.playClick();
      setBasket([x, Math.min(y, CANVAS_HEIGHT - 40)]);
    } else if (tool === 'wall') {
      dragWall.current = { startX: x, startY: y, curX: x, curY: y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'wall' && dragWall.current) {
      const [x, y] = getCanvasCoords(e);
      dragWall.current.curX = x;
      dragWall.current.curY = y;
      redraw();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (tool === 'wall' && dragWall.current) {
      const { startX, startY, curX, curY } = dragWall.current;
      const dist = Math.hypot(curX - startX, curY - startY);
      if (dist > 18) {
        sounds.playClick();
        setWalls((prev) => [...prev, [startX, startY, curX, curY]]);
      }
      dragWall.current = null;
      redraw();
    }
  };

  const handleUndoWall = () => {
    sounds.playClick();
    setWalls((prev) => prev.slice(0, -1));
  };

  // Controles de mecanismos
  const handleToggleMech = (mechId: string) => {
    sounds.playClick();
    setEnabledMechs((prev) => {
      const nextState = !prev[mechId];
      if (!nextState && requiredMech === mechId) {
        setRequiredMech(null);
      }
      return { ...prev, [mechId]: nextState };
    });
  };

  const handleChangeUnits = (mechId: string, delta: number) => {
    sounds.playClick();
    setMechUnits((prev) => {
      const current = prev[mechId] ?? 2;
      const next = Math.max(1, Math.min(20, current + delta));
      return { ...prev, [mechId]: next };
    });
  };

  const handleSetUnlimited = (mechId: string) => {
    sounds.playClick();
    setMechUnits((prev) => ({ ...prev, [mechId]: 99 }));
  };

  const handleToggleRequired = (mechId: string) => {
    sounds.playClick();
    // Asegurar que el mecanismo esté habilitado
    if (!enabledMechs[mechId]) {
      setEnabledMechs((prev) => ({ ...prev, [mechId]: true }));
    }
    setRequiredMech((prev) => (prev === mechId ? null : mechId));
  };

  const handleSelectAll = (units: number) => {
    sounds.playClick();
    const newEnabled: Record<string, boolean> = {};
    const newUnits: Record<string, number> = {};
    MECHANISMS.forEach((m) => {
      newEnabled[m.id] = true;
      newUnits[m.id] = units;
    });
    setEnabledMechs(newEnabled);
    setMechUnits(newUnits);
  };

  const handleDeselectAll = () => {
    sounds.playClick();
    const newEnabled: Record<string, boolean> = {};
    MECHANISMS.forEach((m) => {
      newEnabled[m.id] = false;
    });
    setEnabledMechs(newEnabled);
    setRequiredMech(null);
  };

  const handleSaveAndTest = () => {
    sounds.playClick();

    // Obtener lista de mecanismos habilitados
    const allowed = MECHANISMS.filter((m) => enabledMechs[m.id]).map((m) => m.id);
    if (allowed.length === 0) {
      alert('Debes habilitar al menos un artefacto para el nivel en la pestaña "Artefactos y Unidades".');
      setActiveTab('mechs');
      return;
    }

    // Construir mapa de límites de unidades
    const maxUnitsMap: Record<string, number> = {};
    allowed.forEach((id) => {
      const u = mechUnits[id];
      if (u && u < 99) {
        maxUnitsMap[id] = u;
      }
    });

    const newLvl: LevelDef = {
      id: `custom_${Date.now()}`,
      title: title.trim() || 'Reto Personalizado',
      s: spawn,
      b: basket,
      w: walls,
      bud: Number(budget) || 160,
      tip: 'Nivel diseñado en el editor personalizado de GmedranoTIC con selección de artefactos y unidades.',
      allowedMechs: allowed,
      maxUnits: Object.keys(maxUnitsMap).length > 0 ? maxUnitsMap : undefined,
      requiredMech: requiredMech && enabledMechs[requiredMech] ? requiredMech : undefined,
    };

    onSaveLevel(newLvl);
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fondo
    ctx.fillStyle = '#1c282e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Cuadrícula
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Suelo
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT - 5);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 5);
    ctx.stroke();

    // Muros existentes
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    for (const w of walls) {
      ctx.beginPath();
      ctx.moveTo(w[0], w[1]);
      ctx.lineTo(w[2], w[3]);
      ctx.stroke();
    }

    // Muro en proceso de dibujo
    if (dragWall.current) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.lineWidth = 6;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(dragWall.current.startX, dragWall.current.startY);
      ctx.lineTo(dragWall.current.curX, dragWall.current.curY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Cesta objetivo
    const [bx, by] = basket;
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bx - 26, by);
    ctx.lineTo(bx - 26, by + 30);
    ctx.lineTo(bx + 26, by + 30);
    ctx.lineTo(bx + 26, by);
    ctx.stroke();
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('META 🎯', bx, by - 8);

    // Salida de la bola
    const [sx, sy] = spawn;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(sx, sy, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('SALIDA 🔴', sx, sy - 14);

    // Marca de agua
    ctx.font = '900 60px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.textAlign = 'center';
    ctx.fillText('Editor GmedranoTIC', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  };

  useEffect(() => {
    if (activeTab === 'canvas') {
      redraw();
    }
  }, [spawn, basket, walls, tool, activeTab]);

  const enabledCount = Object.values(enabledMechs).filter(Boolean).length;
  const filteredMechanisms = MECHANISMS.filter(
    (m) => selectedCategory === 'all' || m.category === selectedCategory
  );

  return (
    <div className="relative w-full h-full flex flex-col bg-[#141d22] text-white overflow-hidden select-none">
      {/* Barra superior de herramientas del editor */}
      <header className="relative z-10 bg-[#1c2930] border-b border-slate-700 p-2 sm:p-3 flex flex-wrap items-center justify-between gap-2 shadow">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sounds.playClick();
              onCancel();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs sm:text-sm cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Volver</span>
          </button>
          <span className="font-extrabold text-amber-400 text-xs sm:text-sm flex items-center gap-1">
            <span>✎ Editor de Rompecabezas</span>
          </span>
        </div>

        {/* Pestañas principales: Circuito vs Mecanismos */}
        <div className="flex items-center bg-[#121c21] p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('canvas');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'canvas'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>🎨 1. Diseñar Circuito</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('mechs');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'mechs'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Box size={14} />
            <span>2. Artefactos y Unidades</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'mechs' ? 'bg-slate-900 text-amber-300' : 'bg-slate-700 text-slate-200'
              }`}
            >
              {enabledCount}/{MECHANISMS.length}
            </span>
          </button>
        </div>

        {/* Ajuste de presupuesto y botón de guardar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">Presupuesto:</span>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Math.max(50, Number(e.target.value)))}
              className="w-16 px-2 py-1 bg-[#121c21] border border-slate-600 rounded text-center text-emerald-400 font-bold font-mono text-xs"
              min={50}
              max={1000}
            />
            <span className="text-emerald-400">€</span>
          </div>

          <button
            onClick={handleSaveAndTest}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs sm:text-sm shadow cursor-pointer active:scale-95"
          >
            <Play size={16} className="fill-current" />
            <span>Guardar y Probar</span>
          </button>
        </div>
      </header>

      {/* PESTAÑA 1: DISEÑAR CIRCUITO EN EL CANVAS */}
      {activeTab === 'canvas' && (
        <>
          {/* Barra de herramientas para el Canvas */}
          <div className="bg-[#182329] border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 mr-1 hidden sm:inline">Herramientas:</span>
              <button
                onClick={() => {
                  sounds.playClick();
                  setTool('wall');
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  tool === 'wall'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-[#23333c] text-slate-300 hover:bg-slate-700'
                }`}
              >
                🧱 Muro Obstáculo
              </button>

              <button
                onClick={() => {
                  sounds.playClick();
                  setTool('spawn');
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  tool === 'spawn'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-[#23333c] text-slate-300 hover:bg-slate-700'
                }`}
              >
                🔴 Posición Bola (S)
              </button>

              <button
                onClick={() => {
                  sounds.playClick();
                  setTool('basket');
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  tool === 'basket'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-[#23333c] text-slate-300 hover:bg-slate-700'
                }`}
              >
                🎯 Cesta Meta (B)
              </button>
            </div>

            {/* Título editable del nivel */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Nombre:</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del reto..."
                className="px-2.5 py-1 bg-[#121c21] border border-slate-700 rounded text-xs text-amber-300 font-bold max-w-[200px]"
                maxLength={40}
              />
            </div>

            {walls.length > 0 && (
              <button
                onClick={handleUndoWall}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 cursor-pointer font-bold"
              >
                <Trash2 size={14} />
                <span>Deshacer muro ({walls.length})</span>
              </button>
            )}
          </div>

          {/* Área del canvas */}
          <main className="relative flex-1 w-full h-full flex items-center justify-center p-2 overflow-hidden bg-[#10171a]">
            <div className="relative w-full h-full max-w-[880px] max-h-[550px] aspect-[8/5] flex items-center justify-center shadow-2xl rounded-xl overflow-hidden border border-slate-700/60 bg-[#1c282e]">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="w-full h-full object-contain cursor-crosshair touch-none select-none block"
              />
            </div>
          </main>

          <footer className="bg-[#121c20] border-t border-slate-800 p-2 text-center text-xs text-slate-400 flex items-center justify-center gap-4 flex-wrap">
            <span>🖱️ Haz clic y arrastra en el tapiz para trazar muros.</span>
            <span>🔴 Pulsa en Salida o Cesta para recolocarlas.</span>
            <button
              onClick={() => setActiveTab('mechs')}
              className="text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
            >
              Configurar artefactos disponibles ({enabledCount}) ➔
            </button>
          </footer>
        </>
      )}

      {/* PESTAÑA 2: SELECCIÓN DE TODOS LOS ARTEFACTOS Y NÚMERO DE UNIDADES */}
      {activeTab === 'mechs' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#121c21]">
          {/* Sub-barra de acciones rápidas para artefactos */}
          <div className="bg-[#182329] border-b border-slate-700 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Filtro por categorías */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-slate-400 font-bold flex items-center gap-1 mr-1">
                <Filter size={13} /> Categoría:
              </span>
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-[#202e35] text-slate-300 hover:text-white'
                }`}
              >
                Todos ({MECHANISMS.length})
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1 ${
                    selectedCategory === cat.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[#202e35] text-slate-300 hover:text-white'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Botones de selección masiva */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectAll(2)}
                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 font-bold cursor-pointer"
              >
                ✓ Todos (2 uds)
              </button>
              <button
                onClick={() => handleSelectAll(99)}
                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 font-bold cursor-pointer"
              >
                ∞ Todos Ilimitados
              </button>
              <button
                onClick={handleDeselectAll}
                className="px-2.5 py-1 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 rounded-lg font-bold cursor-pointer"
              >
                ✕ Desmarcar Todos
              </button>
            </div>
          </div>

          {/* Rejilla de todos los artefactos para seleccionar y ajustar unidades */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 scrollbar-thin">
            <div className="max-w-6xl mx-auto">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                <p>
                  Marca los artefactos que estarán en la paleta del jugador y define cuántas unidades podrá colocar
                  de cada uno. Si marcas uno como <span className="text-amber-400 font-bold">Elemento Clave 🔑</span>,
                  el jugador deberá usarlo obligatoriamente para superar el nivel.
                </p>
                <span className="font-mono text-emerald-400 font-bold shrink-0 ml-2">
                  {enabledCount} de {MECHANISMS.length} activos
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMechanisms.map((mech) => {
                  const isEnabled = enabledMechs[mech.id] ?? false;
                  const units = mechUnits[mech.id] ?? 2;
                  const isKey = requiredMech === mech.id;

                  return (
                    <div
                      key={mech.id}
                      className={`relative flex flex-col justify-between p-3.5 rounded-2xl border transition ${
                        isKey
                          ? 'bg-[#272115] border-amber-400/90 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : isEnabled
                          ? 'bg-[#1a262c] border-slate-700 hover:border-slate-500'
                          : 'bg-[#141b20] border-slate-800/80 opacity-55 hover:opacity-80'
                      }`}
                    >
                      {/* Cabecera del mecanismo con checkbox y precio */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleMech(mech.id)}
                            className={`w-5 h-5 rounded-md flex items-center justify-center border cursor-pointer transition ${
                              isEnabled
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-black'
                                : 'bg-[#121c21] border-slate-600'
                            }`}
                          >
                            {isEnabled && <Check size={14} strokeWidth={3} />}
                          </button>
                          <span className="text-2xl">{mech.i}</span>
                          <div>
                            <h3 className="font-extrabold text-sm text-white leading-tight">{mech.n}</h3>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Categoría: {CATEGORIES.find((c) => c.id === mech.category)?.label || mech.category}
                            </span>
                          </div>
                        </div>

                        <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                          {mech.c} €
                        </span>
                      </div>

                      {/* Descripción breve */}
                      <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">{mech.desc}</p>

                      {/* Controles de unidades y elemento clave */}
                      <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2 mt-auto">
                        {/* Selector de número de unidades */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-bold">Unidades:</span>
                          <div className="flex items-center bg-[#10171a] rounded-lg border border-slate-700 p-0.5">
                            <button
                              type="button"
                              disabled={!isEnabled || units <= 1}
                              onClick={() => handleChangeUnits(mech.id, -1)}
                              className="p-1 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              title="Reducir unidades"
                            >
                              <Minus size={12} />
                            </button>

                            <span
                              className={`w-9 text-center font-mono text-xs font-black ${
                                units >= 99 ? 'text-amber-400' : 'text-cyan-300'
                              }`}
                            >
                              {units >= 99 ? '∞' : units}
                            </span>

                            <button
                              type="button"
                              disabled={!isEnabled || units >= 20}
                              onClick={() => handleChangeUnits(mech.id, 1)}
                              className="p-1 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              title="Aumentar unidades"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={!isEnabled}
                            onClick={() => handleSetUnlimited(mech.id)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer disabled:opacity-30"
                            title="Unidades ilimitadas"
                          >
                            ∞
                          </button>
                        </div>

                        {/* Botón de Elemento Clave obligatorio */}
                        <button
                          type="button"
                          disabled={!isEnabled}
                          onClick={() => handleToggleRequired(mech.id)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer disabled:opacity-30 ${
                            isKey
                              ? 'bg-amber-400 text-slate-950 shadow'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                          }`}
                          title="Hacer este elemento obligatorio para superar el nivel"
                        >
                          <Key size={11} />
                          <span>{isKey ? '★ CLAVE' : 'Hacer Clave'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <footer className="bg-[#182329] border-t border-slate-800 p-2.5 px-4 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {requiredMech ? (
                <span>
                  🔑 Elemento clave obligatorio:{' '}
                  <span className="text-amber-400 font-bold">
                    {MECHANISMS.find((m) => m.id === requiredMech)?.n || requiredMech}
                  </span>
                </span>
              ) : (
                <span>Sin elemento clave obligatorio (cualquier combinación que llegue a la meta vale).</span>
              )}
            </span>

            <button
              onClick={() => setActiveTab('canvas')}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
            >
              Volver al Canvas ➔
            </button>
          </footer>
        </div>
      )}
    </div>
  );
};
