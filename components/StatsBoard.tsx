
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { FlowStats, SimulationStats, StepStats, ProcessStep, DurationUnit, WorkItem, SimulationConfig } from '../types';
import { XCircle, Ban, CheckCircle2, Gauge, Timer, Activity, GitCompareArrows, Users, Clock3, PauseCircle, Percent, Hourglass, UserX, BatteryWarning, Eye, EyeOff, SlidersHorizontal } from 'lucide-react';

interface Props {
  globalStats: SimulationStats;
  stepStats: StepStats[];
  flowStats?: FlowStats[];
  steps: ProcessStep[];
  items?: WorkItem[];
  simulationTimeMs: number;
  cycleTimeUnit: DurationUnit;
  config: SimulationConfig;
}

interface FlowGroup {
  id: string;
  name: string;
  color: string;
  stepIds: Set<string>;
  steps: ProcessStep[];
}

type MetricVisibilityKey =
  | 'items'
  | 'throughput'
  | 'avgCalendar'
  | 'medianCalendar'
  | 'p90Calendar'
  | 'avgGlobalWorking'
  | 'medianGlobalWorking'
  | 'p90GlobalWorking'
  | 'avgOperational'
  | 'medianOperational'
  | 'p90Operational'
  | 'touchWork'
  | 'queueWaitCalendar'
  | 'queueWaitWorking'
  | 'diagnosticWorkingWait'
  | 'transfer'
  | 'offHoursDelay'
  | 'flowEfficiency'
  | 'liveResourceUtil'
  | 'oldestWip'
  | 'oldestQueue'
  | 'blockedShare'
  | 'activeWork'
  | 'resourcesUsed'
  | 'errors'
  | 'cancelled';

interface MetricCard {
  id: MetricVisibilityKey;
  label: string;
  value: string | number;
  suffix: string;
  color: string;
  icon: React.ReactNode;
}

interface MetricVisibilityOption {
  id: MetricVisibilityKey;
  label: string;
  description: string;
}

const METRIC_VISIBILITY_STORAGE_KEY = 'flowsim-live-metrics-visibility-v1';

const METRIC_VISIBILITY_OPTIONS: MetricVisibilityOption[] = [
  { id: 'items', label: 'Items', description: 'Created / finished item counts' },
  { id: 'throughput', label: 'Throughput', description: 'Completed items per selected unit' },
  { id: 'avgCalendar', label: 'Avg Calendar', description: 'Mean customer elapsed time' },
  { id: 'medianCalendar', label: 'Median Calendar', description: 'Typical customer elapsed time' },
  { id: 'p90Calendar', label: 'P90 Calendar', description: 'Slow-tail customer elapsed time' },
  { id: 'avgGlobalWorking', label: 'Avg Global Working', description: 'Mean time inside global business hours' },
  { id: 'medianGlobalWorking', label: 'Median Global Working', description: 'Typical global working time' },
  { id: 'p90GlobalWorking', label: 'P90 Global Working', description: 'Slow-tail global working time' },
  { id: 'avgOperational', label: 'Avg Operational', description: 'Mean step-calendar working time' },
  { id: 'medianOperational', label: 'Median Operational', description: 'Typical operational working time' },
  { id: 'p90Operational', label: 'P90 Operational', description: 'Slow-tail operational working time' },
  { id: 'touchWork', label: 'Touch / Work', description: 'Active processing time' },
  { id: 'queueWaitCalendar', label: 'Queue Wait (Calendar)', description: 'Queue time including off-hours' },
  { id: 'queueWaitWorking', label: 'Queue Wait (Working)', description: 'Item-weighted working-hour queue time' },
  { id: 'diagnosticWorkingWait', label: 'Diagnostic Working Wait', description: 'Step-level wait diagnostic' },
  { id: 'transfer', label: 'Transfer', description: 'Movement / handoff time' },
  { id: 'offHoursDelay', label: 'Off-hours Delay', description: 'Delay outside working hours' },
  { id: 'flowEfficiency', label: 'Flow Efficiency', description: 'Work time share of elapsed time' },
  { id: 'liveResourceUtil', label: 'Resource Utilization', description: 'Live resource usage percentage' },
  { id: 'oldestWip', label: 'Oldest WIP', description: 'Oldest active item age' },
  { id: 'oldestQueue', label: 'Oldest Queue', description: 'Oldest queued item age' },
  { id: 'blockedShare', label: 'Blocked Share', description: 'Share of time blocked' },
  { id: 'activeWork', label: 'Active Work / Load', description: 'Live queue, processing, and active counts' },
  { id: 'resourcesUsed', label: 'Resources Used', description: 'Used resources vs capacity' },
  { id: 'errors', label: 'Errors', description: 'Failed item count' },
  { id: 'cancelled', label: 'Cancelled', description: 'Cancelled item count' },
];

const METRIC_VISIBILITY_OPTION_BY_ID = METRIC_VISIBILITY_OPTIONS.reduce((optionsById, option) => {
  optionsById[option.id] = option;
  return optionsById;
}, {} as Record<MetricVisibilityKey, MetricVisibilityOption>);

const METRIC_VISIBILITY_GROUPS: Array<{ label: string; description: string; metricIds: MetricVisibilityKey[] }> = [
  {
    label: 'Core demo',
    description: 'Keep these on for a simple audience-facing story.',
    metricIds: ['items', 'throughput', 'avgCalendar', 'queueWaitCalendar', 'activeWork'],
  },
  {
    label: 'Service time detail',
    description: 'Use when explaining calendar, working-hour, and tail metrics.',
    metricIds: ['medianCalendar', 'p90Calendar', 'avgGlobalWorking', 'medianGlobalWorking', 'p90GlobalWorking', 'avgOperational', 'medianOperational', 'p90Operational', 'touchWork'],
  },
  {
    label: 'Wait and aging',
    description: 'Use for queue, SLA, and bottleneck discussions.',
    metricIds: ['queueWaitWorking', 'diagnosticWorkingWait', 'transfer', 'offHoursDelay', 'oldestWip', 'oldestQueue'],
  },
  {
    label: 'Resources and exceptions',
    description: 'Use when discussing staffing, load, or failure scenarios.',
    metricIds: ['flowEfficiency', 'liveResourceUtil', 'resourcesUsed', 'blockedShare', 'errors', 'cancelled'],
  },
];

const DEMO_FOCUS_METRIC_IDS: MetricVisibilityKey[] = [
  'items',
  'throughput',
  'avgCalendar',
  'queueWaitCalendar',
  'activeWork',
  'liveResourceUtil',
  'errors',
];

const createMetricVisibilityState = (visibleMetricIds?: Set<MetricVisibilityKey>): Record<MetricVisibilityKey, boolean> => {
  const state = {} as Record<MetricVisibilityKey, boolean>;
  METRIC_VISIBILITY_OPTIONS.forEach((option) => {
    state[option.id] = visibleMetricIds ? visibleMetricIds.has(option.id) : true;
  });
  return state;
};

