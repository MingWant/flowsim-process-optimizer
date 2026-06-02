
export type ColorTheme = 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan' | 'indigo';
export type NodeType = 'start' | 'process' | 'end';
export type RandomnessMode = 'fixed' | 'range';

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
  
  // Process Node Fields
  capacity: number; 
  processingTime: number; // Default ms (Fixed Mode)
  variance: number; // 0-1 (Fixed Mode)
  minProcessingTime?: number; // ms (Range Mode)
  maxProcessingTime?: number; // ms (Range Mode)

  // Start Node Fields
  arrivalRate?: number; // Items per second (Fixed Mode)
  minArrivalRate?: number; // Items per second (Range Mode)
  maxArrivalRate?: number; // Items per second (Range Mode)

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
  createdAt: number;
  finishedAt?: number;
  totalWaitTime: number;
  totalProcessingTime: number;
  stepEntryTime: number;
  requiredDuration?: number; // The specific time calculated for this item instance
}

export interface SimulationConfig {
  steps: ProcessStep[];
  isRunning: boolean;
  speedMultiplier: number;
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
  // Cumulative History
  totalProcessed: number;
  totalFailed: number;
  totalCancelled: number;
}
