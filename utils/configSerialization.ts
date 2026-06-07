import { DEFAULT_CONFIG } from '../constants';
import { FLOWSIM_DRAFT_STORAGE_KEY } from '../constants/storage';
import { DURATION_UNITS } from '../constants/timeUnits';
import {
  DEFAULT_BUSINESS_CALENDAR,
  normalizeBusinessCalendar,
  normalizeDemandModifiers,
} from '../services/simulationCalendar';
import type {
  ArrivalInputMode,
  ArrivalModel,
  AutoPauseConfig,
  DemandModifier,
  DurationUnit,
  ItemProfile,
  NodeType,
  NonWorkingArrivalPolicy,
  ProcessStep,
  RandomnessMode,
  ResourceExecutionMode,
  ScheduledArrivalDispatchMode,
  ScheduledArrivalEvent,
  ScheduledArrivalRepeat,
  ScheduledArrivalSpreadMode,
  ScheduledArrivalWindow,
  SimulationConfig,
  StepSimulationMode,
  TeamAllocationMode,
  WaitTimeCalculationMode,
} from '../types';

const VALID_NODE_TYPES: NodeType[] = ['start', 'process', 'end'];
const VALID_RANDOMNESS_MODES: RandomnessMode[] = ['fixed', 'range'];
const VALID_SIMULATION_MODES: StepSimulationMode[] = ['resource', 'delay'];
const VALID_ARRIVAL_MODELS: ArrivalModel[] = ['simple', 'schedule', 'events'];
const VALID_ARRIVAL_INPUT_MODES: ArrivalInputMode[] = ['rate', 'interval'];
const VALID_RESOURCE_EXECUTION_MODES: ResourceExecutionMode[] = ['single', 'collaborative', 'multitask'];
const VALID_TEAM_ALLOCATION_MODES: TeamAllocationMode[] = ['auto', 'explicit'];
export const VALID_NON_WORKING_POLICIES: NonWorkingArrivalPolicy[] = ['queue', 'delay', 'reject'];
const VALID_SCHEDULED_SPREAD_MODES: ScheduledArrivalSpreadMode[] = ['spread', 'burst'];
const VALID_SCHEDULED_REPEATS: ScheduledArrivalRepeat[] = ['none', 'daily', 'workingDay', 'weekly', 'monthly', 'yearly'];
const VALID_SCHEDULED_DISPATCH_MODES: ScheduledArrivalDispatchMode[] = ['burst', 'sequence'];
const VALID_WAIT_TIME_CALCULATION_MODES: WaitTimeCalculationMode[] = ['calendar', 'working', 'both'];
export const MAX_SCHEDULED_ARRIVAL_QUANTITY = 50000;
const DEFAULT_ZERO_VARIANCE_STEP_IDS = new Set(['step-1', 'step-2', 'step-3', 'step-4']);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isObjectRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const toFiniteNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveNumber = (value: unknown, fallback: number, min = 0.001) => {
  const parsed = toFiniteNumber(value, fallback);
  return parsed > 0 ? Math.max(parsed, min) : fallback;
};

const clampProbability = (value: number) => Math.max(0, Math.min(1, value));

export const getBatchSize = (value: unknown) => Math.max(1, Math.min(1000, Math.round(toFiniteNumber(value, 1))));

const toPositiveInteger = (value: unknown, fallback: number, min = 1, max = 50) => {
  const parsed = Math.round(toFiniteNumber(value, fallback));
  return Math.max(min, Math.min(max, parsed));
};

const sanitizeWorkingHours = (value: unknown) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter(isObjectRecord)
    .map((segment) => ({
      start: toFiniteNumber(segment.start, 9),
      end: toFiniteNumber(segment.end, 17),
    }));
};

const sanitizeDateOnly = (value: unknown) => (
  typeof value === 'string' && DATE_ONLY_PATTERN.test(value) ? value : undefined
);

const sanitizeNumberSet = (value: unknown, min: number, max: number) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = Array.from(new Set(
    value.map((entry) => Math.round(Number(entry))).filter((entry) => entry >= min && entry <= max)
  )).sort((a, b) => a - b);
  return values.length > 0 ? values : undefined;
};