const getInitialMetricVisibility = () => {
  const defaultState = createMetricVisibilityState();

  if (typeof window === 'undefined') {
    return defaultState;
  }

  try {
    const saved = window.localStorage.getItem(METRIC_VISIBILITY_STORAGE_KEY);
    if (!saved) {
      return defaultState;
    }

    const parsed = JSON.parse(saved) as Partial<Record<MetricVisibilityKey, boolean>>;
    const restored = { ...defaultState };
    METRIC_VISIBILITY_OPTIONS.forEach((option) => {
      if (typeof parsed[option.id] === 'boolean') {
        restored[option.id] = parsed[option.id] as boolean;
      }
    });
    return restored;
  } catch {
    return defaultState;
  }
};

const TIME_UNIT_TO_MS: Record<DurationUnit, number> = {
  ms: 1,
  s: 1000,
  min: 60 * 1000,
  h: 60 * 60 * 1000,
  workingDay: 8 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

const UNIT_LABELS: Record<DurationUnit, string> = {
  ms: 'ms',
  s: 'sec',
  min: 'min',
  h: 'hour',
  workingDay: 'working day',
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

const getExecutionModeLabel = (step: ProcessStep) => {
  if (step.type !== 'process') {
    return step.type;
  }

  if (step.simulationMode === 'delay') {
    return 'Delay';
  }

  if ((step.resourceExecutionMode || 'single') === 'collaborative') {
    return step.teamAllocationMode === 'explicit' ? 'Explicit Teams' : 'Auto Teams';
  }

  if (step.resourceExecutionMode === 'multitask') {
    return 'Multitask';
  }

  return 'Single';
};

const getPreferredThroughputUnit = (steps: ProcessStep[]): DurationUnit => {
  const startSteps = steps.filter(step => step.type === 'start');

  if (startSteps.length === 0) {
    return 'min';
  }

  // Find the most common unit among start nodes
  const unitCounts = new Map<DurationUnit, number>();
  startSteps.forEach(step => {
    const unit = step.arrivalUnit || 's';
    unitCounts.set(unit, (unitCounts.get(unit) || 0) + 1);
  });

  // Return the most frequently used unit
  let maxCount = 0;
  let preferredUnit: DurationUnit = 'min';

  unitCounts.forEach((count, unit) => {
    if (count > maxCount) {
      maxCount = count;
      preferredUnit = unit;
    }
  });

  return preferredUnit;
};

const formatDurationValue = (milliseconds: number, unit: DurationUnit) => {
  const divisor = TIME_UNIT_TO_MS[unit] || 1000;
  const value = milliseconds / divisor;
  return value.toFixed(unit === 'ms' ? 0 : 2);
};

const clampPercent = (value: number) => Math.min(999, Math.max(0, value * 100));

const getStepResourceCapacity = (step: ProcessStep, stats?: StepStats) => (
  Math.max(0, stats?.totalResources || step.capacity || 0)
);

const getFlowGroups = (steps: ProcessStep[]): FlowGroup[] => {
  const stepById = new Map(steps.map(step => [step.id, step]));
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

  if (steps.length === 0) {
    return [{
      id: 'flow-all',
      name: 'All Steps',
      color: '#64748b',
      stepIds: new Set(steps.map(step => step.id)),
      steps,
    }];
  }

  const visited = new Set<string>();
  const flowGroups: FlowGroup[] = [];

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

    const flowSteps = steps.filter(step => stepIds.has(step.id));
    const startSteps = flowSteps.filter(step => step.type === 'start');
    const primaryStart = startSteps[0] || flowSteps[0];
    const derivedName = startSteps.length > 1
      ? `${primaryStart?.name || `Flow ${String.fromCharCode(65 + index)}`} +${startSteps.length - 1}`
      : primaryStart?.name || `Flow ${String.fromCharCode(65 + index)}`;

    flowGroups.push({
      id: primaryStart?.id || seedStep.id,
      name: derivedName,
      color: primaryStart?.color || seedStep.color || '#3b82f6',
      stepIds,
      steps: flowSteps,
    });
  });

  return flowGroups;
};

