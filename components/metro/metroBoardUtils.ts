import { DURATION_LABELS, TIME_UNIT_TO_MS } from '../../constants/timeUnits';
import type { DurationUnit, ProcessStep, StepStats } from '../../types';

export interface FlowGroup {
  id: string;
  name: string;
  color: string;
  stepIds: Set<string>;
  steps: ProcessStep[];
}

export interface StationLayout {
  x: number;
  y: number;
  level: number;
  row: number;
  step: ProcessStep;
}

export const CARD_WIDTH = 190;
export const CARD_HEIGHT = 120;
const COLUMN_GAP = 260;
const ROW_GAP = 180;
const BOARD_PADDING_X = 46;
const BOARD_PADDING_Y = 44;

export const formatMetricTimeInUnit = (milliseconds: number, unit: DurationUnit) => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return `0 ${DURATION_LABELS[unit]}`;
  }

  const divisor = TIME_UNIT_TO_MS[unit] || 1000;
  const value = milliseconds / divisor;
  const precision = unit === 'ms' ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${DURATION_LABELS[unit]}`;
};

export const getFlowGroups = (steps: ProcessStep[]): FlowGroup[] => {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const adjacency = new Map<string, Set<string>>();

  steps.forEach((step) => {
    if (!adjacency.has(step.id)) {
      adjacency.set(step.id, new Set());
    }

    step.connections.forEach((connection) => {
      if (!adjacency.has(connection.targetId)) {
        adjacency.set(connection.targetId, new Set());
      }

      adjacency.get(step.id)?.add(connection.targetId);
      adjacency.get(connection.targetId)?.add(step.id);
    });
  });

  const visited = new Set<string>();
  const groups: FlowGroup[] = [];

  steps.forEach((seedStep, index) => {
    if (visited.has(seedStep.id)) {
      return;
    }

    const stepIds = new Set<string>();
    const stack = [seedStep.id];

    while (stack.length > 0) {
      const stepId = stack.pop();
      if (!stepId || visited.has(stepId)) {
        continue;
      }

      const step = stepById.get(stepId);
      if (!step) {
        continue;
      }

      visited.add(stepId);
      stepIds.add(stepId);
      adjacency.get(stepId)?.forEach((neighborId) => stack.push(neighborId));
    }

    const flowSteps = steps.filter((step) => stepIds.has(step.id));
    const startSteps = flowSteps.filter((step) => step.type === 'start');
    const primaryStart = startSteps[0] || flowSteps[0];

    groups.push({
      id: primaryStart?.id || seedStep.id,
      name: primaryStart?.name || `Flow ${String.fromCharCode(65 + index)}`,
      color: primaryStart?.color || seedStep.color || '#3b82f6',
      stepIds,
      steps: flowSteps,
    });
  });

  return groups;
};

const getTypePriority = (type: ProcessStep['type']) => {
  if (type === 'start') return 0;
  if (type === 'process') return 1;
  return 2;
};

export const buildFlowLayout = (flowSteps: ProcessStep[]) => {
  const flowStepIds = new Set(flowSteps.map((step) => step.id));
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  flowSteps.forEach((step) => {
    outgoing.set(step.id, step.connections.filter((connection) => flowStepIds.has(connection.targetId)).map((connection) => connection.targetId));
    incomingCount.set(step.id, 0);
  });

  flowSteps.forEach((step) => {
    outgoing.get(step.id)?.forEach((targetId) => {
      incomingCount.set(targetId, (incomingCount.get(targetId) || 0) + 1);
    });
  });

  const roots = flowSteps.filter((step) => step.type === 'start');
  const fallbackRoots = flowSteps.filter((step) => (incomingCount.get(step.id) || 0) === 0);
  const seedNodes = (roots.length > 0 ? roots : fallbackRoots.length > 0 ? fallbackRoots : [flowSteps[0]])
    .filter((step): step is ProcessStep => Boolean(step));

  const levels = new Map<string, number>();
  const queue = seedNodes.map((step) => step.id);
  seedNodes.forEach((step) => levels.set(step.id, 0));

  while (queue.length > 0) {
    const stepId = queue.shift();
    if (!stepId) {
      continue;
    }

    const level = levels.get(stepId) || 0;
    (outgoing.get(stepId) || []).forEach((targetId) => {
      if (!levels.has(targetId)) {
        levels.set(targetId, level + 1);
        queue.push(targetId);
      }
    });
  }

  flowSteps.forEach((step) => {
    if (!levels.has(step.id)) {
      levels.set(step.id, 0);
    }
  });

  const columns = new Map<number, ProcessStep[]>();
  flowSteps.forEach((step) => {
    const level = levels.get(step.id) || 0;
    const bucket = columns.get(level) || [];
    bucket.push(step);
    columns.set(level, bucket);
  });

  Array.from(columns.values()).forEach((stepsInColumn) => {
    stepsInColumn.sort((a, b) => {
      const typeDiff = getTypePriority(a.type) - getTypePriority(b.type);
      if (typeDiff !== 0) {
        return typeDiff;
      }
      return a.name.localeCompare(b.name);
    });
  });

  const layoutById = new Map<string, StationLayout>();
  const sortedLevels = Array.from(columns.keys()).sort((a, b) => a - b);

  sortedLevels.forEach((level) => {
    const stepsInColumn = columns.get(level) || [];
    stepsInColumn.forEach((step, row) => {
      layoutById.set(step.id, {
        step,
        level,
        row,
        x: BOARD_PADDING_X + level * COLUMN_GAP,
        y: BOARD_PADDING_Y + row * ROW_GAP,
      });
    });
  });

  const maxLevel = sortedLevels.length > 0 ? Math.max(...sortedLevels) : 0;
  const maxRows = Math.max(1, ...Array.from(columns.values()).map((stepsInColumn) => stepsInColumn.length));

  return {
    layoutById,
    width: BOARD_PADDING_X * 2 + CARD_WIDTH + maxLevel * COLUMN_GAP + 72,
    height: BOARD_PADDING_Y * 2 + CARD_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP,
  };
};

export const getMetroPath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) {
    return '';
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    return `${path} L ${point.x} ${point.y}`;
  }, '');
};

export const getMetroRoutePoints = (from: StationLayout, to: StationLayout) => {
  const fromCenterY = from.y + CARD_HEIGHT / 2;
  const toCenterY = to.y + CARD_HEIGHT / 2;
  const fromCenterX = from.x + CARD_WIDTH / 2;
  const toCenterX = to.x + CARD_WIDTH / 2;
  const fromRight = from.x + CARD_WIDTH;
  const toLeft = to.x;
  const toRight = to.x + CARD_WIDTH;
  const forward = toLeft >= fromRight;
  const laneX = forward
    ? fromRight + Math.max(32, (toLeft - fromRight) / 2)
    : Math.max(from.x, to.x) + CARD_WIDTH + 34;

  if (from.row === to.row) {
    if (from.row > 0) {
      const branchLaneY = from.y - Math.max(14, (ROW_GAP - CARD_HEIGHT) / 2);

      return [
        { x: fromCenterX, y: from.y },
        { x: fromCenterX, y: branchLaneY },
        { x: toCenterX, y: branchLaneY },
        { x: toCenterX, y: to.y },
      ];
    }

    return forward
      ? [
          { x: fromRight, y: fromCenterY },
          { x: laneX, y: fromCenterY },
          { x: toLeft, y: toCenterY },
        ]
      : [
          { x: fromRight, y: fromCenterY },
          { x: laneX, y: fromCenterY },
          { x: laneX, y: toCenterY },
          { x: toRight, y: toCenterY },
        ];
  }

  const branchLaneY = toCenterY > fromCenterY
    ? (from.y + CARD_HEIGHT + to.y) / 2
    : (to.y + CARD_HEIGHT + from.y) / 2;

  return toCenterY > fromCenterY
    ? [
        { x: fromCenterX, y: from.y + CARD_HEIGHT },
        { x: fromCenterX, y: branchLaneY },
        { x: toCenterX, y: branchLaneY },
        { x: toCenterX, y: to.y },
      ]
    : [
        { x: fromCenterX, y: from.y },
        { x: fromCenterX, y: branchLaneY },
        { x: toCenterX, y: branchLaneY },
        { x: toCenterX, y: to.y + CARD_HEIGHT },
      ];
};

export const getPointOnPolyline = (progress: number, points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  if (points.length === 1) {
    return points[0];
  }

  const segments = points.slice(1).map((point, index) => {
    const previous = points[index];
    return {
      from: previous,
      to: point,
      length: Math.hypot(point.x - previous.x, point.y - previous.y),
    };
  });

  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (totalLength <= 0) {
    return points[points.length - 1];
  }

  let remaining = Math.max(0, Math.min(1, progress)) * totalLength;

  for (const segment of segments) {
    if (remaining <= segment.length) {
      const localProgress = segment.length === 0 ? 1 : remaining / segment.length;
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * localProgress,
        y: segment.from.y + (segment.to.y - segment.from.y) * localProgress,
      };
    }

    remaining -= segment.length;
  }

  return points[points.length - 1];
};

export const getArrivalSummary = (step: ProcessStep) => {
  if (step.type !== 'start') {
    return '';
  }

  const unit = step.arrivalUnit || 's';
  if (step.arrivalInputMode === 'interval') {
    if (step.randomnessMode === 'range') {
      return `${step.minArrivalRate ?? 0}-${step.maxArrivalRate ?? 0} ${unit}`;
    }

    return `${step.arrivalRate ?? 0} ${unit}`;
  }

  if (step.randomnessMode === 'range') {
    return `${step.minArrivalRate ?? 0}-${step.maxArrivalRate ?? 0}/${unit}`;
  }

  return `${step.arrivalRate ?? 0}/${unit}`;
};

export const isBottleneckStep = (step: ProcessStep, stats?: StepStats) => {
  if (!stats || step.type === 'start') {
    return false;
  }

  const queueRisk = stats.queueLength >= (step.type === 'process' ? Math.max(3, (step.capacity || 1) * 2) : 4);
  const utilizationRisk = step.type === 'process' && step.simulationMode !== 'delay' && stats.utilization >= 0.88;
  const failureRisk = stats.totalFailed > 0;

  return queueRisk || utilizationRisk || failureRisk;
};