const sanitizeAutoPause = (value: unknown): AutoPauseConfig => {
  if (!isObjectRecord(value)) {
    return { enabled: false };
  }

  const simulationTimeUnit = typeof value.simulationTimeUnit === 'string' && DURATION_UNITS.some((unit) => unit.value === value.simulationTimeUnit)
    ? value.simulationTimeUnit as DurationUnit
    : undefined;
  const stopDateIso = typeof value.stopDateIso === 'string' && Number.isFinite(Date.parse(value.stopDateIso))
    ? value.stopDateIso
    : undefined;

  const getOptionalTarget = (target: unknown) => {
    const parsed = Number(target);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  return {
    enabled: Boolean(value.enabled),
    simulationTimeMs: getOptionalTarget(value.simulationTimeMs),
    simulationTimeUnit,
    stopDateIso,
    totalItemsCreated: getOptionalTarget(value.totalItemsCreated),
    totalItemsFinished: getOptionalTarget(value.totalItemsFinished),
    totalItemsFailed: getOptionalTarget(value.totalItemsFailed),
    totalItemsCancelled: getOptionalTarget(value.totalItemsCancelled),
    activeItems: getOptionalTarget(value.activeItems),
  };
};

const sanitizeEfficiencyRecord = (value: unknown, maxKey: number, fallback: Record<number, number>) => {
  if (!isObjectRecord(value)) {
    return fallback;
  }

  const entries = Object.entries(value)
    .map(([key, rawMultiplier]) => {
      const numericKey = Math.round(Number(key));
      if (!Number.isFinite(numericKey) || numericKey < 1 || numericKey > maxKey) {
        return null;
      }

      return [numericKey, Math.max(0.05, Math.min(50, toFiniteNumber(rawMultiplier, fallback[numericKey] ?? 1)))] as const;
    })
    .filter((entry): entry is readonly [number, number] => entry !== null);

  return entries.length > 0 ? Object.fromEntries(entries) as Record<number, number> : fallback;
};

export const buildDefaultCollaborativeEfficiency = (maxResources: number) => Object.fromEntries(
  Array.from({ length: Math.max(1, maxResources) }, (_, index) => {
    const resources = index + 1;
    return [resources, resources === 1 ? 1 : Number((1 + (resources - 1) * 0.65).toFixed(2))];
  })
) as Record<number, number>;

export const buildDefaultMultitaskEfficiency = (maxConcurrent: number) => Object.fromEntries(
  Array.from({ length: Math.max(1, maxConcurrent) }, (_, index) => {
    const load = index + 1;
    return [load, Number(Math.max(0.25, 1 - (load - 1) * 0.2).toFixed(2))];
  })
) as Record<number, number>;

export const updateEfficiencyValue = (record: Record<number, number> | undefined, key: number, value: number) => ({
  ...(record || {}),
  [key]: Math.max(0.05, Number.isFinite(value) ? value : 1),
});

const sanitizeCollaborativeTeams = (value: unknown, fallbackCapacity: number) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isObjectRecord)
    .map((team, index) => ({
      id: typeof team.id === 'string' && team.id.trim() ? team.id : `team-${index + 1}`,
      name: typeof team.name === 'string' && team.name.trim() ? team.name : `Team ${index + 1}`,
      resources: toPositiveInteger(team.resources, Math.max(1, Math.min(2, fallbackCapacity)), 1, 50),
    }))
    .filter((team) => team.resources > 0);
};

export const DEFAULT_ITEM_PROFILE: ItemProfile = {
  id: 'standard',
  name: 'Standard',
  probability: 1,
  processingTimeMultiplier: 1,
  failureMultiplier: 1,
  cancellationMultiplier: 1,
  priority: 1,
  color: '#38bdf8',
};

export const sanitizeItemProfiles = (value: unknown): ItemProfile[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ ...DEFAULT_ITEM_PROFILE }];
  }

  return value
    .filter(isObjectRecord)
    .map((profile, index) => ({
      id: typeof profile.id === 'string' && profile.id.trim() ? profile.id : `profile-${index + 1}`,
      name: typeof profile.name === 'string' && profile.name.trim() ? profile.name : `Profile ${index + 1}`,
      probability: Math.max(0, Math.min(1, toFiniteNumber(profile.probability, index === 0 ? 1 : 0))),
      processingTimeMultiplier: Math.max(0.01, toFiniteNumber(profile.processingTimeMultiplier, 1)),
      failureMultiplier: Math.max(0, toFiniteNumber(profile.failureMultiplier, 1)),
      cancellationMultiplier: Math.max(0, toFiniteNumber(profile.cancellationMultiplier, 1)),
      priority: Math.max(0, toFiniteNumber(profile.priority, 1)),
      color: typeof profile.color === 'string' && profile.color.trim() ? profile.color : DEFAULT_ITEM_PROFILE.color,
    }));
};