export const StatsBoard: React.FC<Props> = ({ globalStats, stepStats, flowStats = [], steps, items = [], simulationTimeMs, cycleTimeUnit, config }) => {
  const flowGroups = getFlowGroups(steps);
  const [selectedFlowId, setSelectedFlowId] = React.useState<string>('all');
  const [metricVisibility, setMetricVisibility] = React.useState<Record<MetricVisibilityKey, boolean>>(getInitialMetricVisibility);
  const [isMetricVisibilityPanelOpen, setIsMetricVisibilityPanelOpen] = React.useState(false);
  const selectedFlow = selectedFlowId === 'all' ? undefined : flowGroups.find((flow) => flow.id === selectedFlowId);
  const stepStatsById = new Map(stepStats.map(stats => [stats.stepId, stats]));
  const flowStatsById = new Map(flowStats.map(stats => [stats.flowId, stats]));
  const flowFilterOptions = [
    { id: 'all', name: 'All Flows', color: '#64748b' },
    ...flowGroups.map((flow) => ({ id: flow.id, name: flow.name, color: flow.color })),
  ];

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(METRIC_VISIBILITY_STORAGE_KEY, JSON.stringify(metricVisibility));
  }, [metricVisibility]);

  const isMetricVisible = React.useCallback((metricId: MetricVisibilityKey) => metricVisibility[metricId] ?? true, [metricVisibility]);
  const visibleMetricCount = METRIC_VISIBILITY_OPTIONS.filter((option) => isMetricVisible(option.id)).length;
  const hiddenMetricCount = METRIC_VISIBILITY_OPTIONS.length - visibleMetricCount;
  const toggleMetricVisibility = (metricId: MetricVisibilityKey) => {
    setMetricVisibility((current) => ({ ...current, [metricId]: !(current[metricId] ?? true) }));
  };
  const showAllMetrics = () => setMetricVisibility(createMetricVisibilityState());
  const hideAllMetrics = () => setMetricVisibility(createMetricVisibilityState(new Set<MetricVisibilityKey>()));
  const showDemoFocusMetrics = () => setMetricVisibility(createMetricVisibilityState(new Set(DEMO_FOCUS_METRIC_IDS)));

  // Get wait time display mode from config
  const waitTimeMode = config.waitTimeCalculationMode || 'both';

  const visibleLoadFlows = selectedFlow ? flowGroups.filter((flow) => flow.id === selectedFlow.id) : flowGroups;
  const flowLoadCharts = visibleLoadFlows.map((flow) => {
    const data = flow.steps.map((step) => {
      const stats = stepStatsById.get(step.id);
      return {
        name: step.name,
        flowName: flow.name,
        displayName: `${flow.name}: ${step.name}`,
        queue: stats?.queueLength || 0,
        active: stats?.activeProcessing || 0,
      };
    });

    return {
      ...flow,
      data,
      totalQueue: data.reduce((sum, entry) => sum + entry.queue, 0),
      totalActive: data.reduce((sum, entry) => sum + entry.active, 0),
    };
  });
  const visibleLoadStepCount = flowLoadCharts.reduce((sum, flow) => sum + flow.data.length, 0);

  const throughputUnit = getPreferredThroughputUnit(steps);
  const throughputUnitMs = TIME_UNIT_TO_MS[throughputUnit];
  const throughputValue = simulationTimeMs > 0
    ? (globalStats.totalItemsFinished / simulationTimeMs) * throughputUnitMs
    : 0;
  const calendarCycleTimeValue = formatDurationValue(globalStats.avgCycleTime || 0, cycleTimeUnit);
  const medianCycleTimeValue = formatDurationValue(globalStats.medianCycleTime || 0, cycleTimeUnit);
  const p90CycleTimeValue = formatDurationValue(globalStats.p90CycleTime || 0, cycleTimeUnit);
  const workingCycleTimeValue = formatDurationValue(globalStats.avgWorkingCycleTime || 0, cycleTimeUnit);
  const medianWorkingCycleTimeValue = formatDurationValue(globalStats.medianWorkingCycleTime || 0, cycleTimeUnit);
  const p90WorkingCycleTimeValue = formatDurationValue(globalStats.p90WorkingCycleTime || 0, cycleTimeUnit);
  const operationalWorkingCycleTimeValue = formatDurationValue(globalStats.avgOperationalWorkingCycleTime || 0, cycleTimeUnit);
  const medianOperationalWorkingCycleTimeValue = formatDurationValue(globalStats.medianOperationalWorkingCycleTime || 0, cycleTimeUnit);
  const p90OperationalWorkingCycleTimeValue = formatDurationValue(globalStats.p90OperationalWorkingCycleTime || 0, cycleTimeUnit);
  const workTimeValue = formatDurationValue(globalStats.avgWorkTime || 0, cycleTimeUnit);
  const waitTimeValue = formatDurationValue(globalStats.avgWaitTime || 0, cycleTimeUnit);
  const nonWorkingDelayValue = formatDurationValue(globalStats.avgNonWorkingDelay || 0, cycleTimeUnit);
  const flowEfficiencyValue = `${clampPercent(globalStats.flowEfficiency || 0).toFixed(1)}%`;
  const oldestWipAgeValue = formatDurationValue(globalStats.oldestWipAge || 0, cycleTimeUnit);
  const oldestQueueAgeValue = formatDurationValue(globalStats.oldestQueueAge || 0, cycleTimeUnit);
  const resourceUtilizationValue = `${Math.min(999, Math.max(0, (globalStats.resourceUtilization || 0) * 100)).toFixed(1)}%`;
  const blockedTimeShareValue = `${Math.min(999, Math.max(0, (globalStats.blockedTimeShare || 0) * 100)).toFixed(1)}%`;
  const globalMetricCards: MetricCard[] = [
    { id: 'items', label: 'Finished / Created', value: `${globalStats.totalItemsFinished}/${globalStats.totalItemsCreated}`, suffix: '', color: 'text-emerald-300', icon: <CheckCircle2 size={18} className="text-emerald-400" /> },
    { id: 'throughput', label: 'Throughput', value: throughputValue.toFixed(1), suffix: `/ ${UNIT_LABELS[throughputUnit]}`, color: 'text-emerald-400', icon: <Gauge size={18} className="text-emerald-400" /> },
    { id: 'avgCalendar', label: 'Avg Calendar', value: calendarCycleTimeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-blue-400', icon: <Timer size={18} className="text-blue-400" /> },
    { id: 'medianCalendar', label: 'Median Calendar', value: medianCycleTimeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-blue-300', icon: <Timer size={18} className="text-blue-300" /> },
    { id: 'p90Calendar', label: 'P90 Calendar', value: p90CycleTimeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-indigo-300', icon: <Timer size={18} className="text-indigo-300" /> },
    { id: 'avgGlobalWorking', label: 'Avg Global Working', value: workingCycleTimeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-sky-300', icon: <Timer size={18} className="text-sky-300" /> },
    { id: 'medianGlobalWorking', label: 'Median Global Working', value: medianWorkingCycleTimeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-cyan-300', icon: <Timer size={18} className="text-cyan-300" /> },
    { id: 'p90GlobalWorking', label: 'P90 Global Working', value: p90WorkingCycleTimeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-teal-300', icon: <Timer size={18} className="text-teal-300" /> },
    { id: 'avgOperational', label: 'Avg Operational', value: operationalWorkingCycleTimeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-lime-300', icon: <Clock3 size={18} className="text-lime-300" /> },
    { id: 'medianOperational', label: 'Median Operational', value: medianOperationalWorkingCycleTimeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-green-300', icon: <Clock3 size={18} className="text-green-300" /> },
    { id: 'p90Operational', label: 'P90 Operational', value: p90OperationalWorkingCycleTimeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-emerald-300', icon: <Clock3 size={18} className="text-emerald-300" /> },
    { id: 'touchWork', label: 'Touch / Work', value: workTimeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-cyan-300', icon: <Activity size={18} className="text-cyan-300" /> },
    { id: 'queueWaitCalendar', label: 'Queue Wait', value: waitTimeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-amber-300', icon: <PauseCircle size={18} className="text-amber-300" /> },
    { id: 'offHoursDelay', label: 'Off-hours Delay', value: nonWorkingDelayValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-violet-300', icon: <PauseCircle size={18} className="text-violet-300" /> },
    { id: 'flowEfficiency', label: 'Flow Efficiency', value: flowEfficiencyValue, suffix: '', color: 'text-emerald-300', icon: <Percent size={18} className="text-emerald-300" /> },
    { id: 'liveResourceUtil', label: 'Live Resource Util.', value: resourceUtilizationValue, suffix: '', color: 'text-purple-300', icon: <Users size={18} className="text-purple-300" /> },
    { id: 'oldestWip', label: 'Oldest WIP', value: oldestWipAgeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-orange-300', icon: <Hourglass size={18} className="text-orange-300" /> },
    { id: 'oldestQueue', label: 'Oldest Queue', value: oldestQueueAgeValue, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-yellow-300', icon: <UserX size={18} className="text-yellow-300" /> },
    { id: 'blockedShare', label: 'Blocked Share', value: blockedTimeShareValue, suffix: '', color: 'text-red-300', icon: <BatteryWarning size={18} className="text-red-300" /> },
  ];
  const visibleGlobalMetricCards = globalMetricCards.filter((card) => isMetricVisible(card.id));
  const globalSummaryParts = [
    isMetricVisible('activeWork') ? `${globalStats.activeItems} active` : null,
    isMetricVisible('errors') ? `${globalStats.totalItemsFailed} errors` : null,
    isMetricVisible('cancelled') ? `${globalStats.totalItemsCancelled} cancelled` : null,
  ].filter((part): part is string => Boolean(part));

  const flowMetrics = flowGroups.map((flow, index) => {
    const statsForFlow = flow.steps.map(step => stepStatsById.get(step.id)).filter((stats): stats is StepStats => Boolean(stats));
    const endStats = flow.steps
      .filter(step => step.type === 'end')
      .map(step => stepStatsById.get(step.id))
      .filter((stats): stats is StepStats => Boolean(stats));
    const startStats = flow.steps
      .filter(step => step.type === 'start')
      .map(step => stepStatsById.get(step.id))
      .filter((stats): stats is StepStats => Boolean(stats));
    const completedFlowStats = flowStatsById.get(flow.id);
    const fallbackFinished = endStats.reduce((sum, stats) => sum + stats.totalProcessed, 0);
    const fallbackCreated = startStats.reduce((sum, stats) => sum + stats.totalProcessed, 0);
    const fallbackFailed = statsForFlow.reduce((sum, stats) => sum + stats.totalFailed, 0);
    const fallbackCancelled = statsForFlow.reduce((sum, stats) => sum + stats.totalCancelled, 0);
    const finished = completedFlowStats?.totalItemsFinished ?? fallbackFinished;
    const created = completedFlowStats?.totalItemsCreated ?? fallbackCreated;
    const failed = completedFlowStats?.totalItemsFailed ?? fallbackFailed;
    const cancelled = completedFlowStats?.totalItemsCancelled ?? fallbackCancelled;
    const queue = statsForFlow.reduce((sum, stats) => sum + stats.queueLength, 0);
    const processing = statsForFlow.reduce((sum, stats) => sum + stats.activeProcessing, 0);
    const maxUtilization = statsForFlow.reduce((max, stats) => Math.max(max, stats.utilization), 0);
    const activeItems = items.filter(item => (
      !['finished', 'error', 'cancelled'].includes(item.status)
      && item.currentStepId !== 'finished'
      && (item.sourceFlowId === flow.id || flow.stepIds.has(item.currentStepId))
    )).length;
    const liveItemsForFlow = items.filter(item => (
      !['finished', 'error', 'cancelled'].includes(item.status)
      && item.currentStepId !== 'finished'
      && (item.sourceFlowId === flow.id || flow.stepIds.has(item.currentStepId))
    ));
    const oldestWipAge = liveItemsForFlow.reduce((max, item) => Math.max(max, simulationTimeMs - item.createdAtSimulationMs), 0);
    const oldestQueueAge = liveItemsForFlow
      .filter((item) => item.status === 'queued')
      .reduce((max, item) => Math.max(max, simulationTimeMs - (item.queuedAtSimulationMs ?? item.stepEntryTime ?? item.createdAtSimulationMs)), 0);
    const averageCycleTime = finished > 0
      ? endStats.reduce((sum, stats) => sum + stats.avgCompletionTime * stats.totalProcessed, 0) / finished
      : 0;
    const unit = getPreferredThroughputUnit(flow.steps);
    const flowThroughput = simulationTimeMs > 0 ? (finished / simulationTimeMs) * TIME_UNIT_TO_MS[unit] : 0;
    const resourceStepsForFlow = flow.steps.filter((step) => step.type === 'process' && step.simulationMode !== 'delay');
    const resourceUsage = resourceStepsForFlow.reduce((sum, step) => sum + (stepStatsById.get(step.id)?.resourceUsage || 0), 0);
    const resourceCapacity = resourceStepsForFlow.reduce((sum, step) => sum + getStepResourceCapacity(step, stepStatsById.get(step.id)), 0);
    const resourceUtilization = resourceCapacity > 0 ? resourceUsage / resourceCapacity : 0;

    // Calculate diagnostic step-level wait fallbacks for the flow.
    const avgWaitTime = statsForFlow.reduce((sum, stats) => sum + (stats.avgWaitTime || 0), 0) / Math.max(1, statsForFlow.length);
    const diagnosticWorkingWaitTime = statsForFlow.reduce((sum, stats) => sum + (stats.avgWorkingWaitTime || 0), 0) / Math.max(1, statsForFlow.length);

    return {
      ...flow,
      label: `Flow ${String.fromCharCode(65 + index)}`,
      created,
      finished,
      failed,
      cancelled,
      queue,
      processing,
      activeItems,
      maxUtilization,
      averageCycleTime,
      avgCalendarCycle: completedFlowStats?.avgCycleTime ?? averageCycleTime,
      medianCalendarCycle: completedFlowStats?.medianCycleTime ?? 0,
      p90CalendarCycle: completedFlowStats?.p90CycleTime ?? 0,
      avgWorkingCycle: completedFlowStats?.avgWorkingCycleTime ?? 0,
      medianWorkingCycle: completedFlowStats?.medianWorkingCycleTime ?? 0,
      p90WorkingCycle: completedFlowStats?.p90WorkingCycleTime ?? 0,
      avgOperationalWorkingCycle: completedFlowStats?.avgOperationalWorkingCycleTime ?? 0,
      medianOperationalWorkingCycle: completedFlowStats?.medianOperationalWorkingCycleTime ?? 0,
      p90OperationalWorkingCycle: completedFlowStats?.p90OperationalWorkingCycleTime ?? 0,
      avgTouchTime: completedFlowStats?.avgWorkTime ?? 0,
      avgWaitTime: completedFlowStats?.avgWaitTime ?? avgWaitTime,
      avgItemWorkingWaitTime: completedFlowStats?.avgWorkingWaitTime ?? 0,
      diagnosticWorkingWaitTime,
      avgTransmissionTime: completedFlowStats?.avgTransmissionTime ?? 0,
      avgOffHoursDelay: completedFlowStats?.avgOffHoursDelay ?? completedFlowStats?.avgNonWorkingDelay ?? 0,
      avgNonWorkingDelay: completedFlowStats?.avgNonWorkingDelay ?? 0,
      flowEfficiency: completedFlowStats?.flowEfficiency ?? 0,
      oldestWipAge,
      oldestQueueAge,
      resourceUsage,
      resourceCapacity,
      resourceUtilization,
      throughputUnit: unit,
      throughput: flowThroughput,
      cycleTimeValue: (completedFlowStats?.avgCycleTime ?? averageCycleTime) / TIME_UNIT_TO_MS[cycleTimeUnit],
    };
  });
  const visibleFlowMetrics = selectedFlow ? flowMetrics.filter((flow) => flow.id === selectedFlow.id) : flowMetrics;
  const liveFlowCards = visibleFlowMetrics.map((flow) => ({
    ...flow,
    avgCalendarCycleLabel: formatDurationValue(flow.avgCalendarCycle, cycleTimeUnit),
    medianCalendarCycleLabel: formatDurationValue(flow.medianCalendarCycle, cycleTimeUnit),
    p90CalendarCycleLabel: formatDurationValue(flow.p90CalendarCycle, cycleTimeUnit),
    avgWorkingCycleLabel: formatDurationValue(flow.avgWorkingCycle, cycleTimeUnit),
    medianWorkingCycleLabel: formatDurationValue(flow.medianWorkingCycle, cycleTimeUnit),
    p90WorkingCycleLabel: formatDurationValue(flow.p90WorkingCycle, cycleTimeUnit),
    avgOperationalWorkingCycleLabel: formatDurationValue(flow.avgOperationalWorkingCycle, cycleTimeUnit),
    medianOperationalWorkingCycleLabel: formatDurationValue(flow.medianOperationalWorkingCycle, cycleTimeUnit),
    p90OperationalWorkingCycleLabel: formatDurationValue(flow.p90OperationalWorkingCycle, cycleTimeUnit),
    avgTouchTimeLabel: formatDurationValue(flow.avgTouchTime, cycleTimeUnit),
    avgWaitTimeLabel: formatDurationValue(flow.avgWaitTime, cycleTimeUnit),
    avgItemWorkingWaitTimeLabel: formatDurationValue(flow.avgItemWorkingWaitTime, cycleTimeUnit),
    diagnosticWorkingWaitTimeLabel: formatDurationValue(flow.diagnosticWorkingWaitTime, cycleTimeUnit),
    avgTransmissionTimeLabel: formatDurationValue(flow.avgTransmissionTime, cycleTimeUnit),
    avgOffHoursDelayLabel: formatDurationValue(flow.avgOffHoursDelay, cycleTimeUnit),
    avgNonWorkingDelayLabel: formatDurationValue(flow.avgNonWorkingDelay, cycleTimeUnit),
    oldestWipAgeLabel: formatDurationValue(flow.oldestWipAge, cycleTimeUnit),
    oldestQueueAgeLabel: formatDurationValue(flow.oldestQueueAge, cycleTimeUnit),
    flowEfficiencyLabel: `${clampPercent(flow.flowEfficiency).toFixed(1)}%`,
    resourceUtilizationLabel: `${clampPercent(flow.resourceUtilization).toFixed(1)}%`,
  }));

  const maxFinished = Math.max(1, ...flowMetrics.map(flow => flow.finished));
  const maxThroughput = Math.max(0.000001, ...flowMetrics.map(flow => flow.throughput));
  const resourceSteps = steps
    .filter(step => step.type === 'process' && step.simulationMode !== 'delay')
    .map(step => ({ step, stats: stepStatsById.get(step.id) }));
  const visibleResourceSteps = selectedFlow
    ? resourceSteps.filter((entry) => selectedFlow.stepIds.has(entry.step.id))
    : resourceSteps;
  const totalResourceUsage = resourceSteps.reduce((sum, entry) => sum + (entry.stats?.resourceUsage || 0), 0);
  const totalResourceCapacity = resourceSteps.reduce((sum, entry) => sum + getStepResourceCapacity(entry.step, entry.stats), 0);
  const visibleResourceUsage = visibleResourceSteps.reduce((sum, entry) => sum + (entry.stats?.resourceUsage || 0), 0);
  const visibleResourceCapacity = visibleResourceSteps.reduce((sum, entry) => sum + getStepResourceCapacity(entry.step, entry.stats), 0);
  const weightedAvgResourcesPerItem = resourceSteps.reduce((sum, entry) => sum + (entry.stats?.avgResourcesPerItem || 0) * (entry.stats?.activeProcessing || 0), 0) / Math.max(1, resourceSteps.reduce((sum, entry) => sum + (entry.stats?.activeProcessing || 0), 0));
  const weightedAvgResourceLoad = resourceSteps.reduce((sum, entry) => sum + (entry.stats?.avgResourceLoadFactor || 0) * (entry.stats?.activeProcessing || 0), 0) / Math.max(1, resourceSteps.reduce((sum, entry) => sum + (entry.stats?.activeProcessing || 0), 0));
  const visibleWeightedAvgResourcesPerItem = visibleResourceSteps.reduce((sum, entry) => sum + (entry.stats?.avgResourcesPerItem || 0) * (entry.stats?.activeProcessing || 0), 0) / Math.max(1, visibleResourceSteps.reduce((sum, entry) => sum + (entry.stats?.activeProcessing || 0), 0));
  const visibleWeightedAvgResourceLoad = visibleResourceSteps.reduce((sum, entry) => sum + (entry.stats?.avgResourceLoadFactor || 0) * (entry.stats?.activeProcessing || 0), 0) / Math.max(1, visibleResourceSteps.reduce((sum, entry) => sum + (entry.stats?.activeProcessing || 0), 0));

  const buildFlowMetricCards = (flow: typeof liveFlowCards[number]) => {
    const cards: MetricCard[] = [
      { id: 'items', label: 'Items Finished', value: flow.finished, suffix: '', color: 'text-emerald-300', icon: <CheckCircle2 size={18} className="text-emerald-400" /> },
      { id: 'throughput', label: 'Throughput', value: flow.throughput.toFixed(1), suffix: `/ ${UNIT_LABELS[flow.throughputUnit]}`, color: 'text-emerald-400', icon: <Gauge size={18} className="text-emerald-400" /> },
      { id: 'avgCalendar', label: 'Avg Calendar', value: flow.avgCalendarCycleLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-blue-400', icon: <Timer size={18} className="text-blue-400" /> },
      { id: 'medianCalendar', label: 'Median Calendar', value: flow.medianCalendarCycleLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-blue-300', icon: <Timer size={18} className="text-blue-300" /> },
      { id: 'p90Calendar', label: 'P90 Calendar', value: flow.p90CalendarCycleLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-indigo-300', icon: <Timer size={18} className="text-indigo-300" /> },
      { id: 'avgGlobalWorking', label: 'Avg Global Working', value: flow.avgWorkingCycleLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-sky-300', icon: <Timer size={18} className="text-sky-300" /> },
      { id: 'medianGlobalWorking', label: 'Median Global Working', value: flow.medianWorkingCycleLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-cyan-300', icon: <Timer size={18} className="text-cyan-300" /> },
      { id: 'p90GlobalWorking', label: 'P90 Global Working', value: flow.p90WorkingCycleLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-teal-300', icon: <Timer size={18} className="text-teal-300" /> },
      { id: 'avgOperational', label: 'Avg Operational', value: flow.avgOperationalWorkingCycleLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-lime-300', icon: <Clock3 size={18} className="text-lime-300" /> },
      { id: 'medianOperational', label: 'Median Operational', value: flow.medianOperationalWorkingCycleLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-green-300', icon: <Clock3 size={18} className="text-green-300" /> },
      { id: 'p90Operational', label: 'P90 Operational', value: flow.p90OperationalWorkingCycleLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-emerald-300', icon: <Clock3 size={18} className="text-emerald-300" /> },
      { id: 'touchWork', label: 'Touch / Work', value: flow.avgTouchTimeLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-cyan-300', icon: <Clock3 size={18} className="text-cyan-300" /> },
    ];

    // Add wait time cards based on configuration
    if (waitTimeMode === 'calendar' || waitTimeMode === 'both') {
      cards.push({
        id: 'queueWaitCalendar',
        label: waitTimeMode === 'both' ? 'Queue Wait (Calendar)' : 'Queue Wait',
        value: flow.avgWaitTimeLabel,
        suffix: UNIT_LABELS[cycleTimeUnit],
        color: 'text-amber-300',
        icon: <PauseCircle size={18} className="text-amber-300" />
      });
    }

    if (waitTimeMode === 'working' || waitTimeMode === 'both') {
      cards.push({
        id: 'queueWaitWorking',
        label: waitTimeMode === 'both' ? 'Queue Wait (Working)' : 'Queue Wait',
        value: flow.avgItemWorkingWaitTimeLabel,
        suffix: UNIT_LABELS[cycleTimeUnit],
        color: 'text-yellow-200',
        icon: <Clock3 size={18} className="text-yellow-200" />
      });

      cards.push({
        id: 'diagnosticWorkingWait',
        label: 'Diagnostic Working Wait',
        value: flow.diagnosticWorkingWaitTimeLabel,
        suffix: UNIT_LABELS[cycleTimeUnit],
        color: 'text-yellow-300',
        icon: <Clock3 size={18} className="text-yellow-300" />
      });
    }

    // Add remaining cards
    cards.push(
      { id: 'transfer', label: 'Transfer', value: flow.avgTransmissionTimeLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-indigo-300', icon: <GitCompareArrows size={18} className="text-indigo-300" /> },
      { id: 'offHoursDelay', label: 'Off-hours Delay', value: flow.avgOffHoursDelayLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-violet-300', icon: <PauseCircle size={18} className="text-violet-300" /> },
      { id: 'flowEfficiency', label: 'Flow Efficiency', value: flow.flowEfficiencyLabel, suffix: '', color: 'text-emerald-300', icon: <Percent size={18} className="text-emerald-300" /> },
      { id: 'oldestWip', label: 'Oldest WIP', value: flow.oldestWipAgeLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-orange-300', icon: <Hourglass size={18} className="text-orange-300" /> },
      { id: 'oldestQueue', label: 'Oldest Queue', value: flow.oldestQueueAgeLabel, suffix: UNIT_LABELS[cycleTimeUnit], color: 'text-yellow-300', icon: <UserX size={18} className="text-yellow-300" /> },
      { id: 'liveResourceUtil', label: 'Live Resource Util.', value: flow.resourceUtilizationLabel, suffix: '', color: 'text-purple-300', icon: <Gauge size={18} className="text-purple-300" /> },
      { id: 'activeWork', label: 'Active Work', value: flow.activeItems, suffix: '', color: 'text-amber-400', icon: <Activity size={18} className="text-amber-400" /> },
      { id: 'resourcesUsed', label: 'Resources Used', value: `${flow.resourceUsage}/${flow.resourceCapacity}`, suffix: '', color: 'text-purple-300', icon: <Users size={18} className="text-purple-300" /> },
      { id: 'errors', label: 'Errors', value: flow.failed, suffix: '', color: 'text-red-400', icon: <XCircle size={18} className="text-red-400" /> },
      { id: 'cancelled', label: 'Cancelled', value: flow.cancelled, suffix: '', color: 'text-slate-400', icon: <Ban size={18} className="text-slate-400" /> }
    );

    return cards.filter((card) => isMetricVisible(card.id));
  };

  return (
    <div className="space-y-4 w-full">
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-100">
              <SlidersHorizontal size={18} className="text-cyan-300" /> Metrics Display
            </h3>
            <p className="mt-1 text-xs text-slate-500">Choose which Live Metrics are shown during demos. Hidden choices are saved on this browser.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${hiddenMetricCount > 0 ? 'border-amber-500/20 bg-amber-500/10 text-amber-200' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'}`}>
              {visibleMetricCount}/{METRIC_VISIBILITY_OPTIONS.length} shown
            </span>
            <button
              type="button"
              onClick={() => setIsMetricVisibilityPanelOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-100"
            >
              {isMetricVisibilityPanelOpen ? <EyeOff size={14} /> : <Eye size={14} />}
              {isMetricVisibilityPanelOpen ? 'Hide Controls' : 'Show / Hide Metrics'}
            </button>
          </div>
        </div>

        {isMetricVisibilityPanelOpen && (
          <div className="mt-4 space-y-4 border-t border-cyan-500/10 pt-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={showDemoFocusMetrics} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20">Demo focus</button>
              <button type="button" onClick={showAllMetrics} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20">Show all</button>
              <button type="button" onClick={hideAllMetrics} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-slate-100">Hide all</button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              {METRIC_VISIBILITY_GROUPS.map((group) => (
                <div key={group.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="mb-3">
                    <div className="text-xs font-bold text-slate-200">{group.label}</div>
                    <div className="mt-1 text-[11px] leading-snug text-slate-500">{group.description}</div>
                  </div>
                  <div className="space-y-2">
                    {group.metricIds.map((metricId) => {
                      const option = METRIC_VISIBILITY_OPTION_BY_ID[metricId];
                      const visible = isMetricVisible(metricId);
                      return (
                        <button
                          key={metricId}
                          type="button"
                          onClick={() => toggleMetricVisibility(metricId)}
                          className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${visible ? 'border-cyan-500/25 bg-cyan-500/10 text-slate-100' : 'border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-600 hover:text-slate-300'}`}
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold leading-tight">{option.label}</span>
                            <span className="mt-0.5 block text-[10px] leading-snug opacity-75">{option.description}</span>
                          </span>
                          <span className={`mt-0.5 inline-flex h-5 min-w-10 items-center justify-center rounded-full text-[10px] font-bold ${visible ? 'bg-cyan-400/20 text-cyan-100' : 'bg-slate-800 text-slate-500'}`}>
                            {visible ? 'Show' : 'Hide'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {visibleMetricCount === 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          All Live Metrics are hidden. Open <span className="font-semibold">Show / Hide Metrics</span> and enable at least one metric to present data.
        </div>
      )}

      {/* Flow-first Metrics Cards */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-slate-400">
        <span className="font-semibold text-blue-200">Time model:</span> Calendar is customer elapsed time. Global Working uses the shared business calendar. Operational Working uses each item&apos;s actual step calendars, counted as working queue wait plus active processing. Avg shows the mean, Median shows the typical item, and P90 shows the slow-tail service level. Touch / Work is active processing. <span className="font-semibold text-amber-200">Queue Wait (Calendar)</span> includes non-working hours for SLA tracking. <span className="font-semibold text-yellow-200">Queue Wait (Working)</span> is item-weighted from completed items, showing each item&apos;s real working-hour queue experience. <span className="font-semibold text-yellow-300">Diagnostic Working Wait</span> is the current Avg Step Working Wait / Step-level Working Wait diagnostic metric, useful for bottleneck analysis and not item-weighted. Transfer is movement time, and Off-hours Delay is calendar time outside working hours.
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-100">
              <Gauge size={18} className="text-emerald-300" /> Global Service-Level Summary
            </h3>
            <p className="mt-1 text-xs text-slate-500">All completed items are pooled here, so Median and P90 represent the true global item distribution instead of an average of flow-level percentiles.</p>
          </div>
          {globalSummaryParts.length > 0 && (
            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              {globalSummaryParts.join(' · ')}
            </div>
          )}
        </div>

        {visibleGlobalMetricCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {visibleGlobalMetricCards.map((card) => (
            <div key={`global-${card.label}`} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="text-sm leading-tight text-slate-400">{card.label}</div>
                {card.icon}
              </div>
              <div className={`font-mono text-2xl font-bold ${card.color}`}>
                {card.value} {card.suffix && <span className="text-[11px] text-slate-500">{card.suffix}</span>}
              </div>
            </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-500">Global metric cards are hidden.</div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-100">
              <Activity size={18} className="text-blue-300" /> Live Metrics by Flow
            </h3>
            <p className="mt-1 text-xs text-slate-500">All time, service-level, load, resource, and exception metrics are split by connected flow instead of mixed into one global number.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              {flowMetrics.length} live flow{flowMetrics.length === 1 ? '' : 's'}
            </div>
            <div className="flex flex-wrap gap-2">
              {flowFilterOptions.map((flow) => {
                const isSelected = flow.id === selectedFlowId;
                return (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => setSelectedFlowId(flow.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${isSelected ? 'border-slate-400 bg-slate-200/10 text-slate-100' : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                  >
                    <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: flow.color }} />
                    {flow.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {liveFlowCards.map((flow) => (
            <section key={`${flow.id}-metric-board`} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: flow.color }} />
                    {flow.label}
                  </div>
                  <h4 className="truncate text-lg font-bold text-slate-100" title={flow.name}>{flow.name}</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {flow.steps.length} nodes
                    {isMetricVisible('items') && <> · {flow.created} created</>}
                    {isMetricVisible('activeWork') && <> · {flow.activeItems} active</>}
                  </p>
                </div>
                {(isMetricVisible('activeWork') || isMetricVisible('liveResourceUtil')) && (
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${flow.maxUtilization > 0.9 || flow.queue > 10 ? 'bg-red-500/10 text-red-300 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>
                    {flow.maxUtilization > 0.9 || flow.queue > 10 ? 'Bottleneck risk' : 'Stable'}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                {(() => {
                  const cards = buildFlowMetricCards(flow);
                  return cards.length > 0 ? cards.map((card) => (
                    <div key={`${flow.id}-${card.label}`} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="text-sm leading-tight text-slate-400">{card.label}</div>
                        {card.icon}
                      </div>
                      <div className={`font-mono text-2xl font-bold ${card.color}`}>
                        {card.value} {card.suffix && <span className="text-[11px] text-slate-500">{card.suffix}</span>}
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-500">All flow metric cards are hidden for this flow.</div>
                  );
                })()}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <GitCompareArrows size={16} className="text-cyan-300" /> Flow Summary
            </h4>
            <p className="mt-1 text-xs text-slate-500">Compact comparison of throughput, cycle times, live load, and exception risk by flow.</p>
          </div>
          <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            {selectedFlow ? selectedFlow.name : `${flowMetrics.length} flow${flowMetrics.length === 1 ? '' : 's'}`}
          </div>
        </div>

        {visibleResourceSteps.length > 0 && (isMetricVisible('resourcesUsed') || isMetricVisible('liveResourceUtil')) && (
          <div className="mb-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-purple-100">
                  <Users size={16} className="text-purple-300" /> Resource Execution by Flow
                </h4>
                <p className="mt-1 text-xs text-slate-500">Live resource allocation {selectedFlow ? `inside ${selectedFlow.name}` : 'split across visible flows'}.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {isMetricVisible('resourcesUsed') && <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 font-semibold text-purple-200">Used {visibleResourceUsage}/{visibleResourceCapacity}</span>}
                {isMetricVisible('resourcesUsed') && <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 font-semibold text-blue-200">Avg team {visibleWeightedAvgResourcesPerItem.toFixed(1)}</span>}
                {isMetricVisible('liveResourceUtil') && <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 font-semibold text-cyan-200">Avg load {visibleWeightedAvgResourceLoad.toFixed(1)}</span>}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {visibleResourceSteps.map(({ step, stats }) => {
                const capacity = getStepResourceCapacity(step, stats);
                const usage = stats?.resourceUsage || 0;
                const usagePercent = Math.min(100, (usage / Math.max(1, capacity)) * 100);
                return (
                  <div key={step.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100" title={step.name}>{step.name}</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">{getExecutionModeLabel(step)}</div>
                      </div>
                      {isMetricVisible('resourcesUsed') && <div className="font-mono text-sm font-bold text-purple-200">{usage}/{capacity}</div>}
                    </div>
                    {isMetricVisible('liveResourceUtil') && (
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-purple-400" style={{ width: `${usagePercent}%` }} />
                      </div>
                    )}
                    {isMetricVisible('resourcesUsed') && (
                      <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                        <span>Avg team <span className="font-mono text-blue-200">{(stats?.avgResourcesPerItem || 0).toFixed(1)}</span></span>
                        <span>Avg load <span className="font-mono text-cyan-200">{(stats?.avgResourceLoadFactor || 0).toFixed(1)}</span></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleFlowMetrics.map(flow => (
            <div key={flow.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: flow.color }} />
                    {flow.label}
                  </div>
                  <div className="truncate text-base font-bold text-slate-100" title={flow.name}>{flow.name}</div>
                  <div className="text-xs text-slate-500">
                    {flow.steps.length} nodes
                    {isMetricVisible('items') && <> · {flow.created} created</>}
                  </div>
                </div>
                {(isMetricVisible('activeWork') || isMetricVisible('liveResourceUtil')) && (
                  <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${flow.maxUtilization > 0.9 || flow.queue > 10 ? 'bg-red-500/10 text-red-300 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>
                    {flow.maxUtilization > 0.9 || flow.queue > 10 ? 'Bottleneck risk' : 'Stable'}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {isMetricVisible('items') && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Finished</div>
                    <div className="mt-1 font-mono text-2xl font-bold text-emerald-300">{flow.finished}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, (flow.finished / maxFinished) * 100)}%` }} />
                    </div>
                  </div>
                )}
                {isMetricVisible('throughput') && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Throughput</div>
                    <div className="mt-1 font-mono text-2xl font-bold text-cyan-300">
                      {flow.throughput.toFixed(1)} <span className="text-[10px] text-slate-500">/ {UNIT_LABELS[flow.throughputUnit]}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, (flow.throughput / maxThroughput) * 100)}%` }} />
                    </div>
                  </div>
                )}
                {isMetricVisible('avgCalendar') && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg Cycle</div>
                    <div className="mt-1 font-mono text-xl font-bold text-blue-300">
                      {flow.cycleTimeValue.toFixed(cycleTimeUnit === 'ms' ? 0 : 2)} <span className="text-[10px] text-slate-500">{UNIT_LABELS[cycleTimeUnit]}</span>
                    </div>
                  </div>
                )}
                {isMetricVisible('avgGlobalWorking') && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg Global Working</div>
                    <div className="mt-1 font-mono text-xl font-bold text-sky-300">
                      {formatDurationValue(flow.avgWorkingCycle, cycleTimeUnit)} <span className="text-[10px] text-slate-500">{UNIT_LABELS[cycleTimeUnit]}</span>
                    </div>
                  </div>
                )}
                {isMetricVisible('avgOperational') && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg Operational</div>
                    <div className="mt-1 font-mono text-xl font-bold text-lime-300">
                      {formatDurationValue(flow.avgOperationalWorkingCycle, cycleTimeUnit)} <span className="text-[10px] text-slate-500">{UNIT_LABELS[cycleTimeUnit]}</span>
                    </div>
                  </div>
                )}
              </div>

              {(isMetricVisible('queueWaitCalendar') || isMetricVisible('queueWaitWorking') || isMetricVisible('diagnosticWorkingWait')) && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  {isMetricVisible('queueWaitCalendar') && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Calendar Wait</div>
                      <div className="mt-1 font-mono text-sm text-amber-300">
                        {formatDurationValue(flow.avgWaitTime, cycleTimeUnit)} <span className="text-[10px] text-slate-500">{UNIT_LABELS[cycleTimeUnit]}</span>
                      </div>
                      <div className="mt-1 text-[9px] text-slate-500">Includes non-working hours</div>
                    </div>
                  )}
                  {isMetricVisible('queueWaitWorking') && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Working Wait</div>
                      <div className="mt-1 font-mono text-sm text-yellow-200">
                        {formatDurationValue(flow.avgItemWorkingWaitTime, cycleTimeUnit)} <span className="text-[10px] text-slate-500">{UNIT_LABELS[cycleTimeUnit]}</span>
                      </div>
                      <div className="mt-1 text-[9px] text-slate-500">Item-weighted working-hour queue wait</div>
                    </div>
                  )}
                  {isMetricVisible('diagnosticWorkingWait') && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Diagnostic Wait</div>
                      <div className="mt-1 font-mono text-sm text-yellow-300">
                        {formatDurationValue(flow.diagnosticWorkingWaitTime, cycleTimeUnit)} <span className="text-[10px] text-slate-500">{UNIT_LABELS[cycleTimeUnit]}</span>
                      </div>
                      <div className="mt-1 text-[9px] text-slate-500">Avg Step Working Wait; not item-weighted</div>
                    </div>
                  )}
                </div>
              )}

              {(isMetricVisible('touchWork') || isMetricVisible('activeWork')) && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  {isMetricVisible('touchWork') && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Touch Time</div>
                      <div className="mt-1 font-mono text-sm text-cyan-300">
                        {formatDurationValue(flow.avgTouchTime, cycleTimeUnit)} <span className="text-[10px] text-slate-500">{UNIT_LABELS[cycleTimeUnit]}</span>
                      </div>
                    </div>
                  )}
                  {isMetricVisible('activeWork') && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Live Load</div>
                      <div className="mt-1 flex items-end gap-2 font-mono text-sm">
                        <span className="text-amber-300">Q {flow.queue}</span>
                        <span className="text-blue-300">P {flow.processing}</span>
                        <span className="text-slate-400">A {flow.activeItems}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(isMetricVisible('errors') || isMetricVisible('cancelled') || isMetricVisible('offHoursDelay') || isMetricVisible('flowEfficiency') || isMetricVisible('liveResourceUtil')) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {isMetricVisible('errors') && <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-300">Errors {flow.failed}</span>}
                  {isMetricVisible('cancelled') && <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-slate-400">Cancelled {flow.cancelled}</span>}
                  {isMetricVisible('offHoursDelay') && <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-300">Non-work {formatDurationValue(flow.avgNonWorkingDelay, cycleTimeUnit)} {UNIT_LABELS[cycleTimeUnit]}</span>}
                  {isMetricVisible('flowEfficiency') && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">Eff. {(flow.flowEfficiency * 100).toFixed(1)}%</span>}
                  {isMetricVisible('liveResourceUtil') && <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-purple-300">Max util {(flow.maxUtilization * 100).toFixed(0)}%</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Queue Visualization */}
      {isMetricVisible('activeWork') && (
      <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <h4 className="text-sm font-semibold text-slate-300">Real-time Step Load by Flow</h4>
            <p className="mt-1 text-xs text-slate-500">
              {selectedFlow ? `Showing the load chart for ${selectedFlow.name}.` : 'Each connected flow is shown as a separate load chart; use the filter above to focus one flow.'}
            </p>
          </div>
          <div className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-300">
            {flowLoadCharts.length} flow{flowLoadCharts.length === 1 ? '' : 's'} · {visibleLoadStepCount} step{visibleLoadStepCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="space-y-4">
          {flowLoadCharts.map((flow) => (
            <section key={`${flow.id}-step-load-chart`} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: flow.color }} />
                    Flow step load
                  </div>
                  <h5 className="truncate text-sm font-semibold text-slate-200" title={flow.name}>{flow.name}</h5>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 font-semibold text-slate-300">{flow.data.length} step{flow.data.length === 1 ? '' : 's'}</span>
                  <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 font-semibold text-blue-200">Processing {flow.totalActive}</span>
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-200">Queue {flow.totalQueue}</span>
                </div>
              </div>
              <div className="h-72 min-h-0 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={flow.data} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#e2e8f0', fontSize: '12px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                      cursor={{ fill: '#334155', opacity: 0.25 }}
                      formatter={(value, name) => [value, name === 'active' ? 'Processing' : 'Queue']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.displayName || ''}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Bar
                      dataKey="active"
                      stackId="load"
                      fill="#3b82f6"
                      name="Processing"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="queue"
                      stackId="load"
                      fill="#f59e0b"
                      name="Queue"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ))}
        </div>
      </div>
      )}
    </div>
  );
};
