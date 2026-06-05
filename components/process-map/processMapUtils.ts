import type { ProcessStep } from '../../types';

export interface Position {
  x: number;
  y: number;
}

export type InteractionMode = 'mixed' | 'pan' | 'select' | 'move';

export interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const NODE_WIDTH = 320;
export const NODE_HEIGHT = 300;
export const START_END_WIDTH = 280;
export const START_HEIGHT = 118;
export const END_HEIGHT = 186;
export const NODE_SPAWN_OFFSETS: Position[] = [
  { x: 0, y: 0 },
  { x: 48, y: 36 },
  { x: -48, y: 36 },
  { x: 72, y: -28 },
  { x: -72, y: -28 },
  { x: 0, y: 72 },
];
export const MAX_VISIBLE_TRANSMISSION_DOTS = 360;

const COLLAPSED_PROCESS_HEIGHT = 104;
const COLLAPSED_START_HEIGHT = 104;
const COLLAPSED_END_HEIGHT = 104;

export const getPointOnBezier = (t: number, p0: Position, p1: Position, p2: Position, p3: Position): Position => {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
  const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;
  return { x, y };
};

export const getStepDimensions = (type?: ProcessStep['type'], collapsed = false) => ({
  width: type === 'process' ? NODE_WIDTH : type === 'start' ? 260 : START_END_WIDTH,
  height: collapsed
    ? type === 'process'
      ? COLLAPSED_PROCESS_HEIGHT
      : type === 'start'
        ? COLLAPSED_START_HEIGHT
        : COLLAPSED_END_HEIGHT
    : type === 'process'
      ? NODE_HEIGHT
      : type === 'start'
        ? START_HEIGHT
        : END_HEIGHT,
});

export const haveSameIds = (a: string[], b: string[]) => {
  if (a.length !== b.length) {
    return false;
  }

  const ids = new Set(a);
  return b.every((id) => ids.has(id));
};