export const sanitizeScheduledArrivalWindows = (value: unknown): ScheduledArrivalWindow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isObjectRecord)
    .map((window, index) => {
      const startHour = Math.max(0, Math.min(23.99, toFiniteNumber(window.startHour, 9)));
      const endHour = Math.max(startHour + 0.01, Math.min(24, toFiniteNumber(window.endHour, startHour + 1)));

      return {
        id: typeof window.id === 'string' && window.id.trim() ? window.id : `schedule-${index + 1}`,
        name: typeof window.name === 'string' && window.name.trim() ? window.name : `Window ${index + 1}`,
        enabled: window.enabled !== false,
        startHour,
        endHour,
        quantity: Math.max(0, Math.min(MAX_SCHEDULED_ARRIVAL_QUANTITY, Math.round(toFiniteNumber(window.quantity, 10)))),
        spreadMode: typeof window.spreadMode === 'string' && VALID_SCHEDULED_SPREAD_MODES.includes(window.spreadMode as ScheduledArrivalSpreadMode)
          ? window.spreadMode as ScheduledArrivalSpreadMode
          : 'spread',
        daysOfWeek: Array.isArray(window.daysOfWeek)
          ? Array.from(new Set(window.daysOfWeek.map(day => Math.round(Number(day))).filter(day => day >= 0 && day <= 6)))
          : undefined,
        months: Array.isArray(window.months)
          ? Array.from(new Set(window.months.map(month => Math.round(Number(month))).filter(month => month >= 1 && month <= 12)))
          : undefined,
        startDate: sanitizeDateOnly(window.startDate),
        endDate: sanitizeDateOnly(window.endDate),
      };
    })
    .filter((window) => window.quantity > 0);
};

export const sanitizeScheduledArrivalEvents = (value: unknown): ScheduledArrivalEvent[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isObjectRecord)
    .map((event, index) => ({
      id: typeof event.id === 'string' && event.id.trim() ? event.id : `event-${index + 1}`,
      name: typeof event.name === 'string' && event.name.trim() ? event.name : `Event ${index + 1}`,
      enabled: event.enabled !== false,
      dayOffset: Math.max(0, Math.round(toFiniteNumber(event.dayOffset, 0))),
      hour: Math.max(0, Math.min(23.99, toFiniteNumber(event.hour, 9))),
      quantity: Math.max(0, Math.min(MAX_SCHEDULED_ARRIVAL_QUANTITY, Math.round(toFiniteNumber(event.quantity, 10)))),
      repeat: typeof event.repeat === 'string' && VALID_SCHEDULED_REPEATS.includes(event.repeat as ScheduledArrivalRepeat)
        ? event.repeat as ScheduledArrivalRepeat
        : 'none',
      repeatEvery: Math.max(1, Math.min(1000, Math.round(toFiniteNumber(event.repeatEvery, 1)))),
      startDate: sanitizeDateOnly(event.startDate),
      endDate: sanitizeDateOnly(event.endDate),
      occurrenceLimit: Number.isFinite(Number(event.occurrenceLimit)) && Number(event.occurrenceLimit) > 0
        ? Math.max(1, Math.min(100000, Math.round(Number(event.occurrenceLimit))))
        : undefined,
      daysOfWeek: sanitizeNumberSet(event.daysOfWeek, 0, 6),
      months: sanitizeNumberSet(event.months, 1, 12),
      daysOfMonth: sanitizeNumberSet(event.daysOfMonth, 1, 31),
      dispatchMode: typeof event.dispatchMode === 'string' && VALID_SCHEDULED_DISPATCH_MODES.includes(event.dispatchMode as ScheduledArrivalDispatchMode)
        ? event.dispatchMode as ScheduledArrivalDispatchMode
        : 'burst',
      itemInterval: Math.max(0, toFiniteNumber(event.itemInterval, 0)),
      itemIntervalUnit: typeof event.itemIntervalUnit === 'string' && DURATION_UNITS.some(unit => unit.value === event.itemIntervalUnit)
        ? event.itemIntervalUnit as DurationUnit
        : 's',
    }))
    .filter((event) => event.quantity > 0);
};

export const getProfileProbabilityTotal = (step: ProcessStep) => (step.itemProfiles || []).reduce((sum, profile) => sum + (profile.probability || 0), 0);

export const updateItemProfile = (step: ProcessStep, profileId: string, updates: Partial<ItemProfile>): ProcessStep => ({
  ...step,
  itemProfiles: sanitizeItemProfiles((step.itemProfiles || [DEFAULT_ITEM_PROFILE]).map((profile) => (
    profile.id === profileId ? { ...profile, ...updates } : profile
  ))),
});

export const updateStepDemandModifier = (step: ProcessStep, modifierId: string, updates: Partial<DemandModifier>): ProcessStep => ({
  ...step,
  demandModifiers: normalizeDemandModifiers((step.demandModifiers || []).map((modifier) => (
    modifier.id === modifierId ? { ...modifier, ...updates } : modifier
  ))),
});

