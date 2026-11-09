import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Play,
  RotateCcw,
  RotateCw,
  Trash2,
  Menu,
  Info,
  DollarSign,
  Star,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BallState, GameDifficulty, LevelDef, MechanismCategory, PlacedPart } from '../types';
import { MECHANISMS, CATEGORIES } from '../mechanisms';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BALL_RADIUS,
  generateSegments,
  stepPhysics,
  getEffectiveLevel,
} from '../physics';
import { sounds } from '../audio';
import teacherAvatar from '../assets/images/teacher_avatar_1791217416001.jpg';

interface GameScreenProps {
  level: LevelDef;
  onOpenLevelSelect: () => void;
  onLevelComplete: (stars: number, savedMoney: number) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  difficulty?: GameDifficulty;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  level,
  onOpenLevelSelect,
  onLevelComplete,
  soundEnabled,
  onToggleSound,
  difficulty = 'standard',
}) => {
  // Nivel efectivo con adaptaciones del modo de dificultad:
  // En 'hard': presupuesto -30%, rampas de los niveles 10% más cortas, meta 20% más arriba
  const effectiveLevel = useMemo(() => getEffectiveLevel(level, difficulty), [level, difficulty]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Estados de simulación
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [parts, setParts] = useState<PlacedPart[]>([]);
  const [selectedPartIndex, setSelectedPartIndex] = useState<number | null>(null);
  const [selectedToolIndex, setSelectedToolIndex] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState<MechanismCategory>('rube');
  const [showTip, setShowTip] = useState<boolean>(true);
  const [keyMechAlert, setKeyMechAlert] = useState<string | null>(null);

  // Estados para arrastre en pantalla táctil / ratón
  const dragInfo = useRef<{
    isDragging: boolean;
    partIndex: number | null;
    startX: number;
    startY: number;
  }>({
    isDragging: false,
    partIndex: null,
    startX: 0,
    startY: 0,
  });

  // Estado mutable para bucle de animación sin re-renderizar
  const simState = useRef<{
    balls: BallState[];
    time: number;
    animFrameId: number | null;
    lastTimestamp: number;
  }>({
    balls: [{ x: effectiveLevel.s[0], y: effectiveLevel.s[1], vx: 0, vy: 0 }],
    time: 0,
    animFrameId: null,
    lastTimestamp: 0,
  });

  // Partículas de viento y efectos
  const particles = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }>>([]);

  // Referencia mutable a las piezas actuales para evitar bucles infinitos en useEffect
  const partsRef = useRef<PlacedPart[]>(parts);
  partsRef.current = parts;

  // Reiniciar estado de la bola al cambiar de nivel o reintentar
  const resetSimulation = useCallback(() => {
    setIsRunning(false);
    const initialBalls: BallState[] = [
      { x: effectiveLevel.s[0], y: effectiveLevel.s[1], vx: 0, vy: 0 },
    ];
    if (effectiveLevel.extraBalls) {
      for (const eb of effectiveLevel.extraBalls) {
        initialBalls.push({ x: eb[0], y: eb[1], vx: 0, vy: 0 });
      }
    }
    // Añadir bolas de piezas "bola_extra" colocadas
    for (const p of partsRef.current) {
      const m = MECHANISMS[p.i];
      if (m?.id === 'bola_extra') {
        initialBalls.push({ x: p.x, y: p.y - 10, vx: 0, vy: 0 });
      }
    }

    simState.current.balls = initialBalls;
    simState.current.time = 0;
    // Restablecer estados de disparo, palancas y dominós
    setParts((prev) =>
      prev.map((p) => ({
        ...p,
        f: 0,
        fallAngle: 0,
        fallVel: 0,
        fallDir: 0,
        firedBall: false,
      }))
    );
    particles.current = [];
  }, [effectiveLevel]);

  // Inicializar nivel al cambiar level.id o difficulty
  useEffect(() => {
    setIsRunning(false);
    const initialBalls: BallState[] = [
      { x: effectiveLevel.s[0], y: effectiveLevel.s[1], vx: 0, vy: 0 },
    ];
    if (effectiveLevel.extraBalls) {
      for (const eb of effectiveLevel.extraBalls) {
        initialBalls.push({ x: eb[0], y: eb[1], vx: 0, vy: 0 });
      }
    }
    simState.current.balls = initialBalls;
    simState.current.time = 0;
    setParts([]);
    setSelectedPartIndex(null);
    setShowTip(true);

    const levelNum = typeof effectiveLevel.id === 'number' ? effectiveLevel.id : 99;
    const available = MECHANISMS.filter((m) => {
      if (effectiveLevel.allowedMechs && effectiveLevel.allowedMechs.length > 0) {
        return effectiveLevel.allowedMechs.includes(m.id);
      }
      return m.u <= levelNum;
    });

    if (available.length > 0) {
      let targetMech = available[0];
      if (effectiveLevel.requiredMech) {
        const req = available.find((m) => m.id === effectiveLevel.requiredMech);
        if (req) targetMech = req;
      }
      const originalIdx = MECHANISMS.findIndex((m) => m.id === targetMech.id);
      setSelectedToolIndex(originalIdx >= 0 ? originalIdx : 0);
      setActiveCategory(targetMech.category);
    }
  }, [effectiveLevel]);

  // Filtrar mecanismos disponibles para este nivel (respetando allowedMechs si existe)
  const levelNum = typeof effectiveLevel.id === 'number' ? effectiveLevel.id : 99;
  const availableMechs = useMemo(() => {
    return MECHANISMS.filter((m) => {
      if (effectiveLevel.allowedMechs && effectiveLevel.allowedMechs.length > 0) {
        return effectiveLevel.allowedMechs.includes(m.id);
      }
      return m.u <= levelNum;
    });
  }, [effectiveLevel.allowedMechs, levelNum]);

  // Presupuesto efectivo: en Modo Difícil ya está reducido un 30% en effectiveLevel.bud
  const effectiveBudget = effectiveLevel.bud;

  // Coste actual de los mecanismos colocados
  const currentCost = parts.reduce((acc, p) => acc + (MECHANISMS[p.i]?.c || 0), 0);
  const remainingBudget = effectiveBudget - currentCost;
  const costRatio = currentCost / (effectiveBudget || 1);

  // Cálculo de estrellas según el presupuesto gastado
  const projectedStars = costRatio <= 0.4 ? 3 : costRatio <= 0.7 ? 2 : costRatio <= 1.0 ? 1 : 0;

  // Convertir coordenadas de evento de pantalla a coordenadas del Canvas 800x500
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    return [Math.max(10, Math.min(CANVAS_WIDTH - 10, x)), Math.max(10, Math.min(CANVAS_HEIGHT - 10, y))];
  };

  // Rotar pieza seleccionada
  const rotateSelected = (angleDelta: number = Math.PI / 12) => {
    if (selectedPartIndex === null || isRunning) return;
    sounds.playGear();
    setParts((prev) => {
      const next = [...prev];
      if (next[selectedPartIndex]) {
        next[selectedPartIndex] = {
          ...next[selectedPartIndex],
          a: next[selectedPartIndex].a + angleDelta,
        };
      }
      return next;
    });
  };

  // Eliminar pieza seleccionada
  const deleteSelected = () => {
    if (selectedPartIndex === null || isRunning) return;
    sounds.playClick();
    setParts((prev) => prev.filter((_, idx) => idx !== selectedPartIndex));
    setSelectedPartIndex(null);
  };

  // Manejadores de interacción con el canvas (táctil y ratón)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isRunning) return;
    const [x, y] = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.setPointerCapture(e.pointerId);
    }

    // Comprobar si se ha pulsado sobre una pieza existente
    const hitIndex = parts.findIndex((p) => Math.hypot(p.x - x, p.y - y) < 32);

    if (hitIndex >= 0) {
      setSelectedPartIndex(hitIndex);
      dragInfo.current = {
        isDragging: true,
        partIndex: hitIndex,
        startX: x,
        startY: y,
      };
      sounds.playClick();
      return;
    }

    // Si se pulsa en el vacío y hay una herramienta seleccionada en la paleta
    if (selectedToolIndex !== null) {
      const mech = MECHANISMS[selectedToolIndex];
      if (currentCost + mech.c > effectiveBudget) {
        sounds.playBounce(300);
        return;
      }

      // Comprobar límite de unidades si el nivel tiene maxUnits configurado
      if (effectiveLevel.maxUnits && effectiveLevel.maxUnits[mech.id] !== undefined) {
        const currentUnits = parts.filter((p) => {
          const m = MECHANISMS[p.i];
          return m?.id === mech.id || (mech.id === 'engranaje' && (m?.id === 'engranaje' || m?.id === 'engranaje_conico'));
        }).length;
        if (currentUnits >= effectiveLevel.maxUnits[mech.id]) {
          sounds.playBounce(300);
          setKeyMechAlert(`⚠️ Límite de unidades alcanzado: Máximo ${effectiveLevel.maxUnits[mech.id]} de ${mech.n} para este reto.`);
          return;
        }
      }

      sounds.playClick();
      const newPart: PlacedPart = {
        uid: `${Date.now()}_${Math.random()}`,
        i: selectedToolIndex,
        x: Math.round(x),
        y: Math.round(y),
        a: 0,
        f: 0,
        hasExtraBall: true,
        firedBall: false,
      };

      setParts((prev) => [...prev, newPart]);
      setSelectedPartIndex(parts.length);
      dragInfo.current = {
        isDragging: true,
        partIndex: parts.length,
        startX: x,
        startY: y,
      };
    } else {
      setSelectedPartIndex(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragInfo.current.isDragging || dragInfo.current.partIndex === null || isRunning) return;
    const [x, y] = getCanvasCoords(e);
    const pIdx = dragInfo.current.partIndex;

    setParts((prev) => {
      if (!prev[pIdx]) return prev;
      const next = [...prev];
      next[pIdx] = {
        ...next[pIdx],
        x: Math.round(x),
        y: Math.round(y),
      };
      return next;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    dragInfo.current.isDragging = false;
  };

  // Bucle de física y renderizado del juego
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;

    const render = (timestamp: number) => {
      if (!isMounted) return;

      const sim = simState.current;
      if (!sim.lastTimestamp) sim.lastTimestamp = timestamp;
      const dt = Math.min((timestamp - sim.lastTimestamp) / 1000, 0.04);
      sim.lastTimestamp = timestamp;

      // 1. Si está en marcha, dar pasos de física
      if (isRunning) {
        sim.time += dt;
        const result = stepPhysics(sim.balls, effectiveLevel, parts, dt, sim.time, 12);

        // Generar partículas para ventiladores
        for (const p of parts) {
          const m = MECHANISMS[p.i];
          if (m && m.k === 'f' && Math.random() < 0.3) {
            const cos = Math.cos(p.a);
            const sin = Math.sin(p.a);
            particles.current.push({
              x: p.x + 10 * cos,
              y: p.y + 10 * sin + (Math.random() - 0.5) * 20,
              vx: (180 + Math.random() * 80) * cos,
              vy: (180 + Math.random() * 80) * sin,
              life: 0,
              maxLife: 0.6 + Math.random() * 0.3,
              color: 'rgba(125, 211, 252, 0.6)',
            });
          }
        }

        // Si gana
        if (result.won) {
          // 1) Verificar que el elemento clave esté colocado si el nivel lo exige
          const reqMech = effectiveLevel.requiredMech;
          const hasRequiredMech =
            !reqMech ||
            partsRef.current.some((p) => {
              const m = MECHANISMS[p.i];
              return (
                m?.id === reqMech ||
                (reqMech === 'engranaje' && (m?.id === 'engranaje' || m?.id === 'engranaje_conico'))
              );
            });

          if (!hasRequiredMech) {
            setIsRunning(false);
            sounds.playBounce(220);
            const reqMechObj = MECHANISMS.find(
              (m) => m.id === reqMech || (reqMech === 'engranaje' && m.id === 'engranaje')
            );
            const reqName = reqMechObj ? reqMechObj.n : reqMech;
            setKeyMechAlert(
              `⚠️ ¡Falta el elemento clave "${reqName}"! Debes colocarlo e integrarlo en el circuito para superar este nivel.`
            );
            setTimeout(() => resetSimulation(), 600);
          } else {
            setIsRunning(false);
            sounds.playWin();
            const savedMoney = Math.max(0, effectiveBudget - currentCost);
            onLevelComplete(projectedStars, savedMoney);
          }
        } else if (result.outOfBounds || sim.time > 18) {
          // Si cae fuera o se queda atascado, reset suave
          setIsRunning(false);
          setTimeout(() => resetSimulation(), 300);
        }
      }

      // Actualizar partículas
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const pt = particles.current[i];
        pt.life += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.life >= pt.maxLife) {
          particles.current.splice(i, 1);
        }
      }

      // 2. DIBUJADO EN CANVAS (800x500)
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Fondo del taller de tecnología
      const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      bgGrad.addColorStop(0, '#1c282e');
      bgGrad.addColorStop(1, '#25353d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Cuadrícula técnica sutil
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
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

      // MARCA DE AGUA OBLIGATORIA "GmedranoTIC"
      ctx.save();
      ctx.font = '900 76px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.rotate(-Math.PI / 12);
      ctx.fillText('GmedranoTIC', 0, 0);
      ctx.restore();

      // Suelo y límites
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT - 5);
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 5);
      ctx.stroke();

      // Muros del nivel
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 8;
      if (effectiveLevel.w) {
        for (const wall of effectiveLevel.w) {
          ctx.beginPath();
          ctx.moveTo(wall[0], wall[1]);
          ctx.lineTo(wall[2], wall[3]);
          ctx.stroke();

          // Sombra arquitectónica
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(wall[0] + 2, wall[1] + 2);
          ctx.lineTo(wall[2] + 2, wall[3] + 2);
          ctx.stroke();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 8;
        }
      }

      // Cesta objetivo (Basket estilo Dynamic Systems)
      const [bx, by] = effectiveLevel.b;
      // Bordes acampanados y marco del cesto
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(bx - 34, by - 8);
      ctx.lineTo(bx - 26, by);
      ctx.lineTo(bx - 26, by + 32);
      ctx.lineTo(bx + 26, by + 32);
      ctx.lineTo(bx + 26, by);
      ctx.lineTo(bx + 34, by - 8);
      ctx.stroke();

      // Malla decorativa de la cesta
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx - 25, by + 10);
      ctx.lineTo(bx + 25, by + 10);
      ctx.moveTo(bx - 25, by + 20);
      ctx.lineTo(bx + 25, by + 20);
      ctx.stroke();

      // Cartel META
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('META 🎯', bx, by - 12);

      // Plataforma de salida (Spawn point)
      const [sx, sy] = effectiveLevel.s;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(sx, sy + BALL_RADIUS + 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx - 18, sy + BALL_RADIUS + 4);
      ctx.lineTo(sx + 18, sy + BALL_RADIUS + 4);
      ctx.stroke();

      // Partículas activas (aire del ventilador, etc.)
      for (const pt of particles.current) {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Renderizado detallado de cada mecanismo colocado
      parts.forEach((p, idx) => {
        const mech = MECHANISMS[p.i];
        if (!mech) return;

        const isSelected = idx === selectedPartIndex;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);

        const halfL = (mech.l || 70) / 2;

        // Renderizado según tipo de mecanismo
        switch (mech.k) {
          case 's': // Rampa, Libro, Palanca
            if (mech.id === 'libro') {
              // Libro dominó interactivo que se cae al ser golpeado
              const L = mech.l || 55;
              const halfL = L / 2;
              const fallAng = p.fallAngle || 0;
              const bookW = 14;

              ctx.save();
              // Punto de apoyo en la base
              ctx.translate(0, halfL);
              // Rotación por caída dinámica
              ctx.rotate(fallAng);

              // 1. Cubierta exterior de tapa dura azul intenso
              ctx.fillStyle = '#1d4ed8';
              ctx.fillRect(-bookW / 2, -L, bookW, L);

              // 2. Lomo del libro con detalles dorados de encuadernación
              ctx.fillStyle = '#1e3a8a';
              ctx.fillRect(-bookW / 2, -L, 4, L);
              ctx.fillStyle = '#fbbf24';
              ctx.fillRect(-bookW / 2, -L + 7, 4, 2.5);
              ctx.fillRect(-bookW / 2, -L + 12, 4, 2.5);
              ctx.fillRect(-bookW / 2, -12, 4, 2.5);
              ctx.fillRect(-bookW / 2, -7, 4, 2.5);

              // 3. Bloque de páginas blancas interiores
              ctx.fillStyle = '#f8fafc';
              ctx.fillRect(-bookW / 2 + 4, -L + 3, bookW - 5.5, L - 6);

              // 4. Filo de las hojas (efecto papel)
              ctx.strokeStyle = '#cbd5e1';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(-bookW / 2 + 5, -L + 10);
              ctx.lineTo(bookW / 2 - 2, -L + 10);
              ctx.moveTo(-bookW / 2 + 5, -L + 16);
              ctx.lineTo(bookW / 2 - 2, -L + 16);
              ctx.stroke();

              // 5. Rótulo vertical en la portada
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 7.5px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.save();
              ctx.translate(bookW / 2 - 4.5, -L / 2);
              ctx.rotate(Math.PI / 2);
              ctx.fillText('ESO', 0, 0);
              ctx.restore();

              // Contorno técnico exterior
              ctx.strokeStyle = '#0f172a';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(-bookW / 2, -L, bookW, L);

              ctx.restore();
            } else if (mech.id === 'palanca') {
              // 1. Fulcro base fijo de soporte (triángulo central)
              ctx.fillStyle = '#334155';
              ctx.beginPath();
              ctx.moveTo(0, 2);
              ctx.lineTo(-14, 22);
              ctx.lineTo(14, 22);
              ctx.closePath();
              ctx.fill();

              // Placa de anclaje base
              ctx.fillStyle = '#1e293b';
              ctx.fillRect(-18, 22, 36, 4);
              ctx.fillStyle = '#94a3b8';
              ctx.beginPath();
              ctx.arc(-12, 24, 1.5, 0, Math.PI * 2);
              ctx.arc(12, 24, 1.5, 0, Math.PI * 2);
              ctx.fill();

              // 2. Brazo balancín basculante que gira según p.fallAngle
              ctx.save();
              const tiltAng = p.fallAngle || 0;
              ctx.rotate(tiltAng);

              // Barra basculante de madera tecnológica
              ctx.fillStyle = '#d97706';
              ctx.beginPath();
              ctx.roundRect(-halfL, -5, halfL * 2, 10, 3);
              ctx.fill();
              ctx.strokeStyle = '#92400e';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              // Refuerzo central de acero
              ctx.fillStyle = '#cbd5e1';
              ctx.fillRect(-4, -5, 8, 10);

              // Almohadilla receptora de impacto roja en el brazo izquierdo
              ctx.fillStyle = '#dc2626';
              ctx.beginPath();
              ctx.roundRect(-halfL + 2, -7.5, 26, 3, 1.5);
              ctx.fill();
              ctx.fillStyle = '#fef08a';
              ctx.fillRect(-halfL + 6, -6.5, 18, 1);

              // Cuenco / cesta de catapulta en el extremo derecho
              const cupArm = halfL - 15;
              ctx.fillStyle = '#475569';
              ctx.beginPath();
              ctx.arc(cupArm, -3, 11, 0, Math.PI);
              ctx.fill();
              ctx.strokeStyle = '#94a3b8';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              // Si la segunda bola no ha sido catapultada aún, dibujarla descansando en el cuenco
              if (!p.firedBall && p.hasExtraBall !== false) {
                const cupBallX = cupArm;
                const cupBallY = -11;
                const bGrad = ctx.createRadialGradient(
                  cupBallX - 2.5,
                  cupBallY - 2.5,
                  1,
                  cupBallX,
                  cupBallY,
                  BALL_RADIUS
                );
                bGrad.addColorStop(0, '#ffffff');
                bGrad.addColorStop(0.3, '#38bdf8');
                bGrad.addColorStop(0.8, '#0284c7');
                bGrad.addColorStop(1, '#0c4a6e');
                ctx.fillStyle = bGrad;
                ctx.beginPath();
                ctx.arc(cupBallX, cupBallY, BALL_RADIUS, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#0284c7';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Brillo especular
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.beginPath();
                ctx.arc(cupBallX - 2.5, cupBallY - 2.5, 2.2, 0, Math.PI * 2);
                ctx.fill();
              }

              ctx.restore(); // Fin de rotación de la viga

              // 3. Perno de giro pivotante central
              ctx.fillStyle = '#0f172a';
              ctx.beginPath();
              ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#f8fafc';
              ctx.beginPath();
              ctx.arc(-1, -1, 1.5, 0, Math.PI * 2);
              ctx.fill();
            } else if (mech.id === 'bola_extra') {
              // Pedestal de soporte de bola auxiliar
              ctx.fillStyle = '#475569';
              ctx.beginPath();
              ctx.moveTo(-10, 8);
              ctx.lineTo(10, 8);
              ctx.lineTo(4, 0);
              ctx.lineTo(-4, 0);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = '#64748b';
              ctx.beginPath();
              ctx.arc(0, 0, 8, 0, Math.PI);
              ctx.fill();

              // Si no está corriendo la simulación, dibujar la bola reposando
              if (!isRunning) {
                const bGrad = ctx.createRadialGradient(-2.5, -12.5, 1, 0, -10, BALL_RADIUS);
                bGrad.addColorStop(0, '#ffffff');
                bGrad.addColorStop(0.3, '#38bdf8');
                bGrad.addColorStop(0.8, '#0284c7');
                bGrad.addColorStop(1, '#0c4a6e');
                ctx.fillStyle = bGrad;
                ctx.beginPath();
                ctx.arc(0, -10, BALL_RADIUS, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#0284c7';
                ctx.lineWidth = 1;
                ctx.stroke();
              }
            } else {
              // Rampa estándar de madera tecnológica
              ctx.fillStyle = '#ca8a04';
              ctx.fillRect(-halfL, -5, halfL * 2, 10);
              ctx.strokeStyle = '#a16207';
              ctx.lineWidth = 2;
              ctx.strokeRect(-halfL, -5, halfL * 2, 10);
            }
            break;

          case 'w': // Cuña
            ctx.fillStyle = '#e8a33d';
            ctx.beginPath();
            ctx.moveTo(-halfL, halfL * 0.4);
            ctx.lineTo(halfL, halfL * 0.4);
            ctx.lineTo(halfL, -halfL * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 2;
            ctx.stroke();
            break;

          case 't': // Muelle / trampolín
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-halfL, 0);
            for (let step = 1; step <= 8; step++) {
              const xStep = -halfL + (step * (halfL * 2)) / 8;
              const yStep = step % 2 === 1 ? -10 : 10;
              ctx.lineTo(xStep, yStep);
            }
            ctx.stroke();
            break;

          case 'b': // Globo ascensional
            ctx.restore(); // Deshacemos rotación para que el globo siempre vuele vertical hacia arriba
            ctx.save();
            ctx.translate(p.x, p.y);
            // Dibujar hilo
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-5, -15, 0, -28);
            ctx.stroke();
            // Globo
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.ellipse(0, -28, 18, 22, 0, 0, Math.PI * 2);
            ctx.fill();
            // Brillo especular
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.ellipse(-5, -34, 4, 7, -0.3, 0, Math.PI * 2);
            ctx.fill();
            break;

          case 'f': // Ventilador
            ctx.fillStyle = '#334155';
            ctx.fillRect(-12, -20, 24, 40);
            // Aspas girando
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3;
            const fanAng = isRunning ? sim.time * 20 : 0;
            ctx.beginPath();
            ctx.moveTo(-Math.cos(fanAng) * 14, -Math.sin(fanAng) * 14);
            ctx.lineTo(Math.cos(fanAng) * 14, Math.sin(fanAng) * 14);
            ctx.moveTo(-Math.sin(fanAng) * 14, Math.cos(fanAng) * 14);
            ctx.lineTo(Math.sin(fanAng) * 14, -Math.cos(fanAng) * 14);
            ctx.stroke();
            // Flujo de aire ilustrado
            ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
            ctx.beginPath();
            ctx.moveTo(12, -18);
            ctx.lineTo(mech.l || 140, -32);
            ctx.lineTo(mech.l || 140, 32);
            ctx.lineTo(12, 18);
            ctx.closePath();
            ctx.fill();
            break;

          case 'g': { // Cañón de artillería con afuste, recámara y proyectil
            // 1. Afuste / Carretón de madera y hierro en la base
            ctx.fillStyle = '#78350f'; // Madera noble de roble
            ctx.beginPath();
            ctx.moveTo(-18, 13);
            ctx.lineTo(16, 13);
            ctx.lineTo(10, -2);
            ctx.lineTo(-14, -2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Rueda de madera con llanta de hierro
            ctx.fillStyle = '#92400e';
            ctx.beginPath();
            ctx.arc(-2, 11, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Eje central de la rueda
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(-2, 11, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // 2. Tubo del cañón metálico fundido
            const barrelGrad = ctx.createLinearGradient(0, -9, 0, 9);
            barrelGrad.addColorStop(0, '#64748b');
            barrelGrad.addColorStop(0.35, '#334155');
            barrelGrad.addColorStop(0.7, '#1e293b');
            barrelGrad.addColorStop(1, '#0f172a');

            ctx.fillStyle = barrelGrad;
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.8;

            ctx.beginPath();
            // Culata redondeada con cascabel
            ctx.moveTo(-12, -7.5);
            ctx.lineTo(halfL * 0.95, -5.5);
            // Bocacha acampanada ensanchada
            ctx.lineTo(halfL * 1.05, -8);
            ctx.lineTo(halfL * 1.05, 8);
            ctx.lineTo(halfL * 0.95, 5.5);
            ctx.lineTo(-12, 7.5);
            ctx.arc(-12, 0, 7.5, Math.PI / 2, -Math.PI / 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Cascabel posterior (bola de la culata)
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.arc(-18, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Anillos y molduras de refuerzo de bronce dorado
            ctx.fillStyle = '#eab308';
            ctx.fillRect(halfL * 0.45, -6, 3, 12);
            ctx.fillRect(halfL * 0.8, -5.5, 3, 11);
            ctx.fillRect(halfL * 1.02, -8.5, 2.5, 17); // Anillo frontal de la boca

            // Muñón lateral de pivote
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // 3. Fogonazo si ya se disparó, o mecha lista si está armado
            if (p.f) {
              ctx.save();
              const muzzleX = halfL * 1.05;
              // Llamarada cónica de deflagración
              const fireGrad = ctx.createRadialGradient(muzzleX + 12, 0, 2, muzzleX + 12, 0, 22);
              fireGrad.addColorStop(0, '#ffffff');
              fireGrad.addColorStop(0.3, '#fef08a');
              fireGrad.addColorStop(0.6, '#f97316');
              fireGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
              ctx.fillStyle = fireGrad;
              ctx.beginPath();
              ctx.arc(muzzleX + 12, 0, 20, 0, Math.PI * 2);
              ctx.fill();

              // Nube de humo de pólvora
              ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
              ctx.beginPath();
              ctx.arc(muzzleX + 6, -9, 9, 0, Math.PI * 2);
              ctx.arc(muzzleX + 18, -5, 11, 0, Math.PI * 2);
              ctx.arc(muzzleX + 14, 8, 8, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            } else {
              // Mecha de ignición lista en la recámara
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.moveTo(-10, -7.5);
              ctx.quadraticCurveTo(-15, -16, -13, -19);
              ctx.stroke();
              // Chispa roja encendida
              ctx.fillStyle = '#ef4444';
              ctx.beginPath();
              ctx.arc(-13, -19, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }

          case 'o': { // Plataformas oscilantes: Poleas, Biela-manivela, Piñón-cremallera, Leva
            const omega = 2 * Math.PI * (mech.freq || 0.5);
            const sinW = Math.sin(omega * sim.time);
            const offX = (mech.dx || 0) * sinW;
            const offY = (mech.dy || 0) * sinW;

            // Soporte base fijo
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();

            // Dibujo específico por mecanismo
            if (mech.id === 'polea_simple') {
              // Polea simple con contrapeso y segunda bola (como la palanca)
              const disp = p.fallAngle || 0;
              const cupY = 75 - disp;
              const trayY = 35 + disp;

              // Soporte / chumacera superior fija
              ctx.fillStyle = '#475569';
              ctx.fillRect(-6, -14, 12, 14);

              // Rueda de la polea giratoria
              const wheelRot = (disp / 20) % (Math.PI * 2);
              ctx.save();
              ctx.rotate(wheelRot);
              ctx.fillStyle = '#64748b';
              ctx.beginPath();
              ctx.arc(0, 0, 22, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#94a3b8';
              ctx.beginPath();
              ctx.arc(0, 0, 18, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#334155';
              ctx.lineWidth = 2.5;
              for (let r = 0; r < 4; r++) {
                const ra = (r * Math.PI) / 2;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(ra) * 18, Math.sin(ra) * 18);
                ctx.stroke();
              }
              ctx.fillStyle = '#1e293b';
              ctx.beginPath();
              ctx.arc(0, 0, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#cbd5e1';
              ctx.beginPath();
              ctx.arc(0, 0, 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();

              // Cuerda dorada tensada sobre la polea
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.arc(0, 0, 20, Math.PI, 0, false);
              ctx.stroke();

              // Ramal izquierdo hacia la bandeja receptora
              ctx.beginPath();
              ctx.moveTo(-20, 0);
              ctx.lineTo(-22, trayY);
              ctx.stroke();

              // Ramal derecho hacia la cesta del contrapeso
              ctx.beginPath();
              ctx.moveTo(20, 0);
              ctx.lineTo(22, cupY);
              ctx.stroke();

              // 1. Bandeja receptora izquierda (azul)
              ctx.fillStyle = '#0284c7';
              ctx.fillRect(-38, trayY, 32, 6);
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(-38, trayY, 32, 6);
              // Pestaña lateral izquierda
              ctx.fillStyle = '#38bdf8';
              ctx.fillRect(-38, trayY - 14, 4, 14);

              // 2. Cesta de contrapeso derecha (con la segunda bola)
              ctx.fillStyle = '#475569';
              ctx.beginPath();
              ctx.arc(22, cupY, 12, 0, Math.PI);
              ctx.fill();
              ctx.strokeStyle = '#94a3b8';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              // Si la segunda bola no ha sido catapultada aún, dibujarla descansando en la cesta
              if (!p.firedBall && p.hasExtraBall !== false) {
                ctx.fillStyle = '#94a3b8';
                ctx.beginPath();
                ctx.arc(22, cupY - 8, 8, 0, Math.PI * 2);
                ctx.fill();
                // Brillo especular esférico 3D en la bola
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(20, cupY - 11, 2.5, 0, Math.PI * 2);
                ctx.fill();
              }
            } else if (mech.id === 'biela_manivela') {
              // Manivela giratoria y biela
              const crankR = 24;
              const crankX = Math.cos(omega * sim.time) * crankR;
              const crankY = Math.sin(omega * sim.time) * crankR;
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(crankX, crankY);
              ctx.lineTo(offX, 0);
              ctx.stroke();
              // Pistón / barra deslizante
              ctx.fillStyle = '#e11d48';
              ctx.fillRect(-halfL + offX, -5, halfL * 2, 10);
            } else if (mech.id === 'pinon_cremallera') {
              // 1) Piñón (rueda dentada) que gira ENCIMA de la cremallera
              // Cremallera (barra dentada horizontal) que se desplaza hacia adelante y atrás con offX
              const pinionR = 16;
              const pinionY = -21; // Posicionado encima de la cremallera
              const pinionAngle = -offX / pinionR; // Rotación sincronizada con el desplazamiento lineal

              // Carril guía inferior fijo
              ctx.fillStyle = '#334155';
              ctx.fillRect(-halfL - 8, 8, halfL * 2 + 16, 5);
              ctx.fillStyle = '#475569';
              ctx.fillRect(-halfL - 10, 5, 5, 10);
              ctx.fillRect(halfL + 5, 5, 5, 10);

              // Soporte / viga de sujeción del piñón superior
              ctx.fillStyle = '#475569';
              ctx.fillRect(-4, pinionY - 4, 8, 14);

              // Cremallera móvil (plataforma deslizante inferior)
              const rackLeft = -halfL + offX;
              const rackW = halfL * 2;
              
              // Cuerpo de la cremallera
              ctx.fillStyle = '#0284c7'; // Azul
              ctx.fillRect(rackLeft, -2, rackW, 9);
              ctx.strokeStyle = '#0369a1';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(rackLeft, -2, rackW, 9);

              // Dientes en la parte superior de la cremallera que engranan con el piñón
              ctx.fillStyle = '#38bdf8';
              const toothPitch = 9;
              for (let d = rackLeft + 3; d <= rackLeft + rackW - 5; d += toothPitch) {
                ctx.beginPath();
                ctx.moveTo(d, -2);
                ctx.lineTo(d + 2, -6);
                ctx.lineTo(d + 5, -6);
                ctx.lineTo(d + 7, -2);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#0284c7';
                ctx.lineWidth = 1;
                ctx.stroke();
              }

              // Piñón giratorio (rueda dentada ENCIMA de la cremallera)
              ctx.save();
              ctx.translate(0, pinionY);
              ctx.rotate(pinionAngle);

              // Dientes del piñón
              const numTeeth = 10;
              ctx.fillStyle = '#ca8a04'; // Marrón claro / bronce dorado
              ctx.strokeStyle = '#854d0e';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              for (let i = 0; i < numTeeth; i++) {
                const a0 = (i * 2 * Math.PI) / numTeeth;
                const a1 = a0 + (Math.PI / numTeeth) * 0.35;
                const a2 = a0 + (Math.PI / numTeeth) * 0.65;
                const a3 = a0 + (Math.PI / numTeeth);
                const rIn = 12.5;
                const rOut = 17.5;
                if (i === 0) ctx.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
                else ctx.lineTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
                ctx.lineTo(Math.cos(a1) * rOut, Math.sin(a1) * rOut);
                ctx.lineTo(Math.cos(a2) * rOut, Math.sin(a2) * rOut);
                ctx.lineTo(Math.cos(a3) * rIn, Math.sin(a3) * rIn);
              }
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              // Cuerpo interior del piñón
              ctx.fillStyle = '#eab308';
              ctx.beginPath();
              ctx.arc(0, 0, 11, 0, Math.PI * 2);
              ctx.fill();

              // Aligeramientos decorativos del piñón
              ctx.fillStyle = '#713f12';
              for (let i = 0; i < 3; i++) {
                const angH = (i * 2 * Math.PI) / 3;
                ctx.beginPath();
                ctx.arc(Math.cos(angH) * 6, Math.sin(angH) * 6, 2.5, 0, Math.PI * 2);
                ctx.fill();
              }

              // Eje central del piñón
              ctx.fillStyle = '#1e293b';
              ctx.beginPath();
              ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#94a3b8';
              ctx.beginPath();
              ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
              ctx.fill();

              ctx.restore();
            } else if (mech.id === 'leva_seguidor') {
              // 2) Leva excéntrica: forma excéntrica marrón clara que GIRA excéntricamente
              // y empuja la plataforma azul para que suba y baje
              const camPivotY = 16;
              const camAngle = isRunning ? sim.time * omega : 0;
              
              // Perfil de elevación de la leva en función del giro excéntrico
              const camLift = 12 * Math.cos(camAngle);
              const contactY = camPivotY - 18 - camLift; // Posición de contacto
              const platH = 8;
              const platY = contactY - 5; // Centro de la plataforma azul

              // Guías verticales fijas laterales
              ctx.fillStyle = '#334155';
              ctx.fillRect(-12, -4, 4, 22);
              ctx.fillRect(8, -4, 4, 22);

              // Soporte y pedestal del eje de la leva en la base
              ctx.fillStyle = '#475569';
              ctx.beginPath();
              ctx.moveTo(-16, 26);
              ctx.lineTo(-8, camPivotY);
              ctx.lineTo(8, camPivotY);
              ctx.lineTo(16, 26);
              ctx.closePath();
              ctx.fill();

              // Forma excéntrica marrón clara que GIRA excéntricamente alrededor del eje
              ctx.save();
              ctx.translate(0, camPivotY);
              ctx.rotate(camAngle);

              ctx.fillStyle = '#d97706'; // Forma marrón clara
              ctx.strokeStyle = '#92400e'; // Borde marrón oscuro
              ctx.lineWidth = 2;
              ctx.beginPath();
              // Perfil de leva ovoide / excéntrico:
              // Base circular en el eje r = 11, y lóbulo excéntrico alargado r = 24
              ctx.arc(0, 0, 11, 0.45, Math.PI - 0.45, false);
              ctx.lineTo(-6, -18);
              ctx.arc(0, -18, 6, Math.PI, 0, false);
              ctx.lineTo(11 * Math.cos(0.45), 11 * Math.sin(0.45));
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              // Detalle radial de la leva para enfatizar el giro excéntrico
              ctx.strokeStyle = 'rgba(254, 243, 199, 0.6)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(0, -18);
              ctx.stroke();

              // Eje fijo central
              ctx.fillStyle = '#1e293b';
              ctx.beginPath();
              ctx.arc(0, 0, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#cbd5e1';
              ctx.beginPath();
              ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
              ctx.fill();

              ctx.restore();

              // Vástago seguidor vertical con rodillo inferior
              ctx.fillStyle = '#94a3b8';
              ctx.fillRect(-2.5, platY + platH / 2, 5, Math.max(0, contactY - (platY + platH / 2)));
              
              // Rodillo que rueda sobre la leva
              ctx.fillStyle = '#cbd5e1';
              ctx.strokeStyle = '#475569';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(0, contactY, 4.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // Plataforma azul (seguidor) que sube y baja
              ctx.fillStyle = '#0284c7';
              ctx.fillRect(-halfL, platY - platH / 2, halfL * 2, platH);
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(-halfL, platY - platH / 2, halfL * 2, platH);
            }
            break;
          }

          case 'r': { // Mecanismos giratorios: Engranajes cilíndricos, cónicos, tornillo sin fin
            const speed = mech.w || 2;
            const curAng = isRunning ? sim.time * speed : 0;

            if (mech.id === 'tornillo_sinfin') {
              // 3) Tornillo sin fin: NO rota como un reloj
              // El cuerpo cilíndrico se mantiene en su orientación y las espiras blancas avanzan linealmente
              const pitch = 15;
              const scrollSpeed = speed * 28; // Velocidad de avance continuo como cinta
              const phase = isRunning ? (sim.time * scrollSpeed) % pitch : 0;

              // Soportes / chumaceras de los extremos fijos
              ctx.fillStyle = '#334155';
              ctx.fillRect(-halfL - 8, -14, 8, 28);
              ctx.fillRect(halfL, -14, 8, 28);
              // Pernos en las chumaceras
              ctx.fillStyle = '#f59e0b';
              ctx.fillRect(-halfL - 6, -12, 4, 3);
              ctx.fillRect(-halfL - 6, 9, 4, 3);
              ctx.fillRect(halfL + 2, -12, 4, 3);
              ctx.fillRect(halfL + 2, 9, 4, 3);

              // Eje pasante metálico
              ctx.fillStyle = '#64748b';
              ctx.fillRect(-halfL - 14, -4, halfL * 2 + 28, 8);

              // Cuerpo cilíndrico del tornillo
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(-halfL, -11, halfL * 2, 22, 3);
              ctx.clip();

              // Fondo del cilindro verde esmeralda / acero
              ctx.fillStyle = '#059669';
              ctx.fillRect(-halfL, -11, halfL * 2, 22);

              // Degradado / brillo superior del cilindro para volumen 3D
              ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
              ctx.fillRect(-halfL, -9, halfL * 2, 6);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
              ctx.fillRect(-halfL, 4, halfL * 2, 7);

              // Espiras helicoidales blancas que avanzan continuamente como cinta transportadora
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 3.5;
              ctx.lineCap = 'round';
              for (let x = -halfL - pitch * 2; x <= halfL + pitch * 2; x += pitch) {
                const xPos = x + phase;
                ctx.beginPath();
                ctx.moveTo(xPos - 5, -11);
                ctx.lineTo(xPos + 6, 11);
                ctx.stroke();
              }

              ctx.restore();

              // Crestas dentadas de las espiras en la parte superior e inferior
              ctx.fillStyle = '#ffffff';
              for (let x = -halfL - pitch * 2; x <= halfL + pitch; x += pitch) {
                const xPos = x + phase;
                if (xPos >= -halfL + 2 && xPos <= halfL - 2) {
                  ctx.beginPath();
                  ctx.arc(xPos, -11, 2.5, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.beginPath();
                  ctx.arc(xPos + 4, 11, 2, 0, Math.PI * 2);
                  ctx.fill();
                }
              }

              // Indicador sutil de sentido de transporte (flecha en el centro)
              ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
              ctx.font = 'bold 9px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('► ► ►', 0, 0);

            } else {
              // 3) Para el engranaje se aplica rotación angular continua sobre el eje
              ctx.rotate(curAng);

              // Engranaje dentado rotatorio (rueda dentada completa de precisión)
              const numTeeth = 12;
              const rIn = 26;
              const rOut = 36;
              ctx.fillStyle = '#ca8a04'; // Marrón claro / bronce dorado
              ctx.strokeStyle = '#854d0e';
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              for (let i = 0; i < numTeeth; i++) {
                const a0 = (i * 2 * Math.PI) / numTeeth;
                const a1 = a0 + (Math.PI / numTeeth) * 0.35;
                const a2 = a0 + (Math.PI / numTeeth) * 0.65;
                const a3 = a0 + (Math.PI / numTeeth);
                if (i === 0) ctx.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
                else ctx.lineTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
                ctx.lineTo(Math.cos(a1) * rOut, Math.sin(a1) * rOut);
                ctx.lineTo(Math.cos(a2) * rOut, Math.sin(a2) * rOut);
                ctx.lineTo(Math.cos(a3) * rIn, Math.sin(a3) * rIn);
              }
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              // Cuerpo interior del engranaje
              ctx.fillStyle = '#eab308';
              ctx.beginPath();
              ctx.arc(0, 0, 23, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ca8a04';
              ctx.lineWidth = 2;
              ctx.stroke();

              // 4 aligeramientos decorativos
              ctx.fillStyle = '#713f12';
              for (let i = 0; i < 4; i++) {
                const angH = (i * Math.PI) / 2;
                ctx.beginPath();
                ctx.arc(Math.cos(angH) * 13, Math.sin(angH) * 13, 4.5, 0, Math.PI * 2);
                ctx.fill();
              }

              // Eje central del engranaje
              ctx.fillStyle = '#1e293b';
              ctx.beginPath();
              ctx.arc(0, 0, 7, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#cbd5e1';
              ctx.beginPath();
              ctx.arc(0, 0, 3, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }

          default:
            break;
        }

        ctx.restore();

        // Icono representativo e indicador de selección
        if (isSelected) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Icono flotante con información
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(p.x, p.y - 36, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(mech.i, p.x, p.y - 36);
        }
      });

      // Dibujar todas las bolas activas en la simulación
      for (let bIdx = 0; bIdx < sim.balls.length; bIdx++) {
        const ball = sim.balls[bIdx];
        ctx.save();
        const ballGrad = ctx.createRadialGradient(
          ball.x - 2.5,
          ball.y - 2.5,
          1,
          ball.x,
          ball.y,
          BALL_RADIUS
        );
        if (bIdx === 0) {
          // Bola principal (Rojo rubí tecnológico)
          ballGrad.addColorStop(0, '#ffffff');
          ballGrad.addColorStop(0.3, '#f87171');
          ballGrad.addColorStop(0.8, '#dc2626');
          ballGrad.addColorStop(1, '#991b1b');
          ctx.strokeStyle = '#7f1d1d';
        } else {
          // Bola secundaria / catapultada (Azul zafiro / acero pulido)
          ballGrad.addColorStop(0, '#ffffff');
          ballGrad.addColorStop(0.3, '#38bdf8');
          ballGrad.addColorStop(0.8, '#0284c7');
          ballGrad.addColorStop(1, '#0c4a6e');
          ctx.strokeStyle = '#0369a1';
        }
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.stroke();

        // Destello especular de luz
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(ball.x - 2.5, ball.y - 2.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Solicitar siguiente fotograma
      sim.animFrameId = requestAnimationFrame(render);
    };

    simState.current.animFrameId = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      if (simState.current.animFrameId) {
        cancelAnimationFrame(simState.current.animFrameId);
      }
    };
  }, [isRunning, level, parts, selectedPartIndex, currentCost, projectedStars, onLevelComplete]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#141d22] text-white select-none overflow-hidden">
      {/* 1. BARRA SUPERIOR DE CONTROL */}
      <header className="relative z-10 bg-[#1a262d] border-b border-slate-700/80 px-2 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        {/* Lado izquierdo: Botón Menú + Título del nivel */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sounds.playClick();
              onOpenLevelSelect();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs sm:text-sm border border-slate-600 transition active:scale-95 cursor-pointer"
            title="Volver al índice de niveles"
          >
            <Menu size={16} />
            <span className="hidden sm:inline">Niveles</span>
          </button>

          <div className="flex flex-col">
            <h1 className="text-xs sm:text-sm font-extrabold text-amber-400 flex items-center gap-1.5 flex-wrap">
              <span>{effectiveLevel.title}</span>
              {effectiveLevel.requiredMech && (() => {
                const reqMechObj = MECHANISMS.find(
                  (m) => m.id === effectiveLevel.requiredMech || (effectiveLevel.requiredMech === 'engranaje' && m.id === 'engranaje')
                );
                const reqName = reqMechObj ? reqMechObj.n : effectiveLevel.requiredMech;
                const isPlaced = parts.some(
                  (p) =>
                    MECHANISMS[p.i]?.id === effectiveLevel.requiredMech ||
                    (effectiveLevel.requiredMech === 'engranaje' &&
                      (MECHANISMS[p.i]?.id === 'engranaje' || MECHANISMS[p.i]?.id === 'engranaje_conico'))
                );
                return (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 border ${
                      isPlaced
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    }`}
                    title="Elemento clave que debes incluir en la solución"
                  >
                    <span>🔑</span>
                    <span>Clave: {reqName}</span>
                    <span>{isPlaced ? '✓' : '⚠️'}</span>
                  </span>
                );
              })()}
              {difficulty === 'hard' && (
                <span
                  className="bg-red-950/90 text-amber-300 border border-red-500/80 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-black shadow flex items-center gap-1 animate-pulse"
                  title="Modo Difícil: Presupuesto -30%, rampas del nivel 10% más cortas y meta 20% más alta"
                >
                  ⚔️ DIFÍCIL (-30% € · Rampas -10% · Meta +20% ⇡)
                </span>
              )}
            </h1>
            <span className="text-[10px] text-slate-400">GmedranoTIC · Mecanismos ESO</span>
          </div>
        </div>

        {/* Centro: Indicador visual de Presupuesto y Estrellas */}
        <div className="flex items-center gap-2 bg-[#121c21] px-3 py-1.5 rounded-xl border border-slate-700">
          <div className="flex items-center gap-1">
            <DollarSign size={15} className="text-emerald-400" />
            <span
              className={`font-mono text-xs sm:text-sm font-bold ${
                remainingBudget < 0 ? 'text-red-400 animate-pulse' : 'text-slate-200'
              }`}
            >
              {currentCost} / {effectiveBudget} €
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Medidor de estrellas */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`text-xs ${
                  s <= projectedStars ? 'text-amber-400 drop-shadow' : 'text-slate-600'
                }`}
              >
                ★
              </span>
            ))}
          </div>
        </div>

        {/* Lado derecho: Botones de Acción (Play / Reset / Rotar / Borrar) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              sounds.playClick();
              if (isRunning) {
                resetSimulation();
              } else {
                if (currentCost > effectiveBudget) {
                  sounds.playBounce(300);
                  return;
                }
                resetSimulation();
                setIsRunning(true);
              }
            }}
            className={`flex items-center gap-1 px-4 py-1.5 rounded-xl font-black text-xs sm:text-sm transition active:scale-95 shadow cursor-pointer min-h-[38px] ${
              isRunning
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            {isRunning ? (
              <>
                <RotateCcw size={15} />
                <span>Parar</span>
              </>
            ) : (
              <>
                <Play size={16} className="fill-current" />
                <span>Probar</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              resetSimulation();
            }}
            className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition active:scale-95 cursor-pointer"
            title="Reiniciar bola"
          >
            <RotateCcw size={16} />
          </button>

          {/* Botón Rotar si hay pieza seleccionada */}
          <button
            onClick={() => rotateSelected()}
            disabled={selectedPartIndex === null || isRunning}
            className={`p-2 rounded-xl transition active:scale-95 ${
              selectedPartIndex !== null && !isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
            title="Rotar pieza seleccionada (15º)"
          >
            <RotateCw size={16} />
          </button>

          {/* Botón Borrar si hay pieza seleccionada */}
          <button
            onClick={() => deleteSelected()}
            disabled={selectedPartIndex === null || isRunning}
            className={`p-2 rounded-xl transition active:scale-95 ${
              selectedPartIndex !== null && !isRunning
                ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
            title="Eliminar pieza seleccionada"
          >
            <Trash2 size={16} />
          </button>

          <button
            onClick={onToggleSound}
            className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition cursor-pointer"
            title={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
          >
            {soundEnabled ? <Volume2 size={16} className="text-amber-400" /> : <VolumeX size={16} className="text-red-400" />}
          </button>
        </div>
      </header>

      {/* Consejo didáctico flotante de nivel con foto del docente */}
      {showTip && effectiveLevel.tip && (
        <div className="relative z-10 bg-[#14232c]/95 border-b border-amber-500/40 px-3 py-2 flex items-center justify-between text-xs text-slate-100 shadow-md">
          <div className="flex items-center gap-3">
            <img
              src={teacherAvatar}
              alt="Prof. @GmedranoTIC"
              className="w-8 h-8 rounded-full border border-amber-400 object-cover shrink-0 shadow"
            />
            <div className="flex flex-col text-left">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-amber-400 text-xs">Prof. @GmedranoTIC</span>
                {effectiveLevel.mechFocus && (
                  <span className="bg-sky-950/80 text-sky-300 border border-sky-600/50 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    🔬 {effectiveLevel.mechFocus}
                  </span>
                )}
                {effectiveLevel.requiredMech && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                    🎯 Mecanismo imprescindible
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 mt-0.5 leading-snug">
                {effectiveLevel.tip}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowTip(false)}
            className="text-amber-300 hover:text-white px-2 py-1 text-xs font-bold shrink-0 ml-2 cursor-pointer"
            title="Ocultar pista"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. ÁREA CENTRAL DEL CANVAS RESPONSIVE */}
      <main
        ref={containerRef}
        className="relative flex-1 w-full h-full flex items-center justify-center p-1 sm:p-2 overflow-hidden bg-[#10171a]"
      >
        {/* Contenedor con aspect-ratio fijo 8/5 pero adaptado al 100% del espacio visible */}
        <div className="relative w-full h-full max-w-[880px] max-h-[550px] aspect-[8/5] flex items-center justify-center shadow-2xl rounded-xl overflow-hidden border border-slate-700/60 bg-[#1c282e]">
          {/* Banner de alerta de elemento clave requerido o límite de piezas */}
          {keyMechAlert && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 max-w-lg w-11/12 bg-red-950/95 border-2 border-red-500 text-white p-3 rounded-xl shadow-2xl flex items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <p className="text-xs sm:text-sm font-bold text-red-200">{keyMechAlert}</p>
              </div>
              <button
                onClick={() => setKeyMechAlert(null)}
                className="px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white rounded-lg text-xs font-black cursor-pointer shrink-0"
              >
                Cerrar
              </button>
            </div>
          )}

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

      {/* 3. PALETA INFERIOR DE MECANISMOS CON PESTAÑAS */}
      <footer className="relative z-10 bg-[#162127] border-t border-slate-700/80 p-2 flex flex-col gap-1.5 shadow-lg">
        {/* Selector de categorías o aviso de reto específico */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 text-xs">
          {effectiveLevel.allowedMechs && effectiveLevel.allowedMechs.length > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-amber-500/20 text-amber-300 font-extrabold px-2.5 py-1 rounded-lg border border-amber-500/40 flex items-center gap-1">
                <span>🎯</span>
                <span>Piezas del Reto ({availableMechs.length})</span>
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Para superar este nivel debes usar la interacción mecánica correcta
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    sounds.playClick();
                    setActiveCategory(cat.id);
                  }}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                    activeCategory === cat.id
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-[#202e35] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="hidden sm:inline">{cat.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Información del mecanismo seleccionado */}
          {selectedToolIndex !== null && MECHANISMS[selectedToolIndex] && (
            <div className="text-[11px] text-slate-300 truncate max-w-md hidden md:block">
              <span className="text-amber-400 font-bold">{MECHANISMS[selectedToolIndex].n}:</span>{' '}
              {MECHANISMS[selectedToolIndex].desc}
            </div>
          )}
        </div>

        {/* Carrusel horizontal de piezas desbloqueadas */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
          {availableMechs
            .filter((m) =>
              effectiveLevel.allowedMechs && effectiveLevel.allowedMechs.length > 0
                ? true
                : m.category === activeCategory
            )
            .map((mech) => {
              const originalIndex = MECHANISMS.findIndex((it) => it.id === mech.id);
              const isSelectedTool = selectedToolIndex === originalIndex;
              const canAfford = currentCost + mech.c <= effectiveBudget;
              const isKeyMech =
                effectiveLevel.requiredMech === mech.id ||
                (effectiveLevel.requiredMech === 'engranaje' && (mech.id === 'engranaje' || mech.id === 'engranaje_conico'));

              const isPlaced = parts.some((p) => {
                const m = MECHANISMS[p.i];
                return (
                  m?.id === mech.id ||
                  (mech.id === 'engranaje' && (m?.id === 'engranaje' || m?.id === 'engranaje_conico'))
                );
              });

              // Contabilidad de unidades
              const maxUnits = effectiveLevel.maxUnits?.[mech.id];
              const placedCount = parts.filter((p) => {
                const m = MECHANISMS[p.i];
                return (
                  m?.id === mech.id ||
                  (mech.id === 'engranaje' && (m?.id === 'engranaje' || m?.id === 'engranaje_conico'))
                );
              }).length;
              const isDepleted = maxUnits !== undefined && maxUnits > 0 && placedCount >= maxUnits;

              return (
                <button
                  key={mech.id}
                  disabled={isDepleted}
                  onClick={() => {
                    sounds.playClick();
                    setSelectedToolIndex(isSelectedTool ? null : originalIndex);
                  }}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-xl transition flex-shrink-0 border cursor-pointer ${
                    isSelectedTool
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-300 text-slate-950 shadow-md font-bold'
                      : isKeyMech
                      ? isPlaced
                        ? 'bg-[#1e3428] border-emerald-500/80 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                        : 'bg-[#2f2214] border-amber-400/90 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse'
                      : isDepleted
                      ? 'bg-[#182329] border-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                      : canAfford
                      ? 'bg-[#24343d] hover:bg-[#2c3e49] border-slate-700 text-slate-200'
                      : 'bg-[#182329] border-slate-800 text-slate-500 opacity-60'
                  }`}
                  title={`${mech.n} (${mech.c} €)\n${mech.desc}${
                    maxUnits !== undefined ? `\nUnidades: ${placedCount}/${maxUnits}` : ''
                  }`}
                >
                  {isKeyMech && !isSelectedTool && (
                    <span
                      className={`absolute -top-2 right-2 font-black text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-tighter shadow ${
                        isPlaced ? 'bg-emerald-500 text-slate-950' : 'bg-amber-400 text-slate-950'
                      }`}
                    >
                      {isPlaced ? '✓ COLOCADO' : '★ OBLIGATORIO'}
                    </span>
                  )}
                  <span className="text-lg">{mech.i}</span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold leading-tight">{mech.n}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-mono ${
                          isSelectedTool
                            ? 'text-slate-900 font-bold'
                            : isKeyMech
                            ? 'text-amber-300 font-bold'
                            : 'text-emerald-400'
                        }`}
                      >
                        {mech.c} €
                      </span>
                      {maxUnits !== undefined && (
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                            isDepleted
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : 'bg-slate-900 text-cyan-300'
                          }`}
                        >
                          {placedCount}/{maxUnits} uds
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </footer>
    </div>
  );
};
