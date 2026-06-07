
import { useState, useEffect, useRef, useCallback } from 'react';
import { FlowStats, ProcessStep, RouteStats, ScheduledArrivalEvent, ScheduledArrivalWindow, WorkItem, SimulationConfig, StepStats, SimulationStats } from '../types';
import { addWorkingDuration, getDemandMultiplier, getNextWorkingSimulationTime, getWorkingDurationBetween, isWorkingTime, normalizeBusinessCalendar } from '../services/simulationCalendar';

const TRANSMISSION_DURATION = 900; // visual ms to travel between nodes
const TIME_UNIT_TO_MS = {
  ms: 1,
  s: 1000,
  min: 60 * 1000,
  h: 60 * 60 * 1000,
  workingDay: 8 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
} as const;

const MIN_ARRIVAL_RATE = 0.000000001;
const MIN_PROCESSING_DURATION_MS = 1;
const MAX_SPAWNS_PER_START_PER_TICK = 1000;
const MAX_BUSINESS_EVENTS_PER_TICK = 5000;
const MAX_SAFE_DURATION_MS = Number.MAX_SAFE_INTEGER / 2; // Safety margin for calculations
const UI_FRAME_INTERVAL_MS = 33; // Keep simulation logic smooth while avoiding 60 React tree renders/sec
const MAX_RENDER_ITEMS_FOR_UI = 900;
const MAX_TRANSMITTING_ITEMS_FOR_UI = 420;
const MAX_PROCESSING_ITEMS_FOR_UI = 320;
const MAX_QUEUED_ITEMS_FOR_UI = 120;
const MAX_TERMINAL_ITEMS_FOR_UI = 60;

const BUSINESS_TRANSMISSION_SIM_MS = 0;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_CALENDAR_START_ISO = '2026-01-05T00:00:00';
const ARRIVAL_TIME_EPSILON_MS = 0.000001;

type StepCounter = {
  processed: number;
  failed: number;
  cancelled: number;
  totalCompletionTime: number;
  totalProcessingTime: number;
  totalCalendarProcessingTime: number;
  totalWaitTime: number;
  totalWorkingWaitTime: number;
  totalStarted: number;
};

type ArrivalSlot = {
  time: number;
  quantity: number;
  itemIntervalMs: number;
};

type CycleTimeSamples = {
  cycleTimeSamples: number[];
  workingCycleTimeSamples: number[];
  operationalWorkingCycleTimeSamples: number[];
};

type RoutingContext = {
  itemProfileId?: string;
  priority?: number;
  processingTimeMultiplier?: number;
  itemId?: string;
  items?: WorkItem[];
  stepMap?: Map<string, ProcessStep>;
  trackStats?: boolean;
  currentSimulationMs?: number;
};

type FlowCounter = {
  flowId: string;
  created: number;
  finished: number;
  cancelled: number;
  failed: number;
  cycleTimeSamples: number[];
  workingCycleTimeSamples: number[];
  operationalWorkingCycleTimeSamples: number[];
  totalCycleTime: number;
  totalWorkingCycleTime: number;
  totalOperationalWorkingCycleTime: number;
  totalWorkTime: number;
  totalWaitTime: number;
  totalWorkingWaitTime: number;
  totalTransmissionTime: number;
  totalOffHoursDelay: number;
  totalNonWorkingDelay: number;
};

type RouteCounter = Omit<RouteStats, 'routeId'>;

type RouteEstimate = {
  queueWait: number;
  processingTime: number;
  calendarDelay: number;
  totalTime: number;
  targetWasWorking: boolean;
};

const EMPTY_ROUTE_ESTIMATE: RouteEstimate = {
  queueWait: 0,
  processingTime: 0,
  calendarDelay: 0,
  totalTime: 0,
  targetWasWorking: true,
};

const createStepCounter = (): StepCounter => ({
  processed: 0,
  failed: 0,
  cancelled: 0,
  totalCompletionTime: 0,
  totalProcessingTime: 0,
  totalCalendarProcessingTime: 0,
  totalWaitTime: 0,
  totalWorkingWaitTime: 0,
  totalStarted: 0,
});

const createCycleTimeSamples = (): CycleTimeSamples => ({
  cycleTimeSamples: [],
  workingCycleTimeSamples: [],
  operationalWorkingCycleTimeSamples: [],
});

const createFlowCounter = (flowId: string): FlowCounter => ({
  flowId,
  created: 0,
  finished: 0,
  cancelled: 0,
  failed: 0,
  ...createCycleTimeSamples(),
  totalCycleTime: 0,
  totalWorkingCycleTime: 0,
  totalOperationalWorkingCycleTime: 0,
  totalWorkTime: 0,
  totalWaitTime: 0,
  totalWorkingWaitTime: 0,
  totalTransmissionTime: 0,
  totalOffHoursDelay: 0,
  totalNonWorkingDelay: 0,
});

const getRouteId = (fromStepId: string, targetStepId: string) => `${fromStepId}->${targetStepId}`;

const createRouteCounter = (fromStepId: string, targetStepId: string): RouteCounter => ({
  fromStepId,
  targetStepId,
  selectedCount: 0,
  sourceDecisionCount: 0,
  sourceFallbackDecisionCount: 0,
  fallbackSelectedCount: 0,
  profileMatchedSelectionCount: 0,
  priorityMatchedSelectionCount: 0,
  lastBaseWeight: 0,
  lastEffectiveWeight: 0,
  lastEffectiveShare: 0,
  lastCongestion: 0,
  lastEstimatedQueueWait: 0,
  lastEstimatedProcessingTime: 0,
  lastEstimatedCalendarDelay: 0,
  lastEstimatedTotalTime: 0,
  lastTargetWasWorking: true,
  lastWasFallback: false,
  lastSelectionMode: 'probability',
});

const toRouteStats = (counter: RouteCounter): RouteStats => ({
  routeId: getRouteId(counter.fromStepId, counter.targetStepId),
  ...counter,
});

const getPercentileFromSorted = (sortedSamples: number[], percentile: number) => {
  const index = Math.min(sortedSamples.length - 1, Math.max(0, Math.ceil(percentile * sortedSamples.length) - 1));
  return sortedSamples[index];
};

const getPercentilePair = (samples: number[]) => {
  if (samples.length === 0) {
    return { median: 0, p90: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  return {
    median: getPercentileFromSorted(sorted, 0.5),
    p90: getPercentileFromSorted(sorted, 0.9),
  };
};

const buildStepFlowLookup = (steps: ProcessStep[]) => {
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

  const lookup = new Map<string, string>();
  const visited = new Set<string>();

  steps.forEach((seedStep, index) => {
    if (visited.has(seedStep.id)) {
      return;
    }

    const stack = [seedStep.id];
    const componentIds = new Set<string>();

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
      componentIds.add(stepId);
      adjacency.get(stepId)?.forEach((neighborId) => stack.push(neighborId));
    }

    const componentSteps = steps.filter((step) => componentIds.has(step.id));
    const primaryStart = componentSteps.find((step) => step.type === 'start') || componentSteps[0] || seedStep;
    const flowId = primaryStart?.id || seedStep.id || `flow-${index + 1}`;
    componentIds.forEach((stepId) => lookup.set(stepId, flowId));
  });

  return lookup;
};

const toFlowStats = (counter: FlowCounter): FlowStats => {
  const calendarPercentiles = getPercentilePair(counter.cycleTimeSamples);
  const workingPercentiles = getPercentilePair(counter.workingCycleTimeSamples);
  const operationalPercentiles = getPercentilePair(counter.operationalWorkingCycleTimeSamples);

  return {
    flowId: counter.flowId,
    totalItemsCreated: counter.created,
    totalItemsFinished: counter.finished,
    totalItemsCancelled: counter.cancelled,
    totalItemsFailed: counter.failed,
    avgCycleTime: counter.finished > 0 ? counter.totalCycleTime / counter.finished : 0,
    medianCycleTime: calendarPercentiles.median,
    p90CycleTime: calendarPercentiles.p90,
    avgWorkingCycleTime: counter.finished > 0 ? counter.totalWorkingCycleTime / counter.finished : 0,
    medianWorkingCycleTime: workingPercentiles.median,
    p90WorkingCycleTime: workingPercentiles.p90,
    avgOperationalWorkingCycleTime: counter.finished > 0 ? counter.totalOperationalWorkingCycleTime / counter.finished : 0,
    medianOperationalWorkingCycleTime: operationalPercentiles.median,
    p90OperationalWorkingCycleTime: operationalPercentiles.p90,
    avgWorkTime: counter.finished > 0 ? counter.totalWorkTime / counter.finished : 0,
    avgWaitTime: counter.finished > 0 ? counter.totalWaitTime / counter.finished : 0,
    avgWorkingWaitTime: counter.finished > 0 ? counter.totalWorkingWaitTime / counter.finished : 0,
    avgTransmissionTime: counter.finished > 0 ? counter.totalTransmissionTime / counter.finished : 0,
    avgOffHoursDelay: counter.finished > 0 ? counter.totalOffHoursDelay / counter.finished : 0,
    avgNonWorkingDelay: counter.finished > 0 ? counter.totalNonWorkingDelay / counter.finished : 0,
    flowEfficiency: counter.totalCycleTime > 0 ? counter.totalWorkTime / counter.totalCycleTime : 0,
  };
};

const applyGlobalPercentiles = (stats: SimulationStats, samples: CycleTimeSamples): SimulationStats => {
  const calendarPercentiles = getPercentilePair(samples.cycleTimeSamples);
  const workingPercentiles = getPercentilePair(samples.workingCycleTimeSamples);
  const operationalPercentiles = getPercentilePair(samples.operationalWorkingCycleTimeSamples);

  return {
    ...stats,
    medianCycleTime: calendarPercentiles.median,
    p90CycleTime: calendarPercentiles.p90,
    medianWorkingCycleTime: workingPercentiles.median,
    p90WorkingCycleTime: workingPercentiles.p90,
    medianOperationalWorkingCycleTime: operationalPercentiles.median,
    p90OperationalWorkingCycleTime: operationalPercentiles.p90,
  };
};

const createInitialSimulationStats = (): SimulationStats => ({
  totalItemsCreated: 0,
  totalItemsFinished: 0,
  totalItemsCancelled: 0,
  totalItemsFailed: 0,
  avgCycleTime: 0,
  medianCycleTime: 0,
  p90CycleTime: 0,
  avgWorkingCycleTime: 0,
  medianWorkingCycleTime: 0,
  p90WorkingCycleTime: 0,
  avgOperationalWorkingCycleTime: 0,
  medianOperationalWorkingCycleTime: 0,
  p90OperationalWorkingCycleTime: 0,
  avgWorkTime: 0,
  avgWaitTime: 0,
  avgNonWorkingDelay: 0,
  flowEfficiency: 0,
  oldestWipAge: 0,
  oldestQueueAge: 0,
  resourceIdleUnits: 0,
  resourceUtilization: 0,
  blockedTimeShare: 0,
  avgThroughput: 0,
  activeItems: 0,
});

const buildVisibleItemsForUi = (allItems: WorkItem[]): WorkItem[] => {
  if (allItems.length <= MAX_RENDER_ITEMS_FOR_UI) {
    return [...allItems];
  }

  const transmitting: WorkItem[] = [];
  const processing: WorkItem[] = [];
  const queued: WorkItem[] = [];
  const terminal: WorkItem[] = [];

  for (const item of allItems) {
    if (transmitting.length < MAX_TRANSMITTING_ITEMS_FOR_UI && (item.status === 'transmitting' || typeof item.visualTransmissionProgress === 'number')) {
      transmitting.push(item);
      continue;
    }

    if (processing.length < MAX_PROCESSING_ITEMS_FOR_UI && item.status === 'processing') {
      processing.push(item);
      continue;
    }

    if (queued.length < MAX_QUEUED_ITEMS_FOR_UI && item.status === 'queued') {
      queued.push(item);
      continue;
    }

    if (terminal.length < MAX_TERMINAL_ITEMS_FOR_UI && (item.status === 'finished' || item.status === 'cancelled' || item.status === 'error')) {
      terminal.push(item);
    }
  }

  return [...transmitting, ...processing, ...queued, ...terminal].slice(0, MAX_RENDER_ITEMS_FOR_UI);
};

// Generate a normally distributed random number using Box-Muller transform
// Returns a value with mean=0 and standard deviation=1
const generateNormalRandom = (): number => {
  const u1 = Math.max(Number.EPSILON, Math.random());
  const u2 = Math.random();
  // Box-Muller transform
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const getPositiveInteger = (value: number | undefined, fallback: number, min = 1, max = 1000): number => {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, parsed));
};

const getRecordMultiplier = (record: Record<number, number> | undefined, key: number, fallback: number): number => {
  const direct = record?.[key];
  if (typeof direct === 'number' && Number.isFinite(direct) && direct > 0) {
    return direct;
  }

  const stringKey = record?.[String(key) as unknown as number];
  if (typeof stringKey === 'number' && Number.isFinite(stringKey) && stringKey > 0) {
    return stringKey;
  }

  return fallback;
};

const getStepResourceCapacity = (step: ProcessStep): number => Math.max(1, getPositiveInteger(step.capacity, 1, 1, 1000));

