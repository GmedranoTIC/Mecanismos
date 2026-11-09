import { BallState, GameDifficulty, LevelDef, PlacedPart } from './types';
import { MECHANISMS } from './mechanisms';
import { sounds } from './audio';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;
export const BALL_RADIUS = 8;
export const GRAVITY = 950; // px/s²

/**
 * En el nivel difícil:
 * 1) Presupuesto -30% (redondeado)
 * 2) Las rampas (muros / pistas inclinadas y plataformas) un 10% más cortas, contrayéndose hacia su centro
 * 3) La meta un 20% más arriba (reducir coordenada Y en un 20%, o mínimo 30px hacia arriba sin salirse del techo)
 */
export function getEffectiveLevel(level: LevelDef, difficulty: GameDifficulty = 'standard'): LevelDef {
  if (difficulty !== 'hard') {
    return level;
  }

  // 1. Meta un 20% más arriba (mínimo 30px hacia arriba, respetando margen superior de seguridad)
  const [origBx, origBy] = level.b;
  // Subir un 20% de la altura o al menos 30px; en pantalla de 500px, 20% son 100px o el 20% de su propia altura Y
  // "la meta un 20% más arriba": desplazamos hacia arriba el 20% de su posición Y actual (ej: si está en 400 -> sube a 320)
  // asegurando un margen superior cómodo (>= 55px)
  const targetBy = Math.max(55, Math.round(origBy * 0.8));
  const newBasket: [number, number] = [origBx, targetBy];

  // 2. Rampas / muros de los niveles un 10% más cortas (factor de escala 0.90 desde el punto medio)
  const newWalls: [number, number, number, number][] = (level.w || []).map(([x1, y1, x2, y2]) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = (x2 - x1) * 0.45; // 0.90 / 2 = 0.45 desde el centro
    const dy = (y2 - y1) * 0.45;
    return [
      Math.round(mx - dx),
      Math.round(my - dy),
      Math.round(mx + dx),
      Math.round(my + dy),
    ];
  });

  return {
    ...level,
    bud: Math.round(level.bud * 0.70),
    b: newBasket,
    w: newWalls,
  };
}

export interface PhysicsSegment {
  p: [number, number, number, number]; // x1, y1, x2, y2
  v?: (px: number, py: number) => [number, number];
  restitution?: number;
  friction?: number;
  isMechanism?: boolean;
  onHit?: (ball: BallState, px: number, py: number, vn: number) => void;
}

/**
 * Genera todos los segmentos de colisión estáticos y dinámicos para el tiempo t
 */