export const updateScheduledArrivalWindow = (step: ProcessStep, windowId: string, updates: Partial<ScheduledArrivalWindow>): ProcessStep => ({
  ...step,
  arrivalSchedule: sanitizeScheduledArrivalWindows((step.arrivalSchedule || []).map((window) => (
    window.id === windowId ? { ...window, ...updates } : window
  ))),
});

export const updateScheduledArrivalEvent = (step: ProcessStep, eventId: string, updates: Partial<ScheduledArrivalEvent>): ProcessStep => ({
  ...step,
  arrivalEvents: sanitizeScheduledArrivalEvents((step.arrivalEvents || []).map((event) => (
    event.id === eventId ? { ...event, ...updates } : event
  ))),
});

export const getEditableTeams = (step: ProcessStep) => (
  step.collaborativeTeams && step.collaborativeTeams.length > 0
    ? step.collaborativeTeams
    : [{ id: `team-${Date.now()}`, name: 'Team 1', resources: step.targetResourcesPerItem ?? 2 }]
);

export const getTeamAllocationMode = (step: ProcessStep) => step.teamAllocationMode || (step.collaborativeTeams && step.collaborativeTeams.length > 0 ? 'explicit' : 'auto');

export const getTeamResourceTotal = (step: ProcessStep) => getTeamAllocationMode(step) === 'explicit'
  ? getEditableTeams(step).reduce((sum, team) => sum + toPositiveInteger(team.resources, 1, 1, 50), 0)
  : step.capacity;

export const getStepValidationError = (step: ProcessStep | null) => {
  if (!step) {
    return null;
  }

  if (step.type === 'start') {
    const total = getProfileProbabilityTotal(step);
    if (step.itemProfiles && step.itemProfiles.length > 0 && Math.abs(total - 1) > 0.001) {
      return `Item profile probabilities must total 100% (currently ${(total * 100).toFixed(1)}%).`;
    }
    return null;
  }

  if (step.type !== 'process' || step.simulationMode === 'delay') {
    return null;
  }

  if ((step.resourceExecutionMode || 'single') !== 'collaborative') {
    return null;
  }

  if (getTeamAllocationMode(step) !== 'explicit') {
    const targetSize = toPositiveInteger(step.targetResourcesPerItem, 1, 1, 50);
    if (targetSize > step.capacity) {
      return `Default team size (${targetSize}) cannot exceed Capacity (${step.capacity}).`;
    }
    return null;
  }

  const teams = getEditableTeams(step);
  if (teams.length === 0) {
    return 'Add at least one team.';
  }

  const emptyName = teams.find((team) => !team.name || !team.name.trim());
  if (emptyName) {
    return 'Every team needs a name.';
  }

  const duplicateName = teams.some((team, index) => teams.findIndex((otherTeam) => otherTeam.name.trim().toLowerCase() === team.name.trim().toLowerCase()) !== index);
  if (duplicateName) {
    return 'Team names must be unique.';
  }

  const totalTeamResources = getTeamResourceTotal(step);
  if (totalTeamResources !== step.capacity) {
    return `Team resources (${totalTeamResources}) must equal Capacity (${step.capacity}).`;
  }

  const maxTeamSize = Math.max(...teams.map((team) => toPositiveInteger(team.resources, 1, 1, 50)));
  if ((step.maxResourcesPerItem ?? maxTeamSize) < maxTeamSize) {
    return `Max resources / item must be at least the largest team size (${maxTeamSize}).`;
  }

  return null;
};

const shouldMigrateDefaultVariance = (payload: Record<string, unknown>) => (
  !Number.isFinite(Number(payload.version)) || Number(payload.version) < 2
);