const getCollaborativeTeams = (step: ProcessStep) => (
  step.teamAllocationMode === 'explicit' ? step.collaborativeTeams || [] : []
).filter((team) => team && typeof team.id === 'string' && getPositiveInteger(team.resources, 0, 0, 1000) > 0);

const getCollaborativeCapacity = (step: ProcessStep): number => {
  const teams = getCollaborativeTeams(step);
  if (teams.length > 0) {
    return teams.reduce((sum, team) => sum + getPositiveInteger(team.resources, 1, 1, 1000), 0);
  }

  return getStepResourceCapacity(step);
};

const getTeamUsageKey = (stepId: string, teamId: string) => `${stepId}::${teamId}`;

const getResourceUnitsForItem = (step: ProcessStep, freeUnits: number): number => {
  if ((step.resourceExecutionMode || 'single') !== 'collaborative') {
    return 1;
  }

  const minResources = getPositiveInteger(step.minResourcesPerItem, 1, 1, 1000);
  const maxResources = getPositiveInteger(step.maxResourcesPerItem, minResources, minResources, 1000);
  const targetResources = getPositiveInteger(step.targetResourcesPerItem, minResources, minResources, maxResources);
  if (freeUnits < minResources) {
    return 0;
  }

  return Math.max(minResources, Math.min(targetResources, maxResources, freeUnits));
};

const getStepProcessingLimit = (step: ProcessStep): number => {
  const capacity = getStepResourceCapacity(step);
  if ((step.resourceExecutionMode || 'single') === 'collaborative') {
    return getCollaborativeCapacity(step);
  }

  if ((step.resourceExecutionMode || 'single') === 'multitask') {
    return capacity * getPositiveInteger(step.maxConcurrentItemsPerResource, 1, 1, 1000);
  }

  return capacity;
};

const getResourceLoadForNextItem = (step: ProcessStep, nextUsage: number): number => {
  if ((step.resourceExecutionMode || 'single') !== 'multitask') {
    return 1;
  }

  return Math.max(1, Math.ceil(nextUsage / getStepResourceCapacity(step)));
};

const getProcessingSpeedMultiplier = (step: ProcessStep, item: WorkItem): number => {
  const executionMode = item.executionMode || step.resourceExecutionMode || 'single';

  if (executionMode === 'collaborative') {
    const assignedResources = getPositiveInteger(item.assignedResourceCount, 1, 1, 1000);
    return getRecordMultiplier(step.collaborativeEfficiency, assignedResources, assignedResources === 1 ? 1 : 1 + (assignedResources - 1) * 0.65);
  }

  if (executionMode === 'multitask') {
    const load = getPositiveInteger(item.resourceLoadFactor, 1, 1, 1000);
    return getRecordMultiplier(step.multitaskEfficiency, load, Math.max(0.25, 1 - (load - 1) * 0.2));
  }

  return 1;
};

const getItemDispatchPriority = (item: WorkItem): number => {
  const priority = item.priority;
  return typeof priority === 'number' && Number.isFinite(priority) ? priority : 1;
};

type ResolvedBusinessCalendar = ReturnType<typeof normalizeBusinessCalendar>;

const resolveGlobalBusinessCalendar = (config: SimulationConfig): ResolvedBusinessCalendar => (
  normalizeBusinessCalendar(config.businessCalendar)
);

const resolveStepBusinessCalendar = (step: ProcessStep, globalCalendar: ResolvedBusinessCalendar): ResolvedBusinessCalendar => (
  step.calendarMode === 'custom' ? normalizeBusinessCalendar(step.businessCalendar) : globalCalendar
);

const isArrivalDueBy = (arrivalTimeMs: number, currentSimulationMs: number) => (
  Number.isFinite(arrivalTimeMs) && arrivalTimeMs <= currentSimulationMs + ARRIVAL_TIME_EPSILON_MS
);

const isArrivalInFrame = (arrivalTimeMs: number, frameStartMs: number, frameEndMs: number) => {
  if (!Number.isFinite(arrivalTimeMs) || arrivalTimeMs < -ARRIVAL_TIME_EPSILON_MS) {
    return false;
  }

  const safeFrameStartMs = Math.max(0, frameStartMs);
  const safeFrameEndMs = Math.max(safeFrameStartMs, frameEndMs);

  if (safeFrameStartMs <= ARRIVAL_TIME_EPSILON_MS && Math.abs(arrivalTimeMs) <= ARRIVAL_TIME_EPSILON_MS) {
    return arrivalTimeMs <= safeFrameEndMs + ARRIVAL_TIME_EPSILON_MS;
  }

  return arrivalTimeMs > safeFrameStartMs + ARRIVAL_TIME_EPSILON_MS
    && arrivalTimeMs <= safeFrameEndMs + ARRIVAL_TIME_EPSILON_MS;
};

const getItemProfileForSpawn = (step: ProcessStep) => {
  const profiles = step.itemProfiles && step.itemProfiles.length > 0 ? step.itemProfiles : undefined;
  if (!profiles) {
    return undefined;
  }

  const totalProbability = profiles.reduce((sum, profile) => sum + Math.max(0, profile.probability || 0), 0);
  if (totalProbability <= 0) {
    return profiles[0];
  }

  const roll = Math.random() * totalProbability;
  let cumulative = 0;
  for (const profile of profiles) {
    cumulative += Math.max(0, profile.probability || 0);
    if (roll <= cumulative) {
      return profile;
    }
  }

  return profiles[profiles.length - 1];
};

const getSimulationSignature = (config: SimulationConfig) => JSON.stringify({
  simulationMode: config.simulationMode,
  calendarStartIso: config.calendarStartIso,
  businessCalendar: config.businessCalendar,
  demandModifiers: config.demandModifiers,
  autoPause: config.autoPause,
  steps: config.steps.map((step) => ({
  id: step.id,
  type: step.type,
  randomnessMode: step.randomnessMode,
  simulationMode: step.simulationMode,
  calendarMode: step.calendarMode,
  businessCalendar: step.businessCalendar,
  resourceExecutionMode: step.resourceExecutionMode,
  minResourcesPerItem: step.minResourcesPerItem,
  targetResourcesPerItem: step.targetResourcesPerItem,
  maxResourcesPerItem: step.maxResourcesPerItem,
  teamAllocationMode: step.teamAllocationMode,
  collaborativeTeams: step.collaborativeTeams,
  collaborativeEfficiency: step.collaborativeEfficiency,
  maxConcurrentItemsPerResource: step.maxConcurrentItemsPerResource,
  multitaskEfficiency: step.multitaskEfficiency,
  capacity: step.capacity,
  processingTime: step.processingTime,
  processingTimeUnit: step.processingTimeUnit,
  variance: step.variance,
  minProcessingTime: step.minProcessingTime,
  maxProcessingTime: step.maxProcessingTime,
  rangeTimeUnit: step.rangeTimeUnit,
  arrivalModel: step.arrivalModel,
  arrivalInputMode: step.arrivalInputMode,
  arrivalUnit: step.arrivalUnit,
  arrivalRate: step.arrivalRate,
  minArrivalRate: step.minArrivalRate,
  maxArrivalRate: step.maxArrivalRate,
  arrivalBatchSize: step.arrivalBatchSize,
  arrivalBatchIntervalMs: step.arrivalBatchIntervalMs,
  demandModifiers: step.demandModifiers,
  arrivalSchedule: step.arrivalSchedule,
  arrivalEvents: step.arrivalEvents,
  itemProfiles: step.itemProfiles,
  failureProbability: step.failureProbability,
  cancellationProbability: step.cancellationProbability,
  routingStrategy: step.routingStrategy,
  routingLoadSensitivity: step.routingLoadSensitivity,
  routingTimeSensitivity: step.routingTimeSensitivity,
  routingCalendarAware: step.routingCalendarAware,
  connections: step.connections,
  sourceProcessingTimes: step.sourceProcessingTimes,
  sourceProcessingTimeUnit: step.sourceProcessingTimeUnit,
}))});

