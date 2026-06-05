
export type ColorTheme = 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan' | 'indigo';
export type NodeType = 'start' | 'process' | 'end';
export type RandomnessMode = 'fixed' | 'range';
export type StepSimulationMode = 'resource' | 'delay';
export type DurationUnit = 'ms' | 's' | 'min' | 'h' | 'day' | 'week' | 'month' | 'year';
export type ArrivalInputMode = 'rate' | 'interval';
export type SimulationMode = 'realistic' | 'worst-case';
export type ResourceExecutionMode = 'single' | 'collaborative' | 'multitask';
export type TeamAllocationMode = 'auto' | 'explicit';
export type NonWorkingArrivalPolicy = 'queue' | 'delay' | 'reject';
export type ArrivalModel = 'simple' | 'schedule' | 'events';
export type ScheduledArrivalSpreadMode = 'spread' | 'burst';
export type ScheduledArrivalRepeat = 'none' | 'daily' | 'weekly';

export interface WorkingHourSegment {
  start: number; // 0-24, local hour (e.g., 9 = 9:00, 9.5 = 9:30)
  end: number;   // 0-24, must be after start
}

export interface BusinessCalendar {
  enabled: boolean;
  daysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
  // Legacy fields (for backward compatibility, auto-migrated to workingHours)
  startHour?: number; // 0-23.99 local business hour (deprecated)
  endHour?: number; // 0-24, must be after startHour (deprecated)
  // New multi-segment support
  workingHours?: WorkingHourSegment[]; // Multiple working time segments (e.g., morning + afternoon)
  nonWorkingArrivalPolicy?: NonWorkingArrivalPolicy;
}

export interface DemandModifier {
  id: string;
  name: string;
  enabled: boolean;
  multiplier: number;
  startHour?: number;
  endHour?: number;
  daysOfWeek?: number[];
  months?: number[]; // 1-12
  startDate?: string; // yyyy-mm-dd
  endDate?: string; // yyyy-mm-dd inclusive
}

export interface ScheduledArrivalWindow {
  id: string;
  name: string;
  enabled: boolean;
  startHour: number; // 0-24 local business hour
  endHour: number; // 0-24, must be after startHour
  quantity: number; // Items generated within this window before demand multipliers
  spreadMode: ScheduledArrivalSpreadMode;
  daysOfWeek?: number[];
  months?: number[];
  startDate?: string;
  endDate?: string;
}

export interface ScheduledArrivalEvent {
  id: string;
  name: string;
  enabled: boolean;
  dayOffset: number; // Simulation day offset from calendarStartIso
  hour: number; // 0-24 local hour within the day
  quantity: number;
  repeat: ScheduledArrivalRepeat;
}

export interface AutoPauseConfig {
  enabled: boolean;
  simulationTimeMs?: number;
  totalItemsCreated?: number;
  totalItemsFinished?: number;
  totalItemsFailed?: number;
  totalItemsCancelled?: number;
  activeItems?: number;
}

export interface StepConnection {
  targetId: string;
  probability: number; // 0 to 1
}

export interface ResourceTeam {
  id: string;
  name: string;
  resources: number;
}

export interface ItemProfile {
  id: string;
  name: string;
  probability: number; // 0-1
  processingTimeMultiplier: number;
  failureMultiplier: number;
  cancellationMultiplier: number;
  priority: number;
  color: string;
}

export interface ProcessStep {
  id: string;
  type: NodeType;
  name: string;
  
  // Logic Config
  randomnessMode: RandomnessMode;
  simulationMode?: StepSimulationMode; // resource = capacity/queue, delay = time-only
  calendarMode?: 'inherit' | 'custom';
  businessCalendar?: BusinessCalendar;
  
  // Process Node Fields
  capacity: number; 
  resourceExecutionMode?: ResourceExecutionMode;
  minResourcesPerItem?: number;
  targetResourcesPerItem?: number;
  maxResourcesPerItem?: number;
  teamAllocationMode?: TeamAllocationMode;
  collaborativeTeams?: ResourceTeam[];
  collaborativeEfficiency?: Record<number, number>; // resource count -> speed multiplier
  maxConcurrentItemsPerResource?: number;
  multitaskEfficiency?: Record<number, number>; // concurrent items on same resource -> speed multiplier
  processingTime: number; // Default ms (Fixed Mode)
  processingTimeUnit?: DurationUnit;
  variance: number; // 0-1 (Fixed Mode)
  minProcessingTime?: number; // ms (Range Mode)
  maxProcessingTime?: number; // ms (Range Mode)
  rangeTimeUnit?: DurationUnit;

  // Start Node Fields
  arrivalModel?: ArrivalModel;
  arrivalInputMode?: ArrivalInputMode;
  arrivalUnit?: DurationUnit;
  arrivalRate?: number; // Items per selected simulated unit (Fixed Mode)
  minArrivalRate?: number; // Items per selected simulated unit (Range Mode)
  maxArrivalRate?: number; // Items per selected simulated unit (Range Mode)
  arrivalBatchSize?: number; // Number of items created at each arrival event
  arrivalBatchIntervalMs?: number; // Time interval between items within a batch (ms), default 0 (simultaneous arrival)
  demandModifiers?: DemandModifier[];
  arrivalSchedule?: ScheduledArrivalWindow[];
  arrivalEvents?: ScheduledArrivalEvent[];
  itemProfiles?: ItemProfile[];

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
  itemProfileId?: string;
  itemProfileName?: string;
  itemProfileColor?: string;
  processingTimeMultiplier?: number;
  failureMultiplier?: number;
  cancellationMultiplier?: number;
  priority?: number;
  assignedResourceCount?: number;
  assignedTeamId?: string;
  assignedTeamName?: string;
  resourceLoadFactor?: number;
  executionMode?: ResourceExecutionMode;
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
  simulationMode?: SimulationMode; // realistic (default) or worst-case planning
  calendarStartIso?: string;
  businessCalendar?: BusinessCalendar;
  demandModifiers?: DemandModifier[];
  autoPause?: AutoPauseConfig;
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
  resourceUsage: number;
  totalResources: number;
  avgResourcesPerItem: number;
  avgResourceLoadFactor: number;
  avgWaitTime: number;
  avgCompletionTime: number;
  // Cumulative History
  totalProcessed: number;
  totalFailed: number;
  totalCancelled: number;
}
