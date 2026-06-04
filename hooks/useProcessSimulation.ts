
import { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessStep, WorkItem, SimulationConfig, StepStats, SimulationStats } from '../types';

const TRANSMISSION_DURATION = 900; // visual ms to travel between nodes
const TIME_UNIT_TO_MS = {
  ms: 1,
  s: 1000,
  min: 60 * 1000,
  h: 60 * 60 * 1000,
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

const BUSINESS_TRANSMISSION_SIM_MS = 0;

// Generate a normally distributed random number using Box-Muller transform
// Returns a value with mean=0 and standard deviation=1
const generateNormalRandom = (): number => {
  const u1 = Math.max(Number.EPSILON, Math.random());
  const u2 = Math.random();
  // Box-Muller transform
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const getSimulationSignature = (steps: ProcessStep[]) => JSON.stringify(steps.map((step) => ({
  id: step.id,
  type: step.type,
  randomnessMode: step.randomnessMode,
  simulationMode: step.simulationMode,
  capacity: step.capacity,
  processingTime: step.processingTime,
  processingTimeUnit: step.processingTimeUnit,
  variance: step.variance,
  minProcessingTime: step.minProcessingTime,
  maxProcessingTime: step.maxProcessingTime,
  rangeTimeUnit: step.rangeTimeUnit,
  arrivalInputMode: step.arrivalInputMode,
  arrivalUnit: step.arrivalUnit,
  arrivalRate: step.arrivalRate,
  minArrivalRate: step.minArrivalRate,
  maxArrivalRate: step.maxArrivalRate,
  arrivalBatchSize: step.arrivalBatchSize,
  failureProbability: step.failureProbability,
  cancellationProbability: step.cancellationProbability,
  connections: step.connections,
  sourceProcessingTimes: step.sourceProcessingTimes,
})));

export const useProcessSimulation = (config: SimulationConfig) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [stepStats, setStepStats] = useState<StepStats[]>([]);
  const [simulationTimeMs, setSimulationTimeMs] = useState(0);
  const [globalStats, setGlobalStats] = useState<SimulationStats>({
    totalItemsCreated: 0,
    totalItemsFinished: 0,
    totalItemsCancelled: 0,
    totalItemsFailed: 0,
    avgCycleTime: 0,
    avgThroughput: 0,
    activeItems: 0,
  });

  const lastTickRef = useRef<number>(Date.now());
  const simulationTimeRef = useRef(0);
  const itemsRef = useRef<WorkItem[]>([]);
  const statsRef = useRef<SimulationStats>({ ...globalStats });
  const stepsRef = useRef<ProcessStep[]>(config.steps);
  const simulationSignatureRef = useRef(getSimulationSignature(config.steps));
  
  // Track the absolute simulated timestamp when the next item should spawn for each start node
  const nextSpawnTimeRef = useRef<Record<string, number>>({});

  // Persistent Counters for Steps (Map<StepId, Counts>)
  // We need this because 'stepStats' state is regenerated every frame
  const stepCountersRef = useRef<Record<string, { processed: number; failed: number; cancelled: number; totalCompletionTime: number; totalProcessingTime: number; totalWaitTime: number; totalStarted: number }>>({});

  const resetSimulation = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
    simulationTimeRef.current = 0;
    lastTickRef.current = Date.now();
    setSimulationTimeMs(0);
    const initialStats = {
      totalItemsCreated: 0,
      totalItemsFinished: 0,
      totalItemsCancelled: 0,
      totalItemsFailed: 0,
      avgCycleTime: 0,
      avgThroughput: 0,
      activeItems: 0,
    };
    statsRef.current = initialStats;
    setGlobalStats(initialStats);
    setStepStats([]);
    nextSpawnTimeRef.current = {};
    stepCountersRef.current = {}; 
    config.steps.forEach(s => {
      stepCountersRef.current[s.id] = { processed: 0, failed: 0, cancelled: 0, totalCompletionTime: 0, totalProcessingTime: 0, totalWaitTime: 0, totalStarted: 0 };
    });
  }, [config.steps]);

  useEffect(() => {
    const nextSignature = getSimulationSignature(config.steps);
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
        // Initialize counters
        if (!stepCountersRef.current[s.id]) {
          stepCountersRef.current[s.id] = { processed: 0, failed: 0, cancelled: 0, totalCompletionTime: 0, totalProcessingTime: 0, totalWaitTime: 0, totalStarted: 0 };
        }
    });
  }, [config.steps, resetSimulation]);

  const getNextStepId = (currentStep: ProcessStep): string | 'finished' => {
    if (!currentStep.connections || currentStep.connections.length === 0) {
      return 'finished';
    }

    const roll = Math.random();
    let cumulative = 0;
    
    const totalProb = currentStep.connections.reduce((sum, c) => sum + c.probability, 0);
    
    for (const conn of currentStep.connections) {
      cumulative += (conn.probability / (totalProb || 1));
      if (roll <= cumulative) {
        return conn.targetId;
      }
    }
    
    return currentStep.connections[currentStep.connections.length - 1].targetId;
  };

  const safeNumber = (val: number | undefined, defaultVal: number): number => {
      if (typeof val === 'number' && !isNaN(val) && isFinite(val) && val >= 0) {
          return val;
      }
      return defaultVal;
  };

  const getArrivalUnitMs = (step: ProcessStep) => TIME_UNIT_TO_MS[step.arrivalUnit || 's'];
  const getArrivalBatchSize = (step: ProcessStep) => Math.max(1, Math.min(1000, Math.round(safeNumber(step.arrivalBatchSize, 1))));

  const calculateNextSpawnDelay = (step: ProcessStep): number => {
    const unitMs = getArrivalUnitMs(step);
    const inputMode = step.arrivalInputMode || 'rate';
    const batchSize = getArrivalBatchSize(step);

    if (step.randomnessMode === 'range') {
        const minValue = safeNumber(step.minArrivalRate, inputMode === 'interval' ? 1 : 0.1);
        const maxValue = safeNumber(step.maxArrivalRate, inputMode === 'interval' ? 3 : 1.0);

        if (inputMode === 'interval') {
          const minInterval = Math.max(MIN_ARRIVAL_RATE, Math.min(minValue, maxValue));
          const maxInterval = Math.max(MIN_ARRIVAL_RATE, Math.max(minValue, maxValue));
          const randomInterval = minInterval + Math.random() * (maxInterval - minInterval);
          return randomInterval * unitMs;
        }

        const randomRate = minValue + Math.random() * (maxValue - minValue);
        const safeRate = Math.max(MIN_ARRIVAL_RATE, randomRate);
        return (unitMs * batchSize) / safeRate; 
    } else {
        const value = safeNumber(step.arrivalRate, inputMode === 'interval' ? 1 : 0.5);

        if (inputMode === 'interval') {
          return Math.max(MIN_ARRIVAL_RATE, value) * unitMs;
        }

        const safeRate = Math.max(MIN_ARRIVAL_RATE, value);
        return (unitMs * batchSize) / safeRate;
    }
  };

  const calculateProcessingDuration = (step: ProcessStep, item: WorkItem): number => {
      const fixedUnitMultiplier = TIME_UNIT_TO_MS[step.processingTimeUnit || 'ms'];
      const rangeUnitMultiplier = TIME_UNIT_TO_MS[step.rangeTimeUnit || step.processingTimeUnit || 'ms'];
      const isDelayMode = step.simulationMode === 'delay';
      const simulationMode = config.simulationMode || 'realistic';

    // 1. Check Source Rule Override (Fixed Mode only usually, but applies generally)
    if (!isDelayMode && step.randomnessMode === 'fixed' && item.previousStepId && step.sourceProcessingTimes && step.sourceProcessingTimes[item.previousStepId]) {
        const baseValue = safeNumber(step.sourceProcessingTimes[item.previousStepId], 1000);
        const baseMs = baseValue * fixedUnitMultiplier;
        // Boundary check: prevent overflow
        if (baseMs > MAX_SAFE_DURATION_MS) {
          console.warn(`Processing time exceeds safe limit: ${baseValue} ${step.processingTimeUnit}`);
          return MAX_SAFE_DURATION_MS;
        }
        const variance = safeNumber(step.variance, 0);
        if (variance > 0) {
          if (simulationMode === 'worst-case') {
            // Worst-case: uniform distribution, can produce extreme values
            const speedNoise = 1 + (Math.random() * 2 - 1) * variance;
            return Math.max(MIN_PROCESSING_DURATION_MS, baseMs * speedNoise);
          } else {
            // Realistic: normal distribution with bounds
            const normalRandom = generateNormalRandom();
            const duration = baseMs + baseMs * variance * normalRandom;
            // Clamp to reasonable bounds: not less than 20% of base, not more than 3x base
            return Math.max(baseMs * 0.2, Math.min(baseMs * 3, duration));
          }
        }
        return Math.max(MIN_PROCESSING_DURATION_MS, baseMs);
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
      return min + Math.random() * (max - min);
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
      return Math.max(MIN_PROCESSING_DURATION_MS, baseMs);
    }

    const variance = safeNumber(step.variance, 0);
    if (variance > 0) {
      if (simulationMode === 'worst-case') {
        // Worst-case: uniform distribution, can produce extreme values
        const speedNoise = 1 + (Math.random() * 2 - 1) * variance;
        return Math.max(MIN_PROCESSING_DURATION_MS, baseMs * speedNoise);
      } else {
        // Realistic: normal distribution with bounds
        const normalRandom = generateNormalRandom();
        const duration = baseMs + baseMs * variance * normalRandom;
        // Clamp to reasonable bounds: not less than 20% of base, not more than 3x base
        return Math.max(baseMs * 0.2, Math.min(baseMs * 3, duration));
      }
    }
    return Math.max(MIN_PROCESSING_DURATION_MS, baseMs);
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
    const queuedAtSimulationMs = item.queuedAtSimulationMs;
    const waitTime = typeof queuedAtSimulationMs === 'number'
      ? Math.max(0, currentSimulationMs - queuedAtSimulationMs)
      : 0;

    item.totalWaitTime += waitTime;
    if (!stepCountersRef.current[step.id]) {
      stepCountersRef.current[step.id] = { processed: 0, failed: 0, cancelled: 0, totalCompletionTime: 0, totalProcessingTime: 0, totalWaitTime: 0, totalStarted: 0 };
    }
    stepCountersRef.current[step.id].totalWaitTime += waitTime;
    stepCountersRef.current[step.id].totalStarted++;

    const duration = calculateProcessingDuration(step, item);
    const safeDuration = Number.isFinite(duration) ? Math.max(MIN_PROCESSING_DURATION_MS, duration) : 1000;

    item.status = 'processing';
    item.progress = 0;
    item.requiredDuration = safeDuration;
    item.queuedAtSimulationMs = undefined;
    item.queueCancellationCheckedAtSimulationMs = undefined;
    item.processingStartedAtSimulationMs = currentSimulationMs;
    item.processingEndsAtSimulationMs = currentSimulationMs + safeDuration;
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

        // 1. Arrival Logic (Absolute Simulated Event Time)
      for (const startNode of steps.filter((s: ProcessStep) => s.type === 'start')) {
          // Initialize if missing
          if (nextSpawnTimeRef.current[startNode.id] === undefined) {
             nextSpawnTimeRef.current[startNode.id] = 0; 
          }
          
          let nextSpawnAt = nextSpawnTimeRef.current[startNode.id];
          if (isNaN(nextSpawnAt)) nextSpawnAt = frameStartSimulationMs;
          let spawnedThisTick = 0;
          
            while (nextSpawnAt <= simulationTimeRef.current && spawnedThisTick < MAX_SPAWNS_PER_START_PER_TICK) {
              const batchSize = getArrivalBatchSize(startNode);
              const simulationMode = config.simulationMode || 'realistic';

              for (let batchIndex = 0; batchIndex < batchSize; batchIndex++) {
                // SPAWN
                // Determine immediate target independently for each item
                let firstTargetId: string | 'finished' = 'finished';
                if (startNode.connections.length > 0) {
                  firstTargetId = getNextStepId(startNode);
                }

                if (firstTargetId !== 'finished') {
                  // Calculate spawn time based on simulation mode
                  let itemSpawnTime: number;
                  if (simulationMode === 'worst-case') {
                    // Worst-case: all items arrive at exactly the same time (instant surge)
                    itemSpawnTime = nextSpawnAt;
                  } else {
                    // Realistic: small time offset to simulate physical arrival sequence
                    // Each item arrives 0.1ms after the previous one in the batch
                    itemSpawnTime = nextSpawnAt + (batchIndex * 0.1);
                  }

                  const newItem: WorkItem = {
                    id: `item-${statsRef.current.totalItemsCreated + 1}`,
                  currentStepId: startNode.id,
                  targetStepId: firstTargetId,
                  status: 'transmitting',
                    previousStepId: startNode.id,
                    progress: 0,
                    transmissionProgress: 0,
                    createdAt: now, // Wall clock for UI creation
                    createdAtSimulationMs: itemSpawnTime,
                    completedAtSimulationMs: undefined,
                    totalTransmissionTime: 0,
                    totalWaitTime: 0,
                    totalProcessingTime: 0,
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
                      
                  // Increment Start Node "Processed" count
                  if (stepCountersRef.current[startNode.id]) {
                    stepCountersRef.current[startNode.id].processed++;
                  }
                }
              }

                  nextSpawnAt += calculateNextSpawnDelay(startNode);
                    spawnedThisTick++;
          }
          
                nextSpawnTimeRef.current[startNode.id] = nextSpawnAt;
      }

      // 2. Resource Tracking Setup
      const currentItems: WorkItem[] = itemsRef.current;
      const stepUsage = new Map<string, number>();
      steps.forEach((s: ProcessStep) => stepUsage.set(s.id, 0));

      // Pass 1: Count currently processing items
      for (const item of currentItems) {
        if (item.status === 'processing' && item.currentStepId !== 'finished') {
          const count = stepUsage.get(item.currentStepId) || 0;
          stepUsage.set(item.currentStepId, count + 1);
        }
      }

      const cancelQueuedItem = (item: WorkItem, step: ProcessStep) => {
        item.status = 'cancelled';
        item.queueCancellationCheckedAtSimulationMs = undefined;
        statsRef.current.totalItemsCancelled++;
        if (!stepCountersRef.current[item.currentStepId]) stepCountersRef.current[item.currentStepId] = { processed: 0, failed: 0, cancelled: 0, totalCompletionTime: 0, totalProcessingTime: 0, totalWaitTime: 0, totalStarted: 0 };
        stepCountersRef.current[item.currentStepId].cancelled++;
      };

      const applyQueueCancellationThrough = (item: WorkItem, step: ProcessStep, throughSimulationMs: number): boolean => {
        if (item.status !== 'queued' || step.cancellationProbability <= 0) {
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

        if (simulationMode === 'worst-case') {
          // Worst-case: linear model, reaches 100% quickly for stress testing
          cancelChance = Math.min(1, step.cancellationProbability * (exposureMs / 1000));
        } else {
          // Realistic: exponential distribution (Poisson process)
          cancelChance = 1 - Math.exp(-step.cancellationProbability * (exposureMs / 1000));
        }

        item.queueCancellationCheckedAtSimulationMs = throughSimulationMs;
        if (Math.random() < cancelChance) {
          cancelQueuedItem(item, step);
          return true;
        }

        return false;
      };

      const startQueuedItemsForStep = (stepId: string, availableAtSimulationMs: number) => {
        const step = stepMap.get(stepId);
        if (!step || step.type !== 'process' || step.simulationMode === 'delay') {
          return;
        }

        const capacity = Math.max(1, step.capacity || 1);
        let currentUsage = stepUsage.get(stepId) || 0;
        if (currentUsage >= capacity) {
          return;
        }

        const queuedItems = itemsRef.current
          .filter((queueItem: WorkItem) => queueItem.currentStepId === stepId && queueItem.status === 'queued')
          .sort((a: WorkItem, b: WorkItem) => {
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

          beginProcessing(queuedItem, step, startAt);
          currentUsage++;
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
          statsRef.current.avgCycleTime =
            ((statsRef.current.avgCycleTime * (statsRef.current.totalItemsFinished - 1)) + cycleTime) / statsRef.current.totalItemsFinished;

          // Track stats for End Nodes
          if (item.currentStepId && stepMap.get(item.currentStepId)?.type === 'end') {
            if (!stepCountersRef.current[item.currentStepId]) {
              stepCountersRef.current[item.currentStepId] = { processed: 0, failed: 0, cancelled: 0, totalCompletionTime: 0, totalProcessingTime: 0, totalWaitTime: 0, totalStarted: 0 };
            }
            stepCountersRef.current[item.currentStepId].processed++;
            stepCountersRef.current[item.currentStepId].totalCompletionTime += cycleTime;
          }
        }
      };

      const completeProcessingItem = (item: WorkItem, currentStep: ProcessStep, eventTime: number, safeDuration: number) => {
        item.progress = 0;
        item.processingStartedAtSimulationMs = undefined;
        item.processingEndsAtSimulationMs = undefined;
        item.totalProcessingTime += safeDuration;

        // EXCEPTION: Failure
        const failChance = Math.min(1, safeNumber(currentStep.failureProbability, 0));
        if (Math.random() < failChance) {
          item.status = 'error';
          statsRef.current.totalItemsFailed++;
          if (!stepCountersRef.current[item.currentStepId]) stepCountersRef.current[item.currentStepId] = { processed: 0, failed: 0, cancelled: 0, totalCompletionTime: 0, totalProcessingTime: 0, totalWaitTime: 0, totalStarted: 0 };
          stepCountersRef.current[item.currentStepId].failed++;

          if (currentStep.simulationMode !== 'delay') {
            const currentUsage = stepUsage.get(item.currentStepId) || 0;
            stepUsage.set(item.currentStepId, Math.max(0, currentUsage - 1));
            startQueuedItemsForStep(item.currentStepId, eventTime);
          }
          return;
        }

        // Normal Success
        const nextId = getNextStepId(currentStep);

        // Increment Processed Count for this step
        if (!stepCountersRef.current[item.currentStepId]) stepCountersRef.current[item.currentStepId] = { processed: 0, failed: 0, cancelled: 0, totalCompletionTime: 0, totalProcessingTime: 0, totalWaitTime: 0, totalStarted: 0 };
        stepCountersRef.current[item.currentStepId].processed++;
        stepCountersRef.current[item.currentStepId].totalProcessingTime += safeDuration;

        const completedStepId = item.currentStepId;

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

        if (currentStep.simulationMode !== 'delay') {
          const currentUsage = stepUsage.get(completedStepId) || 0;
          stepUsage.set(completedStepId, Math.max(0, currentUsage - 1));
          startQueuedItemsForStep(completedStepId, eventTime);
        }
      };

      for (const step of steps) {
        if (step.type === 'process' && step.simulationMode !== 'delay') {
          startQueuedItemsForStep(step.id, frameStartSimulationMs);
        }
      }

      const itemsInEventOrder = [...currentItems].sort((a: WorkItem, b: WorkItem) => {
        const getEventTime = (item: WorkItem) => {
          if (item.status === 'processing') {
            return item.processingEndsAtSimulationMs ?? Number.POSITIVE_INFINITY;
          }
          if (item.status === 'transmitting') {
            return item.transmissionEndsAtSimulationMs ?? Number.POSITIVE_INFINITY;
          }
          if (item.status === 'queued') {
            return item.queuedAtSimulationMs ?? item.stepEntryTime ?? Number.POSITIVE_INFINITY;
          }
          return Number.POSITIVE_INFINITY;
        };

        return getEventTime(a) - getEventTime(b);
      });

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
          const elapsed = Math.max(0, Math.min(simulationTimeRef.current - startedAt, safeDuration));
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

      // Construct Step Stats for UI
        const newStepStats: StepStats[] = steps.map((s: ProcessStep) => {
          const counters = stepCountersRef.current[s.id] || { processed: 0, failed: 0, cancelled: 0, totalCompletionTime: 0, totalProcessingTime: 0, totalWaitTime: 0, totalStarted: 0 };
          const stepActiveItems = itemsRef.current.filter((i: WorkItem) => i.currentStepId === s.id);
          const queueLength = stepActiveItems.filter((i: WorkItem) => i.status === 'queued').length;
          const activeProcessing = stepActiveItems.filter((i: WorkItem) => i.status === 'processing').length;
          
          let utilization = 0;
            if (s.type === 'process' && s.simulationMode !== 'delay') {
              const cap = Math.max(1, s.capacity || 1);
              const used = stepUsage.get(s.id) || 0;
              utilization = used / cap;
          }

          return {
              stepId: s.id,
              queueLength,
              activeProcessing,
              utilization,
              avgWaitTime: counters.totalStarted > 0 ? counters.totalWaitTime / counters.totalStarted : 0,
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

      setItems([...itemsRef.current]);
      setStepStats(newStepStats);
      setSimulationTimeMs(simulationTimeRef.current);
      const simulatedMinutesElapsed = simulationTimeRef.current / (60 * 1000);
      const avgThroughput = simulatedMinutesElapsed > 0
        ? statsRef.current.totalItemsFinished / simulatedMinutesElapsed
        : 0;
      setGlobalStats({
        ...statsRef.current,
        avgThroughput,
        activeItems: itemsRef.current.filter((i: WorkItem) => !['finished', 'error', 'cancelled'].includes(i.status)).length,
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [config.isRunning, config.speedMultiplier, config.timeCompression, config.simulationMode, config.steps]);

  return {
    items,
    stepStats,
    simulationTimeMs,
    globalStats,
    resetSimulation
  };
};