export const useProcessSimulation = (config: SimulationConfig, onAutoPause?: (reason: string) => void) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [stepStats, setStepStats] = useState<StepStats[]>([]);
  const [flowStats, setFlowStats] = useState<FlowStats[]>([]);
  const [routeStats, setRouteStats] = useState<RouteStats[]>([]);
  const [simulationTimeMs, setSimulationTimeMs] = useState(0);
  const [globalStats, setGlobalStats] = useState<SimulationStats>(createInitialSimulationStats);
  const [autoPauseReason, setAutoPauseReason] = useState<string | null>(null);

  const lastTickRef = useRef<number>(Date.now());
  const simulationTimeRef = useRef(0);
  const itemsRef = useRef<WorkItem[]>([]);
  const statsRef = useRef<SimulationStats>({ ...globalStats });
  const stepsRef = useRef<ProcessStep[]>(config.steps);
  const simulationSignatureRef = useRef(getSimulationSignature(config));
  const lastUiUpdateRef = useRef(0);
  
  // Track the absolute simulated timestamp when the next item should spawn for each start node
  const nextSpawnTimeRef = useRef<Record<string, number>>({});
  const delayedArrivalSlotsRef = useRef<Record<string, ArrivalSlot[]>>({});

  // Persistent Counters for Steps (Map<StepId, Counts>)
  // We need this because 'stepStats' state is regenerated every frame
  const stepCountersRef = useRef<Record<string, StepCounter>>({});
  const flowCountersRef = useRef<Record<string, FlowCounter>>({});
  const routeCountersRef = useRef<Record<string, RouteCounter>>({});
  const globalCycleTimeSamplesRef = useRef<CycleTimeSamples>(createCycleTimeSamples());

  const resetSimulation = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
    simulationTimeRef.current = 0;
    lastTickRef.current = Date.now();
    setSimulationTimeMs(0);
    const initialStats = createInitialSimulationStats();
    statsRef.current = initialStats;
    setGlobalStats(initialStats);
    setAutoPauseReason(null);
    setStepStats([]);
    setFlowStats([]);
    setRouteStats([]);
    lastUiUpdateRef.current = 0;
    nextSpawnTimeRef.current = {};
    delayedArrivalSlotsRef.current = {};
    stepCountersRef.current = {}; 
    flowCountersRef.current = {};
    routeCountersRef.current = {};
    globalCycleTimeSamplesRef.current = createCycleTimeSamples();
    config.steps.forEach(s => {
      stepCountersRef.current[s.id] = createStepCounter();
    });
  }, [config.steps]);

  const getAutoPauseReason = (activeItems: number): string | null => {
    const autoPause = config.autoPause;
    if (!autoPause?.enabled) {
      return null;
    }

    if (autoPause.stopDateIso) {
      const stopDateMs = Date.parse(autoPause.stopDateIso);
      const calendarStartMs = config.calendarStartIso ? Date.parse(config.calendarStartIso) : Date.parse(DEFAULT_CALENDAR_START_ISO);
      const safeCalendarStartMs = Number.isFinite(calendarStartMs) ? calendarStartMs : Date.parse(DEFAULT_CALENDAR_START_ISO);
      const stopTargetSimulationMs = stopDateMs - safeCalendarStartMs;

      if (!Number.isFinite(stopTargetSimulationMs)) {
        return 'Stop date is invalid';
      }

      if (stopTargetSimulationMs <= 0) {
        return 'Stop date must be after simulation start';
      }

      if (simulationTimeRef.current >= stopTargetSimulationMs) {
        return `Stop date reached ${autoPause.stopDateIso.replace('T', ' ').slice(0, 16)}`;
      }
    }

    const checks: Array<[number | undefined, number, string]> = [
      [autoPause.simulationTimeMs, simulationTimeRef.current, 'Simulation time'],
      [autoPause.totalItemsCreated, statsRef.current.totalItemsCreated, 'Created items'],
      [autoPause.totalItemsFinished, statsRef.current.totalItemsFinished, 'Finished items'],
      [autoPause.totalItemsFailed, statsRef.current.totalItemsFailed, 'Failed items'],
      [autoPause.totalItemsCancelled, statsRef.current.totalItemsCancelled, 'Cancelled items'],
      [autoPause.activeItems, activeItems, 'Active work'],
    ];

    for (const [target, current, label] of checks) {
      if (typeof target === 'number' && Number.isFinite(target) && target > 0 && current >= target) {
        return `${label} reached ${target}`;
      }
    }

    return null;
  };

  useEffect(() => {
    const nextSignature = getSimulationSignature(config);
    const simulationLogicChanged = nextSignature !== simulationSignatureRef.current;

    stepsRef.current = config.steps;
    simulationSignatureRef.current = nextSignature;

    if (simulationLogicChanged) {
      resetSimulation();
      return;
    }

    // Initialize spawn timers for new start nodes if not present
    config.steps.forEach(s => {
        if (s.type === 'start' && nextSpawnTimeRef.current[s.id] === undefined) {
            nextSpawnTimeRef.current[s.id] = 0; // Ready immediately
        }
        if (s.type === 'start' && !delayedArrivalSlotsRef.current[s.id]) {
          delayedArrivalSlotsRef.current[s.id] = [];
        }
        // Initialize counters
        if (!stepCountersRef.current[s.id]) {
          stepCountersRef.current[s.id] = createStepCounter();
        }
    });
  }, [config, config.steps, resetSimulation]);

  const hasRoutingFilter = (connection: ProcessStep['connections'][number]) => (
    (connection.itemProfileIds && connection.itemProfileIds.length > 0)
    || typeof connection.minPriority === 'number'
    || typeof connection.maxPriority === 'number'
  );

  const isConnectionEligible = (connection: ProcessStep['connections'][number], context?: RoutingContext) => {
    if (connection.itemProfileIds && connection.itemProfileIds.length > 0) {
      if (!context?.itemProfileId || !connection.itemProfileIds.includes(context.itemProfileId)) {
        return false;
      }
    }

    const priority = typeof context?.priority === 'number' && Number.isFinite(context.priority) ? context.priority : 1;
    const hasMinPriority = typeof connection.minPriority === 'number' && Number.isFinite(connection.minPriority);
    const hasMaxPriority = typeof connection.maxPriority === 'number' && Number.isFinite(connection.maxPriority);
    const minPriority = hasMinPriority && hasMaxPriority ? Math.min(connection.minPriority ?? 0, connection.maxPriority ?? 0) : connection.minPriority;
    const maxPriority = hasMinPriority && hasMaxPriority ? Math.max(connection.minPriority ?? 0, connection.maxPriority ?? 0) : connection.maxPriority;

    if (typeof minPriority === 'number' && Number.isFinite(minPriority) && priority < minPriority) {
      return false;
    }
    if (typeof maxPriority === 'number' && Number.isFinite(maxPriority) && priority > maxPriority) {
      return false;
    }

    return true;
  };

  const doesConnectionPriorityMatch = (connection: ProcessStep['connections'][number], context?: RoutingContext) => {
    const priority = typeof context?.priority === 'number' && Number.isFinite(context.priority) ? context.priority : undefined;
    if (priority === undefined) {
      return false;
    }

    const hasMinPriority = typeof connection.minPriority === 'number' && Number.isFinite(connection.minPriority);
    const hasMaxPriority = typeof connection.maxPriority === 'number' && Number.isFinite(connection.maxPriority);
    if (!hasMinPriority && !hasMaxPriority) {
      return false;
    }

    const minPriority = hasMinPriority && hasMaxPriority ? Math.min(connection.minPriority ?? 0, connection.maxPriority ?? 0) : connection.minPriority;
    const maxPriority = hasMinPriority && hasMaxPriority ? Math.max(connection.minPriority ?? 0, connection.maxPriority ?? 0) : connection.maxPriority;

    if (typeof minPriority === 'number' && Number.isFinite(minPriority) && priority < minPriority) {
      return false;
    }
    if (typeof maxPriority === 'number' && Number.isFinite(maxPriority) && priority > maxPriority) {
      return false;
    }

    return true;
  };

  const chooseWeightedConnection = (connections: ProcessStep['connections'], weights: number[]) => {
    if (connections.length === 0) {
      return undefined;
    }

    const safeWeights = weights.map((weight) => Number.isFinite(weight) && weight > 0 ? weight : 0);
    const totalWeight = safeWeights.reduce((sum, weight) => sum + weight, 0);
    const effectiveWeights = totalWeight > 0 ? safeWeights : connections.map(() => 1);
    const effectiveTotal = totalWeight > 0 ? totalWeight : connections.length;
    const roll = Math.random() * effectiveTotal;
    let cumulative = 0;

    for (let index = 0; index < connections.length; index++) {
      cumulative += effectiveWeights[index];
      if (roll <= cumulative) {
        return connections[index];
      }
    }

    return connections[connections.length - 1];
  };

  const getTargetCongestion = (targetStep: ProcessStep | undefined, context?: RoutingContext) => {
    if (!targetStep || targetStep.type !== 'process' || targetStep.simulationMode === 'delay') {
      return 0;
    }

    const items = context?.items || itemsRef.current;
    const capacity = Math.max(1, getStepProcessingLimit(targetStep));
    let queuedCount = 0;
    let processingCount = 0;
    let inboundCount = 0;

    for (const item of items) {
      if (item.id === context?.itemId) {
        continue;
      }

      if (item.currentStepId === targetStep.id && item.status === 'queued') {
        queuedCount++;
      } else if (item.currentStepId === targetStep.id && item.status === 'processing') {
        processingCount++;
      } else if (item.status === 'transmitting' && item.targetStepId === targetStep.id) {
        inboundCount++;
      }
    }

    const queuePressure = queuedCount / capacity;
    const activePressure = processingCount / capacity;
    const inboundPressure = inboundCount / capacity;
    return activePressure + queuePressure + inboundPressure * 0.5;
  };

  const getEstimatedProcessingSpeedMultiplier = (targetStep: ProcessStep, context?: RoutingContext): number => {
    const executionMode = targetStep.resourceExecutionMode || 'single';

    if (targetStep.simulationMode === 'delay') {
      return 1;
    }

    if (executionMode === 'collaborative') {
      const minResources = getPositiveInteger(targetStep.minResourcesPerItem, 1, 1, 1000);
      const maxResources = getPositiveInteger(targetStep.maxResourcesPerItem, minResources, minResources, 1000);
      const targetResources = getPositiveInteger(targetStep.targetResourcesPerItem, Math.min(2, maxResources), minResources, maxResources);
      return getRecordMultiplier(
        targetStep.collaborativeEfficiency,
        targetResources,
        targetResources === 1 ? 1 : 1 + (targetResources - 1) * 0.65
      );
    }

    if (executionMode === 'multitask') {
      const items = context?.items || itemsRef.current;
      const activeCount = items.reduce((count, item) => (
        item.id !== context?.itemId && item.currentStepId === targetStep.id && item.status === 'processing'
          ? count + 1
          : count
      ), 0);
      const nextLoad = getResourceLoadForNextItem(targetStep, activeCount + 1);
      return getRecordMultiplier(targetStep.multitaskEfficiency, nextLoad, Math.max(0.25, 1 - (nextLoad - 1) * 0.2));
    }

    return 1;
  };

  const getExpectedProcessingDuration = (targetStep: ProcessStep | undefined, sourceStepId: string, context?: RoutingContext): number => {
    if (!targetStep || targetStep.type !== 'process') {
      return 0;
    }

    const safeDurationNumber = (value: number | undefined, fallback: number) => {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return value;
      }
      return fallback;
    };

    const fixedUnitMultiplier = TIME_UNIT_TO_MS[targetStep.processingTimeUnit || 'ms'];
    const sourceRuleUnitMultiplier = TIME_UNIT_TO_MS[targetStep.sourceProcessingTimeUnit || targetStep.processingTimeUnit || 'ms'];
    const rangeUnitMultiplier = TIME_UNIT_TO_MS[targetStep.rangeTimeUnit || targetStep.processingTimeUnit || 'ms'];
    const isDelayMode = targetStep.simulationMode === 'delay';
    const simulationMode = config.simulationMode || 'realistic';
    let baseDurationMs = 0;

    if (!isDelayMode && targetStep.randomnessMode === 'fixed' && sourceStepId && targetStep.sourceProcessingTimes && Object.prototype.hasOwnProperty.call(targetStep.sourceProcessingTimes, sourceStepId)) {
      baseDurationMs = safeDurationNumber(targetStep.sourceProcessingTimes[sourceStepId], 1000) * sourceRuleUnitMultiplier;
    } else if (targetStep.randomnessMode === 'range') {
      const minDuration = safeDurationNumber(targetStep.minProcessingTime, 500) * rangeUnitMultiplier;
      const maxDuration = safeDurationNumber(targetStep.maxProcessingTime, 2000) * rangeUnitMultiplier;
      baseDurationMs = simulationMode === 'worst-case'
        ? Math.max(minDuration, maxDuration)
        : (Math.min(minDuration, maxDuration) + Math.max(minDuration, maxDuration)) / 2;
    } else {
      baseDurationMs = safeDurationNumber(targetStep.processingTime, 1000) * fixedUnitMultiplier;
      const variance = safeDurationNumber(targetStep.variance, 0);
      if (!isDelayMode && variance > 0 && simulationMode === 'worst-case') {
        baseDurationMs *= (1 + variance);
      }
    }

    const profileMultiplier = typeof context?.processingTimeMultiplier === 'number' && Number.isFinite(context.processingTimeMultiplier)
      ? Math.max(0.01, context.processingTimeMultiplier)
      : 1;
    const speedMultiplier = getEstimatedProcessingSpeedMultiplier(targetStep, context);
    const adjustedDuration = (baseDurationMs * profileMultiplier) / Math.max(0.05, speedMultiplier);
    return Math.max(MIN_PROCESSING_DURATION_MS, Math.min(MAX_SAFE_DURATION_MS, Number.isFinite(adjustedDuration) ? adjustedDuration : 1000));
  };

  const getEstimatedRouteTime = (currentStep: ProcessStep, targetStep: ProcessStep | undefined, context?: RoutingContext): RouteEstimate => {
    if (!targetStep || targetStep.type !== 'process') {
      return EMPTY_ROUTE_ESTIMATE;
    }

    const currentSimulationMs = Math.max(0, context?.currentSimulationMs ?? simulationTimeRef.current);
    const globalCalendar = resolveGlobalBusinessCalendar(config);
    const targetCalendar = resolveStepBusinessCalendar(targetStep, globalCalendar);
    const processingTime = getExpectedProcessingDuration(targetStep, currentStep.id, context);
    let queueWait = 0;

    if (targetStep.simulationMode !== 'delay') {
      const items = context?.items || itemsRef.current;
      const capacity = Math.max(1, getStepProcessingLimit(targetStep));
      const estimatedUnitsPerItem = targetStep.resourceExecutionMode === 'collaborative'
        ? Math.max(1, getResourceUnitsForItem(targetStep, capacity) || getPositiveInteger(targetStep.minResourcesPerItem, 1, 1, 1000))
        : 1;
      const candidatePriority = typeof context?.priority === 'number' && Number.isFinite(context.priority) ? context.priority : 1;
      let activeUnits = 0;
      let activeRemainingWorkUnits = 0;
      let queuedUnits = 0;
      let inboundUnits = 0;

      for (const item of items) {
        if (item.id === context?.itemId) {
          continue;
        }

        if (item.currentStepId === targetStep.id && item.status === 'processing') {
          const usageUnits = targetStep.resourceExecutionMode === 'collaborative'
            ? getPositiveInteger(item.assignedResourceCount, estimatedUnitsPerItem, 1, 1000)
            : 1;
          const requiredDuration = item.requiredDuration && item.requiredDuration > 0 ? item.requiredDuration : processingTime;
          const startedAt = item.processingStartedAtSimulationMs ?? currentSimulationMs;
          const elapsedWorking = Math.max(0, Math.min(
            getWorkingDurationBetween(targetCalendar, config.calendarStartIso, startedAt, currentSimulationMs),
            requiredDuration
          ));
          const remainingWorking = Math.max(0, requiredDuration - elapsedWorking);
          activeUnits += usageUnits;
          activeRemainingWorkUnits += remainingWorking * usageUnits;
          continue;
        }

        if (item.currentStepId === targetStep.id && item.status === 'queued') {
          if (getItemDispatchPriority(item) >= candidatePriority) {
            queuedUnits += estimatedUnitsPerItem;
          }
          continue;
        }

        if (item.status === 'transmitting' && item.targetStepId === targetStep.id) {
          inboundUnits += estimatedUnitsPerItem * 0.5;
        }
      }

      const freeUnits = Math.max(0, capacity - activeUnits);
      const waitingUnits = queuedUnits + inboundUnits;
      const overflowWaitingUnits = Math.max(0, waitingUnits - freeUnits);
      const activeWait = activeUnits >= capacity || waitingUnits >= freeUnits
        ? activeRemainingWorkUnits / capacity
        : 0;
      const overflowWait = (overflowWaitingUnits * processingTime) / capacity;
      queueWait = Math.max(0, activeWait + overflowWait);
    }

    const predictedReadyTime = currentSimulationMs + queueWait;
    const calendarAware = currentStep.routingCalendarAware !== false;
    let calendarDelay = 0;
    let targetWasWorking = true;

    if (calendarAware) {
      targetWasWorking = isWorkingTime(targetCalendar, config.calendarStartIso, predictedReadyTime);
      const processingStartTime = getNextWorkingSimulationTime(targetCalendar, config.calendarStartIso, predictedReadyTime);
      const processingFinishTime = addWorkingDuration(targetCalendar, config.calendarStartIso, processingStartTime, processingTime);
      calendarDelay = Math.max(0, processingStartTime - predictedReadyTime)
        + Math.max(0, processingFinishTime - processingStartTime - processingTime);
    }

    const totalTime = Math.max(0, queueWait + processingTime + calendarDelay);
    return {
      queueWait: Number.isFinite(queueWait) ? queueWait : 0,
      processingTime: Number.isFinite(processingTime) ? processingTime : 0,
      calendarDelay: Number.isFinite(calendarDelay) ? calendarDelay : 0,
      totalTime: Number.isFinite(totalTime) ? totalTime : 0,
      targetWasWorking,
    };
  };

  const getRouteCounter = (fromStepId: string, targetStepId: string) => {
    const routeId = getRouteId(fromStepId, targetStepId);
    if (!routeCountersRef.current[routeId]) {
      routeCountersRef.current[routeId] = createRouteCounter(fromStepId, targetStepId);
    }
    return routeCountersRef.current[routeId];
  };

  const recordRoutingDecision = (
    currentStep: ProcessStep,
    candidateConnections: ProcessStep['connections'],
    baseWeights: number[],
    effectiveWeights: number[],
    routeEstimates: RouteEstimate[] | undefined,
    selectedTargetId: string | undefined,
    wasFallback: boolean,
    context?: RoutingContext
  ) => {
    if (!context?.trackStats) {
      return;
    }

    const positiveEffectiveWeights = effectiveWeights.map((weight) => Number.isFinite(weight) && weight > 0 ? weight : 0);
    const effectiveTotal = positiveEffectiveWeights.reduce((sum, weight) => sum + weight, 0);

    candidateConnections.forEach((connection, index) => {
      const counter = getRouteCounter(currentStep.id, connection.targetId);
      const baseWeight = Number.isFinite(baseWeights[index]) ? Math.max(0, baseWeights[index]) : 0;
      const effectiveWeight = positiveEffectiveWeights[index] || 0;
      const targetStep = context.stepMap?.get(connection.targetId) || stepsRef.current.find((step) => step.id === connection.targetId);
      const routeEstimate = routeEstimates?.[index] || EMPTY_ROUTE_ESTIMATE;

      counter.sourceDecisionCount++;
      if (wasFallback) {
        counter.sourceFallbackDecisionCount++;
      }
      counter.lastBaseWeight = baseWeight;
      counter.lastEffectiveWeight = effectiveWeight;
      counter.lastEffectiveShare = effectiveTotal > 0 ? effectiveWeight / effectiveTotal : 1 / Math.max(1, candidateConnections.length);
      counter.lastCongestion = getTargetCongestion(targetStep, context);
      counter.lastEstimatedQueueWait = routeEstimate.queueWait;
      counter.lastEstimatedProcessingTime = routeEstimate.processingTime;
      counter.lastEstimatedCalendarDelay = routeEstimate.calendarDelay;
      counter.lastEstimatedTotalTime = routeEstimate.totalTime;
      counter.lastTargetWasWorking = routeEstimate.targetWasWorking;
      counter.lastWasFallback = wasFallback;
      counter.lastSelectionMode = currentStep.routingStrategy || 'probability';

      if (connection.targetId === selectedTargetId) {
        counter.selectedCount++;
        if (wasFallback) {
          counter.fallbackSelectedCount++;
        }
        if (connection.itemProfileIds && connection.itemProfileIds.length > 0 && context.itemProfileId && connection.itemProfileIds.includes(context.itemProfileId)) {
          counter.profileMatchedSelectionCount++;
        }
        if (doesConnectionPriorityMatch(connection, context)) {
          counter.priorityMatchedSelectionCount++;
        }
      }
    });
  };

  const getNextStepId = (currentStep: ProcessStep, context?: RoutingContext): string | 'finished' => {
    if (!currentStep.connections || currentStep.connections.length === 0) {
      return 'finished';
    }

    const stepMap = context?.stepMap || new Map<string, ProcessStep>(stepsRef.current.map((step) => [step.id, step]));
    const validConnections = currentStep.connections.filter((connection) => connection.targetId && stepMap.has(connection.targetId));
    if (validConnections.length === 0) {
      return 'finished';
    }

    const filteredConnections = validConnections.filter(hasRoutingFilter);
    const matchingFilteredConnections = filteredConnections.filter((connection) => isConnectionEligible(connection, context));
    const unfilteredConnections = validConnections.filter((connection) => !hasRoutingFilter(connection));
    const wasFallback = filteredConnections.length > 0 && matchingFilteredConnections.length === 0;
    const candidateConnections = matchingFilteredConnections.length > 0
      ? matchingFilteredConnections
      : unfilteredConnections.length > 0
        ? unfilteredConnections
        : validConnections;
    const baseWeights = candidateConnections.map((connection) => Math.max(0, connection.probability || 0));

    const routingStrategy = currentStep.routingStrategy || 'probability';

    if (routingStrategy === 'probability') {
      const selectedConnection = chooseWeightedConnection(candidateConnections, baseWeights);
      recordRoutingDecision(currentStep, candidateConnections, baseWeights, baseWeights, undefined, selectedConnection?.targetId, wasFallback, context);
      return selectedConnection?.targetId || 'finished';
    }

    if (routingStrategy === 'time-aware') {
      const sensitivity = Math.max(0, Math.min(10, Number.isFinite(currentStep.routingTimeSensitivity) ? currentStep.routingTimeSensitivity ?? 2 : 2));
      const routeEstimates = candidateConnections.map((connection) => getEstimatedRouteTime(currentStep, stepMap.get(connection.targetId), context));
      const positiveEstimatedTimes = routeEstimates
        .map((estimate) => estimate.totalTime)
        .filter((time) => Number.isFinite(time) && time > 0);
      const fastestTime = positiveEstimatedTimes.length > 0 ? Math.min(...positiveEstimatedTimes) : 1;
      const dynamicWeights = candidateConnections.map((connection, index) => {
        const baseWeight = baseWeights[index];
        const estimatedTime = routeEstimates[index]?.totalTime ?? 0;
        const relativeDelay = estimatedTime > 0 && fastestTime > 0
          ? Math.max(0, (estimatedTime - fastestTime) / fastestTime)
          : 0;
        return baseWeight / (1 + sensitivity * relativeDelay);
      });

      const selectedConnection = chooseWeightedConnection(candidateConnections, dynamicWeights);
      recordRoutingDecision(currentStep, candidateConnections, baseWeights, dynamicWeights, routeEstimates, selectedConnection?.targetId, wasFallback, context);
      return selectedConnection?.targetId || 'finished';
    }

    const sensitivity = Math.max(0, Math.min(10, Number.isFinite(currentStep.routingLoadSensitivity) ? currentStep.routingLoadSensitivity ?? 1 : 1));
    const dynamicWeights = candidateConnections.map((connection, index) => {
      const targetStep = stepMap.get(connection.targetId);
      const congestion = getTargetCongestion(targetStep, context);
      const baseWeight = baseWeights[index];
      return baseWeight / (1 + sensitivity * congestion);
    });

    const selectedConnection = chooseWeightedConnection(candidateConnections, dynamicWeights);
    recordRoutingDecision(currentStep, candidateConnections, baseWeights, dynamicWeights, undefined, selectedConnection?.targetId, wasFallback, context);
    return selectedConnection?.targetId || 'finished';
  };

  const safeNumber = (val: number | undefined, defaultVal: number): number => {
      if (typeof val === 'number' && !isNaN(val) && isFinite(val) && val >= 0) {
          return val;
      }
      return defaultVal;
  };

  const getArrivalUnitMs = (step: ProcessStep) => TIME_UNIT_TO_MS[step.arrivalUnit || 's'];
  const getArrivalBatchSize = (step: ProcessStep) => Math.max(1, Math.min(1000, Math.round(safeNumber(step.arrivalBatchSize, 1))));
  const getGlobalBusinessCalendar = () => resolveGlobalBusinessCalendar(config);
  const getEffectiveBusinessCalendar = (step: ProcessStep) => resolveStepBusinessCalendar(
    step,
    getGlobalBusinessCalendar()
  );

  const getCalendarStartMs = () => {
    const parsed = config.calendarStartIso ? Date.parse(config.calendarStartIso) : Date.parse(DEFAULT_CALENDAR_START_ISO);
    return Number.isFinite(parsed) ? parsed : Date.parse(DEFAULT_CALENDAR_START_ISO);
  };

  const getDateOnlyMs = (date: string | undefined, endOfDay = false) => {
    if (!date) {
      return undefined;
    }

    const parsed = Date.parse(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const getStartOfDayMs = (date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay.getTime();
  };

  const isDateInFilters = (
    date: Date,
    filters: { daysOfWeek?: number[]; months?: number[]; daysOfMonth?: number[]; startDate?: string; endDate?: string }
  ) => {
    if (filters.daysOfWeek && filters.daysOfWeek.length > 0 && !filters.daysOfWeek.includes(date.getDay())) {
      return false;
    }

    if (filters.months && filters.months.length > 0 && !filters.months.includes(date.getMonth() + 1)) {
      return false;
    }

    if (filters.daysOfMonth && filters.daysOfMonth.length > 0 && !filters.daysOfMonth.includes(date.getDate())) {
      return false;
    }

    const time = date.getTime();
    const startDateMs = getDateOnlyMs(filters.startDate);
    const endDateMs = getDateOnlyMs(filters.endDate, true);

    if (typeof startDateMs === 'number' && time < startDateMs) {
      return false;
    }

    if (typeof endDateMs === 'number' && time > endDateMs) {
      return false;
    }

    return true;
  };

  const getStartDemandMultiplier = (step: ProcessStep, eventSimulationMs: number) => (
    Math.max(0.01, getDemandMultiplier(config.demandModifiers, config.calendarStartIso, eventSimulationMs))
    * Math.max(0.01, getDemandMultiplier(step.demandModifiers, config.calendarStartIso, eventSimulationMs))
  );

  const getFrameSequenceSlot = (
    sequenceStartMs: number,
    quantity: number,
    itemIntervalMs: number,
    frameStartMs: number,
    frameEndMs: number
  ): ArrivalSlot | null => {
    const safeQuantity = Math.max(1, Math.round(quantity));
    const safeIntervalMs = Math.max(0, itemIntervalMs);

    if (safeIntervalMs <= 0 || safeQuantity <= 1) {
      return isArrivalInFrame(sequenceStartMs, frameStartMs, frameEndMs)
        ? { time: sequenceStartMs, quantity: safeQuantity, itemIntervalMs: 0 }
        : null;
    }

    let firstIndex = Math.max(0, Math.ceil((frameStartMs - sequenceStartMs) / safeIntervalMs));
    const firstTime = sequenceStartMs + firstIndex * safeIntervalMs;
    const isInitialZeroFrame = frameStartMs <= ARRIVAL_TIME_EPSILON_MS && Math.abs(firstTime) <= ARRIVAL_TIME_EPSILON_MS;
    if (!isInitialZeroFrame && firstTime <= frameStartMs + ARRIVAL_TIME_EPSILON_MS) {
      firstIndex++;
    }

    const lastIndex = Math.min(safeQuantity - 1, Math.floor((frameEndMs - sequenceStartMs + ARRIVAL_TIME_EPSILON_MS) / safeIntervalMs));
    if (firstIndex > lastIndex || firstIndex >= safeQuantity) {
      return null;
    }

    return {
      time: sequenceStartMs + firstIndex * safeIntervalMs,
      quantity: lastIndex - firstIndex + 1,
      itemIntervalMs: safeIntervalMs,
    };
  };

  const calculateNextSpawnDelay = (step: ProcessStep, eventSimulationMs = simulationTimeRef.current): number => {
    const unitMs = getArrivalUnitMs(step);
    const inputMode = step.arrivalInputMode || 'rate';
    const batchSize = getArrivalBatchSize(step);
    const demandMultiplier = getStartDemandMultiplier(step, eventSimulationMs);

    if (step.randomnessMode === 'range') {
        const minValue = safeNumber(step.minArrivalRate, inputMode === 'interval' ? 1 : 0.1);
        const maxValue = safeNumber(step.maxArrivalRate, inputMode === 'interval' ? 3 : 1.0);

        if (inputMode === 'interval') {
          const minInterval = Math.max(MIN_ARRIVAL_RATE, Math.min(minValue, maxValue));
          const maxInterval = Math.max(MIN_ARRIVAL_RATE, Math.max(minValue, maxValue));
          const randomInterval = minInterval + Math.random() * (maxInterval - minInterval);
          return (randomInterval * unitMs) / demandMultiplier;
        }

        const randomRate = minValue + Math.random() * (maxValue - minValue);
        const safeRate = Math.max(MIN_ARRIVAL_RATE, randomRate * demandMultiplier);
        return (unitMs * batchSize) / safeRate; 
    } else {
        const value = safeNumber(step.arrivalRate, inputMode === 'interval' ? 1 : 0.5);

        if (inputMode === 'interval') {
          return (Math.max(MIN_ARRIVAL_RATE, value) * unitMs) / demandMultiplier;
        }

        const safeRate = Math.max(MIN_ARRIVAL_RATE, value * demandMultiplier);
        return (unitMs * batchSize) / safeRate;
    }
  };

  const getWindowArrivalSlots = (step: ProcessStep, frameStartMs: number, frameEndMs: number): ArrivalSlot[] => {
    const windows = (step.arrivalSchedule || []).filter((window): window is ScheduledArrivalWindow => Boolean(window?.enabled) && (window.quantity || 0) > 0);
    if (windows.length === 0) {
      return [];
    }

    const calendarStartMs = getCalendarStartMs();
    const slots: ArrivalSlot[] = [];
    const safeFrameStartMs = Math.max(0, Math.min(frameStartMs, frameEndMs));
    const safeFrameEndMs = Math.max(safeFrameStartMs, frameEndMs);
    const firstDayStartMs = getStartOfDayMs(new Date(calendarStartMs + safeFrameStartMs));
    const lastDayStartMs = getStartOfDayMs(new Date(calendarStartMs + safeFrameEndMs));

    for (let dayStartMs = firstDayStartMs; dayStartMs <= lastDayStartMs; dayStartMs += DAY_MS) {
      const date = new Date(dayStartMs);

      for (const window of windows) {
        if (!isDateInFilters(date, window)) {
          continue;
        }

        const quantity = Math.max(1, Math.round(window.quantity));
        const windowStart = dayStartMs + window.startHour * HOUR_MS - calendarStartMs;
        const windowEnd = dayStartMs + window.endHour * HOUR_MS - calendarStartMs;
        const duration = Math.max(1, windowEnd - windowStart);
        const demandMultiplier = getStartDemandMultiplier(step, windowStart);
        const adjustedQuantity = Math.max(1, Math.round(quantity * demandMultiplier));

        if (window.spreadMode === 'burst') {
          const burstSlot = getFrameSequenceSlot(windowStart, adjustedQuantity, 0, frameStartMs, frameEndMs);
          if (burstSlot) {
            slots.push(burstSlot);
          }
          continue;
        }

        const interval = duration / adjustedQuantity;
        const spreadSlot = getFrameSequenceSlot(windowStart, adjustedQuantity, interval, frameStartMs, frameEndMs);
        if (spreadSlot) {
          slots.push(spreadSlot);
        }
      }
    }

    return slots.sort((a, b) => a.time - b.time);
  };

  const getEventBaseSimulationTime = (event: ScheduledArrivalEvent) => {
    const calendarStartMs = getCalendarStartMs();
    if (event.startDate) {
      const dateMs = getDateOnlyMs(event.startDate);
      if (typeof dateMs === 'number') {
        return dateMs - calendarStartMs + event.hour * HOUR_MS;
      }
    }

    const calendarStartDayMs = getStartOfDayMs(new Date(calendarStartMs));
    return calendarStartDayMs + Math.max(0, event.dayOffset || 0) * DAY_MS + event.hour * HOUR_MS - calendarStartMs;
  };

  const getRepeatIntervalMs = (event: ScheduledArrivalEvent) => {
    const every = Math.max(1, Math.round(event.repeatEvery ?? 1));
    switch (event.repeat) {
      case 'daily':
      case 'workingDay':
        return every * DAY_MS;
      case 'weekly':
        return every * 7 * DAY_MS;
      case 'monthly':
        return every * 30 * DAY_MS;
      case 'yearly':
        return every * 365 * DAY_MS;
      case 'none':
      default:
        return undefined;
    }
  };

  const getEventArrivalSlots = (step: ProcessStep, frameStartMs: number, frameEndMs: number): ArrivalSlot[] => {
    const events = (step.arrivalEvents || []).filter((event): event is ScheduledArrivalEvent => Boolean(event?.enabled) && (event.quantity || 0) > 0);
    if (events.length === 0) {
      return [];
    }

    const calendarStartMs = getCalendarStartMs();
    const slots: ArrivalSlot[] = [];

    for (const event of events) {
      const baseTime = getEventBaseSimulationTime(event);
      const repeatInterval = getRepeatIntervalMs(event);
      const maxRuns = Math.max(1, event.occurrenceLimit ?? 100000);
      const configuredUnitMs = TIME_UNIT_TO_MS[event.itemIntervalUnit || 's'] || 1000;
      const configuredItemIntervalMs = (event.dispatchMode || 'burst') === 'sequence'
        ? Math.max(0, event.itemInterval || 0) * configuredUnitMs
        : 0;
      const configuredSpanMs = configuredItemIntervalMs > 0
        ? Math.max(0, Math.round(event.quantity || 1) - 1) * configuredItemIntervalMs
        : 0;
      const firstRun = repeatInterval ? Math.max(0, Math.floor((frameStartMs - baseTime - configuredSpanMs) / repeatInterval)) : 0;
      const lastRun = repeatInterval ? Math.min(maxRuns - 1, Math.ceil((frameEndMs - baseTime) / repeatInterval)) : 0;

      for (let run = firstRun; run <= lastRun; run++) {
        const eventTime = baseTime + (repeatInterval ? run * repeatInterval : 0);

        const absoluteDate = new Date(calendarStartMs + eventTime);
        if (event.repeat === 'workingDay' && !getEffectiveBusinessCalendar(step).daysOfWeek.includes(absoluteDate.getDay())) {
          continue;
        }

        if (!isDateInFilters(absoluteDate, event)) {
          continue;
        }

        const demandMultiplier = getStartDemandMultiplier(step, eventTime);
        const quantity = Math.max(1, Math.round(event.quantity * demandMultiplier));
        const itemIntervalMs = (event.dispatchMode || 'burst') === 'sequence'
          ? Math.max(0, event.itemInterval || 0) * configuredUnitMs
          : 0;

        const eventSlot = getFrameSequenceSlot(eventTime, quantity, itemIntervalMs, frameStartMs, frameEndMs);
        if (eventSlot) {
          slots.push(eventSlot);
        }
      }
    }

    return slots.sort((a, b) => a.time - b.time);
  };

  const applyExecutionSpeed = (step: ProcessStep, item: WorkItem, duration: number): number => {
    const speedMultiplier = getProcessingSpeedMultiplier(step, item);
    const profileMultiplier = typeof item.processingTimeMultiplier === 'number' && Number.isFinite(item.processingTimeMultiplier)
      ? Math.max(0.01, item.processingTimeMultiplier)
      : 1;
    return (duration * profileMultiplier) / Math.max(0.05, speedMultiplier);
  };

  const calculateProcessingDuration = (step: ProcessStep, item: WorkItem): number => {
      const fixedUnitMultiplier = TIME_UNIT_TO_MS[step.processingTimeUnit || 'ms'];
      const sourceRuleUnitMultiplier = TIME_UNIT_TO_MS[step.sourceProcessingTimeUnit || step.processingTimeUnit || 'ms'];
      const rangeUnitMultiplier = TIME_UNIT_TO_MS[step.rangeTimeUnit || step.processingTimeUnit || 'ms'];
      const isDelayMode = step.simulationMode === 'delay';
      const simulationMode = config.simulationMode || 'realistic';

    // 1. Check Source Rule Override (Fixed Mode only usually, but applies generally)
    if (!isDelayMode && step.randomnessMode === 'fixed' && item.previousStepId && step.sourceProcessingTimes && Object.prototype.hasOwnProperty.call(step.sourceProcessingTimes, item.previousStepId)) {
        const baseValue = safeNumber(step.sourceProcessingTimes[item.previousStepId], 1000);
        const baseMs = baseValue * sourceRuleUnitMultiplier;
        // Boundary check: prevent overflow
        if (baseMs > MAX_SAFE_DURATION_MS) {
          console.warn(`Processing time exceeds safe limit: ${baseValue} ${step.sourceProcessingTimeUnit || step.processingTimeUnit}`);
          return MAX_SAFE_DURATION_MS;
        }
        const variance = safeNumber(step.variance, 0);
        if (variance > 0) {
          if (simulationMode === 'worst-case') {
            // Worst-case: uniform distribution, can produce extreme values
            const speedNoise = 1 + (Math.random() * 2 - 1) * variance;
            return applyExecutionSpeed(step, item, Math.max(MIN_PROCESSING_DURATION_MS, baseMs * speedNoise));
          } else {
            // Realistic: normal distribution with bounds
            const normalRandom = generateNormalRandom();
            const duration = baseMs + baseMs * variance * normalRandom;
            // Clamp to reasonable bounds: not less than 20% of base, not more than 3x base
            return applyExecutionSpeed(step, item, Math.max(baseMs * 0.2, Math.min(baseMs * 3, duration)));
          }
        }
        return applyExecutionSpeed(step, item, Math.max(MIN_PROCESSING_DURATION_MS, baseMs));
    }

    // 2. Range Mode
    if (step.randomnessMode === 'range') {
      const minValue = safeNumber(step.minProcessingTime, 500);
      const maxValue = safeNumber(step.maxProcessingTime, 2000);
      const min = minValue * rangeUnitMultiplier;
      const max = maxValue * rangeUnitMultiplier;
      // Boundary check
      if (max > MAX_SAFE_DURATION_MS) {
        console.warn(`Processing time range exceeds safe limit: ${minValue}-${maxValue} ${step.rangeTimeUnit || step.processingTimeUnit}`);
        return Math.min(min, MAX_SAFE_DURATION_MS);
      }
      // Independent random number for this call
      return applyExecutionSpeed(step, item, min + Math.random() * (max - min));
    }

    // 3. Default Fixed Mode
    const baseValue = safeNumber(step.processingTime, 1000);
    const baseMs = baseValue * fixedUnitMultiplier;
    // Boundary check
    if (baseMs > MAX_SAFE_DURATION_MS) {
      console.warn(`Processing time exceeds safe limit: ${baseValue} ${step.processingTimeUnit}`);
      return MAX_SAFE_DURATION_MS;
    }
    if (isDelayMode) {
      return applyExecutionSpeed(step, item, Math.max(MIN_PROCESSING_DURATION_MS, baseMs));
    }

    const variance = safeNumber(step.variance, 0);
    if (variance > 0) {
      if (simulationMode === 'worst-case') {
        // Worst-case: uniform distribution, can produce extreme values
        const speedNoise = 1 + (Math.random() * 2 - 1) * variance;
        return applyExecutionSpeed(step, item, Math.max(MIN_PROCESSING_DURATION_MS, baseMs * speedNoise));
      } else {
        // Realistic: normal distribution with bounds
        const normalRandom = generateNormalRandom();
        const duration = baseMs + baseMs * variance * normalRandom;
        // Clamp to reasonable bounds: not less than 20% of base, not more than 3x base
        return applyExecutionSpeed(step, item, Math.max(baseMs * 0.2, Math.min(baseMs * 3, duration)));
      }
    }
    return applyExecutionSpeed(step, item, Math.max(MIN_PROCESSING_DURATION_MS, baseMs));
  };

  const beginTransmission = (
    item: WorkItem,
    fromStepId: string,
    toStepId: string | 'finished',
    currentSimulationMs: number,
    currentWallMs: number
  ) => {
    item.previousStepId = fromStepId;
    item.targetStepId = toStepId;
    item.status = 'transmitting';
    item.transmissionProgress = 0;
    item.transmissionStartedAtSimulationMs = currentSimulationMs;
    item.transmissionEndsAtSimulationMs = currentSimulationMs + BUSINESS_TRANSMISSION_SIM_MS;
    item.transmissionStartedAtWallMs = currentWallMs;
    item.transmissionEndsAtWallMs = currentWallMs + TRANSMISSION_DURATION;
    item.visualPreviousStepId = fromStepId;
    item.visualTargetStepId = toStepId;
    item.visualTransmissionStartedAtWallMs = currentWallMs;
    item.visualTransmissionEndsAtWallMs = currentWallMs + TRANSMISSION_DURATION;
    item.visualTransmissionProgress = 0;
    item.totalTransmissionTime += BUSINESS_TRANSMISSION_SIM_MS;
  };

  const beginProcessing = (
    item: WorkItem,
    step: ProcessStep,
    currentSimulationMs: number
  ) => {
    const stepCalendar = getEffectiveBusinessCalendar(step);
    const processingStartSimulationMs = getNextWorkingSimulationTime(stepCalendar, config.calendarStartIso, currentSimulationMs);
    const queuedAtSimulationMs = item.queuedAtSimulationMs;

    // Calculate calendar wait time: total time from queue entry to processing start
    // This includes both working hours and non-working hours (weekends, nights, etc.)
    // Use case: Customer SLA, response time metrics
    const calendarWaitTime = typeof queuedAtSimulationMs === 'number'
      ? Math.max(0, processingStartSimulationMs - queuedAtSimulationMs)
      : Math.max(0, processingStartSimulationMs - currentSimulationMs);

    // Calculate working wait time: only working hours between queue entry and processing start
    // This excludes non-working hours (weekends, nights, etc.)
    // Use case: Internal queue efficiency, resource utilization, capacity planning
    const workingWaitTime = typeof queuedAtSimulationMs === 'number'
      ? getWorkingDurationBetween(stepCalendar, config.calendarStartIso, queuedAtSimulationMs, processingStartSimulationMs)
      : getWorkingDurationBetween(stepCalendar, config.calendarStartIso, currentSimulationMs, processingStartSimulationMs);

    item.totalWaitTime += calendarWaitTime;
    item.totalWorkingWaitTime += workingWaitTime;

    if (!stepCountersRef.current[step.id]) {
      stepCountersRef.current[step.id] = createStepCounter();
    }
    stepCountersRef.current[step.id].totalWaitTime += calendarWaitTime;
    stepCountersRef.current[step.id].totalWorkingWaitTime += workingWaitTime;
    stepCountersRef.current[step.id].totalStarted++;

    const duration = calculateProcessingDuration(step, item);
    const safeDuration = Number.isFinite(duration) ? Math.max(MIN_PROCESSING_DURATION_MS, duration) : 1000;

    item.status = 'processing';
    item.progress = 0;
    item.requiredDuration = safeDuration;
    item.queuedAtSimulationMs = undefined;
    item.queueCancellationCheckedAtSimulationMs = undefined;
    item.processingStartedAtSimulationMs = processingStartSimulationMs;
    item.processingEndsAtSimulationMs = addWorkingDuration(stepCalendar, config.calendarStartIso, processingStartSimulationMs, safeDuration);
  };

  const beginArrivalAtStep = (
    item: WorkItem,
    step: ProcessStep,
    currentSimulationMs: number
  ) => {
    item.currentStepId = step.id;
    item.stepEntryTime = currentSimulationMs;
    item.targetStepId = undefined;

    if (step.type === 'end') {
      item.completedAtSimulationMs = currentSimulationMs;
      item.status = 'finished';
      return;
    }

    if (step.type !== 'process') {
      item.status = 'queued';
      return;
    }

    if (step.simulationMode === 'delay') {
      beginProcessing(item, step, currentSimulationMs);
      return;
    }

    item.status = 'queued';
    item.queuedAtSimulationMs = currentSimulationMs;
    item.queueCancellationCheckedAtSimulationMs = currentSimulationMs;
  };

  useEffect(() => {
    if (!config.isRunning) {
      lastTickRef.current = Date.now();
      return;
    }

    let animationFrameId: number;

    const tick = () => {
      const now = Date.now();
      const rawDt = now - lastTickRef.current;
      // Cap dt to prevent massive jumps after lag spikes or background tabs
      const clampedRealDt = Math.min(rawDt, 100);
      const visualDt = clampedRealDt * config.speedMultiplier;
      const dt = visualDt * config.timeCompression;
      lastTickRef.current = now;
      const frameStartSimulationMs = simulationTimeRef.current;
      simulationTimeRef.current += dt;

      const steps: ProcessStep[] = stepsRef.current;
      const stepMap = new Map<string, ProcessStep>(steps.map((s: ProcessStep) => [s.id, s]));
      const stepFlowLookup = buildStepFlowLookup(steps);
      const globalBusinessCalendar = resolveGlobalBusinessCalendar(config);

      const spawnArrivalSlot = (startNode: ProcessStep, slot: ArrivalSlot): number => {
        const quantity = Math.max(1, Math.min(MAX_SPAWNS_PER_START_PER_TICK, Math.round(slot.quantity)));
        const itemIntervalMs = Math.max(0, slot.itemIntervalMs);

        if (itemIntervalMs > 0 && quantity > 1) {
          let handledCount = 0;
          const futureSlots: ArrivalSlot[] = [];

          for (let batchIndex = 0; batchIndex < quantity; batchIndex++) {
            const itemSpawnTime = slot.time + (batchIndex * itemIntervalMs);
            const itemSlot = { time: itemSpawnTime, quantity: 1, itemIntervalMs: 0 };

            if (isArrivalDueBy(itemSpawnTime, simulationTimeRef.current)) {
              handledCount += spawnArrivalSlot(startNode, itemSlot);
            } else {
              futureSlots.push(itemSlot);
            }
          }

          if (futureSlots.length > 0) {
            delayedArrivalSlotsRef.current[startNode.id] = [
              ...(delayedArrivalSlotsRef.current[startNode.id] || []),
              ...futureSlots,
            ];
          }

          return handledCount;
        }

        const startCalendar = resolveStepBusinessCalendar(startNode, globalBusinessCalendar);
        const isStartWorking = isWorkingTime(startCalendar, config.calendarStartIso, slot.time);

        if (!isStartWorking && startCalendar.nonWorkingArrivalPolicy === 'delay') {
          const delayedTime = getNextWorkingSimulationTime(startCalendar, config.calendarStartIso, slot.time);
          delayedArrivalSlotsRef.current[startNode.id] = [
            ...(delayedArrivalSlotsRef.current[startNode.id] || []),
            { ...slot, time: delayedTime },
          ];
          return quantity;
        }

        if (!isStartWorking && startCalendar.nonWorkingArrivalPolicy === 'reject') {
          statsRef.current.totalItemsCancelled += quantity;
          if (stepCountersRef.current[startNode.id]) {
            stepCountersRef.current[startNode.id].cancelled += quantity;
          }
          const flowId = stepFlowLookup.get(startNode.id) || startNode.id;
          if (!flowCountersRef.current[flowId]) {
            flowCountersRef.current[flowId] = createFlowCounter(flowId);
          }
          flowCountersRef.current[flowId].cancelled += quantity;
          return quantity;
        }

        for (let batchIndex = 0; batchIndex < quantity; batchIndex++) {
          const itemProfile = getItemProfileForSpawn(startNode);
          let firstTargetId: string | 'finished' = 'finished';
          if (startNode.connections.length > 0) {
            firstTargetId = getNextStepId(startNode, {
              itemProfileId: itemProfile?.id,
              priority: itemProfile?.priority ?? 1,
              processingTimeMultiplier: itemProfile?.processingTimeMultiplier ?? 1,
              items: itemsRef.current,
              stepMap,
              trackStats: true,
              currentSimulationMs: slot.time,
            });
          }

          if (firstTargetId === 'finished') {
            continue;
          }

          const itemSpawnTime = slot.time + (batchIndex * Math.max(0, slot.itemIntervalMs));
          const flowId = stepFlowLookup.get(startNode.id) || startNode.id;

          const newItem: WorkItem = {
            id: `item-${statsRef.current.totalItemsCreated + 1}`,
            sourceFlowId: flowId,
            currentStepId: startNode.id,
            targetStepId: firstTargetId,
            status: 'transmitting',
            previousStepId: startNode.id,
            progress: 0,
            transmissionProgress: 0,
            createdAt: now,
            createdAtSimulationMs: itemSpawnTime,
            completedAtSimulationMs: undefined,
            totalTransmissionTime: 0,
            totalWaitTime: 0,
            totalWorkingWaitTime: 0,
            totalProcessingTime: 0,
            totalCalendarProcessingTime: 0,
            itemProfileId: itemProfile?.id,
            itemProfileName: itemProfile?.name,
            itemProfileColor: itemProfile?.color,
            processingTimeMultiplier: itemProfile?.processingTimeMultiplier ?? 1,
            failureMultiplier: itemProfile?.failureMultiplier ?? 1,
            cancellationMultiplier: itemProfile?.cancellationMultiplier ?? 1,
            priority: itemProfile?.priority ?? 1,
            assignedResourceCount: 1,
            resourceLoadFactor: 1,
            executionMode: 'single',
            stepEntryTime: itemSpawnTime,
            queuedAtSimulationMs: undefined,
            queueCancellationCheckedAtSimulationMs: undefined,
            visualPreviousStepId: undefined,
            visualTargetStepId: undefined,
            visualTransmissionStartedAtWallMs: undefined,
            visualTransmissionEndsAtWallMs: undefined,
            visualTransmissionProgress: undefined,
          };

          beginTransmission(newItem, startNode.id, firstTargetId, itemSpawnTime, now);
          itemsRef.current.push(newItem);
          statsRef.current.totalItemsCreated++;

          if (stepCountersRef.current[startNode.id]) {
            stepCountersRef.current[startNode.id].processed++;
          }
          if (!flowCountersRef.current[flowId]) {
            flowCountersRef.current[flowId] = createFlowCounter(flowId);
          }
          flowCountersRef.current[flowId].created++;
        }

        return quantity;
      };

      // 1. Arrival Logic (Absolute Simulated Event Time)
      for (const startNode of steps.filter((s: ProcessStep) => s.type === 'start')) {
        if (nextSpawnTimeRef.current[startNode.id] === undefined) {
          nextSpawnTimeRef.current[startNode.id] = 0;
        }
        if (!delayedArrivalSlotsRef.current[startNode.id]) {
          delayedArrivalSlotsRef.current[startNode.id] = [];
        }

        const delayedSlots = delayedArrivalSlotsRef.current[startNode.id]
          .filter((slot) => isArrivalDueBy(slot.time, simulationTimeRef.current))
          .sort((a, b) => a.time - b.time);
        delayedArrivalSlotsRef.current[startNode.id] = delayedArrivalSlotsRef.current[startNode.id]
          .filter((slot) => !isArrivalDueBy(slot.time, simulationTimeRef.current));

        let spawnedThisTick = 0;
        for (const slot of delayedSlots) {
          if (spawnedThisTick >= MAX_SPAWNS_PER_START_PER_TICK) {
            delayedArrivalSlotsRef.current[startNode.id].push(slot);
            continue;
          }
          spawnedThisTick += spawnArrivalSlot(startNode, slot);
        }

        const arrivalModel = startNode.arrivalModel || 'simple';
        if (arrivalModel === 'schedule') {
          const slots = getWindowArrivalSlots(startNode, frameStartSimulationMs, simulationTimeRef.current);
          for (const slot of slots) {
            if (spawnedThisTick >= MAX_SPAWNS_PER_START_PER_TICK) break;
            spawnedThisTick += spawnArrivalSlot(startNode, slot);
          }
          continue;
        }

        if (arrivalModel === 'events') {
          const slots = getEventArrivalSlots(startNode, frameStartSimulationMs, simulationTimeRef.current);
          for (const slot of slots) {
            if (spawnedThisTick >= MAX_SPAWNS_PER_START_PER_TICK) break;
            spawnedThisTick += spawnArrivalSlot(startNode, slot);
          }
          continue;
        }

        let nextSpawnAt = nextSpawnTimeRef.current[startNode.id];
        if (isNaN(nextSpawnAt)) nextSpawnAt = frameStartSimulationMs;

        while (isArrivalDueBy(nextSpawnAt, simulationTimeRef.current) && spawnedThisTick < MAX_SPAWNS_PER_START_PER_TICK) {
          const batchSize = getArrivalBatchSize(startNode);
          const batchInterval = config.simulationMode === 'worst-case'
            ? 0
            : typeof startNode.arrivalBatchIntervalMs === 'number' && Number.isFinite(startNode.arrivalBatchIntervalMs)
              ? Math.max(0, startNode.arrivalBatchIntervalMs)
              : 0;
          spawnedThisTick += spawnArrivalSlot(startNode, { time: nextSpawnAt, quantity: batchSize, itemIntervalMs: batchInterval });
          nextSpawnAt += calculateNextSpawnDelay(startNode, nextSpawnAt);
        }

        nextSpawnTimeRef.current[startNode.id] = nextSpawnAt;
      }

      // 2. Resource Tracking Setup
      const currentItems: WorkItem[] = itemsRef.current;
      const stepUsage = new Map<string, number>();
      const stepTeamUsage = new Map<string, boolean>();
      steps.forEach((s: ProcessStep) => stepUsage.set(s.id, 0));

      // Pass 1: Count currently processing items
      for (const item of currentItems) {
        if (item.status === 'processing' && item.currentStepId !== 'finished') {
          const count = stepUsage.get(item.currentStepId) || 0;
          const currentStep = stepMap.get(item.currentStepId);
          const usageUnits = currentStep?.resourceExecutionMode === 'collaborative'
            ? getPositiveInteger(item.assignedResourceCount, 1, 1, 1000)
            : 1;
          stepUsage.set(item.currentStepId, count + usageUnits);
          if (currentStep?.resourceExecutionMode === 'collaborative' && item.assignedTeamId) {
            stepTeamUsage.set(getTeamUsageKey(item.currentStepId, item.assignedTeamId), true);
          }
        }
      }

      const cancelQueuedItem = (item: WorkItem, step: ProcessStep) => {
        item.status = 'cancelled';
        item.queueCancellationCheckedAtSimulationMs = undefined;
        statsRef.current.totalItemsCancelled++;
        if (!stepCountersRef.current[item.currentStepId]) stepCountersRef.current[item.currentStepId] = createStepCounter();
        stepCountersRef.current[item.currentStepId].cancelled++;
        const flowId = item.sourceFlowId || stepFlowLookup.get(step.id) || stepFlowLookup.get(item.previousStepId || '') || 'flow-all';
        if (!flowCountersRef.current[flowId]) {
          flowCountersRef.current[flowId] = createFlowCounter(flowId);
        }
        flowCountersRef.current[flowId].cancelled++;
      };

      const applyQueueCancellationThrough = (item: WorkItem, step: ProcessStep, throughSimulationMs: number): boolean => {
        const cancellationMultiplier = typeof item.cancellationMultiplier === 'number' && Number.isFinite(item.cancellationMultiplier)
          ? Math.max(0, item.cancellationMultiplier)
          : 1;
        const effectiveCancellationProbability = step.cancellationProbability * cancellationMultiplier;
        if (item.status !== 'queued' || effectiveCancellationProbability <= 0) {
          return false;
        }

        const lastCheckedAt = item.queueCancellationCheckedAtSimulationMs ?? item.queuedAtSimulationMs ?? item.stepEntryTime ?? throughSimulationMs;
        const exposureMs = Math.max(0, throughSimulationMs - lastCheckedAt);
        if (exposureMs <= 0) {
          item.queueCancellationCheckedAtSimulationMs = Math.max(lastCheckedAt, throughSimulationMs);
          return false;
        }

        const simulationMode = config.simulationMode || 'realistic';
        let cancelChance: number;

        const exposureSeconds = exposureMs / 1000;
        const stressMultiplier = simulationMode === 'worst-case' ? 2 : 1;
        // Exponential hazard model keeps probability bounded and time-consistent across frame sizes.
        // Worst-case uses a higher hazard rate instead of a linear shortcut that can hit 100% too quickly.
        cancelChance = 1 - Math.exp(-effectiveCancellationProbability * stressMultiplier * exposureSeconds);

        item.queueCancellationCheckedAtSimulationMs = throughSimulationMs;
        if (Math.random() < cancelChance) {
          cancelQueuedItem(item, step);
          return true;
        }

        return false;
      };

      const getProcessingUsageUnits = (item: WorkItem, step: ProcessStep) => (
        step.resourceExecutionMode === 'collaborative'
          ? getPositiveInteger(item.assignedResourceCount, 1, 1, 1000)
          : 1
      );

      const clearProcessingAssignment = (item: WorkItem) => {
        item.assignedResourceCount = 1;
        item.assignedTeamId = undefined;
        item.assignedTeamName = undefined;
        item.resourceLoadFactor = 1;
        item.executionMode = 'single';
      };

      const releaseProcessingResources = (item: WorkItem, step: ProcessStep, stepId: string) => {
        if (step.simulationMode === 'delay') {
          clearProcessingAssignment(item);
          return;
        }

        const currentUsage = stepUsage.get(stepId) || 0;
        const usageUnits = getProcessingUsageUnits(item, step);
        stepUsage.set(stepId, Math.max(0, currentUsage - usageUnits));

        if (step.resourceExecutionMode === 'collaborative' && item.assignedTeamId) {
          stepTeamUsage.delete(getTeamUsageKey(stepId, item.assignedTeamId));
        }

        clearProcessingAssignment(item);
      };

      const getCollaborativeAssignment = (step: ProcessStep, stepId: string, freeUnits: number) => {
        const teams = getCollaborativeTeams(step);
        const minResources = getPositiveInteger(step.minResourcesPerItem, 1, 1, 1000);

        if (teams.length > 0) {
          const availableTeam = [...teams]
            .filter((team) => getPositiveInteger(team.resources, 1, 1, 1000) >= minResources)
            .sort((a, b) => getPositiveInteger(a.resources, 1, 1, 1000) - getPositiveInteger(b.resources, 1, 1, 1000))
            .find((team) => !stepTeamUsage.get(getTeamUsageKey(stepId, team.id)));

          if (!availableTeam) {
            return { resources: 0 };
          }

          return {
            resources: getPositiveInteger(availableTeam.resources, 1, 1, 1000),
            teamId: availableTeam.id,
            teamName: availableTeam.name || availableTeam.id,
          };
        }

        return { resources: getResourceUnitsForItem(step, freeUnits) };
      };

      const startQueuedItemsForStep = (stepId: string, availableAtSimulationMs: number) => {
        const step = stepMap.get(stepId);
        if (!step || step.type !== 'process' || step.simulationMode === 'delay') {
          return;
        }

        const stepCalendar = resolveStepBusinessCalendar(step, globalBusinessCalendar);
        if (!isWorkingTime(stepCalendar, config.calendarStartIso, availableAtSimulationMs)) {
          return;
        }

        const capacity = getStepProcessingLimit(step);
        let currentUsage = stepUsage.get(stepId) || 0;
        if (currentUsage >= capacity) {
          return;
        }

        const queuedItems = itemsRef.current
          .filter((queueItem: WorkItem) => queueItem.currentStepId === stepId && queueItem.status === 'queued')
          .sort((a: WorkItem, b: WorkItem) => {
            const priorityDelta = getItemDispatchPriority(b) - getItemDispatchPriority(a);
            if (priorityDelta !== 0) {
              return priorityDelta;
            }

            const aQueuedAt = a.queuedAtSimulationMs ?? a.stepEntryTime ?? a.createdAtSimulationMs;
            const bQueuedAt = b.queuedAtSimulationMs ?? b.stepEntryTime ?? b.createdAtSimulationMs;
            if (aQueuedAt !== bQueuedAt) {
              return aQueuedAt - bQueuedAt;
            }
            return a.createdAtSimulationMs - b.createdAtSimulationMs;
          });

        for (const queuedItem of queuedItems) {
          if (currentUsage >= capacity) {
            break;
          }

          const queuedAt = queuedItem.queuedAtSimulationMs ?? queuedItem.stepEntryTime ?? availableAtSimulationMs;
          const startAt = Math.max(availableAtSimulationMs, queuedAt);
          if (applyQueueCancellationThrough(queuedItem, step, startAt)) {
            continue;
          }

          const freeUnits = capacity - currentUsage;
          const assignment = step.resourceExecutionMode === 'collaborative'
            ? getCollaborativeAssignment(step, stepId, freeUnits)
            : { resources: getResourceUnitsForItem(step, freeUnits) };
          if (assignment.resources <= 0) {
            break;
          }

          queuedItem.executionMode = step.resourceExecutionMode || 'single';
          queuedItem.assignedResourceCount = assignment.resources;
          queuedItem.assignedTeamId = assignment.teamId;
          queuedItem.assignedTeamName = assignment.teamName;
          queuedItem.resourceLoadFactor = getResourceLoadForNextItem(step, currentUsage + 1);
          if (assignment.teamId) {
            stepTeamUsage.set(getTeamUsageKey(stepId, assignment.teamId), true);
          }
          beginProcessing(queuedItem, step, startAt);
          currentUsage += step.resourceExecutionMode === 'collaborative' ? assignment.resources : 1;
        }

        stepUsage.set(stepId, currentUsage);
      };

      const completeBusinessTransmission = (item: WorkItem, arrivalStepId: string | 'finished' | undefined, eventTime: number) => {
        item.transmissionProgress = 1;
        item.transmissionStartedAtSimulationMs = undefined;
        item.transmissionEndsAtSimulationMs = undefined;
        item.transmissionStartedAtWallMs = undefined;
        item.transmissionEndsAtWallMs = undefined;

        if (arrivalStepId === 'finished') {
          item.completedAtSimulationMs = eventTime;
          item.status = 'finished';
          item.currentStepId = 'finished';
          item.targetStepId = undefined;
          return;
        }

        const arrivalStep = arrivalStepId ? stepMap.get(arrivalStepId) : undefined;
        if (arrivalStep) {
          beginArrivalAtStep(item, arrivalStep, eventTime);
          if (arrivalStep.type === 'process' && arrivalStep.simulationMode !== 'delay') {
            startQueuedItemsForStep(arrivalStep.id, eventTime);
          }
        }
      };

      const settleTerminalItem = (item: WorkItem) => {
        const isTerminal = item.status === 'finished' || item.status === 'cancelled' || item.status === 'error';
        if (!isTerminal || item.finishedAt) {
          return;
        }

        item.finishedAt = now;

        if (item.status === 'finished') {
          statsRef.current.totalItemsFinished++;
          const completedAtSimulationMs = item.completedAtSimulationMs ?? simulationTimeRef.current;
          const cycleTime = Math.max(
            0,
            completedAtSimulationMs - item.createdAtSimulationMs
          );
          const workingCycleTime = getWorkingDurationBetween(globalBusinessCalendar, config.calendarStartIso, item.createdAtSimulationMs, completedAtSimulationMs);
          const operationalWorkingCycleTime = Math.max(0, item.totalWorkingWaitTime + item.totalProcessingTime);
          const offHoursDelay = Math.max(0, cycleTime - workingCycleTime);
          globalCycleTimeSamplesRef.current.cycleTimeSamples.push(cycleTime);
          globalCycleTimeSamplesRef.current.workingCycleTimeSamples.push(workingCycleTime);
          globalCycleTimeSamplesRef.current.operationalWorkingCycleTimeSamples.push(operationalWorkingCycleTime);
          statsRef.current.avgCycleTime =
            ((statsRef.current.avgCycleTime * (statsRef.current.totalItemsFinished - 1)) + cycleTime) / statsRef.current.totalItemsFinished;
          statsRef.current.avgWorkingCycleTime =
            ((statsRef.current.avgWorkingCycleTime * (statsRef.current.totalItemsFinished - 1)) + workingCycleTime) / statsRef.current.totalItemsFinished;
          statsRef.current.avgOperationalWorkingCycleTime =
            ((statsRef.current.avgOperationalWorkingCycleTime * (statsRef.current.totalItemsFinished - 1)) + operationalWorkingCycleTime) / statsRef.current.totalItemsFinished;
          statsRef.current.avgWorkTime =
            ((statsRef.current.avgWorkTime * (statsRef.current.totalItemsFinished - 1)) + item.totalProcessingTime) / statsRef.current.totalItemsFinished;
          statsRef.current.avgWaitTime =
            ((statsRef.current.avgWaitTime * (statsRef.current.totalItemsFinished - 1)) + item.totalWaitTime) / statsRef.current.totalItemsFinished;
          const nonWorkingDelay = offHoursDelay;
          statsRef.current.avgNonWorkingDelay =
            ((statsRef.current.avgNonWorkingDelay * (statsRef.current.totalItemsFinished - 1)) + nonWorkingDelay) / statsRef.current.totalItemsFinished;
          statsRef.current.flowEfficiency = statsRef.current.avgCycleTime > 0
            ? statsRef.current.avgWorkTime / statsRef.current.avgCycleTime
            : 0;

          const flowId = item.sourceFlowId || stepFlowLookup.get(item.currentStepId) || stepFlowLookup.get(item.previousStepId || '') || 'flow-all';
          if (!flowCountersRef.current[flowId]) {
            flowCountersRef.current[flowId] = createFlowCounter(flowId);
          }
          flowCountersRef.current[flowId].finished++;
          flowCountersRef.current[flowId].cycleTimeSamples.push(cycleTime);
          flowCountersRef.current[flowId].workingCycleTimeSamples.push(workingCycleTime);
          flowCountersRef.current[flowId].operationalWorkingCycleTimeSamples.push(operationalWorkingCycleTime);
          flowCountersRef.current[flowId].totalCycleTime += cycleTime;
          flowCountersRef.current[flowId].totalWorkingCycleTime += workingCycleTime;
          flowCountersRef.current[flowId].totalOperationalWorkingCycleTime += operationalWorkingCycleTime;
          flowCountersRef.current[flowId].totalWorkTime += item.totalProcessingTime;
          flowCountersRef.current[flowId].totalWaitTime += item.totalWaitTime;
          flowCountersRef.current[flowId].totalWorkingWaitTime += item.totalWorkingWaitTime;
          flowCountersRef.current[flowId].totalTransmissionTime += item.totalTransmissionTime;
          flowCountersRef.current[flowId].totalOffHoursDelay += offHoursDelay;
          flowCountersRef.current[flowId].totalNonWorkingDelay += nonWorkingDelay;

          // Track stats for End Nodes
          if (item.currentStepId && stepMap.get(item.currentStepId)?.type === 'end') {
            if (!stepCountersRef.current[item.currentStepId]) {
              stepCountersRef.current[item.currentStepId] = createStepCounter();
            }
            stepCountersRef.current[item.currentStepId].processed++;
            stepCountersRef.current[item.currentStepId].totalCompletionTime += cycleTime;
          }
        }
      };

      const completeProcessingItem = (item: WorkItem, currentStep: ProcessStep, eventTime: number, safeDuration: number) => {
        const startedAt = item.processingStartedAtSimulationMs ?? eventTime;
        const calendarProcessingTime = Math.max(0, eventTime - startedAt);
        item.progress = 0;
        item.processingStartedAtSimulationMs = undefined;
        item.processingEndsAtSimulationMs = undefined;
        item.totalProcessingTime += safeDuration;
        item.totalCalendarProcessingTime += calendarProcessingTime;

        // EXCEPTION: Failure
        const failureMultiplier = typeof item.failureMultiplier === 'number' && Number.isFinite(item.failureMultiplier)
          ? Math.max(0, item.failureMultiplier)
          : 1;
        const failChance = Math.min(1, safeNumber(currentStep.failureProbability, 0) * failureMultiplier);
        if (Math.random() < failChance) {
          const failedStepId = item.currentStepId;
          item.status = 'error';
          statsRef.current.totalItemsFailed++;
          if (!stepCountersRef.current[item.currentStepId]) stepCountersRef.current[item.currentStepId] = createStepCounter();
          stepCountersRef.current[item.currentStepId].failed++;
          const flowId = item.sourceFlowId || stepFlowLookup.get(item.currentStepId) || stepFlowLookup.get(item.previousStepId || '') || 'flow-all';
          if (!flowCountersRef.current[flowId]) {
            flowCountersRef.current[flowId] = createFlowCounter(flowId);
          }
          flowCountersRef.current[flowId].failed++;

          releaseProcessingResources(item, currentStep, failedStepId);
          if (currentStep.simulationMode !== 'delay') {
            startQueuedItemsForStep(failedStepId, eventTime);
          }
          return;
        }

        // Normal Success
        const nextId = getNextStepId(currentStep, {
          itemProfileId: item.itemProfileId,
          priority: item.priority,
          processingTimeMultiplier: item.processingTimeMultiplier,
          itemId: item.id,
          items: itemsRef.current,
          stepMap,
          trackStats: true,
          currentSimulationMs: eventTime,
        });

        // Increment Processed Count for this step
        if (!stepCountersRef.current[item.currentStepId]) stepCountersRef.current[item.currentStepId] = createStepCounter();
        stepCountersRef.current[item.currentStepId].processed++;
        stepCountersRef.current[item.currentStepId].totalProcessingTime += safeDuration;
        stepCountersRef.current[item.currentStepId].totalCalendarProcessingTime += calendarProcessingTime;

        const completedStepId = item.currentStepId;

        releaseProcessingResources(item, currentStep, completedStepId);
        if (currentStep.simulationMode !== 'delay') {
          startQueuedItemsForStep(completedStepId, eventTime);
        }

        if (nextId === 'finished') {
          beginTransmission(item, currentStep.id, 'finished', eventTime, now);
          completeBusinessTransmission(item, 'finished', eventTime + BUSINESS_TRANSMISSION_SIM_MS);
        } else {
          const nextStep = stepMap.get(nextId);

          if (nextStep?.type === 'end') {
            beginTransmission(item, currentStep.id, nextStep.id, eventTime, now);
            completeBusinessTransmission(item, nextStep.id, eventTime + BUSINESS_TRANSMISSION_SIM_MS);
          } else if (nextStep) {
            beginTransmission(item, currentStep.id, nextStep.id, eventTime, now);
            completeBusinessTransmission(item, nextStep.id, eventTime + BUSINESS_TRANSMISSION_SIM_MS);
          }
        }
      };

      for (const step of steps) {
        if (step.type === 'process' && step.simulationMode !== 'delay') {
          startQueuedItemsForStep(step.id, frameStartSimulationMs);
        }
      }

      const itemsInEventOrder = currentItems;

      // Pass 2: Process Items in simulated event order
      for (let i = 0; i < itemsInEventOrder.length; i++) {
        const item = itemsInEventOrder[i];

        if (typeof item.visualTransmissionStartedAtWallMs === 'number' && typeof item.visualTransmissionEndsAtWallMs === 'number') {
          const visualDuration = Math.max(0, item.visualTransmissionEndsAtWallMs - item.visualTransmissionStartedAtWallMs);
          const visualElapsed = Math.max(0, Math.min(now - item.visualTransmissionStartedAtWallMs, visualDuration));
          item.visualTransmissionProgress = visualDuration > 0 ? visualElapsed / visualDuration : 1;

          if (now >= item.visualTransmissionEndsAtWallMs) {
            item.visualPreviousStepId = undefined;
            item.visualTargetStepId = undefined;
            item.visualTransmissionStartedAtWallMs = undefined;
            item.visualTransmissionEndsAtWallMs = undefined;
            item.visualTransmissionProgress = undefined;
          }
        }
        
        // --- HANDLE TERMINAL STATES ---
        if (item.status === 'finished' || item.status === 'cancelled' || item.status === 'error') {
           settleTerminalItem(item);
           continue;
        }

        // --- TRANSMISSION ---
        if (item.status === 'transmitting') {
          const startedAt = item.transmissionStartedAtSimulationMs ?? simulationTimeRef.current;
          const endsAt = item.transmissionEndsAtSimulationMs ?? startedAt;
          const wallStartedAt = item.transmissionStartedAtWallMs ?? now;
          const wallEndsAt = item.transmissionEndsAtWallMs ?? (wallStartedAt + TRANSMISSION_DURATION);
          const transmissionDuration = Math.max(0, wallEndsAt - wallStartedAt);
          const elapsed = Math.max(0, Math.min(now - wallStartedAt, transmissionDuration));
          const arrivalStepId = item.targetStepId;

          item.transmissionProgress = transmissionDuration > 0 ? elapsed / transmissionDuration : 1;

          if (simulationTimeRef.current >= endsAt) {
            completeBusinessTransmission(item, arrivalStepId, endsAt);
          }
          continue;
        }

        const currentStep = stepMap.get(item.currentStepId);
        if (!currentStep || currentStep.type === 'start' || currentStep.type === 'end') continue; 

        // --- QUEUED STATE ---
        if (item.status === 'queued') {
          continue;
        } 
        // --- PROCESSING STATE ---
        else if (item.status === 'processing') {
            const duration = item.requiredDuration || 1000;
            const safeDuration = duration > 0 ? duration : 1000;
          const startedAt = item.processingStartedAtSimulationMs ?? simulationTimeRef.current;
          const endsAt = item.processingEndsAtSimulationMs ?? (startedAt + safeDuration);
          const elapsed = Math.max(0, Math.min(
            getWorkingDurationBetween(resolveStepBusinessCalendar(currentStep, globalBusinessCalendar), config.calendarStartIso, startedAt, simulationTimeRef.current),
            safeDuration
          ));
            const eventTime = endsAt;

          item.progress = Math.max(0, Math.min(1, elapsed / safeDuration));

          if (simulationTimeRef.current >= endsAt) {
            completeProcessingItem(item, currentStep, eventTime, safeDuration);
            }
        }
      }

      let businessEventsProcessed = 0;
      while (businessEventsProcessed < MAX_BUSINESS_EVENTS_PER_TICK) {
        const nextDueItem = itemsRef.current
          .filter((item: WorkItem) => {
            if (item.status === 'transmitting') {
              return (item.transmissionEndsAtSimulationMs ?? Number.POSITIVE_INFINITY) <= simulationTimeRef.current;
            }
            if (item.status === 'processing') {
              return (item.processingEndsAtSimulationMs ?? Number.POSITIVE_INFINITY) <= simulationTimeRef.current;
            }
            return false;
          })
          .sort((a: WorkItem, b: WorkItem) => {
            const aEventTime = a.status === 'processing'
              ? a.processingEndsAtSimulationMs ?? Number.POSITIVE_INFINITY
              : a.transmissionEndsAtSimulationMs ?? Number.POSITIVE_INFINITY;
            const bEventTime = b.status === 'processing'
              ? b.processingEndsAtSimulationMs ?? Number.POSITIVE_INFINITY
              : b.transmissionEndsAtSimulationMs ?? Number.POSITIVE_INFINITY;
            return aEventTime - bEventTime;
          })[0];

        if (!nextDueItem) {
          break;
        }

        if (nextDueItem.status === 'transmitting') {
          completeBusinessTransmission(nextDueItem, nextDueItem.targetStepId, nextDueItem.transmissionEndsAtSimulationMs ?? simulationTimeRef.current);
        } else if (nextDueItem.status === 'processing') {
          const currentStep = stepMap.get(nextDueItem.currentStepId);
          if (!currentStep || currentStep.type === 'start' || currentStep.type === 'end') {
            break;
          }

          const safeDuration = nextDueItem.requiredDuration && nextDueItem.requiredDuration > 0 ? nextDueItem.requiredDuration : 1000;
          completeProcessingItem(nextDueItem, currentStep, nextDueItem.processingEndsAtSimulationMs ?? simulationTimeRef.current, safeDuration);
        }

        businessEventsProcessed++;
      }

      itemsRef.current.forEach(settleTerminalItem);

      for (const item of itemsRef.current) {
        if (item.status !== 'queued') {
          continue;
        }

        const currentStep = stepMap.get(item.currentStepId);
        if (!currentStep || currentStep.type !== 'process' || currentStep.simulationMode === 'delay') {
          continue;
        }

        applyQueueCancellationThrough(item, currentStep, simulationTimeRef.current);
      }

      itemsRef.current.forEach(settleTerminalItem);

      // Cleanup items
      itemsRef.current = itemsRef.current.filter((item: WorkItem) => {
        const isTerminal = item.status === 'finished' || item.status === 'cancelled' || item.status === 'error';
        if (isTerminal && item.finishedAt && (now - item.finishedAt > 2000)) {
            return false;
        }
        return true;
      });

      if (now - lastUiUpdateRef.current >= UI_FRAME_INTERVAL_MS) {
        const stepRuntimeById = new Map<string, { queueLength: number; activeProcessing: number }>();
        steps.forEach((s: ProcessStep) => stepRuntimeById.set(s.id, { queueLength: 0, activeProcessing: 0 }));

        let activeItems = 0;
        let oldestWipAge = 0;
        let oldestQueueAge = 0;
        for (const item of itemsRef.current) {
          if (!['finished', 'error', 'cancelled'].includes(item.status)) {
            activeItems++;
            oldestWipAge = Math.max(0, oldestWipAge, simulationTimeRef.current - item.createdAtSimulationMs);
          }

          const runtime = stepRuntimeById.get(item.currentStepId);
          if (!runtime) {
            continue;
          }

          if (item.status === 'queued') {
            runtime.queueLength++;
            const queuedAt = item.queuedAtSimulationMs ?? item.stepEntryTime ?? item.createdAtSimulationMs;
            oldestQueueAge = Math.max(0, oldestQueueAge, simulationTimeRef.current - queuedAt);
          } else if (item.status === 'processing') {
            runtime.activeProcessing++;
          }
        }

        // Construct Step Stats for UI only when React is about to render.
        const newStepStats: StepStats[] = steps.map((s: ProcessStep) => {
          const counters = stepCountersRef.current[s.id] || createStepCounter();
          const runtime = stepRuntimeById.get(s.id) || { queueLength: 0, activeProcessing: 0 };
          const queueLength = runtime.queueLength;
          const activeProcessing = runtime.activeProcessing;
          const resourceUsage = s.type === 'process' && s.simulationMode !== 'delay'
            ? stepUsage.get(s.id) || 0
            : 0;
          const totalResources = s.type === 'process' && s.simulationMode !== 'delay'
            ? getStepProcessingLimit(s)
            : 0;
          const processingItemsForStep = itemsRef.current.filter((item: WorkItem) => item.currentStepId === s.id && item.status === 'processing');
          const avgResourcesPerItem = processingItemsForStep.length > 0
            ? processingItemsForStep.reduce((sum, item) => sum + getPositiveInteger(item.assignedResourceCount, 1, 1, 1000), 0) / processingItemsForStep.length
            : 0;
          const avgResourceLoadFactor = processingItemsForStep.length > 0
            ? processingItemsForStep.reduce((sum, item) => sum + getPositiveInteger(item.resourceLoadFactor, 1, 1, 1000), 0) / processingItemsForStep.length
            : 0;

          let utilization = 0;
          if (s.type === 'process' && s.simulationMode !== 'delay') {
            const cap = Math.max(1, totalResources || 1);
            const used = resourceUsage;
            utilization = used / cap;
          }

          return {
            stepId: s.id,
            queueLength,
            activeProcessing,
            utilization,
            resourceUsage,
            totalResources,
            avgResourcesPerItem,
            avgResourceLoadFactor,
            avgWaitTime: counters.totalStarted > 0 ? counters.totalWaitTime / counters.totalStarted : 0,
            avgWorkingWaitTime: counters.totalStarted > 0 ? counters.totalWorkingWaitTime / counters.totalStarted : 0,
            avgCompletionTime: counters.processed > 0
              ? s.type === 'end'
                ? counters.totalCompletionTime / counters.processed
                : counters.totalProcessingTime / counters.processed
              : 0,
            totalProcessed: counters.processed,
            totalFailed: counters.failed,
            totalCancelled: counters.cancelled
          };
        });

        lastUiUpdateRef.current = now;
        setItems(buildVisibleItemsForUi(itemsRef.current));
        setStepStats(newStepStats);
        setFlowStats(Object.values(flowCountersRef.current).map(toFlowStats));
        setRouteStats(Object.values(routeCountersRef.current).map(toRouteStats));
        setSimulationTimeMs(simulationTimeRef.current);
        const simulatedMinutesElapsed = simulationTimeRef.current / (60 * 1000);
        const avgThroughput = simulatedMinutesElapsed > 0
          ? statsRef.current.totalItemsFinished / simulatedMinutesElapsed
          : 0;
        const liveResourceCapacity = steps.reduce((sum, step) => (
          step.type === 'process' && step.simulationMode !== 'delay'
            ? sum + getStepProcessingLimit(step)
            : sum
        ), 0);
        const liveResourceUsage = steps.reduce((sum, step) => sum + (stepUsage.get(step.id) || 0), 0);
        const resourceUtilization = liveResourceCapacity > 0 ? liveResourceUsage / liveResourceCapacity : 0;
        const blockedTimeShare = statsRef.current.avgCycleTime > 0
          ? Math.min(1, Math.max(0, statsRef.current.avgNonWorkingDelay / statsRef.current.avgCycleTime))
          : 0;
        setGlobalStats(applyGlobalPercentiles({
          ...statsRef.current,
          avgThroughput,
          activeItems,
          oldestWipAge,
          oldestQueueAge,
          resourceIdleUnits: Math.max(0, liveResourceCapacity - liveResourceUsage),
          resourceUtilization,
          blockedTimeShare,
        }, globalCycleTimeSamplesRef.current));

        const pauseReason = getAutoPauseReason(activeItems);
        if (pauseReason) {
          setAutoPauseReason(pauseReason);
          onAutoPause?.(pauseReason);
          lastTickRef.current = now;
          return;
        }
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [config.isRunning, config.speedMultiplier, config.timeCompression, config.simulationMode, config.steps, config.businessCalendar, config.calendarStartIso, config.demandModifiers, config.autoPause, onAutoPause]);

  return {
    items,
    stepStats,
    flowStats,
    routeStats,
    simulationTimeMs,
    globalStats,
    autoPauseReason,
    resetSimulation
  };
};
