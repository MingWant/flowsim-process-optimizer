
export type ColorTheme = 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan' | 'indigo';
export type NodeType = 'start' | 'process' | 'end';
export type RandomnessMode = 'fixed' | 'range';
export type StepSimulationMode = 'resource' | 'delay';
export type DurationUnit = 'ms' | 's' | 'min' | 'h' | 'day' | 'week' | 'month' | 'year';
export type ArrivalInputMode = 'rate' | 'interval';

export interface StepConnection {
  targetId: string;
  probability: number; // 0 to 1
}

export interface ProcessStep {
  id: string;
  type: NodeType;
  name: string;
  
  // Logic Config
  randomnessMode: RandomnessMode;
  simulationMode?: StepSimulationMode; // resource = capacity/queue, delay = time-only
  
  // Process Node Fields
  capacity: number; 
  processingTime: number; // Default ms (Fixed Mode)
  processingTimeUnit?: DurationUnit;
  variance: number; // 0-1 (Fixed Mode)
  minProcessingTime?: number; // ms (Range Mode)
  maxProcessingTime?: number; // ms (Range Mode)
  rangeTimeUnit?: DurationUnit;

  // Start Node Fields
  arrivalInputMode?: ArrivalInputMode;
  arrivalUnit?: DurationUnit;
  arrivalRate?: number; // Items per selected simulated unit (Fixed Mode)
  minArrivalRate?: number; // Items per selected simulated unit (Range Mode)
  maxArrivalRate?: number; // Items per selected simulated unit (Range Mode)
  arrivalBatchSize?: number; // Number of items created at each arrival event

  // End Node Fields
  endTimeUnit?: DurationUnit;

  // Exception Config
  failureProbability: number; // 0-1, chance of error upon completion
  cancellationProbability: number; // 0-1, chance of leaving queue per second

  color: string;
  connections: StepConnection[];
  sourceProcessingTimes?: Record<string, number>;
  x?: number;
  y?: number;
}

export interface WorkItem {
  id: string;
  currentStepId: string | 'finished';
  previousStepId?: string;
  targetStepId?: string;
  status: 'queued' | 'processing' | 'transmitting' | 'finished' | 'cancelled' | 'error';
  progress: number; // 0 to 1
  transmissionProgress: number; // 0 to 1
  createdAt: number; // Wall clock timestamp for transient UI timing
  createdAtSimulationMs: number;
  completedAtSimulationMs?: number;
  finishedAt?: number;
  totalTransmissionTime: number;
  totalWaitTime: number;
  totalProcessingTime: number;
  stepEntryTime: number;
  queuedAtSimulationMs?: number;
  queueCancellationCheckedAtSimulationMs?: number;
  requiredDuration?: number; // The specific time calculated for this item instance
  processingStartedAtSimulationMs?: number;
  processingEndsAtSimulationMs?: number;
  transmissionStartedAtSimulationMs?: number;
  transmissionEndsAtSimulationMs?: number;
  transmissionStartedAtWallMs?: number;
  transmissionEndsAtWallMs?: number;
  visualPreviousStepId?: string;
  visualTargetStepId?: string | 'finished';
  visualTransmissionStartedAtWallMs?: number;
  visualTransmissionEndsAtWallMs?: number;
  visualTransmissionProgress?: number;
}

export interface SimulationConfig {
  steps: ProcessStep[];
  isRunning: boolean;
  speedMultiplier: number;
  timeCompression: number; // simulated ms advanced per real ms
}

export interface SimulationStats {
  totalItemsCreated: number;
  totalItemsFinished: number;
  totalItemsCancelled: number;
  totalItemsFailed: number;
  avgCycleTime: number;
  avgThroughput: number;
  activeItems: number;
}

export interface StepStats {
  stepId: string;
  queueLength: number;
  activeProcessing: number;
  utilization: number;
  avgWaitTime: number;
  avgCompletionTime: number;
  // Cumulative History
  totalProcessed: number;
  totalFailed: number;
  totalCancelled: number;
}
