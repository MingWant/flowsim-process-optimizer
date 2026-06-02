
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

const VISUAL_TRANSMISSION_SIM_MS = 1;

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
  
  // Track when the next item should spawn for each start node
  const nextSpawnTimeRef = useRef<Record<string, number>>({});

  // Persistent Counters for Steps (Map<StepId, Counts>)
  // We need this because 'stepStats' state is regenerated every frame
  const stepCountersRef = useRef<Record<string, { processed: number; failed: number; cancelled: number }>>({});

  useEffect(() => {
    stepsRef.current = config.steps;
    
    // Initialize spawn timers for new start nodes if not present
    config.steps.forEach(s => {
        if (s.type === 'start' && nextSpawnTimeRef.current[s.id] === undefined) {
            nextSpawnTimeRef.current[s.id] = 0; // Ready immediately
        }
        // Initialize counters
        if (!stepCountersRef.current[s.id]) {
            stepCountersRef.current[s.id] = { processed: 0, failed: 0, cancelled: 0 };
        }
    });
  }, [config.steps]);

  const resetSimulation = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
    simulationTimeRef.current = 0;
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
        stepCountersRef.current[s.id] = { processed: 0, failed: 0, cancelled: 0 };
    });
  }, [config.steps]);

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

  const calculateNextSpawnDelay = (step: ProcessStep): number => {
    const unitMs = getArrivalUnitMs(step);
    const inputMode = step.arrivalInputMode || 'rate';

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
        return unitMs / safeRate; 
    } else {
        const value = safeNumber(step.arrivalRate, inputMode === 'interval' ? 1 : 0.5);

        if (inputMode === 'interval') {
          return Math.max(MIN_ARRIVAL_RATE, value) * unitMs;
        }

        const safeRate = Math.max(MIN_ARRIVAL_RATE, value);
        return unitMs / safeRate;
    }
  };

  const calculateProcessingDuration = (step: ProcessStep, item: WorkItem): number => {
      const fixedUnitMultiplier = TIME_UNIT_TO_MS[step.processingTimeUnit || 'ms'];
      const rangeUnitMultiplier = TIME_UNIT_TO_MS[step.rangeTimeUnit || step.processingTimeUnit || 'ms'];

    // 1. Check Source Rule Override (Fixed Mode only usually, but applies generally)
    if (step.randomnessMode === 'fixed' && item.previousStepId && step.sourceProcessingTimes && step.sourceProcessingTimes[item.previousStepId]) {
        const base = safeNumber(step.sourceProcessingTimes[item.previousStepId], 1000) * fixedUnitMultiplier;
         const speedNoise = 1 + (Math.random() * 2 - 1) * safeNumber(step.variance, 0);
         return Math.max(100, base * speedNoise);
    }

    // 2. Range Mode
    if (step.randomnessMode === 'range') {
      const min = safeNumber(step.minProcessingTime, 500) * rangeUnitMultiplier;
      const max = safeNumber(step.maxProcessingTime, 2000) * rangeUnitMultiplier;
        // Independent random number for this call
        return min + Math.random() * (max - min);
    }

    // 3. Default Fixed Mode
    const base = safeNumber(step.processingTime, 1000) * fixedUnitMultiplier;
    const speedNoise = 1 + (Math.random() * 2 - 1) * safeNumber(step.variance, 0);
    return Math.max(100, base * speedNoise);
  };

  const beginTransmission = (
    item: WorkItem,
    fromStepId: string,
    toStepId: string | 'finished',
    currentSimulationMs: number
  ) => {
    item.previousStepId = fromStepId;
    item.targetStepId = toStepId;
    item.status = 'transmitting';
    item.transmissionProgress = 0;
    item.transmissionStartedAtSimulationMs = currentSimulationMs;
    item.transmissionEndsAtSimulationMs = currentSimulationMs + VISUAL_TRANSMISSION_SIM_MS;
    item.totalTransmissionTime += VISUAL_TRANSMISSION_SIM_MS;
  };

  const beginProcessing = (
    item: WorkItem,
    step: ProcessStep,
    currentSimulationMs: number
  ) => {
    const duration = calculateProcessingDuration(step, item);
    const safeDuration = isNaN(duration) || duration < 100 ? 1000 : duration;

    item.status = 'processing';
    item.progress = 0;
    item.requiredDuration = safeDuration;
    item.processingStartedAtSimulationMs = currentSimulationMs;
    item.processingEndsAtSimulationMs = currentSimulationMs + safeDuration;
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
      simulationTimeRef.current += dt;

      const steps = stepsRef.current;
      const stepMap = new Map(steps.map(s => [s.id, s]));

      // 1. Arrival Logic (Timer Based)
      // We reduce the 'time until next spawn' by dt
      for (const startNode of steps.filter(s => s.type === 'start')) {
          // Initialize if missing
          if (nextSpawnTimeRef.current[startNode.id] === undefined) {
             nextSpawnTimeRef.current[startNode.id] = 0; 
          }
          
          let remaining = nextSpawnTimeRef.current[startNode.id];
          if (isNaN(remaining)) remaining = 0;
          
          remaining -= dt;

          if (remaining <= 0) {
              // SPAWN
              // Determine immediate target
              let firstTargetId: string | 'finished' = 'finished';
              if (startNode.connections.length > 0) {
                  firstTargetId = getNextStepId(startNode);
              }

              if (firstTargetId !== 'finished') {
                  const firstTarget = stepMap.get(firstTargetId);
                  const newItem: WorkItem = {
                      id: `item-${statsRef.current.totalItemsCreated + 1}`,
                    currentStepId: firstTargetId,
                    targetStepId: firstTargetId,
                    status: firstTarget?.type === 'end' ? 'finished' : 'queued',
                      previousStepId: startNode.id,
                      progress: 0,
                      transmissionProgress: 0,
                      createdAt: now, // Wall clock for UI creation
                      createdAtSimulationMs: simulationTimeRef.current,
                        completedAtSimulationMs: undefined,
                      totalTransmissionTime: 0,
                      totalWaitTime: 0,
                      totalProcessingTime: 0,
                      stepEntryTime: now,
                  };

                  beginTransmission(newItem, startNode.id, firstTargetId, simulationTimeRef.current);

                  if (firstTarget?.type === 'process' && firstTarget.simulationMode === 'delay') {
                    beginProcessing(newItem, firstTarget, simulationTimeRef.current);
                  }

                  itemsRef.current.push(newItem);
                  statsRef.current.totalItemsCreated++;
                  
                  // Increment Start Node "Processed" count
                  if (stepCountersRef.current[startNode.id]) {
                      stepCountersRef.current[startNode.id].processed++;
                  }
              }

              // Reset Timer
              remaining = calculateNextSpawnDelay(startNode);
          }
          
          nextSpawnTimeRef.current[startNode.id] = remaining;
      }

      // 2. Resource Tracking Setup
      const currentItems = itemsRef.current;
      const stepUsage = new Map<string, number>();
      steps.forEach(s => stepUsage.set(s.id, 0));

      // Pass 1: Count currently processing items
      for (const item of currentItems) {
        if (item.status === 'processing' && item.currentStepId !== 'finished') {
          const count = stepUsage.get(item.currentStepId) || 0;
          stepUsage.set(item.currentStepId, count + 1);
        }
      }

      // Pass 2: Process Items
      for (let i = 0; i < currentItems.length; i++) {
        const item = currentItems[i];
        
        // --- HANDLE TERMINAL STATES ---
        if (item.status === 'finished' || item.status === 'cancelled' || item.status === 'error') {
           if (!item.finishedAt) {
             item.finishedAt = now;
             
             if (item.status === 'finished') {
                statsRef.current.totalItemsFinished++;
                const completedAtSimulationMs = item.completedAtSimulationMs ?? simulationTimeRef.current;
                const cycleTime = Math.max(
                  0,
                  completedAtSimulationMs - item.createdAtSimulationMs - item.totalTransmissionTime
                );
                statsRef.current.avgCycleTime = 
                  ((statsRef.current.avgCycleTime * (statsRef.current.totalItemsFinished - 1)) + cycleTime) / statsRef.current.totalItemsFinished;
                
                // Track stats for End Nodes
                if (item.currentStepId && stepMap.get(item.currentStepId)?.type === 'end') {
                    if (!stepCountersRef.current[item.currentStepId]) {
                        stepCountersRef.current[item.currentStepId] = { processed: 0, failed: 0, cancelled: 0 };
                    }
                    stepCountersRef.current[item.currentStepId].processed++;
                }
             }
           }
           continue;
        }

        // --- TRANSMISSION ---
        if (item.status === 'transmitting') {
          const startedAt = item.transmissionStartedAtSimulationMs ?? simulationTimeRef.current;
          const endsAt = item.transmissionEndsAtSimulationMs ?? startedAt;
          const transmissionDuration = Math.max(0, endsAt - startedAt);
          const elapsed = Math.max(0, Math.min(simulationTimeRef.current - startedAt, transmissionDuration));

          item.transmissionProgress = transmissionDuration > 0 ? elapsed / transmissionDuration : 1;

          if (simulationTimeRef.current >= endsAt) {
            item.transmissionProgress = 1;
            item.targetStepId = undefined;
            item.transmissionStartedAtSimulationMs = undefined;
            item.transmissionEndsAtSimulationMs = undefined;

            if (item.status === 'transmitting' && item.currentStepId === 'finished') {
              item.completedAtSimulationMs = endsAt;
              item.status = 'finished';
            }
            }
            continue;
        }

        const currentStep = stepMap.get(item.currentStepId);
        if (!currentStep || currentStep.type === 'start' || currentStep.type === 'end') continue; 

        // --- QUEUED STATE ---
        if (item.status === 'queued') {
            item.totalWaitTime += dt;
            
            // EXCEPTION: Cancellation
            if (currentStep.cancellationProbability > 0) {
                const cancelChance = currentStep.cancellationProbability * (dt / 1000);
                if (Math.random() < cancelChance) {
                    item.status = 'cancelled';
                    statsRef.current.totalItemsCancelled++;
                    if (!stepCountersRef.current[item.currentStepId]) stepCountersRef.current[item.currentStepId] = { processed: 0, failed: 0, cancelled: 0 };
                    stepCountersRef.current[item.currentStepId].cancelled++;
                    continue; 
                }
            }

            const currentUsage = stepUsage.get(item.currentStepId) || 0;
            if (currentStep.simulationMode === 'delay' || currentUsage < currentStep.capacity) {
                beginProcessing(item, currentStep, simulationTimeRef.current);
                
              if (currentStep.simulationMode !== 'delay') {
                stepUsage.set(item.currentStepId, currentUsage + 1);
              }
            }
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
            item.totalProcessingTime = (item.totalProcessingTime || 0) - elapsed + Math.min(elapsed, safeDuration);

          if (simulationTimeRef.current >= endsAt) {
                item.progress = 0; 
            item.processingStartedAtSimulationMs = undefined;
            item.processingEndsAtSimulationMs = undefined;
                
                // EXCEPTION: Failure
                const failChance = safeNumber(currentStep.failureProbability, 0);
                if (Math.random() < failChance) {
                    item.status = 'error';
                    statsRef.current.totalItemsFailed++;
                    if (!stepCountersRef.current[item.currentStepId]) stepCountersRef.current[item.currentStepId] = { processed: 0, failed: 0, cancelled: 0 };
                    stepCountersRef.current[item.currentStepId].failed++;

                    if (currentStep.simulationMode !== 'delay') {
                      const currentUsage = stepUsage.get(item.currentStepId) || 0;
                      stepUsage.set(item.currentStepId, Math.max(0, currentUsage - 1));
                    }
                    continue;
                }

                // Normal Success
                const nextId = getNextStepId(currentStep);
                
                // Increment Processed Count for this step
                if (!stepCountersRef.current[item.currentStepId]) stepCountersRef.current[item.currentStepId] = { processed: 0, failed: 0, cancelled: 0 };
                stepCountersRef.current[item.currentStepId].processed++;

                if (nextId === 'finished') {
                  item.currentStepId = 'finished';
                  beginTransmission(item, currentStep.id, 'finished', eventTime);
                } else {
                  const nextStep = stepMap.get(nextId);

                  if (nextStep?.type === 'end') {
                    item.currentStepId = 'finished';
                    beginTransmission(item, currentStep.id, nextStep.id, eventTime);
                  } else if (nextStep) {
                    item.currentStepId = nextStep.id;
                    item.stepEntryTime = now;
                    beginTransmission(item, currentStep.id, nextStep.id, eventTime);

                    if (nextStep.simulationMode === 'delay') {
                      beginProcessing(item, nextStep, eventTime);
                    } else {
                      item.status = 'queued';
                    }
                  }
                }
                
                if (currentStep.simulationMode !== 'delay') {
                  const currentUsage = stepUsage.get(item.currentStepId) || 0;
                  stepUsage.set(item.currentStepId, Math.max(0, currentUsage - 1));
                }
            }
        }
      }

      // Cleanup items
      itemsRef.current = itemsRef.current.filter(item => {
        const isTerminal = item.status === 'finished' || item.status === 'cancelled' || item.status === 'error';
        if (isTerminal && item.finishedAt && (now - item.finishedAt > 2000)) {
            return false;
        }
        return true;
      });

      // Construct Step Stats for UI
      const newStepStats: StepStats[] = steps.map(s => {
          const counters = stepCountersRef.current[s.id] || { processed: 0, failed: 0, cancelled: 0 };
          const stepActiveItems = itemsRef.current.filter(i => i.currentStepId === s.id);
          const queueLength = stepActiveItems.filter(i => i.status === 'queued').length;
          const activeProcessing = stepActiveItems.filter(i => i.status === 'processing').length;
          
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
              avgWaitTime: 0, // Simplified for now
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
        activeItems: itemsRef.current.filter(i => !['finished', 'error', 'cancelled'].includes(i.status)).length,
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [config.isRunning, config.speedMultiplier, config.timeCompression, config.steps]);

  return {
    items,
    stepStats,
    simulationTimeMs,
    globalStats,
    resetSimulation
  };
};