export function generateSegments(
  level: LevelDef,
  parts: PlacedPart[],
  t: number,
  spawnedBalls?: BallState[]
): PhysicsSegment[] {
  const segs: PhysicsSegment[] = [];
  const add = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    v?: (px: number, py: number) => [number, number],
    restitution?: number,
    isMech: boolean = false,
    onHit?: (ball: BallState, px: number, py: number, vn: number) => void
  ) => {
    segs.push({ p: [x1, y1, x2, y2], v, restitution, isMechanism: isMech, onHit });
  };

  // 1. Límites del escenario
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;
  add(0, H - 6, W, H - 6); // Suelo
  add(0, 0, 0, H); // Pared izquierda
  add(W, 0, W, H); // Pared derecha
  add(0, 0, W, 0); // Techo

  // 2. Muros del nivel
  if (level.w) {
    for (const wall of level.w) {
      add(wall[0], wall[1], wall[2], wall[3]);
    }
  }

  // 3. Cesta objetivo / Bucket estilo Dynamic Systems: boca ancha con bordes acampanados
  const [bx, by] = level.b;
  // Bordes superiores acampanados tipo embudo para guiar la bola suavemente
  add(bx - 34, by - 8, bx - 26, by);
  add(bx + 34, by - 8, bx + 26, by);
  // Paredes y fondo del cesto
  add(bx - 26, by, bx - 26, by + 32);
  add(bx + 26, by, bx + 26, by + 32);
  add(bx - 26, by + 32, bx + 26, by + 32);

  // 4. Mecanismos colocados por el jugador
  for (const p of parts) {
    const mech = MECHANISMS[p.i];
    if (!mech) continue;

    const cosA = Math.cos(p.a);
    const sinA = Math.sin(p.a);
    const rotPoint = (lx: number, ly: number): [number, number] => [
      p.x + lx * cosA - ly * sinA,
      p.y + lx * sinA + ly * cosA,
    ];

    const halfL = (mech.l || 70) / 2;

    switch (mech.k) {
      case 's': // Segmento recto (Rampa, Libro, Palanca)
        if (mech.id === 'libro') {
          const L = mech.l || 55;
          const halfL = L / 2;
          const baseBx = p.x + halfL * Math.sin(p.a);
          const baseBy = p.y + halfL * Math.cos(p.a);
          const theta = p.a + (p.fallAngle || 0);
          const topTx = baseBx + L * Math.sin(theta);
          const topTy = baseBy - L * Math.cos(theta);

          const velFn =
            p.fallVel && Math.abs(p.fallVel) > 0.1
              ? (_px: number, _py: number): [number, number] => {
                  const r = Math.hypot(_px - baseBx, _py - baseBy);
                  return [p.fallVel! * r * Math.cos(theta), p.fallVel! * r * Math.sin(theta)];
                }
              : undefined;

          const onHit = (ball: BallState) => {
            if (!p.f || Math.abs(p.fallAngle || 0) < 0.2) {
              p.f = 1;
              const fallDir = ball.vx > 10 ? 1 : ball.vx < -10 ? -1 : ball.x < baseBx ? 1 : -1;
              p.fallDir = fallDir;
              p.fallVel = fallDir * (7.5 + Math.min(12.0, Math.abs(ball.vx) / 25));
              sounds.playDomino();
              ball.vx *= 0.7;
              ball.vy *= 0.7;
            }
          };

          add(baseBx, baseBy, topTx, topTy, velFn, 0.35, true, onHit);
        } else if (mech.id === 'palanca') {
          // Palanca con fulcro central que bascula dinámicamente alrededor de (p.x, p.y)
          const L = mech.l || 160;
          const halfL = L / 2;
          const theta = p.a + (p.fallAngle || 0);
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          const x1 = p.x - halfL * cosT;
          const y1 = p.y - halfL * sinT;
          const x2 = p.x + halfL * cosT;
          const y2 = p.y + halfL * sinT;

          // Velocidad tangencial del segmento debida a velocidad angular omega
          const omega = p.fallVel || 0;
          const velFn =
            Math.abs(omega) > 0.02
              ? (px: number, py: number): [number, number] => {
                  return [-omega * (py - p.y), omega * (px - p.x)];
                }
              : undefined;

          // Callback onHit para transferir impulso angular instantáneamente al chocar la bola
          const onHit = (ball: BallState, px: number, py: number, vn: number) => {
            // Distancia con signo desde el fulcro a lo largo de la barra
            const r = (px - p.x) * cosT + (py - p.y) * sinT;
            const impactMag = Math.abs(vn) + 140;

            // Transmisión de momento angular: empuje hacia abajo en el brazo impactado
            // r < 0 (brazo izquierdo): disminuye el ángulo (sentido antihorario, brazo izquierdo baja)
            // r > 0 (brazo derecho): aumenta el ángulo (sentido horario, brazo derecho baja)
            const angularImpulse = (r / halfL) * (impactMag / 26);
            p.fallVel = (p.fallVel || 0) + angularImpulse;
            sounds.playBounce(Math.min(650, impactMag * 3));

            // Si golpea el brazo izquierdo (r < -8) y la segunda bola no ha sido catapultada aún
            if (r < -8 && p.hasExtraBall !== false && !p.firedBall) {
              p.firedBall = true;
              const cupArm = halfL - 15;
              const cupX = p.x + cupArm * cosT - 10 * (-sinT);
              const cupY = p.y + cupArm * sinT - 10 * cosT;

              // Potencia de catapulta: impulso tangencial ascendente hacia la meta
              const flingPower = Math.max(420, Math.abs(angularImpulse) * 65 + 300);
              const launchVx = cosT * 200 - sinT * flingPower * 0.75;
              const launchVy = sinT * 200 - cosT * flingPower - 140;

              if (spawnedBalls) {
                spawnedBalls.push({
                  x: cupX,
                  y: cupY,
                  vx: launchVx,
                  vy: Math.min(-260, launchVy),
                });
              }
              sounds.playBounce(700);
            } else if (r > 8 && p.hasExtraBall !== false && !p.firedBall) {
              // Si la bola golpea en el lado derecho, libera la bola haciéndola rodar
              p.firedBall = true;
              const cupArm = halfL - 15;
              const cupX = p.x + cupArm * cosT - 10 * (-sinT);
              const cupY = p.y + cupArm * sinT - 10 * cosT;
              if (spawnedBalls) {
                spawnedBalls.push({
                  x: cupX,
                  y: cupY - 4,
                  vx: ball.vx * 0.8 + 80,
                  vy: ball.vy * 0.8 - 60,
                });
              }
            }
          };

          add(x1, y1, x2, y2, velFn, 0.45, true, onHit);
        } else if (mech.id === 'bola_extra') {
          // Soporte de bola extra: base ligera de soporte
          add(p.x - 12, p.y + 4, p.x + 12, p.y + 4, undefined, 0.35, true);
        } else {
          add(...rotPoint(-halfL, 0), ...rotPoint(halfL, 0), undefined, 0.45, true);
        }
        break;

      case 'w': { // Cuña (triángulo)
        const p1 = rotPoint(-halfL, halfL * 0.4);
        const p2 = rotPoint(halfL, halfL * 0.4);
        const p3 = rotPoint(halfL, -halfL * 0.4);
        add(...p1, ...p2, undefined, 0.5, true);
        add(...p2, ...p3, undefined, 0.5, true);
        add(...p3, ...p1, undefined, 0.5, true);
        break;
      }

      case 't': // Muelle / trampolín elástico
        add(...rotPoint(-halfL, 0), ...rotPoint(halfL, 0), undefined, 1.35, true);
        break;

      case 'o': { // Plataforma oscilante (Polea simple, Biela-manivela, Piñón-cremallera, Leva)
        const omega = 2 * Math.PI * (mech.freq || 0.5);
        const sinW = Math.sin(omega * t);
        const cosW = Math.cos(omega * t) * omega;

        if (mech.id === 'polea_simple') {
          // Polea simple con contrapeso y bola auxiliar (estilo palanca)
          const disp = p.fallAngle || 0;
          const vyDown = p.fallVel || 0;

          // Velocidad del plato izquierdo al descender
          const velLeftFn = Math.abs(vyDown) > 0.05
            ? () => [ -vyDown * sinA, vyDown * cosA ] as [number, number]
            : undefined;

          // Bandeja receptora izquierda donde aterriza la bola del jugador
          const pL1 = rotPoint(-38, 35 + disp);
          const pL2 = rotPoint(-6, 35 + disp);

          const onHit = (_ball: BallState, _px: number, _py: number, vn: number) => {
            const impact = Math.abs(vn) + 120;
            p.fallVel = Math.min(220, (p.fallVel || 0) + impact * 0.85);
            sounds.playBounce(Math.min(650, impact * 3));

            // Si la segunda bola aún está en la cesta del contrapeso derecho
            if (!p.firedBall && p.hasExtraBall !== false) {
              p.firedBall = true;
              const cupY = 75 - disp;
              const cupX = p.x + 22 * cosA - cupY * (-sinA);
              const cupActualY = p.y + 22 * sinA + cupY * cosA;

              // Fuerza de catapultado hacia arriba y derecha
              const flingPower = Math.max(380, impact * 1.8 + 260);
              const flingVx = 160 * cosA - 40 * (-sinA);
              const flingVy = 160 * sinA - flingPower * cosA;

              if (spawnedBalls) {
                spawnedBalls.push({
                  x: cupX,
                  y: cupActualY - 12,
                  vx: flingVx,
                  vy: Math.min(-260, flingVy),
                });
              }
              sounds.playBounce(750);
            }
          };

          add(...pL1, ...pL2, velLeftFn, 0.45, true, onHit);

          // Pestaña lateral izquierda para retener la bola
          const pLip1 = rotPoint(-38, 35 + disp);
          const pLip2 = rotPoint(-38, 20 + disp);
          add(...pLip1, ...pLip2, undefined, 0.4, true);

          // Rueda superior de la polea
          const pTop1 = rotPoint(-22, -10);
          const pTop2 = rotPoint(22, -10);
          add(...pTop1, ...pTop2, undefined, 0.5, true);

          // Cesta de soporte del contrapeso con la bola auxiliar
          if (!p.firedBall && p.hasExtraBall !== false) {
            const cupY = 75 - disp;
            const pR1 = rotPoint(10, cupY);
            const pR2 = rotPoint(34, cupY);
            add(...pR1, ...pR2, undefined, 0.4, true);
          }

        } else if (mech.id === 'pinon_cremallera') {
          // Cremallera deslizante horizontalmente con offX
          const offX = (mech.dx || 80) * sinW;
          const velX = (mech.dx || 80) * cosW * cosA;
          const velY = (mech.dx || 80) * cosW * sinA;

          // Superficie superior de la cremallera
          const pA = rotPoint(-halfL + offX, -2);
          const pB = rotPoint(halfL + offX, -2);
          add(...pA, ...pB, () => [velX, velY], 0.65, true);

          // Borde superior del piñón fijo en (0, -21)
          const pG1 = rotPoint(-15, -21);
          const pG2 = rotPoint(15, -21);
          add(...pG1, ...pG2, undefined, 0.5, true);

        } else if (mech.id === 'leva_seguidor') {
          // Plataforma azul seguidora que sube y baja empujada por la leva excéntrica
          const camLift = 12 * Math.cos(omega * t);
          const contactY = 16 - 18 - camLift;
          const platY = contactY - 5;
          const vyLocal = 12 * omega * Math.sin(omega * t); // dy/dt de subida/bajada

          const velX = -vyLocal * sinA;
          const velY = vyLocal * cosA;

          // Superficie de la plataforma azul móvil
          const pA = rotPoint(-halfL, platY - 4);
          const pB = rotPoint(halfL, platY - 4);
          add(...pA, ...pB, () => [velX, velY], 0.7, true);

          // Base del pedestal de la leva
          const pBase1 = rotPoint(-16, 26);
          const pBase2 = rotPoint(16, 26);
          add(...pBase1, ...pBase2, undefined, 0.4, true);

        } else {
          const offX = (mech.dx || 0) * sinW;
          const offY = (mech.dy || 0) * sinW;

          const velX = (mech.dx || 0) * cosW * cosA - (mech.dy || 0) * cosW * sinA;
          const velY = (mech.dx || 0) * cosW * sinA + (mech.dy || 0) * cosW * cosA;

          const pA = rotPoint(-halfL + offX, offY);
          const pB = rotPoint(halfL + offX, offY);

          add(...pA, ...pB, () => [velX, velY], 0.6, true);
        }
        break;
      }

      case 'r': { // Mecanismos giratorios: Engranajes y tornillo sin fin
        const speed = mech.w || 2.8;

        if (mech.id === 'tornillo_sinfin') {
          // Tornillo sin fin: cuerpo cilíndrico estático en p.a que transporta como cinta continua
          const convSpeed = (mech.w || 2.0) * 80;
          const vX = Math.cos(p.a) * convSpeed;
          const vY = Math.sin(p.a) * convSpeed;

          // Superficie superior e inferior donde se apoya y transporta la bola en la rosca
          const pTop1 = rotPoint(-halfL, -12);
          const pTop2 = rotPoint(halfL, -12);
          add(...pTop1, ...pTop2, () => [vX, vY], 0.85, true);

          const pBot1 = rotPoint(-halfL, 12);
          const pBot2 = rotPoint(halfL, 12);
          add(...pBot1, ...pBot2, () => [vX, vY], 0.85, true);

          // Fondo posterior para evitar retrocesos accidentales
          add(...pTop1, ...pBot1, undefined, 0.4, true);

        } else {
          // Engranaje dentado rotatorio (engranaje)
          const ang = p.a + speed * t;
          const R = 35; // radio del engranaje con sus dientes

          // Velocidad tangencial v = omega x r
          const velFn = (px: number, py: number): [number, number] => {
            return [-speed * (py - p.y), speed * (px - p.x)];
          };

          // 4 segmentos diametrales a 45º para cubrir perfectamente los 360º de la rueda dentada
          for (let k = 0; k < 4; k++) {
            const kAng = ang + (k * Math.PI) / 4;
            const ck = Math.cos(kAng);
            const sk = Math.sin(kAng);
            const xa = p.x - R * ck;
            const ya = p.y - R * sk;
            const xb = p.x + R * ck;
            const yb = p.y + R * sk;
            add(xa, ya, xb, yb, velFn, 0.72, true);
          }
        }
        break;
      }

      default:
        break;
    }
  }

  return segs;
}