const sanitizeStep = (rawStep: unknown, index: number, migrateDefaultVariance = false): ProcessStep | null => {
  if (!isObjectRecord(rawStep)) {
    return null;
  }

  const rawType = rawStep.type;
  if (typeof rawType !== 'string' || !VALID_NODE_TYPES.includes(rawType as NodeType)) {
    return null;
  }

  const type = rawType as NodeType;
  const isStart = type === 'start';
  const isEnd = type === 'end';
  const isProcess = type === 'process';
  const rawRandomnessMode = rawStep.randomnessMode;
  const randomnessMode = typeof rawRandomnessMode === 'string' && VALID_RANDOMNESS_MODES.includes(rawRandomnessMode as RandomnessMode)
    ? rawRandomnessMode as RandomnessMode
    : 'fixed';
  const calendarMode = rawStep.calendarMode === 'custom' ? 'custom' : 'inherit';
  const stepBusinessCalendar = isObjectRecord(rawStep.businessCalendar)
    ? normalizeBusinessCalendar({
        enabled: rawStep.businessCalendar.enabled !== false,
        daysOfWeek: Array.isArray(rawStep.businessCalendar.daysOfWeek) ? rawStep.businessCalendar.daysOfWeek.map(day => Number(day)) : DEFAULT_BUSINESS_CALENDAR.daysOfWeek,
        startHour: toFiniteNumber(rawStep.businessCalendar.startHour, 9),
        endHour: toFiniteNumber(rawStep.businessCalendar.endHour, 17),
        workingHours: sanitizeWorkingHours(rawStep.businessCalendar.workingHours),
        nonWorkingArrivalPolicy: typeof rawStep.businessCalendar.nonWorkingArrivalPolicy === 'string' && VALID_NON_WORKING_POLICIES.includes(rawStep.businessCalendar.nonWorkingArrivalPolicy as NonWorkingArrivalPolicy)
          ? rawStep.businessCalendar.nonWorkingArrivalPolicy as NonWorkingArrivalPolicy
          : DEFAULT_BUSINESS_CALENDAR.nonWorkingArrivalPolicy,
      })
    : undefined;
  const rawArrivalInputMode = rawStep.arrivalInputMode;
  const rawArrivalModel = rawStep.arrivalModel;
  const arrivalModel = isStart && typeof rawArrivalModel === 'string' && VALID_ARRIVAL_MODELS.includes(rawArrivalModel as ArrivalModel)
    ? rawArrivalModel as ArrivalModel
    : 'simple';
  const arrivalInputMode = isStart && typeof rawArrivalInputMode === 'string' && VALID_ARRIVAL_INPUT_MODES.includes(rawArrivalInputMode as ArrivalInputMode)
    ? rawArrivalInputMode as ArrivalInputMode
    : isStart ? 'rate' : undefined;
  const rawSimulationMode = rawStep.simulationMode;
  const simulationMode = isProcess && typeof rawSimulationMode === 'string' && VALID_SIMULATION_MODES.includes(rawSimulationMode as StepSimulationMode)
    ? rawSimulationMode as StepSimulationMode
    : isProcess ? 'resource' : undefined;
  const rawResourceExecutionMode = rawStep.resourceExecutionMode;
  const resourceExecutionMode = isProcess && typeof rawResourceExecutionMode === 'string' && VALID_RESOURCE_EXECUTION_MODES.includes(rawResourceExecutionMode as ResourceExecutionMode)
    ? rawResourceExecutionMode as ResourceExecutionMode
    : isProcess ? 'single' : undefined;
  const rawTeamAllocationMode = rawStep.teamAllocationMode;
  const teamAllocationMode = isProcess && typeof rawTeamAllocationMode === 'string' && VALID_TEAM_ALLOCATION_MODES.includes(rawTeamAllocationMode as TeamAllocationMode)
    ? rawTeamAllocationMode as TeamAllocationMode
    : isProcess ? Array.isArray(rawStep.collaborativeTeams) && rawStep.collaborativeTeams.length > 0 ? 'explicit' : 'auto' : undefined;
  const minResourcesPerItem = isProcess ? toPositiveInteger(rawStep.minResourcesPerItem, 1, 1, 50) : undefined;
  const maxResourcesPerItem = isProcess ? Math.max(minResourcesPerItem ?? 1, toPositiveInteger(rawStep.maxResourcesPerItem, 1, 1, 50)) : undefined;
  const targetResourcesPerItem = isProcess ? Math.max(minResourcesPerItem ?? 1, Math.min(maxResourcesPerItem ?? 1, toPositiveInteger(rawStep.targetResourcesPerItem, Math.min(2, maxResourcesPerItem ?? 1), 1, 50))) : undefined;
  const collaborativeTeams = isProcess ? sanitizeCollaborativeTeams(rawStep.collaborativeTeams, Math.max(1, toFiniteNumber(rawStep.capacity, 1))) : undefined;
  const maxConcurrentItemsPerResource = isProcess ? toPositiveInteger(rawStep.maxConcurrentItemsPerResource, 1, 1, 50) : undefined;
  const collaborativeEfficiency = isProcess
    ? sanitizeEfficiencyRecord(rawStep.collaborativeEfficiency, maxResourcesPerItem ?? 1, buildDefaultCollaborativeEfficiency(maxResourcesPerItem ?? 1))
    : undefined;
  const multitaskEfficiency = isProcess
    ? sanitizeEfficiencyRecord(rawStep.multitaskEfficiency, maxConcurrentItemsPerResource ?? 1, buildDefaultMultitaskEfficiency(maxConcurrentItemsPerResource ?? 1))
    : undefined;
  const arrivalUnit = isStart && typeof rawStep.arrivalUnit === 'string' && DURATION_UNITS.some(unit => unit.value === rawStep.arrivalUnit)
    ? rawStep.arrivalUnit as DurationUnit
    : isStart ? 's' : undefined;
  const itemProfiles = isStart ? sanitizeItemProfiles(rawStep.itemProfiles) : undefined;
  const stepDemandModifiers = isStart && Array.isArray(rawStep.demandModifiers)
    ? normalizeDemandModifiers(rawStep.demandModifiers.filter(isObjectRecord) as Partial<DemandModifier>[])
    : undefined;
  const arrivalSchedule = isStart ? sanitizeScheduledArrivalWindows(rawStep.arrivalSchedule) : undefined;
  const arrivalEvents = isStart ? sanitizeScheduledArrivalEvents(rawStep.arrivalEvents) : undefined;
  const endTimeUnit = isEnd && typeof rawStep.endTimeUnit === 'string' && DURATION_UNITS.some(unit => unit.value === rawStep.endTimeUnit)
    ? rawStep.endTimeUnit as DurationUnit
    : isEnd ? 'min' : undefined;
  const processingTimeUnit = typeof rawStep.processingTimeUnit === 'string' && DURATION_UNITS.some(unit => unit.value === rawStep.processingTimeUnit)
    ? rawStep.processingTimeUnit as DurationUnit
    : 'ms';
  const rangeTimeUnit = typeof rawStep.rangeTimeUnit === 'string' && DURATION_UNITS.some(unit => unit.value === rawStep.rangeTimeUnit)
    ? rawStep.rangeTimeUnit as DurationUnit
    : processingTimeUnit;
  const connections = Array.isArray(rawStep.connections)
    ? rawStep.connections
        .filter(isObjectRecord)
        .map((connection) => ({
          targetId: typeof connection.targetId === 'string' ? connection.targetId : '',
          probability: clampProbability(toFiniteNumber(connection.probability, 0)),
        }))
        .filter((connection) => connection.targetId)
    : [];
  const sourceProcessingTimes = isObjectRecord(rawStep.sourceProcessingTimes)
    ? Object.fromEntries(
        Object.entries(rawStep.sourceProcessingTimes)
          .filter(([key]) => typeof key === 'string' && key.length > 0)
          .map(([key, value]) => [key, Math.max(0, toFiniteNumber(value, 0))])
      )
    : {};
  const stepId = typeof rawStep.id === 'string' && rawStep.id.trim() ? rawStep.id : `node-import-${Date.now()}-${index}`;
  const variance = isProcess
    ? migrateDefaultVariance && DEFAULT_ZERO_VARIANCE_STEP_IDS.has(stepId)
      ? 0
      : Math.max(0, Math.min(1, toFiniteNumber(rawStep.variance, 0)))
    : 0;

  return {
    id: stepId,
    type,
    name: typeof rawStep.name === 'string' && rawStep.name.trim() ? rawStep.name : isStart ? 'Start Point' : isEnd ? 'End Point' : `Step ${index + 1}`,
    randomnessMode,
    calendarMode,
    businessCalendar: calendarMode === 'custom' ? stepBusinessCalendar || normalizeBusinessCalendar({ ...DEFAULT_BUSINESS_CALENDAR, enabled: true }) : undefined,
    arrivalModel: isStart ? arrivalModel : undefined,
    arrivalInputMode,
    arrivalUnit,
    endTimeUnit,
    simulationMode,
    resourceExecutionMode,
    minResourcesPerItem,
    targetResourcesPerItem,
    maxResourcesPerItem,
    teamAllocationMode,
    collaborativeTeams,
    collaborativeEfficiency,
    maxConcurrentItemsPerResource,
    multitaskEfficiency,
    capacity: isProcess ? Math.max(1, Math.round(toFiniteNumber(rawStep.capacity, 1))) : 0,
    processingTime: isProcess ? Math.max(0, toFiniteNumber(rawStep.processingTime, 2000)) : 0,
    processingTimeUnit,
    variance,
    minProcessingTime: isProcess ? Math.max(0, toFiniteNumber(rawStep.minProcessingTime, 1000)) : 0,
    maxProcessingTime: isProcess ? Math.max(0, toFiniteNumber(rawStep.maxProcessingTime, 3000)) : 0,
    rangeTimeUnit,
    arrivalRate: isStart ? toPositiveNumber(rawStep.arrivalRate, 0.5, 0.000000001) : undefined,
    minArrivalRate: isStart ? toPositiveNumber(rawStep.minArrivalRate, 0.2, 0.000000001) : undefined,
    maxArrivalRate: isStart ? toPositiveNumber(rawStep.maxArrivalRate, 0.8, 0.000000001) : undefined,
    arrivalBatchSize: isStart ? getBatchSize(rawStep.arrivalBatchSize) : undefined,
    arrivalBatchIntervalMs: isStart ? Math.max(0, toFiniteNumber(rawStep.arrivalBatchIntervalMs, 0)) : undefined,
    demandModifiers: stepDemandModifiers,
    arrivalSchedule,
    arrivalEvents,
    itemProfiles,
    failureProbability: Math.max(0, Math.min(1, toFiniteNumber(rawStep.failureProbability, 0))),
    cancellationProbability: Math.max(0, Math.min(1, toFiniteNumber(rawStep.cancellationProbability, 0))),
    color: typeof rawStep.color === 'string' && rawStep.color.trim() ? rawStep.color : isStart ? '#10b981' : isEnd ? '#ef4444' : '#3b82f6',
    connections,
    sourceProcessingTimes,
    x: toFiniteNumber(rawStep.x, 100 + index * 60),
    y: toFiniteNumber(rawStep.y, 100 + index * 40),
  };
};

