import { Star, Camera, ArrowRight, Grid, Award, CheckCircle, Download } from 'lucide-react';
import { sounds } from '../audio';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../physics';
import teacherAvatar from '../assets/images/teacher_avatar_1791217416001.jpg';
import { GameDifficulty } from '../types';

interface VictoryModalProps {
  levelId: number | string;
  levelTitle: string;
  stars: number;
  savedMoney: number;
  budget: number;
  totalStars: number;
  maxStars: number;
  totalSavings: number;
  playerName: string;
  onNextLevel: () => void;
  onOpenLevelSelect: () => void;
  hasNextLevel: boolean;
  difficulty?: GameDifficulty;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  levelId,
  levelTitle,
  stars,
  savedMoney,
  budget,
  totalStars,
  maxStars,
  totalSavings,
  playerName,
  onNextLevel,
  onOpenLevelSelect,
  hasNextLevel,
  difficulty = 'standard',
}) => {
  const spentMoney = Math.max(0, budget - savedMoney);

  // Helper seguro para rectángulos redondeados en canvas
  const drawRoundRect = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ) => {
    if (typeof c.roundRect === 'function') {
      c.roundRect(x, y, w, h, radius);
    } else {
      c.rect(x, y, w, h);
    }
  };

  // Helper para dibujar la gran corona de rey majestuosa sobre el logotipo del docente
  const drawKingCrown = (
    c: CanvasRenderingContext2D,
    cx: number,
    baseY: number,
    width: number = 74,
    height: number = 38
  ) => {
    c.save();

    // Resplandor dorado de la corona real
    c.shadowColor = 'rgba(245, 158, 11, 0.85)';
    c.shadowBlur = 14;

    const halfW = width / 2;
    const left = cx - halfW;
    const right = cx + halfW;
    const topPeakY = baseY - height;

    // 1. Capuchón interior de terciopelo real (rojo carmesí imperial)
    const capGrad = c.createRadialGradient(
      cx,
      baseY - height * 0.45,
      4,
      cx,
      baseY - height * 0.45,
      halfW * 0.85
    );
    capGrad.addColorStop(0, '#f87171');
    capGrad.addColorStop(0.3, '#dc2626');
    capGrad.addColorStop(0.7, '#991b1b');
    capGrad.addColorStop(1, '#450a0a');
    c.fillStyle = capGrad;
    c.beginPath();
    c.moveTo(cx - halfW * 0.72, baseY - 5);
    c.quadraticCurveTo(cx - halfW * 0.55, topPeakY + 4, cx, topPeakY + 2);
    c.quadraticCurveTo(cx + halfW * 0.55, topPeakY + 4, cx + halfW * 0.72, baseY - 5);
    c.closePath();
    c.fill();

    // Pliegues y costuras doradas del terciopelo real
    c.strokeStyle = 'rgba(254, 240, 138, 0.4)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(cx, topPeakY + 2);
    c.lineTo(cx, baseY - 5);
    c.moveTo(cx - 13, topPeakY + 9);
    c.quadraticCurveTo(cx - 7, baseY - 14, cx - 10, baseY - 5);
    c.moveTo(cx + 13, topPeakY + 9);
    c.quadraticCurveTo(cx + 7, baseY - 14, cx + 10, baseY - 5);
    c.stroke();

    // 2. Estructura de los 5 picos de oro de la corona
    const goldGrad = c.createLinearGradient(left, topPeakY, right, baseY);
    goldGrad.addColorStop(0, '#fffbeb');
    goldGrad.addColorStop(0.2, '#fde047');
    goldGrad.addColorStop(0.5, '#f59e0b');
    goldGrad.addColorStop(0.8, '#d97706');
    goldGrad.addColorStop(1, '#78350f');

    c.fillStyle = goldGrad;
    c.strokeStyle = '#78350f';
    c.lineWidth = 1.8;

    c.beginPath();
    // Base izquierda
    c.moveTo(left + 2, baseY - 4);
    // Pico 1 (exterior izquierdo)
    c.lineTo(left, topPeakY + 13);
    // Valle 1
    c.lineTo(cx - halfW * 0.52, topPeakY + 24);
    // Pico 2 (medio izquierdo)
    c.lineTo(cx - halfW * 0.38, topPeakY + 7);
    // Valle 2
    c.lineTo(cx - halfW * 0.17, topPeakY + 22);
    // Pico 3 (central, el más grande y solemne)
    c.lineTo(cx, topPeakY);
    // Valle 3
    c.lineTo(cx + halfW * 0.17, topPeakY + 22);
    // Pico 4 (medio derecho)
    c.lineTo(cx + halfW * 0.38, topPeakY + 7);
    // Valle 4
    c.lineTo(cx + halfW * 0.52, topPeakY + 24);
    // Pico 5 (exterior derecho)
    c.lineTo(right, topPeakY + 13);
    // Bajar al extremo derecho de la base
    c.lineTo(right - 2, baseY - 4);
    // Curva inferior de la diadema
    c.quadraticCurveTo(cx, baseY - 1, left + 2, baseY - 4);
    c.closePath();
    c.fill();
    c.stroke();

    // 3. Orbe y cruz real en el pico más alto (centro imperial)
    c.fillStyle = '#fef08a';
    c.beginPath();
    c.arc(cx, topPeakY - 3, 4.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#b45309';
    c.lineWidth = 1;
    c.stroke();

    // Cruz imperial
    c.strokeStyle = '#fef08a';
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(cx, topPeakY - 11);
    c.lineTo(cx, topPeakY - 2);
    c.moveTo(cx - 4.5, topPeakY - 7);
    c.lineTo(cx + 4.5, topPeakY - 7);
    c.stroke();

    // Perlas en las otras 4 puntas de la corona
    const peaks = [
      { x: left, y: topPeakY + 13 },
      { x: cx - halfW * 0.38, y: topPeakY + 7 },
      { x: cx + halfW * 0.38, y: topPeakY + 7 },
      { x: right, y: topPeakY + 13 },
    ];
    peaks.forEach((p) => {
      c.fillStyle = '#f8fafc';
      c.beginPath();
      c.arc(p.x, p.y - 2, 3.8, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#b45309';
      c.lineWidth = 1;
      c.stroke();
      // Destello especular de perla
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(p.x - 1, p.y - 3, 1.2, 0, Math.PI * 2);
      c.fill();
    });

    // 4. Diadema de oro en la base con joyas incrustadas
    const bandY = baseY - 8;
    const bandHeight = 11;
    const bandGrad = c.createLinearGradient(left, bandY, right, bandY + bandHeight);
    bandGrad.addColorStop(0, '#fef08a');
    bandGrad.addColorStop(0.3, '#f59e0b');
    bandGrad.addColorStop(0.7, '#d97706');
    bandGrad.addColorStop(1, '#fef08a');

    c.fillStyle = bandGrad;
    c.strokeStyle = '#78350f';
    c.lineWidth = 1.4;
    c.beginPath();
    drawRoundRect(c, left - 2, bandY, width + 4, bandHeight, 3);
    c.fill();
    c.stroke();

    // Joyas incrustadas: Gran Rubí imperial central, Zafiros y Esmeraldas
    const jewels = [
      { x: cx - 24, color: '#10b981', border: '#064e3b', r: 3 }, // Esmeralda
      { x: cx - 12, color: '#3b82f6', border: '#1e3a8a', r: 3.2 }, // Zafiro
      { x: cx, color: '#ef4444', border: '#7f1d1d', r: 4.2 }, // Rubí Imperial
      { x: cx + 12, color: '#3b82f6', border: '#1e3a8a', r: 3.2 }, // Zafiro
      { x: cx + 24, color: '#10b981', border: '#064e3b', r: 3 }, // Esmeralda
    ];

    jewels.forEach((j) => {
      c.fillStyle = j.color;
      c.strokeStyle = j.border;
      c.lineWidth = 0.8;
      c.beginPath();
      c.arc(j.x, bandY + bandHeight / 2, j.r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      // Brillo blanco en la joya
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(j.x - 0.9, bandY + bandHeight / 2 - 0.9, 1.1, 0, Math.PI * 2);
      c.fill();
    });

    // 5. Ribete inferior de armiño real
    const ermineY = bandY + bandHeight;
    c.fillStyle = '#f8fafc';
    c.beginPath();
    drawRoundRect(c, left - 2, ermineY - 1, width + 4, 5, 2);
    c.fill();
    c.strokeStyle = '#94a3b8';
    c.lineWidth = 0.6;
    c.stroke();

    // Motas negras del armiño real
    c.fillStyle = '#0f172a';
    for (let dotX = left + 5; dotX <= right - 5; dotX += 9) {
      c.beginPath();
      c.arc(dotX, ermineY + 1.5, 0.9, 0, Math.PI * 2);
      c.fill();
    }

    c.restore();
  };

  // Generador de la captura de pantalla oficial con el logotipo del docente
  const handleDownloadScreenshot = () => {
    sounds.playClick();
    // Obtener el canvas del juego
    const gameCanvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!gameCanvas) return;

    // Crear un canvas de exportación de alta resolución
    const exportWidth = CANVAS_WIDTH; // 800
    const exportHeight = CANVAS_HEIGHT + 140; // 640

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // 1. Dibujar el fotograma del montaje / circuito de la partida
    ctx.drawImage(gameCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Marco decorativo inferior con estadísticas e identidad del alumno
    const bannerY = CANVAS_HEIGHT;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, bannerY, exportWidth, 140);

    // Borde separador dorado
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, bannerY);
    ctx.lineTo(exportWidth, bannerY);
    ctx.stroke();

    // Textos informativos del alumno
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Alumno/a: ${playerName || 'Estudiante'}`, 24, bannerY + 38);

    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      `Reto: ${levelTitle}${difficulty === 'hard' ? ' [Modo Difícil ⚔️]' : ''} · Presupuesto: ${spentMoney}€ gastados (${savedMoney}€ ahorrados)`,
      24,
      bannerY + 68
    );

    // Estrellas y ahorro acumulado
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(
      `★ ${stars} Estrellas en este nivel · Total: ★ ${totalStars}/${maxStars} · 💰 ${totalSavings.toLocaleString()} € ahorrados`,
      24,
      bannerY + 102
    );

    // Firma y fecha en el pie del diploma
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('@GmedranoTIC', exportWidth - 24, bannerY + 45);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Tecnología ESO · Mecanismos', exportWidth - 24, bannerY + 70);
    ctx.fillText(new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }), exportWidth - 24, bannerY + 95);

    // 3. LOGOTIPO DEL DOCENTE EN LA ESQUINA SUPERIOR DERECHA
    const avatarImg = new Image();
    avatarImg.src = teacherAvatar;

    const finishAndDownload = () => {
      try {
        // Coordenadas en la esquina superior derecha
        const logoCenterX = exportWidth - 66; // 734
        const logoCenterY = 78;
        const avatarRadius = 34;
        const hasAllStars = stars === 3;

        ctx.save();

        // Si se consiguen todas las estrellas (3 estrellas), aureola dorada de majestad
        if (hasAllStars) {
          const aura = ctx.createRadialGradient(
            logoCenterX,
            logoCenterY,
            avatarRadius,
            logoCenterX,
            logoCenterY,
            avatarRadius + 22
          );
          aura.addColorStop(0, 'rgba(245, 158, 11, 0.6)');
          aura.addColorStop(0.6, 'rgba(251, 191, 36, 0.25)');
          aura.addColorStop(1, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(logoCenterX, logoCenterY, avatarRadius + 22, 0, Math.PI * 2);
          ctx.fill();
        }

        // Fondo circular oscuro para realzar la imagen
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(logoCenterX, logoCenterY, avatarRadius + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Recorte circular para la foto del docente
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoCenterX, logoCenterY, avatarRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(
          avatarImg,
          logoCenterX - avatarRadius,
          logoCenterY - avatarRadius,
          avatarRadius * 2,
          avatarRadius * 2
        );
        ctx.restore();

        // Anillo / marco dorado del avatar
        const ringGrad = ctx.createLinearGradient(
          logoCenterX - avatarRadius,
          logoCenterY - avatarRadius,
          logoCenterX + avatarRadius,
          logoCenterY + avatarRadius
        );
        ringGrad.addColorStop(0, '#fef08a');
        ringGrad.addColorStop(0.5, '#f59e0b');
        ringGrad.addColorStop(1, '#b45309');

        ctx.strokeStyle = ringGrad;
        ctx.lineWidth = hasAllStars ? 4 : 3;
        ctx.beginPath();
        ctx.arc(logoCenterX, logoCenterY, avatarRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Placa / distintivo inferior del logotipo
        const badgeWidth = 98;
        const badgeHeight = 18;
        const badgeX = logoCenterX - badgeWidth / 2;
        const badgeY = logoCenterY + avatarRadius - 4;

        ctx.fillStyle = hasAllStars ? '#451a03' : '#0f172a';
        ctx.beginPath();
        drawRoundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 9);
        ctx.fill();

        ctx.strokeStyle = hasAllStars ? '#f59e0b' : '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        drawRoundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 9);
        ctx.stroke();

        ctx.fillStyle = hasAllStars ? '#fde047' : '#e2e8f0';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          hasAllStars ? '★ @GmedranoTIC ★' : '@GmedranoTIC',
          logoCenterX,
          badgeY + badgeHeight / 2
        );

        // SI SE CONSIGUEN TODAS LAS ESTRELLAS: CORONA DE REY GIGANTE Y MAJESTUOSA
        if (hasAllStars) {
          // La gran corona de rey se asienta en la parte superior de la cabeza del docente
          drawKingCrown(ctx, logoCenterX, logoCenterY - avatarRadius + 14, 76, 40);

          // Cinta real superior "REY DE LA MECÁNICA"
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 9px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('👑 3 ESTRELLAS 👑', logoCenterX, badgeY + badgeHeight + 11);
        }

        ctx.restore();
      } catch (err) {
        console.warn('Error dibujando sello del docente en la captura:', err);
      }

      exportCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mecanismos-gmedranotic-nivel-${levelId}-${(playerName || 'jugador').toLowerCase().replace(/\s+/g, '_')}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, 'image/png');
    };

    if (avatarImg.complete) {
      finishAndDownload();
    } else {
      avatarImg.onload = finishAndDownload;
      avatarImg.onerror = finishAndDownload;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-gradient-to-b from-[#1e2f38] to-[#162227] border-2 border-amber-500/50 rounded-2xl shadow-2xl p-6 text-white text-center relative overflow-hidden">
        {/* Marca de agua sutil de fondo */}
        <div className="pointer-events-none absolute -right-8 -top-8 text-7xl font-black text-white/5 select-none">
          GmedranoTIC
        </div>

        {/* Insignia de victoria */}
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
          <Award size={36} />
        </div>

        <h2 className="text-2xl font-black text-amber-400 flex items-center justify-center gap-2">
          <span>¡NIVEL SUPERADO!</span>
          {difficulty === 'hard' && (
            <span className="text-xs bg-red-600 text-white font-extrabold px-2 py-0.5 rounded-full border border-amber-300 shadow">
              ⚔️ DIFÍCIL
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-300 mt-0.5">{levelTitle}</p>

        {/* Estrellas conseguidas */}
        <div className="flex items-center justify-center gap-2 my-3">
          {[1, 2, 3].map((starIdx) => (
            <div
              key={starIdx}
              className={`transform transition duration-300 text-3xl sm:text-4xl ${
                starIdx <= stars
                  ? 'text-amber-400 scale-110 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                  : 'text-slate-600'
              }`}
            >
              ★
            </div>
          ))}
        </div>

        {/* Felicitación del docente con su foto y corona si logró 3 estrellas */}
        <div className={`border rounded-2xl p-3 my-3 flex items-center gap-3 text-left shadow-inner relative ${
          stars === 3
            ? 'bg-gradient-to-r from-[#2a2110] to-[#162227] border-amber-400/80'
            : 'bg-[#121c22] border-amber-500/40'
        }`}>
          <div className="relative shrink-0">
            {stars === 3 && (
              <span
                className="absolute -top-4 -left-1 text-2xl filter drop-shadow animate-bounce"
                title="¡Docente coronado con la Gran Corona de Rey por conseguir 3 estrellas!"
              >
                👑
              </span>
            )}
            <img
              src={teacherAvatar}
              alt="Prof. @GmedranoTIC"
              className={`w-12 h-12 rounded-full object-cover shadow ${
                stars === 3 ? 'border-2 border-amber-400 ring-2 ring-amber-300/40' : 'border-2 border-amber-400'
              }`}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 flex-wrap">
              <span>Prof. @GmedranoTIC:</span>
              {stars === 3 && (
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-black border border-amber-400/40 flex items-center gap-1">
                  👑 ¡CORONACIÓN REAL 3 ESTRELLAS!
                </span>
              )}
            </span>
            <span className="text-[12px] text-slate-200 leading-snug">
              {stars === 3
                ? '"¡IMPRESIONANTE! ¡Has ganado las 3 estrellas! Tu circuito mecánico es perfecto y eficiente. ¡Te corono como Rey de los Mecanismos!"'
                : '"¡Magnífico trabajo! Has usado la combinación mecánica precisa para vencer este reto."'}
            </span>
          </div>
        </div>

        {/* Resumen económico del nivel */}
        <div className="bg-[#121b1f] border border-slate-700/80 rounded-xl p-3.5 my-3 text-xs sm:text-sm">
          <div className="grid grid-cols-2 gap-2 text-left">
            <div>
              <span className="text-slate-400">Gastado: </span>
              <strong className="text-slate-200">{spentMoney} €</strong>
            </div>
            <div>
              <span className="text-slate-400">Ahorrado en reto: </span>
              <strong className="text-emerald-400 font-bold">+{savedMoney} €</strong>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">
                Progreso global: <strong className="text-amber-400">★ {totalStars}/{maxStars}</strong>
              </span>
              <span className="text-slate-400">
                Ahorro acumulado: <strong className="text-emerald-400">{totalSavings.toLocaleString()} €</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Botonera de acciones requeridas */}
        <div className="flex flex-col gap-2.5 mt-5">
          {/* Botón oficial de Captura de pantalla para el profesor/alumno */}
          <button
            onClick={handleDownloadScreenshot}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-extrabold text-sm shadow-md transition active:scale-95 cursor-pointer ${
              stars === 3
                ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-amber-500/30'
                : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white'
            }`}
          >
            <Camera size={18} />
            <span>
              {stars === 3
                ? '👑 Descargar Captura Oficial con Docente Coronado'
                : '📸 Hacer Captura con mi Nombre y Logotipo'}
            </span>
          </button>

          <div className="flex items-center gap-2">
            {hasNextLevel && (
              <button
                onClick={() => {
                  sounds.playClick();
                  onNextLevel();
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow transition active:scale-95 cursor-pointer"
              >
                <span>Siguiente Reto</span>
                <ArrowRight size={18} />
              </button>
            )}

            <button
              onClick={() => {
                sounds.playClick();
                onOpenLevelSelect();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-sm border border-slate-600 transition active:scale-95 cursor-pointer"
            >
              <Grid size={17} />
              <span>Ver Niveles</span>
            </button>
          </div>
        </div>

        {/* Firma educativa */}
        <div className="text-[11px] text-slate-400 mt-4">
          Alumno: <span className="text-amber-300 font-bold">{playerName}</span> · Tecnología ESO @GmedranoTIC
        </div>
      </div>
    </div>
  );
};

