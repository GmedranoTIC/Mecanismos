export type MechanismCategory = 'rube' | 'basico' | 'transmision' | 'avanzado';

export interface MechanismItem {
  id: string;
  n: string;
  c: number;
  k: 's' | 'w' | 'o' | 'r' | 'b' | 'g' | 'f' | 't';
  l?: number;
  w?: number;
  dx?: number;
  dy?: number;
  freq?: number;
  u: number; // nivel mínimo de desbloqueo
  i: string; // icono o emoji
  category: MechanismCategory;
  desc: string; // Explicación didáctica para la ESO
}

export interface PlacedPart {
  uid: string;
  i: number; // índice en lista de mecanismos
  x: number;
  y: number;
  a: number; // ángulo en radianes
  f?: number; // estado de disparo / animación (1 = accionado / cayendo)
  fallAngle?: number; // ángulo dinámico de inclinación (dominó o palanca basculante)
  fallVel?: number; // velocidad angular de giro
  fallDir?: number; // dirección de caída o giro
  hasExtraBall?: boolean; // si la palanca cuenta con una bola auxiliar en el otro extremo (por defecto true)
  firedBall?: boolean; // si la bola auxiliar ya fue catapultada
}

export interface LevelDef {
  id: number | string;
  title: string;
  s: [number, number]; // punto de salida [x, y]
  extraBalls?: [number, number][]; // bolas auxiliares predefinidas en el escenario [x, y]
  b: [number, number]; // cesta meta [x, y]
  w: [number, number, number, number][]; // muros u obstáculos [x1, y1, x2, y2]
  bud: number; // presupuesto en €
  tip?: string; // consejo educativo
  requiredMech?: string; // Mecanismo imprescindible para resolver el nivel
  allowedMechs?: string[]; // Si se define, restringe la paleta a estos mecanismos para evitar rampas infinitas
  maxUnits?: Record<string, number>; // Límite máximo de unidades por mecanismo para el reto
  mechFocus?: string; // Título del concepto clave (e.g. "Elevación neumática", "Transmisión a 90º")
}

export interface LevelResult {
  s: number; // estrellas conseguidas (1..3)
  m: number; // dinero ahorrado en €
  date?: string;
}

export type GameDifficulty = 'standard' | 'hard';

export interface PlayerData {
  name: string;
  levels: Record<number, LevelResult>;
  levelsHard?: Record<number, LevelResult>;
  custom: LevelDef[];
  soundEnabled: boolean;
  difficulty?: GameDifficulty;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