const sanitizeConfig = (rawConfig: unknown, migrateDefaultVariance = false): SimulationConfig => {
  if (!isObjectRecord(rawConfig) || !Array.isArray(rawConfig.steps)) {
    throw new Error('Invalid config file: missing steps array.');
  }

  const sanitizedSteps = rawConfig.steps
    .map((step, index) => sanitizeStep(step, index, migrateDefaultVariance))
    .filter((step): step is ProcessStep => step !== null);

  if (sanitizedSteps.length === 0) {
    throw new Error('Import file does not contain any valid steps.');
  }

  const validIds = new Set(sanitizedSteps.map((step) => step.id));
  const normalizedSteps = sanitizedSteps.map((step) => {
    const validConnections = step.connections.filter((connection) => validIds.has(connection.targetId) && connection.targetId !== step.id);
    const probabilityTotal = validConnections.reduce((sum, connection) => sum + connection.probability, 0);
    const normalizedConnections = validConnections.length === 0
      ? []
      : probabilityTotal > 0
        ? validConnections.map((connection) => ({ ...connection, probability: connection.probability / probabilityTotal }))
        : validConnections.map((connection) => ({ ...connection, probability: 1 / validConnections.length }));

    const filteredSourceRules = Object.fromEntries(
      Object.entries(step.sourceProcessingTimes || {}).filter(([sourceId]) => validIds.has(sourceId))
    );

    return {
      ...step,
      connections: normalizedConnections,
      sourceProcessingTimes: filteredSourceRules,
      calendarMode: step.calendarMode || 'inherit',
      businessCalendar: step.calendarMode === 'custom' ? normalizeBusinessCalendar(step.businessCalendar || { ...DEFAULT_BUSINESS_CALENDAR, enabled: true }) : undefined,
      arrivalModel: step.type === 'start' ? step.arrivalModel || 'simple' : undefined,
      minArrivalRate: step.type === 'start' ? Math.min(step.minArrivalRate ?? 0.2, step.maxArrivalRate ?? 0.8) : undefined,
      maxArrivalRate: step.type === 'start' ? Math.max(step.minArrivalRate ?? 0.2, step.maxArrivalRate ?? 0.8) : undefined,
      arrivalBatchSize: step.type === 'start' ? getBatchSize(step.arrivalBatchSize) : undefined,
      arrivalBatchIntervalMs: step.type === 'start' ? Math.max(0, toFiniteNumber(step.arrivalBatchIntervalMs, 0)) : undefined,
      demandModifiers: step.type === 'start' ? normalizeDemandModifiers(step.demandModifiers) : undefined,
      arrivalSchedule: step.type === 'start' ? sanitizeScheduledArrivalWindows(step.arrivalSchedule) : undefined,
      arrivalEvents: step.type === 'start' ? sanitizeScheduledArrivalEvents(step.arrivalEvents) : undefined,
      itemProfiles: step.type === 'start' ? sanitizeItemProfiles(step.itemProfiles) : undefined,
      minProcessingTime: step.type === 'process' ? Math.min(step.minProcessingTime ?? 1000, step.maxProcessingTime ?? 3000) : 0,
      maxProcessingTime: step.type === 'process' ? Math.max(step.minProcessingTime ?? 1000, step.maxProcessingTime ?? 3000) : 0,
      resourceExecutionMode: step.type === 'process' ? step.resourceExecutionMode || 'single' : undefined,
      minResourcesPerItem: step.type === 'process' ? Math.min(step.minResourcesPerItem ?? 1, step.maxResourcesPerItem ?? 1) : undefined,
      targetResourcesPerItem: step.type === 'process' ? Math.max(Math.min(step.minResourcesPerItem ?? 1, step.maxResourcesPerItem ?? 1), Math.min(step.targetResourcesPerItem ?? Math.min(2, step.maxResourcesPerItem ?? 1), Math.max(step.minResourcesPerItem ?? 1, step.maxResourcesPerItem ?? 1))) : undefined,
      maxResourcesPerItem: step.type === 'process' ? Math.max(step.minResourcesPerItem ?? 1, step.maxResourcesPerItem ?? 1) : undefined,
      teamAllocationMode: step.type === 'process' ? step.teamAllocationMode || (step.collaborativeTeams && step.collaborativeTeams.length > 0 ? 'explicit' : 'auto') : undefined,
      collaborativeTeams: step.type === 'process' ? sanitizeCollaborativeTeams(step.collaborativeTeams, step.capacity || 1) : undefined,
      maxConcurrentItemsPerResource: step.type === 'process' ? Math.max(1, step.maxConcurrentItemsPerResource ?? 1) : undefined,
      collaborativeEfficiency: step.type === 'process' ? step.collaborativeEfficiency || buildDefaultCollaborativeEfficiency(step.maxResourcesPerItem ?? 1) : undefined,
      multitaskEfficiency: step.type === 'process' ? step.multitaskEfficiency || buildDefaultMultitaskEfficiency(step.maxConcurrentItemsPerResource ?? 1) : undefined,
    };
  });

  return {
    steps: normalizedSteps,
    isRunning: false,
    speedMultiplier: Math.max(1, Math.round(toFiniteNumber(rawConfig.speedMultiplier, 1))),
    timeCompression: toPositiveNumber(rawConfig.timeCompression, 1),
    simulationMode: typeof rawConfig.simulationMode === 'string' && ['realistic', 'worst-case'].includes(rawConfig.simulationMode)
      ? rawConfig.simulationMode as 'realistic' | 'worst-case'
      : 'realistic',
    calendarStartIso: typeof rawConfig.calendarStartIso === 'string' && rawConfig.calendarStartIso.trim() ? rawConfig.calendarStartIso : '2026-01-05T00:00:00',
    businessCalendar: isObjectRecord(rawConfig.businessCalendar)
      ? normalizeBusinessCalendar({
          enabled: Boolean(rawConfig.businessCalendar.enabled),
          daysOfWeek: Array.isArray(rawConfig.businessCalendar.daysOfWeek) ? rawConfig.businessCalendar.daysOfWeek.map(day => Number(day)) : DEFAULT_BUSINESS_CALENDAR.daysOfWeek,
          startHour: toFiniteNumber(rawConfig.businessCalendar.startHour, 9),
          endHour: toFiniteNumber(rawConfig.businessCalendar.endHour, 17),
          workingHours: sanitizeWorkingHours(rawConfig.businessCalendar.workingHours),
          nonWorkingArrivalPolicy: typeof rawConfig.businessCalendar.nonWorkingArrivalPolicy === 'string' && VALID_NON_WORKING_POLICIES.includes(rawConfig.businessCalendar.nonWorkingArrivalPolicy as NonWorkingArrivalPolicy)
            ? rawConfig.businessCalendar.nonWorkingArrivalPolicy as NonWorkingArrivalPolicy
            : DEFAULT_BUSINESS_CALENDAR.nonWorkingArrivalPolicy,
        })
      : DEFAULT_BUSINESS_CALENDAR,
    demandModifiers: Array.isArray(rawConfig.demandModifiers)
      ? normalizeDemandModifiers(rawConfig.demandModifiers.filter(isObjectRecord) as Partial<DemandModifier>[])
      : [],
    autoPause: sanitizeAutoPause(rawConfig.autoPause),
    waitTimeCalculationMode: typeof rawConfig.waitTimeCalculationMode === 'string' && VALID_WAIT_TIME_CALCULATION_MODES.includes(rawConfig.waitTimeCalculationMode as WaitTimeCalculationMode)
      ? rawConfig.waitTimeCalculationMode as WaitTimeCalculationMode
      : 'both',
  };
};

export const parseImportedConfig = (payload: unknown): SimulationConfig => {
  if (isObjectRecord(payload) && isObjectRecord(payload.config)) {
    return sanitizeConfig(payload.config, shouldMigrateDefaultVariance(payload));
  }

  return sanitizeConfig(payload, isObjectRecord(payload) ? shouldMigrateDefaultVariance(payload) : false);
};

export const loadInitialConfig = (): SimulationConfig => {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG;
  }

  const savedDraft = window.localStorage.getItem(FLOWSIM_DRAFT_STORAGE_KEY);
  if (!savedDraft) {
    return DEFAULT_CONFIG;
  }

  try {
    return parseImportedConfig(JSON.parse(savedDraft) as unknown);
  } catch (error) {
    console.warn('Failed to restore FlowSim draft from local storage.', error);
    window.localStorage.removeItem(FLOWSIM_DRAFT_STORAGE_KEY);
    return DEFAULT_CONFIG;
  }
};