/**
 * Resuelve la colisión entre la bola y un segmento con física de rebote por la normal exacta
 */
export function resolveSegmentCollision(ball: BallState, seg: PhysicsSegment): boolean {
  const [x1, y1, x2, y2] = seg.p;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-6) return false;

  // Proyección ortogonal del centro de la bola sobre el segmento
  let u = ((ball.x - x1) * dx + (ball.y - y1) * dy) / lenSq;
  u = Math.max(0, Math.min(1, u));

  const px = x1 + u * dx;
  const py = y1 + u * dy;

  let nx = ball.x - px;
  let ny = ball.y - py;
  const dist = Math.hypot(nx, ny);

  if (dist >= BALL_RADIUS) return false;

  // Cálculo del vector unitario normal: siempre apunta DESDE la superficie HACIA la bola
  if (dist < 1e-5) {
    const invLen = 1 / Math.sqrt(lenSq);
    nx = -dy * invLen;
    ny = dx * invLen;
  } else {
    nx /= dist;
    ny /= dist;
  }

  // Corregir penetración de forma instantánea
  ball.x = px + nx * (BALL_RADIUS + 0.05);
  ball.y = py + ny * (BALL_RADIUS + 0.05);

  // Obtener velocidad de la superficie en el punto de contacto
  const [sx, sy] = seg.v ? seg.v(px, py) : [0, 0];

  // Velocidad relativa
  const rx = ball.vx - sx;
  const ry = ball.vy - sy;

  // Componente normal
  const vn = rx * nx + ry * ny;

  // Si la bola se mueve HACIA la superficie (vn < 0), realizamos el rebote
  if (vn < 0) {
    if (seg.onHit) {
      seg.onHit(ball, px, py, vn);
    }
    const baseRestitution = seg.restitution !== undefined ? seg.restitution : 0.52;
    // Eliminación de rebote microscópico
    const e = Math.abs(vn) > 35 ? baseRestitution : 0.02;

    // Vector tangente perpendicular
    const tx = -ny;
    const ty = nx;
    const vt = rx * tx + ry * ty;
    const friction = 0.985;

    // Nueva velocidad relativa descompuesta
    const newRx = vt * friction * tx - e * vn * nx;
    const newRy = vt * friction * ty - e * vn * ny;

    ball.vx = newRx + sx;
    ball.vy = newRy + sy;

    if (Math.abs(vn) > 65) {
      sounds.playBounce(Math.abs(vn));
    }
    return true;
  } else if (seg.v) {
    // Si la superficie se está moviendo hacia la bola (plataforma elevadora, leva o pistón)
    if (ny < -0.4 && sy < ball.vy) {
      ball.vy = sy;
    }
    if (Math.abs(nx) > 0.4 && ((sx > 0 && ball.vx < sx) || (sx < 0 && ball.vx > sx))) {
      ball.vx = sx;
    }
  }

  return false;
}

