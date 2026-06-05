import type { NodeType, ProcessStep } from '../types';

export const cloneStep = (step: ProcessStep): ProcessStep => ({
  ...step,
  connections: step.connections.map((connection) => ({ ...connection })),
  sourceProcessingTimes: { ...(step.sourceProcessingTimes || {}) },
});

export const buildClipboardSteps = (steps: ProcessStep[]) => {
  const includedIds = new Set(steps.map((step) => step.id));

  return steps.map((step) => ({
    ...cloneStep(step),
    connections: step.connections.filter((connection) => includedIds.has(connection.targetId)).map((connection) => ({ ...connection })),
    sourceProcessingTimes: Object.fromEntries(
      Object.entries(step.sourceProcessingTimes || {}).filter(([sourceId]) => includedIds.has(sourceId))
    ),
  }));
};

export const normalizeConnections = (connections: ProcessStep['connections']) => {
  const validConnections = connections.filter((connection) => connection.targetId);

  if (validConnections.length === 0) {
    return [];
  }

  const probabilityTotal = validConnections.reduce((sum, connection) => sum + connection.probability, 0);

  if (probabilityTotal > 0) {
    return validConnections.map((connection) => ({
      ...connection,
      probability: connection.probability / probabilityTotal,
    }));
  }

  return validConnections.map((connection) => ({
    ...connection,
    probability: 1 / validConnections.length,
  }));
};

const getStepWidth = (type: NodeType) => type === 'process' ? 320 : 280;

export const getStepBounds = (steps: ProcessStep[]) => {
  if (steps.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return steps.reduce((bounds, step) => {
    const x = typeof step.x === 'number' ? step.x : 0;
    const y = typeof step.y === 'number' ? step.y : 0;
    return {
      minX: Math.min(bounds.minX, x),
      minY: Math.min(bounds.minY, y),
      maxX: Math.max(bounds.maxX, x + getStepWidth(step.type)),
      maxY: Math.max(bounds.maxY, y + 300),
    };
  }, {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
};

export const buildUniqueCopyName = (name: string, usedNames: Set<string>) => {
  const baseName = `${name} Copy`;
  let candidate = baseName;
  let index = 2;

  while (usedNames.has(candidate)) {
    candidate = `${baseName} ${index}`;
    index += 1;
  }

  usedNames.add(candidate);
  return candidate;
};
