
import { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessStep, WorkItem, SimulationConfig, StepStats, SimulationStats } from '../types';

const TRANSMISSION_DURATION = 1000; // ms to travel between nodes

export const useProcessSimulation = (config: SimulationConfig) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [stepStats, setStepStats] = useState<StepStats[]>([]);
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

  const calculateNextSpawnDelay = (step: ProcessStep): number => {
    if (step.randomnessMode === 'range') {
        const minRate = safeNumber(step.minArrivalRate, 0.1);
        const maxRate = safeNumber(step.maxArrivalRate, 1.0);
        // Random rate between min and max
        const randomRate = minRate + Math.random() * (maxRate - minRate);
        const safeRate = Math.max(0.001, randomRate);
        return 1000 / safeRate; 
    } else {
        // Fixed
        const rate = safeNumber(step.arrivalRate, 0.5);
        const safeRate = Math.max(0.001, rate);
        return 1000 / safeRate;
    }
  };

  const calculateProcessingDuration = (step: ProcessStep, item: WorkItem): number => {
    // 1. Check Source Rule Override (Fixed Mode only usually, but applies generally)
    if (step.randomnessMode === 'fixed' && item.previousStepId && step.sourceProcessingTimes && step.sourceProcessingTimes[item.previousStepId]) {
         const base = safeNumber(step.sourceProcessingTimes[item.previousStepId], 1000);
         const speedNoise = 1 + (Math.random() * 2 - 1) * safeNumber(step.variance, 0);
         return Math.max(100, base * speedNoise);
    }

    // 2. Range Mode
    if (step.randomnessMode === 'range') {
        const min = safeNumber(step.minProcessingTime, 500);
        const max = safeNumber(step.maxProcessingTime, 2000);
        // Independent random number for this call
        return min + Math.random() * (max - min);
    }

    // 3. Default Fixed Mode
    const base = safeNumber(step.processingTime, 1000);
    const speedNoise = 1 + (Math.random() * 2 - 1) * safeNumber(step.variance, 0);
    return Math.max(100, base * speedNoise);
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
      const dt = Math.min(rawDt, 100) * config.speedMultiplier; 
      lastTickRef.current = now;

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
                  const newItem: WorkItem = {
                      id: `item-${statsRef.current.totalItemsCreated + 1}`,
                      currentStepId: startNode.id,
                      targetStepId: firstTargetId,
                      status: 'transmitting', 
                      previousStepId: startNode.id,
                      progress: 0,
                      transmissionProgress: 0,
                      createdAt: now, // Wall clock for UI creation
                      totalWaitTime: 0,
                      totalProcessingTime: 0,
                      stepEntryTime: now,
                  };
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
                const cycleTime = now - item.createdAt;
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
            const increment = dt / TRANSMISSION_DURATION;
            item.transmissionProgress += increment;
            
            if (item.transmissionProgress >= 1) {
                if (item.targetStepId && stepMap.has(item.targetStepId)) {
                    const targetStep = stepMap.get(item.targetStepId);
                    
                    if (targetStep?.type === 'end') {
                        // Reached an end node
                        item.previousStepId = item.currentStepId;
                        item.currentStepId = targetStep.id;
                        item.status = 'finished'; // Mark finished immediately
                    } else {
                        // Reached a process node
                        item.previousStepId = item.currentStepId; 
                        item.currentStepId = item.targetStepId;
                        item.status = 'queued';
                        item.stepEntryTime = now;
                        item.targetStepId = undefined;
                        item.requiredDuration = undefined; 
                    }
                } else {
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
            if (currentUsage < currentStep.capacity) {
                item.status = 'processing';
                item.progress = 0;
                
                const d = calculateProcessingDuration(currentStep, item);
                item.requiredDuration = isNaN(d) || d < 100 ? 1000 : d;
                
                stepUsage.set(item.currentStepId, currentUsage + 1);
            }
        } 
        // --- PROCESSING STATE ---
        else if (item.status === 'processing') {
            const duration = item.requiredDuration || 1000;
            const safeDuration = duration > 0 ? duration : 1000;
            const progressIncrement = dt / safeDuration;
            
            item.progress += progressIncrement;
            item.totalProcessingTime += dt;

            if (item.progress >= 1) {
                item.progress = 0; 
                
                // EXCEPTION: Failure
                const failChance = safeNumber(currentStep.failureProbability, 0);
                if (Math.random() < failChance) {
                    item.status = 'error';
                    statsRef.current.totalItemsFailed++;
                    if (!stepCountersRef.current[item.currentStepId]) stepCountersRef.current[item.currentStepId] = { processed: 0, failed: 0, cancelled: 0 };
                    stepCountersRef.current[item.currentStepId].failed++;

                    const currentUsage = stepUsage.get(item.currentStepId) || 0;
                    stepUsage.set(item.currentStepId, Math.max(0, currentUsage - 1));
                    continue;
                }

                // Normal Success
                const nextId = getNextStepId(currentStep);
                
                // Increment Processed Count for this step
                if (!stepCountersRef.current[item.currentStepId]) stepCountersRef.current[item.currentStepId] = { processed: 0, failed: 0, cancelled: 0 };
                stepCountersRef.current[item.currentStepId].processed++;

                item.previousStepId = item.currentStepId; 
                item.targetStepId = nextId;
                item.status = 'transmitting';
                item.transmissionProgress = 0;
                
                const currentUsage = stepUsage.get(item.currentStepId) || 0;
                stepUsage.set(item.currentStepId, Math.max(0, currentUsage - 1));
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
          if (s.type === 'process') {
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
      setGlobalStats({ ...statsRef.current, activeItems: itemsRef.current.filter(i => !['finished', 'error', 'cancelled'].includes(i.status)).length });

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [config.isRunning, config.speedMultiplier, config.steps]);

  return {
    items,
    stepStats,
    globalStats,
    resetSimulation
  };
};