/**
 * Aplica campos de fuerza de mecanismos especiales:
 * - Globo (fuerza ascensional)
 * - Ventilador (corriente de aire continua)
 * - Pistola de gatillo (impulso repentino)
 * - Libro dominó (volteo dinámico)
 * - Palanca con fulcro (basculación por torque y catapulta de bola auxiliar)
 */
export function applyMechanismFields(
  balls: BallState[],
  parts: PlacedPart[],
  dt: number,
  spawnedBalls?: BallState[]
): void {
  for (const p of parts) {
    const mech = MECHANISMS[p.i];
    if (!mech) continue;

    const cosA = Math.cos(p.a);
    const sinA = Math.sin(p.a);

    // 1. Globo ascensional
    if (mech.k === 'b') {
      const balloonCenterY = p.y - 28;
      for (const ball of balls) {
        const dx = ball.x - p.x;
        const dist = Math.hypot(dx, ball.y - balloonCenterY);
        if (dist < 38) {
          ball.vy -= 2200 * dt;
          ball.vx += (dx > 0 ? 80 : -80) * dt;
          sounds.playBalloon();
        }
      }
    }

    // 2. Ventilador de corriente de aire
    else if (mech.k === 'f') {
      const fanRange = mech.l || 140;
      for (const ball of balls) {
        const dx = ball.x - p.x;
        const dy = ball.y - p.y;
        const localForward = dx * cosA + dy * sinA;
        const localLateral = -dx * sinA + dy * cosA;
        if (localForward > 0 && localForward < fanRange && Math.abs(localLateral) < 34) {
          const falloff = 1 - localForward / fanRange;
          const windForce = 1800 * falloff;
          ball.vx += windForce * cosA * dt;
          ball.vy += windForce * sinA * dt;
          if (Math.random() < 0.15) {
            sounds.playFan();
          }
        }
      }
    }

    // 3. Cañón impulsor de artillería
    else if (mech.k === 'g' && !p.f) {
      for (const ball of balls) {
        const dx = ball.x - p.x;
        const dy = ball.y - p.y;
        const dist = Math.hypot(dx, dy);
        // Cuando la bola entra en la recámara del cañón
        if (dist < 28) {
          p.f = 1; // Detonación del cañón
          const impulse = 840;
          ball.vx = impulse * cosA;
          ball.vy = impulse * sinA;
          sounds.playGun();
          break;
        }
      }
    }

    // 4. Libro dominó interactivo: se cae al chocar con la bola o en cadena
    else if (mech.id === 'libro') {
      const L = mech.l || 55;
      const halfL = L / 2;
      const baseBx = p.x + halfL * Math.sin(p.a);
      const baseBy = p.y + halfL * Math.cos(p.a);
      const theta = p.a + (p.fallAngle || 0);
      const topTx = baseBx + L * Math.sin(theta);
      const topTy = baseBy - L * Math.cos(theta);

      const segDx = topTx - baseBx;
      const segDy = topTy - baseBy;
      const lenSq = segDx * segDx + segDy * segDy || 1;

      for (const ball of balls) {
        let u = ((ball.x - baseBx) * segDx + (ball.y - baseBy) * segDy) / lenSq;
        u = Math.max(0, Math.min(1, u));
        const closeX = baseBx + u * segDx;
        const closeY = baseBy + u * segDy;
        const dist = Math.hypot(ball.x - closeX, ball.y - closeY);

        // Si la bola choca con el libro y aún está en pie
        if (dist < BALL_RADIUS + 12 && (!p.f || Math.abs(p.fallAngle || 0) < 0.2)) {
          p.f = 1; // Inicia la caída del dominó
          const fallDir =
            ball.vx > 10 ? 1 : ball.vx < -10 ? -1 : ball.x < baseBx ? 1 : -1;
          p.fallDir = fallDir;
          p.fallVel = fallDir * (7.0 + Math.min(12.0, Math.abs(ball.vx) / 30));
          sounds.playDomino();

          ball.vx *= 0.65;
          ball.vy *= 0.65;
        }

        // Si la punta del libro en movimiento roza la bola
        if (p.f && p.fallVel) {
          const tipDist = Math.hypot(ball.x - topTx, ball.y - topTy);
          if (tipDist < BALL_RADIUS + 16) {
            const vTipX = p.fallVel * L * Math.cos(theta) * 0.45;
            const vTipY = p.fallVel * L * Math.sin(theta) * 0.45;
            ball.vx += vTipX;
            ball.vy += vTipY;
          }
        }
      }

      // Dinámica de caída si el dominó está cayendo
      if (p.f && p.fallVel !== undefined && p.fallVel !== 0) {
        const dir = p.fallDir || 1;
        const currentAngle = p.fallAngle || 0;
        const gravityTorque = 34 * Math.sin(Math.abs(currentAngle) + 0.25) * dir;
        p.fallVel += gravityTorque * dt;
        p.fallAngle = (p.fallAngle || 0) + p.fallVel * dt;

        if (dir > 0 && (p.fallAngle || 0) >= 1.48) {
          p.fallAngle = 1.48;
          p.fallVel = 0;
        } else if (dir < 0 && (p.fallAngle || 0) <= -1.48) {
          p.fallAngle = -1.48;
          p.fallVel = 0;
        }

        for (const other of parts) {
          if (other !== p && MECHANISMS[other.i]?.id === 'libro' && !other.f) {
            const distToOther = Math.hypot(topTx - other.x, topTy - other.y);
            const isTowards = (other.x - p.x) * dir > -5;
            if (distToOther < 44 && isTowards) {
              other.f = 1;
              other.fallDir = dir;
              other.fallVel = (Math.abs(p.fallVel) + 4) * dir;
              sounds.playDomino();
            }
          }
        }
      }
    }

    // 5. Palanca con fulcro dinámica: momento de fuerza continuo y topes mecánicos
    else if (mech.id === 'palanca') {
      const L = mech.l || 160;
      const halfL = L / 2;
      const theta = p.a + (p.fallAngle || 0);
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      let continuousTorque = 0;

      for (const ball of balls) {
        const dx = ball.x - p.x;
        const dy = ball.y - p.y;
        const r = dx * cosT + dy * sinT; // Distancia con signo a lo largo de la barra
        const h = -dx * sinT + dy * cosT; // Distancia perpendicular

        // Si la bola está sobre o rozando la barra de la palanca
        if (Math.abs(r) <= halfL + 8 && Math.abs(h) <= BALL_RADIUS + 8) {
          // Peso continuo ejerciendo par de torsión (torque = r * F)
          const weightTorque = (r / halfL) * 42.0;
          continuousTorque += weightTorque;

          // Catapulta de rescate si rueda o cae con velocidad
          if (r < -10 && p.hasExtraBall !== false && !p.firedBall && ball.vy > 35) {
            p.firedBall = true;
            const cupArm = halfL - 15;
            const cupX = p.x + cupArm * cosT - 10 * (-sinT);
            const cupY = p.y + cupArm * sinT - 10 * cosT;
            if (spawnedBalls) {
              spawnedBalls.push({
                x: cupX,
                y: cupY,
                vx: cosT * 190 - sinT * 380,
                vy: sinT * 190 - cosT * 480 - 120,
              });
            }
            sounds.playBounce(650);
          }
        }
      }

      // Dinámica angular con amortiguamiento realista en el eje del fulcro
      p.fallVel = ((p.fallVel || 0) + continuousTorque * dt) * (1 - 0.7 * dt);
      p.fallAngle = (p.fallAngle || 0) + (p.fallVel || 0) * dt;

      // Topes mecánicos de inclinación (~33 grados / 0.58 rad)
      const maxTilt = 0.58;
      if ((p.fallAngle || 0) > maxTilt) {
        p.fallAngle = maxTilt;
        if ((p.fallVel || 0) > 0) {
          p.fallVel = -(p.fallVel || 0) * 0.22;
          if (Math.abs(p.fallVel) > 0.3) {
            sounds.playBounce(Math.min(300, Math.abs(p.fallVel) * 50));
          }
        }
      } else if ((p.fallAngle || 0) < -maxTilt) {
        p.fallAngle = -maxTilt;
        if ((p.fallVel || 0) < 0) {
          p.fallVel = -(p.fallVel || 0) * 0.22;
          if (Math.abs(p.fallVel) > 0.3) {
            sounds.playBounce(Math.min(300, Math.abs(p.fallVel) * 50));
          }
        }
      }
    }

    // 6. Polea simple: sistema de contrapeso con cuerda y bola auxiliar
    else if (mech.id === 'polea_simple') {
      const maxDisp = 50;

      // Desplazamiento de la cuerda: p.fallAngle representa el descenso del plato izquierdo / elevación del plato derecho
      if ((p.fallVel || 0) > 0.05) {
        p.fallAngle = Math.min(maxDisp, (p.fallAngle || 0) + (p.fallVel || 0) * dt);
        p.fallVel = (p.fallVel || 0) * (1 - 1.2 * dt); // amortiguamiento mecánico
      }

      // Comprobar si alguna bola está sobre la bandeja receptora izquierda
      const cosA = Math.cos(p.a);
      const sinA = Math.sin(p.a);
      const trayOffset = 35 + (p.fallAngle || 0);
      const trayX = p.x - 22 * cosA - trayOffset * (-sinA);
      const trayY = p.y - 22 * sinA + trayOffset * cosA;

      for (const ball of balls) {
        const dX = (ball.x - trayX) * cosA + (ball.y - trayY) * sinA;
        const dY = -(ball.x - trayX) * sinA + (ball.y - trayY) * cosA;

        // Si la bola está sobre la bandeja izquierda
        if (Math.abs(dX) < 22 && dY >= -14 && dY <= 10) {
          p.fallVel = Math.min(180, (p.fallVel || 0) + 50.0 * dt);

          // Si el contrapeso sube lo suficiente y la bola auxiliar aún no fue catapultada
          if (!p.firedBall && p.hasExtraBall !== false && (p.fallAngle || 0) > 10) {
            p.firedBall = true;
            const cupOffset = 75 - (p.fallAngle || 0);
            const cupX = p.x + 22 * cosA - cupOffset * (-sinA);
            const cupY = p.y + 22 * sinA + cupOffset * cosA;

            const flingVx = 160 * cosA - 40 * (-sinA);
            const flingVy = 160 * sinA - 360 * cosA;

            if (spawnedBalls) {
              spawnedBalls.push({
                x: cupX,
                y: cupY - 10,
                vx: flingVx,
                vy: Math.min(-260, flingVy),
              });
            }
            sounds.playBounce(750);
          }
        }
      }
    }

    // 7. Tornillo sin fin: transportador helicoidal activo continuo (puede elevar hacia arriba)
    else if (mech.id === 'tornillo_sinfin') {
      const L = mech.l || 110;
      const halfL = L / 2;
      const cosA = Math.cos(p.a);
      const sinA = Math.sin(p.a);
      const targetSpeed = (mech.w || 2.0) * 85; // velocidad de avance regular

      for (const ball of balls) {
        const dx = ball.x - p.x;
        const dy = ball.y - p.y;
        const along = dx * cosA + dy * sinA;
        const perp = -dx * sinA + dy * cosA;

        // Si la bola está en contacto con el cuerpo cilíndrico del tornillo sin fin
        if (along >= -halfL - 8 && along <= halfL + 8 && Math.abs(perp) <= 24) {
          const currentAlong = ball.vx * cosA + ball.vy * sinA;

          // Propulsar firmemente en la dirección axial del sin fin
          if (currentAlong < targetSpeed) {
            const accel = 950;
            const dV = Math.min(targetSpeed - currentAlong, accel * dt);
            ball.vx += dV * cosA;
            ball.vy += dV * sinA;
          }

          // Si el sin fin está inclinado hacia arriba (sinA < 0), elevar la bola contrarrestando la gravedad
          if (sinA < -0.05) {
            // Contrarrestar la gravedad para que la rosca helicoidal eleve la bola activamente
            ball.vy -= GRAVITY * dt * 1.05;
            // Impulso ascendente adicional proporcional a la inclinación
            ball.vy += sinA * targetSpeed * 0.45 * dt;
          }

          // Centrado estabilizador en el canal de la rosca para que no se caiga de los laterales
          const currentPerp = -ball.vx * sinA + ball.vy * cosA;
          if (Math.abs(currentPerp) > 15) {
            const damp = currentPerp * 0.6 * dt;
            ball.vx += sinA * damp;
            ball.vy -= cosA * damp;
          }
        }
      }
    }
  }
}

/**
 * Ejecuta un paso de simulación con sub-stepping para máxima precisión física
 */
export function stepPhysics(
  balls: BallState[],
  level: LevelDef,
  parts: PlacedPart[],
  dt: number,
  currentTime: number,
  substeps: number = 10
): { won: boolean; outOfBounds: boolean; spawnedBalls: BallState[] } {
  const dtSub = dt / substeps;
  const spawnedBalls: BallState[] = [];
  let won = false;

  for (let s = 0; s < substeps; s++) {
    const subTime = currentTime + s * dtSub;

    // 1. Gravedad y fricción del aire para todas las bolas
    for (const ball of balls) {
      ball.vy += GRAVITY * dtSub;
      ball.vx *= 0.9998;
      ball.vy *= 0.9998;
    }

    // 2. Fuerzas especiales de mecanismos y lanzamiento de bolas auxiliares
    const newInStep: BallState[] = [];
    applyMechanismFields(balls, parts, dtSub, newInStep);

    // 3. Integración de posición
    for (const ball of balls) {
      ball.x += ball.vx * dtSub;
      ball.y += ball.vy * dtSub;
    }

    // 4. Colisiones con segmentos (incluyendo onHit de palanca y dominó)
    const segments = generateSegments(level, parts, subTime, newInStep);
    for (const ball of balls) {
      for (const seg of segments) {
        resolveSegmentCollision(ball, seg);
      }
    }

    // 5. Añadir bolas recién catapultadas o generadas en este substep
    if (newInStep.length > 0) {
      for (const nb of newInStep) {
        balls.push(nb);
        spawnedBalls.push(nb);
      }
    }

    // 6. Colisiones elásticas entre todas las bolas activas
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const b1 = balls[i];
        const b2 = balls[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = BALL_RADIUS * 2;
        if (dist < minDist && dist > 1e-4) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          b1.x -= nx * overlap * 0.5;
          b1.y -= ny * overlap * 0.5;
          b2.x += nx * overlap * 0.5;
          b2.y += ny * overlap * 0.5;

          const rvx = b2.vx - b1.vx;
          const rvy = b2.vy - b1.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const impulse = -(1 + 0.8) * vn * 0.5;
            b1.vx -= impulse * nx;
            b1.vy -= impulse * ny;
            b2.vx += impulse * nx;
            b2.vy += impulse * ny;
            if (Math.abs(vn) > 40) {
              sounds.playBounce(Math.abs(vn));
            }
          }
        }
      }
    }

    // 7. Comprobar si alguna bola entra en la cesta objetivo
    const [bx, by] = level.b;
    for (const ball of balls) {
      const inBasketX = Math.abs(ball.x - bx) < 26;
      const inBasketY = ball.y >= by - 2 && ball.y <= by + 34;

      if (inBasketX && inBasketY) {
        ball.vx *= 0.3;
        ball.vy *= 0.3;
        won = true;
      }
    }
    if (won) return { won: true, outOfBounds: false, spawnedBalls };
  }

  // Comprobar si todas las bolas salieron de la pantalla
  const allOutOfBounds =
    balls.length > 0 &&
    balls.every((b) => b.y > CANVAS_HEIGHT + 70 || b.x < -70 || b.x > CANVAS_WIDTH + 70);

  return { won, outOfBounds: allOutOfBounds, spawnedBalls };
}
