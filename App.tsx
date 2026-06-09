
import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_CONFIG, ROUTING_DEMO_CONFIG } from './constants';
import { useProcessSimulation } from './hooks/useProcessSimulation';
import { ProcessStep, SimulationConfig, NodeType, DurationUnit, RandomnessMode, StepSimulationMode, ArrivalInputMode, ResourceExecutionMode, TeamAllocationMode, NonWorkingArrivalPolicy, DemandModifier, AutoPauseConfig, ItemProfile, RoutingStrategy } from './types';
import { ProcessMap } from './components/ProcessMap';
import { StatsBoard } from './components/StatsBoard';
import { MetroDemoBoard } from './components/MetroDemoBoard';
import { RoutingDiagnosticsPanel } from './components/RoutingDiagnosticsPanel';
import { MarkdownViewer } from './components/MarkdownViewer';
import { StartNodeSettings } from './components/step-editor/StartNodeSettings';
import { ConnectionsTab } from './components/step-editor/ConnectionsTab';
import { generateScenario, analyzeBottlenecks } from './services/geminiService';
import { DEFAULT_BUSINESS_CALENDAR, getActiveDemandModifiers, getBusinessDate, getDemandMultiplier, isWorkingTime, normalizeBusinessCalendar, normalizeDemandModifiers } from './services/simulationCalendar';
import { formatSimulationTime, getAutoPauseProgressRows } from './utils/formatters';
import { loadInitialConfig as loadInitialConfigFromStorage, parseImportedConfig as parseImportedConfigFromFile } from './utils/configSerialization';
import { DOCS_HOME_PATH, MARKDOWN_DOCS, type MarkdownDocEntry } from './constants/documents';
import { Play, Pause, RotateCcw, Download, Upload, Zap, MessageSquare, Loader2, Sparkles, Menu, X, Settings, BarChart3, ArrowRight, ArrowDownUp, Clock, PlayCircle, StopCircle, Box, Shuffle, AlertTriangle, Palette, Users, Dna, Copy, ClipboardPaste, Trash2, BookOpen } from 'lucide-react';

interface CanvasSpawnPosition {
  x: number;
  y: number;
}

type UiTheme = 'dark' | 'light' | 'ocean' | 'warm';
type CanvasViewMode = 'map' | 'metro';

const DURATION_UNITS = [
  { value: 'ms', label: 'ms' },
  { value: 's', label: 'seconds' },
  { value: 'min', label: 'minutes' },
  { value: 'h', label: 'hours' },
  { value: 'workingDay', label: 'working days (8h)' },
  { value: 'day', label: 'days' },
  { value: 'week', label: 'weeks' },
  { value: 'month', label: 'months' },
  { value: 'year', label: 'years' },
] as const;

const ARRIVAL_UNITS = [
  { value: 'ms', label: 'sim millisecond' },
  { value: 's', label: 'sim second' },
  { value: 'min', label: 'sim minute' },
  { value: 'h', label: 'sim hour' },
  { value: 'workingDay', label: 'sim working day (8h)' },
  { value: 'day', label: 'sim day' },
  { value: 'week', label: 'sim week' },
  { value: 'month', label: 'sim month' },
  { value: 'year', label: 'sim year' },
] as const;

const TIME_COMPRESSION_PRESETS = [
  { value: 1, label: 'Real-time', hint: '1 simulated second = 1 real second' },
  { value: 60, label: '1 sim min / sec', hint: 'Useful for short delay testing' },
  { value: 60 * 60, label: '1 sim hour / sec', hint: 'Good for shift-level simulations' },
  { value: 8 * 60 * 60, label: '1 sim working day / sec', hint: '8 simulated working hours per real second' },
  { value: 24 * 60 * 60, label: '1 sim day / sec', hint: 'Great for daily process playback' },
  { value: 7 * 24 * 60 * 60, label: '1 sim week / sec', hint: 'For weekly flow trends' },
  { value: 30 * 24 * 60 * 60, label: '1 sim month / sec', hint: 'For monthly cycle simulations' },
  { value: 365 * 24 * 60 * 60, label: '1 sim year / sec', hint: 'For long-horizon scenario testing' },
] as const;

const AUTO_PAUSE_TIME_UNITS: Array<{ value: DurationUnit; label: string; ms: number }> = [
  { value: 'ms', label: 'ms', ms: 1 },
  { value: 's', label: 'sec', ms: 1000 },
  { value: 'min', label: 'min', ms: 60 * 1000 },
  { value: 'h', label: 'hours', ms: 60 * 60 * 1000 },
  { value: 'workingDay', label: 'working days', ms: 8 * 60 * 60 * 1000 },
  { value: 'day', label: 'days', ms: 24 * 60 * 60 * 1000 },
  { value: 'week', label: 'weeks', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: 'month', label: 'months', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: 'year', label: 'years', ms: 365 * 24 * 60 * 60 * 1000 },
];

const DEFAULT_CALENDAR_START_ISO = '2026-01-05T00:00:00';

const UI_THEMES: { id: UiTheme; label: string; swatch: string }[] = [
  { id: 'dark', label: 'Dark', swatch: 'bg-slate-950' },
  { id: 'light', label: 'Light', swatch: 'bg-slate-100' },
  { id: 'ocean', label: 'Ocean', swatch: 'bg-cyan-700' },
  { id: 'warm', label: 'Warm', swatch: 'bg-orange-500' },
];

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const NON_WORKING_POLICY_LABELS: Record<NonWorkingArrivalPolicy, string> = {
  queue: 'Arrive and queue',
  delay: 'Delay arrivals',
  reject: 'Reject / cancel arrivals',
};

const formatBusinessDateTime = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const CUSTOM_CLOCK_VALUE = 'custom';
const FLOWSIM_EXPORT_VERSION = 3;
const FLOWSIM_DRAFT_STORAGE_KEY = 'flowsim-local-draft';
const FLOWSIM_METRICS_CYCLE_UNIT_KEY = 'flowsim-metrics-cycle-unit';
const VALID_NODE_TYPES: NodeType[] = ['start', 'process', 'end'];
const VALID_RANDOMNESS_MODES: RandomnessMode[] = ['fixed', 'range'];
const VALID_SIMULATION_MODES: StepSimulationMode[] = ['resource', 'delay'];
const VALID_ARRIVAL_INPUT_MODES: ArrivalInputMode[] = ['rate', 'interval'];
const VALID_RESOURCE_EXECUTION_MODES: ResourceExecutionMode[] = ['single', 'collaborative', 'multitask'];
const VALID_TEAM_ALLOCATION_MODES: TeamAllocationMode[] = ['auto', 'explicit'];
const VALID_ROUTING_STRATEGIES: RoutingStrategy[] = ['probability', 'load-aware', 'time-aware'];
const VALID_NON_WORKING_POLICIES: NonWorkingArrivalPolicy[] = ['queue', 'delay', 'reject'];
const DEFAULT_ZERO_VARIANCE_STEP_IDS = new Set(['step-1', 'step-2', 'step-3', 'step-4']);

const HTML_DOC_LINKS = [
  { href: DOCS_HOME_PATH, icon: '⚡', title: '快速參考（HTML）', description: '瀏覽器友好格式', toneClass: 'bg-emerald-500/10 group-hover:bg-emerald-500/20' },
  { href: `${DOCS_HOME_PATH}#quick-start`, icon: '🚀', title: '快速開始', description: '5 分鐘上手指南', toneClass: 'bg-blue-500/10 group-hover:bg-blue-500/20' },
  { href: `${DOCS_HOME_PATH}#modes`, icon: '📖', title: '三種模式對比', description: '詳細說明與選擇指南', toneClass: 'bg-blue-500/10 group-hover:bg-blue-500/20' },
  { href: `${DOCS_HOME_PATH}#faq`, icon: '🗂️', title: '常見問題', description: 'Q&A 與使用技巧', toneClass: 'bg-purple-500/10 group-hover:bg-purple-500/20' },
  { href: `${DOCS_HOME_PATH}#concepts`, icon: '🔬', title: '關鍵概念', description: '雙指標深入解析', toneClass: 'bg-amber-500/10 group-hover:bg-amber-500/20' },
];

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

const sanitizeOptionalNumber = (value: unknown, min = 0, max = 1000000) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : undefined;
};

const sanitizeStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = Array.from(new Set(
    value
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
  ));

  return values.length > 0 ? values : undefined;
};

const getArrivalUnitLabel = (unit?: DurationUnit) => (
  ARRIVAL_UNITS.find((option) => option.value === unit)?.label || 'sim second'
);

const getArrivalMinValue = (mode?: ArrivalInputMode) => mode === 'interval' ? 0.001 : 0.000000001;
const getBatchSize = (value: unknown) => Math.max(1, Math.min(1000, Math.round(toFiniteNumber(value, 1))));
const toPositiveInteger = (value: unknown, fallback: number, min = 1, max = 50) => {
  const parsed = Math.round(toFiniteNumber(value, fallback));
  return Math.max(min, Math.min(max, parsed));
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

const buildDefaultCollaborativeEfficiency = (maxResources: number) => Object.fromEntries(
  Array.from({ length: Math.max(1, maxResources) }, (_, index) => {
    const resources = index + 1;
    return [resources, resources === 1 ? 1 : Number((1 + (resources - 1) * 0.65).toFixed(2))];
  })
) as Record<number, number>;

const buildDefaultMultitaskEfficiency = (maxConcurrent: number) => Object.fromEntries(
  Array.from({ length: Math.max(1, maxConcurrent) }, (_, index) => {
    const load = index + 1;
    return [load, Number(Math.max(0.25, 1 - (load - 1) * 0.2).toFixed(2))];
  })
) as Record<number, number>;

const updateEfficiencyValue = (record: Record<number, number> | undefined, key: number, value: number) => ({
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

const DEFAULT_ITEM_PROFILE: ItemProfile = {
  id: 'standard',
  name: 'Standard',
  probability: 1,
  processingTimeMultiplier: 1,
  failureMultiplier: 1,
  cancellationMultiplier: 1,
  priority: 1,
  color: '#38bdf8',
};

const sanitizeItemProfiles = (value: unknown): ItemProfile[] => {
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

const getProfileProbabilityTotal = (step: ProcessStep) => (step.itemProfiles || []).reduce((sum, profile) => sum + (profile.probability || 0), 0);

const updateItemProfile = (step: ProcessStep, profileId: string, updates: Partial<ItemProfile>): ProcessStep => ({
  ...step,
  itemProfiles: sanitizeItemProfiles((step.itemProfiles || [DEFAULT_ITEM_PROFILE]).map((profile) => (
    profile.id === profileId ? { ...profile, ...updates } : profile
  ))),
});

const getEditableTeams = (step: ProcessStep) => (
  step.collaborativeTeams && step.collaborativeTeams.length > 0
    ? step.collaborativeTeams
    : [{ id: `team-${Date.now()}`, name: 'Team 1', resources: step.targetResourcesPerItem ?? 2 }]
);

const getTeamAllocationMode = (step: ProcessStep) => step.teamAllocationMode || (step.collaborativeTeams && step.collaborativeTeams.length > 0 ? 'explicit' : 'auto');
const getTeamResourceTotal = (step: ProcessStep) => getTeamAllocationMode(step) === 'explicit'
  ? getEditableTeams(step).reduce((sum, team) => sum + toPositiveInteger(team.resources, 1, 1, 50), 0)
  : step.capacity;

const getStepValidationError = (step: ProcessStep | null) => {
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

const cloneStep = (step: ProcessStep): ProcessStep => ({
  ...step,
  connections: step.connections.map((connection) => ({ ...connection })),
  sourceProcessingTimes: { ...(step.sourceProcessingTimes || {}) },
});

const buildClipboardSteps = (steps: ProcessStep[]) => {
  const includedIds = new Set(steps.map((step) => step.id));

  return steps.map((step) => ({
    ...cloneStep(step),
    connections: step.connections.filter((connection) => includedIds.has(connection.targetId)).map((connection) => ({ ...connection })),
    sourceProcessingTimes: Object.fromEntries(
      Object.entries(step.sourceProcessingTimes || {}).filter(([sourceId]) => includedIds.has(sourceId))
    ),
  }));
};

const pruneConnections = (connections: ProcessStep['connections']) => {
  const validConnections = connections.filter((connection) => connection.targetId);

  if (validConnections.length === 0) {
    return [];
  }

  return validConnections.map((connection) => ({ ...connection }));
};

const getStepWidth = (type: NodeType) => type === 'process' ? 320 : 280;

const getStepBounds = (steps: ProcessStep[]) => {
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

const buildUniqueCopyName = (name: string, usedNames: Set<string>) => {
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
        startHour: toFiniteNumber(rawStep.businessCalendar.startHour, DEFAULT_BUSINESS_CALENDAR.startHour ?? 9),
        endHour: toFiniteNumber(rawStep.businessCalendar.endHour, DEFAULT_BUSINESS_CALENDAR.endHour ?? 17),
        nonWorkingArrivalPolicy: typeof rawStep.businessCalendar.nonWorkingArrivalPolicy === 'string' && VALID_NON_WORKING_POLICIES.includes(rawStep.businessCalendar.nonWorkingArrivalPolicy as NonWorkingArrivalPolicy)
          ? rawStep.businessCalendar.nonWorkingArrivalPolicy as NonWorkingArrivalPolicy
          : DEFAULT_BUSINESS_CALENDAR.nonWorkingArrivalPolicy,
      })
    : undefined;
  const rawArrivalInputMode = rawStep.arrivalInputMode;
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
  const rawRoutingStrategy = rawStep.routingStrategy;
  const routingStrategy = !isEnd && typeof rawRoutingStrategy === 'string' && VALID_ROUTING_STRATEGIES.includes(rawRoutingStrategy as RoutingStrategy)
    ? rawRoutingStrategy as RoutingStrategy
    : !isEnd ? 'probability' : undefined;
  const routingLoadSensitivity = !isEnd ? Math.max(0, Math.min(10, toFiniteNumber(rawStep.routingLoadSensitivity, 1))) : undefined;
  const routingTimeSensitivity = !isEnd ? Math.max(0, Math.min(10, toFiniteNumber(rawStep.routingTimeSensitivity, 2))) : undefined;
  const routingCalendarAware = !isEnd ? rawStep.routingCalendarAware !== false : undefined;
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
  const endTimeUnit = isEnd && typeof rawStep.endTimeUnit === 'string' && DURATION_UNITS.some(unit => unit.value === rawStep.endTimeUnit)
    ? rawStep.endTimeUnit as DurationUnit
    : isEnd ? 'min' : undefined;
  const processingTimeUnit = typeof rawStep.processingTimeUnit === 'string' && DURATION_UNITS.some(unit => unit.value === rawStep.processingTimeUnit)
    ? rawStep.processingTimeUnit as DurationUnit
    : 'ms';
  const rangeTimeUnit = typeof rawStep.rangeTimeUnit === 'string' && DURATION_UNITS.some(unit => unit.value === rawStep.rangeTimeUnit)
    ? rawStep.rangeTimeUnit as DurationUnit
    : processingTimeUnit;
  const sourceProcessingTimeUnit = isProcess && typeof rawStep.sourceProcessingTimeUnit === 'string' && DURATION_UNITS.some(unit => unit.value === rawStep.sourceProcessingTimeUnit)
    ? rawStep.sourceProcessingTimeUnit as DurationUnit
    : isProcess ? processingTimeUnit : undefined;
  const connections = Array.isArray(rawStep.connections)
    ? rawStep.connections
        .filter(isObjectRecord)
        .map((connection) => {
          const minPriority = sanitizeOptionalNumber(connection.minPriority, 0);
          const maxPriority = sanitizeOptionalNumber(connection.maxPriority, 0);

          return {
            targetId: typeof connection.targetId === 'string' ? connection.targetId : '',
            probability: clampProbability(toFiniteNumber(connection.probability, 0)),
            itemProfileIds: sanitizeStringList(connection.itemProfileIds),
            minPriority: minPriority !== undefined && maxPriority !== undefined ? Math.min(minPriority, maxPriority) : minPriority,
            maxPriority: minPriority !== undefined && maxPriority !== undefined ? Math.max(minPriority, maxPriority) : maxPriority,
          };
        })
        .filter((connection) => connection.targetId)
    : [];
  const sourceProcessingTimes = isObjectRecord(rawStep.sourceProcessingTimes)
    ? Object.fromEntries(
        Object.entries(rawStep.sourceProcessingTimes)
          .filter(([key]) => typeof key === 'string' && key.length > 0)
          .map(([key, value]) => [key, Math.max(0, toFiniteNumber(value, 0))])
      )
    : {};
  const hasSourceProcessingRules = Object.keys(sourceProcessingTimes).length > 0;
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
    itemProfiles,
    failureProbability: Math.max(0, Math.min(1, toFiniteNumber(rawStep.failureProbability, 0))),
    cancellationProbability: Math.max(0, Math.min(1, toFiniteNumber(rawStep.cancellationProbability, 0))),
    color: typeof rawStep.color === 'string' && rawStep.color.trim() ? rawStep.color : isStart ? '#10b981' : isEnd ? '#ef4444' : '#3b82f6',
    routingStrategy,
    routingLoadSensitivity,
    routingTimeSensitivity,
    routingCalendarAware,
    connections,
    sourceProcessingTimes,
    sourceProcessingTimeUnit: hasSourceProcessingRules || typeof rawStep.sourceProcessingTimeUnit === 'string' ? sourceProcessingTimeUnit : undefined,
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
    const normalizedConnections = validConnections.map((connection) => ({ ...connection }));

    const filteredSourceRules = Object.fromEntries(
      Object.entries(step.sourceProcessingTimes || {}).filter(([sourceId]) => validIds.has(sourceId))
    );

    return {
      ...step,
      connections: normalizedConnections,
      sourceProcessingTimes: filteredSourceRules,
      calendarMode: step.calendarMode || 'inherit',
      businessCalendar: step.calendarMode === 'custom' ? normalizeBusinessCalendar(step.businessCalendar || { ...DEFAULT_BUSINESS_CALENDAR, enabled: true }) : undefined,
      minArrivalRate: step.type === 'start' ? Math.min(step.minArrivalRate ?? 0.2, step.maxArrivalRate ?? 0.8) : undefined,
      maxArrivalRate: step.type === 'start' ? Math.max(step.minArrivalRate ?? 0.2, step.maxArrivalRate ?? 0.8) : undefined,
      arrivalBatchSize: step.type === 'start' ? getBatchSize(step.arrivalBatchSize) : undefined,
      arrivalBatchIntervalMs: step.type === 'start' ? Math.max(0, toFiniteNumber(step.arrivalBatchIntervalMs, 0)) : undefined,
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
      routingStrategy: step.type !== 'end' ? step.routingStrategy || 'probability' : undefined,
      routingLoadSensitivity: step.type !== 'end' ? Math.max(0, Math.min(10, step.routingLoadSensitivity ?? 1)) : undefined,
      routingTimeSensitivity: step.type !== 'end' ? Math.max(0, Math.min(10, step.routingTimeSensitivity ?? 2)) : undefined,
      routingCalendarAware: step.type !== 'end' ? step.routingCalendarAware !== false : undefined,
      sourceProcessingTimeUnit: step.type === 'process' && (step.sourceProcessingTimeUnit || Object.keys(filteredSourceRules).length > 0) ? step.sourceProcessingTimeUnit || step.processingTimeUnit || 'ms' : undefined,
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
    calendarStartIso: typeof rawConfig.calendarStartIso === 'string' && rawConfig.calendarStartIso.trim() ? rawConfig.calendarStartIso : DEFAULT_CALENDAR_START_ISO,
    businessCalendar: isObjectRecord(rawConfig.businessCalendar)
      ? normalizeBusinessCalendar({
          enabled: Boolean(rawConfig.businessCalendar.enabled),
          daysOfWeek: Array.isArray(rawConfig.businessCalendar.daysOfWeek) ? rawConfig.businessCalendar.daysOfWeek.map(day => Number(day)) : DEFAULT_BUSINESS_CALENDAR.daysOfWeek,
          startHour: toFiniteNumber(rawConfig.businessCalendar.startHour, DEFAULT_BUSINESS_CALENDAR.startHour ?? 9),
          endHour: toFiniteNumber(rawConfig.businessCalendar.endHour, DEFAULT_BUSINESS_CALENDAR.endHour ?? 17),
          nonWorkingArrivalPolicy: typeof rawConfig.businessCalendar.nonWorkingArrivalPolicy === 'string' && VALID_NON_WORKING_POLICIES.includes(rawConfig.businessCalendar.nonWorkingArrivalPolicy as NonWorkingArrivalPolicy)
            ? rawConfig.businessCalendar.nonWorkingArrivalPolicy as NonWorkingArrivalPolicy
            : DEFAULT_BUSINESS_CALENDAR.nonWorkingArrivalPolicy,
        })
      : DEFAULT_BUSINESS_CALENDAR,
    demandModifiers: Array.isArray(rawConfig.demandModifiers)
      ? normalizeDemandModifiers(rawConfig.demandModifiers.filter(isObjectRecord) as Partial<DemandModifier>[])
      : [],
    autoPause: sanitizeAutoPause(rawConfig.autoPause),
  };
};

const parseImportedConfig = (payload: unknown): SimulationConfig => {
  if (isObjectRecord(payload) && isObjectRecord(payload.config)) {
    return sanitizeConfig(payload.config, shouldMigrateDefaultVariance(payload));
  }

  return sanitizeConfig(payload, isObjectRecord(payload) ? shouldMigrateDefaultVariance(payload) : false);
};

const loadInitialConfig = (): SimulationConfig => {
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

const App: React.FC = () => {
  // App State
  const [config, setConfig] = useState<SimulationConfig>(loadInitialConfigFromStorage);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isDocsMenuOpen, setIsDocsMenuOpen] = useState(false);
  const [markdownViewer, setMarkdownViewer] = useState<{ isOpen: boolean; file: string; title: string }>({
    isOpen: false,
    file: '',
    title: ''
  });

  const openMarkdownDoc = (doc: MarkdownDocEntry) => {
    setMarkdownViewer({
      isOpen: true,
      file: doc.defaultPath,
      title: doc.title,
    });
    setIsDocsMenuOpen(false);
  };

  const [importExportNotice, setImportExportNotice] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<'restored' | 'saved' | 'save-failed' | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(FLOWSIM_DRAFT_STORAGE_KEY) ? 'restored' : null;
  });
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    const savedTheme = localStorage.getItem('flowsim-ui-theme') as UiTheme | null;
    return savedTheme && UI_THEMES.some(theme => theme.id === savedTheme) ? savedTheme : 'dark';
  });
  const [metricsCycleTimeUnit, setMetricsCycleTimeUnit] = useState<DurationUnit>(() => {
    if (typeof window === 'undefined') {
      return 'min';
    }

    const savedUnit = window.localStorage.getItem(FLOWSIM_METRICS_CYCLE_UNIT_KEY);
    return DURATION_UNITS.some((unit) => unit.value === savedUnit) ? savedUnit as DurationUnit : 'min';
  });
  const [canvasViewMode, setCanvasViewMode] = useState<CanvasViewMode>('map');
  const [flowClipboard, setFlowClipboard] = useState<ProcessStep[] | null>(null);
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  const [autoPauseNotice, setAutoPauseNotice] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  
  // Edit Modal State
  const [editingStep, setEditingStep] = useState<ProcessStep | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'connections' | 'rules' | 'exceptions'>('basic');
  const editingStepValidationError = getStepValidationError(editingStep);

  // Simulation Hook
  const { items, stepStats, flowStats, routeStats, simulationTimeMs, globalStats, autoPauseReason, resetSimulation } = useProcessSimulation(config, (reason) => {
    setConfig((previous) => previous.isRunning ? { ...previous, isRunning: false } : previous);
    setAutoPauseNotice(reason);
  });

  // Handlers
  const togglePlay = () => {
    setAutoPauseNotice(null);
    setConfig(p => ({ ...p, isRunning: !p.isRunning }));
  };

  const startSimulation = () => {
    setAutoPauseNotice(null);
    setConfig(p => p.isRunning ? p : { ...p, isRunning: true });
  };

  const stopSimulation = () => {
    setConfig(p => p.isRunning ? { ...p, isRunning: false } : p);
  };

  const resetSimulationRun = () => {
    setAutoPauseNotice(null);
    resetSimulation();
  };
  
  const saveStepUpdate = () => {
    if (!editingStep) return;
    if (editingStepValidationError) return;
    const stepToSave = editingStep.calendarMode === 'custom'
      ? {
          ...editingStep,
          businessCalendar: normalizeBusinessCalendar({
            ...(editingStep.businessCalendar || normalizeBusinessCalendar(config.businessCalendar)),
            enabled: true,
          }),
        }
      : editingStep;
    setConfig(p => ({
      ...p,
      steps: p.steps.map(s => s.id === editingStep.id ? stepToSave : s)
    }));
    setEditingStep(null);
  };

  const removeSteps = (stepIds: string[], label = 'selected steps') => {
    const uniqueIds = Array.from(new Set(stepIds));
    if (uniqueIds.length === 0) {
      return;
    }

    const removedIds = new Set(uniqueIds);

    setConfig((previous) => ({
      ...previous,
      isRunning: false,
      steps: previous.steps
        .filter((step) => !removedIds.has(step.id))
        .map((step) => ({
          ...step,
          connections: pruneConnections(
            step.connections.filter((connection) => !removedIds.has(connection.targetId))
          ),
          sourceProcessingTimes: Object.fromEntries(
            Object.entries(step.sourceProcessingTimes || {}).filter(([sourceId]) => !removedIds.has(sourceId))
          ),
        })),
    }));

    setSelectedStepIds((current) => current.filter((id) => !removedIds.has(id)));
    setEditingStep((current) => current && removedIds.has(current.id) ? null : current);
    setAiAnalysis(null);
    resetSimulation();
    setImportExportNotice(`Deleted ${uniqueIds.length} ${label}.`);
  };

  const removeStep = (id: string) => {
    removeSteps([id], 'step');
  };

  const removeSelectedSteps = () => {
    removeSteps(selectedStepIds, 'selected steps');
  };

  const clearCanvas = () => {
    if (config.steps.length === 0) {
      return;
    }

    if (!window.confirm(`Clear all ${config.steps.length} steps from the canvas?`)) {
      return;
    }

    setConfig((previous) => ({
      ...previous,
      isRunning: false,
      steps: [],
    }));
    setSelectedStepIds([]);
    setEditingStep(null);
    setAiAnalysis(null);
    resetSimulation();
    setImportExportNotice('Cleared the canvas.');
  };

  const updateStepPosition = (id: string, position: CanvasSpawnPosition) => {
    setConfig((p) => ({
      ...p,
      steps: p.steps.map((step) => step.id === id ? { ...step, x: position.x, y: position.y } : step),
    }));
  };

  const addStep = (type: NodeType, position?: CanvasSpawnPosition) => {
    const isStart = type === 'start';
    const isEnd = type === 'end';
    
    const newStep: ProcessStep = {
      id: `node-${Date.now()}`,
      type: type,
      name: isStart ? 'Start Point' : isEnd ? 'End Point' : 'New Step',
      randomnessMode: 'fixed',
      arrivalModel: isStart ? 'simple' : undefined,
      arrivalInputMode: isStart ? 'rate' : undefined,
      arrivalUnit: isStart ? 'h' : undefined,
      endTimeUnit: isEnd ? 'min' : undefined,
      simulationMode: type === 'process' ? 'resource' : undefined,
      capacity: isStart || isEnd ? 0 : 1,
      processingTime: isStart || isEnd ? 0 : 2000,
      processingTimeUnit: 'ms',
      variance: 0,
      minProcessingTime: 1000,
      maxProcessingTime: 3000,
      rangeTimeUnit: 'ms',
      arrivalRate: isStart ? 12 : undefined,
      minArrivalRate: isStart ? 8 : undefined,
      maxArrivalRate: isStart ? 20 : undefined,
      arrivalBatchSize: isStart ? 1 : undefined,
      arrivalBatchIntervalMs: isStart ? 0 : undefined,
      demandModifiers: isStart ? [] : undefined,
      arrivalSchedule: isStart ? [] : undefined,
      arrivalEvents: isStart ? [] : undefined,
      failureProbability: 0,
      cancellationProbability: 0,
      color: isStart ? '#10b981' : isEnd ? '#ef4444' : '#3b82f6',
      connections: [],
      sourceProcessingTimes: {},
      x: position?.x ?? 100,
      y: position?.y ?? 100
    };
    setConfig(p => ({ ...p, steps: [...p.steps, newStep] }));
  };

  const copyFlow = (stepsToCopy: ProcessStep[] = config.steps, label = 'flow') => {
    if (stepsToCopy.length === 0) {
      setImportExportNotice('Nothing to copy yet. Add at least one step first.');
      return;
    }

    const clipboardSteps = buildClipboardSteps(stepsToCopy);
    setFlowClipboard(clipboardSteps);
    setImportExportNotice(`Copied ${clipboardSteps.length} steps from the ${label}. Paste to duplicate it.`);
  };

  const copySelectedFlow = () => {
    const selectedSteps = config.steps.filter((step) => selectedStepIds.includes(step.id));
    copyFlow(selectedSteps, 'selected area');
  };

  const pasteFlow = () => {
    if (!flowClipboard || flowClipboard.length === 0) {
      setImportExportNotice('Copy a flow first, then paste it onto the canvas.');
      return;
    }

    const clipboardSnapshot = flowClipboard.map(cloneStep);
    const sourceBounds = getStepBounds(clipboardSnapshot);
    const existingBounds = getStepBounds(config.steps);
    const offsetX = config.steps.length === 0
      ? 80 - sourceBounds.minX
      : existingBounds.maxX + 180 - sourceBounds.minX;
    const offsetY = config.steps.length === 0 ? 80 - sourceBounds.minY : 0;
    const copiedAt = Date.now();
    const idMap = new Map<string, string>();
    const usedNames = new Set(config.steps.map((step) => step.name));

    const duplicatedSteps = clipboardSnapshot.map((step, index) => {
      const nextId = `node-${copiedAt}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      idMap.set(step.id, nextId);

      return {
        ...step,
        id: nextId,
        name: buildUniqueCopyName(step.name, usedNames),
        x: (step.x ?? 0) + offsetX,
        y: (step.y ?? 0) + offsetY,
      };
    }).map((step) => ({
      ...step,
      connections: step.connections
        .map((connection) => ({
          ...connection,
          targetId: idMap.get(connection.targetId) || '',
        }))
        .filter((connection) => connection.targetId),
      sourceProcessingTimes: Object.fromEntries(
        Object.entries(step.sourceProcessingTimes || {})
          .map(([sourceId, time]) => [idMap.get(sourceId) || '', time])
          .filter(([sourceId]) => sourceId)
      ),
    }));

    setConfig((previous) => ({
      ...previous,
      isRunning: false,
      steps: [...previous.steps, ...duplicatedSteps],
    }));
    setEditingStep(null);
    setAiAnalysis(null);
    resetSimulation();
    setImportExportNotice(`Pasted ${duplicatedSteps.length} copied steps to the right of the current flow.`);
  };

  const toggleConnection = (targetId: string, checked: boolean) => {
    if (!editingStep) return;
    let newConns = [...(editingStep.connections || [])];
    
    if (checked) {
        newConns.push({ targetId, probability: 1.0 });
    } else {
        newConns = newConns.filter(c => c.targetId !== targetId);
    }
    
    // Normalize probabilities (simple auto-balance)
    if (newConns.length > 0) {
        const prob = 1 / newConns.length;
        newConns = newConns.map(c => ({ ...c, probability: prob }));
    }

    setEditingStep({ ...editingStep, connections: newConns });
  };

  const updateConnection = (targetId: string, updates: Partial<ProcessStep['connections'][number]>) => {
      if (!editingStep) return;
      const sanitizedUpdates: Partial<ProcessStep['connections'][number]> = { ...updates };
      if ('probability' in updates) {
        sanitizedUpdates.probability = typeof updates.probability === 'number' && Number.isFinite(updates.probability)
          ? clampProbability(updates.probability)
          : 0;
      }
      if ('itemProfileIds' in updates) {
        sanitizedUpdates.itemProfileIds = updates.itemProfileIds && updates.itemProfileIds.length > 0 ? updates.itemProfileIds : undefined;
      }
      if ('minPriority' in updates) {
        sanitizedUpdates.minPriority = typeof updates.minPriority === 'number' && Number.isFinite(updates.minPriority) ? Math.max(0, updates.minPriority) : undefined;
      }
      if ('maxPriority' in updates) {
        sanitizedUpdates.maxPriority = typeof updates.maxPriority === 'number' && Number.isFinite(updates.maxPriority) ? Math.max(0, updates.maxPriority) : undefined;
      }
      const newConns = editingStep.connections.map(c => {
         if (c.targetId !== targetId) {
           return c;
         }

         const nextConnection = { ...c, ...sanitizedUpdates };
         if (typeof nextConnection.minPriority === 'number' && typeof nextConnection.maxPriority === 'number' && nextConnection.minPriority > nextConnection.maxPriority) {
           return {
             ...nextConnection,
             minPriority: nextConnection.maxPriority,
             maxPriority: nextConnection.minPriority,
           };
         }

         return nextConnection;
      });
      setEditingStep({ ...editingStep, connections: newConns });
  };

  const updateProbability = (targetId: string, newVal: number) => {
      updateConnection(targetId, { probability: newVal });
  };

  const updateSourceRule = (sourceId: string, time: number) => {
      if (!editingStep) return;
      const newRules = { ...(editingStep.sourceProcessingTimes || {}) };
      if (Number.isFinite(time) && time >= 0) {
        newRules[sourceId] = time;
      } else {
        delete newRules[sourceId];
      }
      setEditingStep({
        ...editingStep,
        sourceProcessingTimes: newRules,
        sourceProcessingTimeUnit: editingStep.sourceProcessingTimeUnit || editingStep.processingTimeUnit || 'ms',
      });
  };

  const addStartDemandModifier = () => {
    if (!editingStep || editingStep.type !== 'start') return;
    const modifiers = normalizeDemandModifiers(editingStep.demandModifiers);
    setEditingStep({
      ...editingStep,
      demandModifiers: normalizeDemandModifiers([
        ...modifiers,
        {
          id: `modifier-${Date.now()}`,
          name: `Peak ${modifiers.length + 1}`,
          enabled: true,
          multiplier: 2,
          startHour: 9,
          endHour: 11,
        },
      ]),
    });
  };

  const addArrivalWindow = () => {
    if (!editingStep || editingStep.type !== 'start') return;
    setEditingStep({
      ...editingStep,
      arrivalModel: 'schedule',
      arrivalSchedule: [
        ...(editingStep.arrivalSchedule || []),
        {
          id: `schedule-${Date.now()}`,
          name: `Window ${(editingStep.arrivalSchedule || []).length + 1}`,
          enabled: true,
          startHour: 9,
          endHour: 17,
          quantity: 20,
          spreadMode: 'spread',
        },
      ],
    });
  };

  const addArrivalEvent = () => {
    if (!editingStep || editingStep.type !== 'start') return;
    setEditingStep({
      ...editingStep,
      arrivalModel: 'events',
      arrivalEvents: [
        ...(editingStep.arrivalEvents || []),
        {
          id: `event-${Date.now()}`,
          name: `Dispatch ${(editingStep.arrivalEvents || []).length + 1}`,
          enabled: true,
          dayOffset: 0,
          hour: 9,
          quantity: 10,
          repeat: 'none',
          repeatEvery: 1,
          dispatchMode: 'burst',
          itemInterval: 0,
          itemIntervalUnit: 's',
        },
      ],
    });
  };

  const handleGenerateScenario = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const steps = await generateScenario(aiPrompt);
      setConfig(p => ({ ...p, steps, isRunning: false }));
      resetSimulation();
      setAiPrompt('');
      setIsSidebarOpen(false); 
    } catch (e) {
      alert("Failed to generate scenario. Ensure API Key is selected.");
    } finally {
      setIsGenerating(false);
    }
  };

  const loadRoutingDemo = () => {
    setConfig({
      ...ROUTING_DEMO_CONFIG,
      steps: ROUTING_DEMO_CONFIG.steps.map((step) => ({
        ...step,
        connections: step.connections.map((connection) => ({ ...connection })),
        sourceProcessingTimes: { ...(step.sourceProcessingTimes || {}) },
        itemProfiles: step.itemProfiles?.map((profile) => ({ ...profile })),
        demandModifiers: step.demandModifiers?.map((modifier) => ({ ...modifier })),
        arrivalSchedule: step.arrivalSchedule?.map((window) => ({ ...window })),
        arrivalEvents: step.arrivalEvents?.map((event) => ({ ...event })),
        collaborativeTeams: step.collaborativeTeams?.map((team) => ({ ...team })),
        collaborativeEfficiency: step.collaborativeEfficiency ? { ...step.collaborativeEfficiency } : undefined,
        multitaskEfficiency: step.multitaskEfficiency ? { ...step.multitaskEfficiency } : undefined,
        businessCalendar: step.businessCalendar ? { ...step.businessCalendar, workingHours: step.businessCalendar.workingHours?.map((segment) => ({ ...segment })) } : undefined,
      })),
      isRunning: false,
    });
    setSelectedStepIds([]);
    setEditingStep(null);
    setAiAnalysis(null);
    setCanvasViewMode('map');
    resetSimulation();
    setImportExportNotice('Loaded VIP + load-aware + time-aware routing demo. Press Start to see profile filters, ETA, and adaptive route shares.');
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    // Filter out start/end nodes for bottleneck analysis generally
    const processSteps = config.steps.filter(s => s.type === 'process');
    const analysis = await analyzeBottlenecks(processSteps, stepStats, globalStats);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const [hasApiKey, setHasApiKey] = useState(false);
  useEffect(() => {
    if (process.env.API_KEY) setHasApiKey(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('flowsim-ui-theme', uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    window.localStorage.setItem(FLOWSIM_METRICS_CYCLE_UNIT_KEY, metricsCycleTimeUnit);
  }, [metricsCycleTimeUnit]);

  useEffect(() => {
    try {
      const draftPayload = {
        app: 'FlowSim',
        version: FLOWSIM_EXPORT_VERSION,
        savedAt: new Date().toISOString(),
        config: {
          ...config,
          isRunning: false,
        },
      };

      window.localStorage.setItem(FLOWSIM_DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
      setDraftStatus((current) => current === 'restored' ? 'restored' : 'saved');
    } catch (error) {
      console.error('Failed to save FlowSim draft.', error);
      setDraftStatus('save-failed');
    }
  }, [config]);

  const selectApiKey = async () => {
    if (window.aistudio) {
        try {
            await window.aistudio.openSelectKey();
            setHasApiKey(true);
            window.location.reload(); 
        } catch (e) {
            console.error(e);
        }
    } else {
        alert("AI Studio environment not detected.");
    }
  };

  // Helper to find potential sources for the currently editing step
  const potentialSources = React.useMemo(() => {
     if (!editingStep) return [];
     return config.steps.filter(s => s.connections.some(c => c.targetId === editingStep.id));
  }, [config.steps, editingStep]);

  const exportConfig = () => {
    const payload = {
      app: 'FlowSim',
      version: FLOWSIM_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      config,
    };
    const fileName = `flowsim-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setImportExportNotice(`Exported ${config.steps.length} steps to ${fileName}`);
  };

  const triggerImport = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const importedConfig = parseImportedConfigFromFile(parsed);

      setConfig(importedConfig);
      setEditingStep(null);
      setSelectedStepIds([]);
      setAiAnalysis(null);
      resetSimulation();
      setDraftStatus('saved');
      setImportExportNotice(`Imported ${importedConfig.steps.length} steps from ${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.';
      setImportExportNotice(`Import failed: ${message}`);
    }
  };

  useEffect(() => {
    if (!importExportNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setImportExportNotice(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [importExportNotice]);

  useEffect(() => {
    if (!draftStatus) {
      return;
    }

    const timeoutId = window.setTimeout(() => setDraftStatus(null), draftStatus === 'save-failed' ? 5000 : 2500);
    return () => window.clearTimeout(timeoutId);
  }, [draftStatus]);

  useEffect(() => {
    const validIds = new Set(config.steps.map((step) => step.id));
    setSelectedStepIds((current) => current.filter((id) => validIds.has(id)));
  }, [config.steps]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = !!target?.closest('input, textarea, select, [contenteditable="true"]');

      if (isTypingTarget) {
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedStepIds.length > 0) {
        event.preventDefault();
        removeSelectedSteps();
        return;
      }

      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'c') {
        event.preventDefault();
        if (selectedStepIds.length > 0) {
          copySelectedFlow();
        } else {
          copyFlow();
        }
      }

      if (key === 'v' && flowClipboard && flowClipboard.length > 0) {
        event.preventDefault();
        pasteFlow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flowClipboard, selectedStepIds]);

  const runningLabel = config.isRunning ? 'Running' : 'Paused';
  const totalQueue = stepStats.reduce((sum, s) => sum + s.queueLength, 0);
  const activeCompressionPreset = TIME_COMPRESSION_PRESETS.find(preset => preset.value === config.timeCompression);
  const simulationClockLabel = formatSimulationTime(simulationTimeMs);
  const compressionSelectValue = activeCompressionPreset ? String(activeCompressionPreset.value) : CUSTOM_CLOCK_VALUE;
  const autoPauseTimeUnit = config.autoPause?.simulationTimeUnit || 'ms';
  const autoPauseTimeUnitMs = AUTO_PAUSE_TIME_UNITS.find((unit) => unit.value === autoPauseTimeUnit)?.ms || 1;
  const autoPauseTimeValue = typeof config.autoPause?.simulationTimeMs === 'number'
    ? Number((config.autoPause.simulationTimeMs / autoPauseTimeUnitMs).toFixed(3))
    : '';
  const calendarStartMs = Date.parse(config.calendarStartIso || DEFAULT_CALENDAR_START_ISO);
  const safeCalendarStartMs = Number.isFinite(calendarStartMs) ? calendarStartMs : Date.parse(DEFAULT_CALENDAR_START_ISO);
  const stopDateMs = config.autoPause?.stopDateIso ? Date.parse(config.autoPause.stopDateIso) : NaN;
  const isStopDateBeforeStart = Boolean(config.autoPause?.stopDateIso && Number.isFinite(stopDateMs) && stopDateMs <= safeCalendarStartMs);
  const calendarStartInputValue = (config.calendarStartIso || DEFAULT_CALENDAR_START_ISO).slice(0, 16);
  const draftStatusMessage = draftStatus === 'restored'
    ? 'Recovered your last local draft.'
    : draftStatus === 'saved'
      ? 'Draft auto-saved locally.'
      : draftStatus === 'save-failed'
        ? 'Local draft save failed.'
        : null;

  const applyClockPreset = (value: string) => {
    if (value === CUSTOM_CLOCK_VALUE) {
      return;
    }

    setConfig((p) => ({ ...p, timeCompression: Number(value) }));
  };

  const applyCustomClockValue = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    setConfig((p) => ({ ...p, timeCompression: parsed }));
  };

  const businessCalendar = normalizeBusinessCalendar(config.businessCalendar);
  const demandModifiers = normalizeDemandModifiers(config.demandModifiers);
  const currentBusinessDate = getBusinessDate(config.calendarStartIso, simulationTimeMs);
  const globalIsWorking = isWorkingTime(businessCalendar, config.calendarStartIso, simulationTimeMs);
  const activeDemandModifiers = getActiveDemandModifiers(demandModifiers, config.calendarStartIso, simulationTimeMs);
  const activeDemandModifierIds = new Set(activeDemandModifiers.map((modifier) => modifier.id));
  const currentDemandMultiplier = getDemandMultiplier(demandModifiers, config.calendarStartIso, simulationTimeMs);
  const autoPauseProgressRows = getAutoPauseProgressRows(config.autoPause, globalStats, simulationTimeMs, config.calendarStartIso);
  const updateBusinessCalendar = (updates: Partial<typeof businessCalendar>) => {
    setConfig((previous) => ({
      ...previous,
      businessCalendar: normalizeBusinessCalendar({ ...normalizeBusinessCalendar(previous.businessCalendar), ...updates }),
    }));
  };
  const updateDemandModifier = (modifierId: string, updates: Partial<DemandModifier>) => {
    setConfig((previous) => ({
      ...previous,
      demandModifiers: normalizeDemandModifiers((previous.demandModifiers || []).map((modifier) => (
        modifier.id === modifierId ? { ...modifier, ...updates } : modifier
      ))),
    }));
  };
  const addDemandModifier = () => {
    setConfig((previous) => {
      const modifiers = normalizeDemandModifiers(previous.demandModifiers);
      return {
        ...previous,
        demandModifiers: normalizeDemandModifiers([
          ...modifiers,
          {
            id: `modifier-${Date.now()}`,
            name: `Peak ${modifiers.length + 1}`,
            enabled: true,
            multiplier: 2,
            startHour: 9,
            endHour: 11,
          },
        ]),
      };
    });
  };
  const removeDemandModifier = (modifierId: string) => {
    setConfig((previous) => ({
      ...previous,
      demandModifiers: (previous.demandModifiers || []).filter((modifier) => modifier.id !== modifierId),
    }));
  };

  return (
    <div data-theme={uiTheme} className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-blue-500/30 theme-root">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md flex items-center justify-between px-4 md:px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-900/20">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">FlowSim</h1>
            <p className="text-[11px] text-slate-500 hidden sm:block">Process optimizer workspace</p>
          </div>
          <button
            onClick={() => setIsDesktopSidebarCollapsed((value) => !value)}
            className="hidden items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 shadow-sm transition hover:border-blue-500/50 hover:bg-slate-800 hover:text-white lg:flex"
            title={isDesktopSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar for presentation'}
          >
            {isDesktopSidebarCollapsed ? <Menu size={14} /> : <X size={14} />}
            {isDesktopSidebarCollapsed ? 'Show controls' : 'Hide controls'}
          </button>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="hidden md:flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/80 p-1 theme-switcher">
             <Palette size={14} className="ml-2 mr-1 text-slate-400" />
             {UI_THEMES.map(theme => (
               <button
                 key={theme.id}
                 onClick={() => setUiTheme(theme.id)}
                 className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${uiTheme === theme.id ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
                 title={`Switch to ${theme.label} theme`}
               >
                 <span className={`h-2.5 w-2.5 rounded-full border border-white/30 ${theme.swatch}`} />
                 {theme.label}
               </button>
             ))}
           </div>
           <div className="hidden sm:flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/80 p-1">
             <button
               onClick={startSimulation}
               disabled={config.isRunning}
               className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-45"
               title="Start simulation"
             >
               <Play size={14} />
               <span className="hidden xl:inline">Start</span>
             </button>
             <button
               onClick={stopSimulation}
               disabled={!config.isRunning}
               className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-45"
               title="Stop simulation"
             >
               <StopCircle size={14} />
               <span className="hidden xl:inline">Stop</span>
             </button>
             <button
               onClick={resetSimulationRun}
               className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
               title="Reset simulation"
             >
               <RotateCcw size={14} />
               <span className="hidden xl:inline">Reset</span>
             </button>
           </div>
           <div className={`hidden sm:flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${config.isRunning ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
             <span className={`h-2 w-2 rounded-full ${config.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
             {runningLabel}
           </div>
           <div className="hidden xl:flex min-w-[8.5rem] items-center justify-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
             <Clock size={14} />
             <span className="min-w-[8ch] text-right font-mono tabular-nums">{simulationClockLabel}</span>
           </div>
           {!hasApiKey && (
             <button onClick={selectApiKey} className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-full transition-colors font-medium">
               Select API Key
             </button>
           )}
           <div className="relative">
             <button
               className="hidden md:flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-blue-500/50 hover:bg-slate-800 hover:text-white transition-colors"
               onClick={() => setIsDocsMenuOpen(!isDocsMenuOpen)}
               title="Documentation"
             >
               <BookOpen size={14} />
               <span className="hidden lg:inline">Docs</span>
             </button>
             {isDocsMenuOpen && (
               <>
                 <div
                   className="fixed inset-0 z-40"
                   onClick={() => setIsDocsMenuOpen(false)}
                 />
                 <div className="absolute right-0 mt-2 max-h-[calc(100vh-5rem)] w-80 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl z-50">
                   <div className="bg-gradient-to-r from-blue-600 to-emerald-600 p-3">
                     <h3 className="text-sm font-bold text-white flex items-center gap-2">
                       <BookOpen size={16} />
                       FlowSim 文檔中心
                     </h3>
                     <p className="text-xs text-blue-100 mt-1">統一管理指南、技術文檔與多語版本</p>
                   </div>
                   <div className="custom-scrollbar max-h-[calc(100vh-10rem)] overflow-y-auto p-2 space-y-1">
                     <a
                       href={DOCS_HOME_PATH}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors group"
                     >
                       <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                         <span className="text-lg">🏠</span>
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="text-sm font-semibold text-slate-200 group-hover:text-white">文檔中心首頁</div>
                         <div className="text-xs text-slate-400 mt-0.5">所有文檔的入口與總覽</div>
                       </div>
                     </a>
                     <div className="border-t border-slate-800 my-2"></div>
                    {MARKDOWN_DOCS.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => openMarkdownDoc(doc)}
                        className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors group text-left"
                      >
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${doc.toneClass.startsWith('from-') ? `bg-gradient-to-br ${doc.toneClass}` : doc.toneClass}`}>
                          <span className="text-lg">{doc.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-200 group-hover:text-white">
                            {doc.shortTitle} <span className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full">MD</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{doc.description}</div>
                        </div>
                      </button>
                    ))}
                    <div className="border-t border-slate-800 my-2"></div>
                     {HTML_DOC_LINKS.map((link) => (
                       <a
                         key={link.href}
                         href={link.href}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors group"
                       >
                         <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${link.toneClass}`}>
                           <span className="text-lg">{link.icon}</span>
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="text-sm font-semibold text-slate-200 group-hover:text-white">{link.title}</div>
                           <div className="text-xs text-slate-400 mt-0.5">{link.description}</div>
                         </div>
                       </a>
                     ))}
                   </div>
                 </div>
               </>
             )}
           </div>
           <button
             className="lg:hidden p-2 text-slate-400 hover:text-white"
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
           >
             <Menu size={24} />
           </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row relative overflow-hidden">
        {/* Sidebar */}
        <aside className={`
        fixed inset-y-0 left-0 z-40 w-80 bg-slate-950/95 backdrop-blur-xl border-r border-slate-800 
        transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:bg-slate-900/70 lg:backdrop-blur-none
        flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden
        ${isDesktopSidebarCollapsed ? 'lg:w-0 lg:border-r-0' : 'lg:w-80'}
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-4 flex items-center justify-between lg:hidden border-b border-slate-800">
             <span className="font-semibold text-slate-200">AI & Insights</span>
             <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400"><X size={20}/></button>
          </div>

          <div className="custom-scrollbar h-full overflow-y-auto p-4 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Settings size={14}/> Quick Controls
              </h3>
              <div className="md:hidden space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Palette size={14}/> Theme
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {UI_THEMES.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setUiTheme(theme.id)}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${uiTheme === theme.id ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-800 bg-slate-900 text-slate-400'}`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full border border-white/30 ${theme.swatch}`} />
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={togglePlay}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-all ${
                    config.isRunning
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/50 hover:bg-amber-500/20'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-lg shadow-emerald-900/20'
                  }`}
                >
                  {config.isRunning ? <><Pause size={18}/> Pause</> : <><Play size={18}/> Start</>}
                </button>
                <button
                  onClick={resetSimulation}
                  className="p-2.5 rounded-lg bg-slate-700 border border-slate-500 hover:bg-slate-600 text-slate-200 transition-colors"
                  title="Reset"
                >
                  <RotateCcw size={18}/>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Speed</span>
                    <span className="font-mono text-purple-400">{config.speedMultiplier}x</span>
                  </div>
                  <input
                    type="range" min="1" max="10" step="1"
                    value={config.speedMultiplier}
                    onChange={(e) => setConfig(p => ({ ...p, speedMultiplier: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-start text-xs mb-1 gap-2">
                    <span className="text-slate-400">Sim Clock</span>
                    <span className="text-right font-mono text-cyan-400 text-[10px] leading-tight">{activeCompressionPreset?.label || `${config.timeCompression}x`}</span>
                  </div>
                  <select
                    value={compressionSelectValue}
                    onChange={(e) => applyClockPreset(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 outline-none transition focus:border-cyan-500"
                  >
                    {TIME_COMPRESSION_PRESETS.map((preset) => (
                      <option key={preset.value} value={String(preset.value)}>{preset.label}</option>
                    ))}
                    <option value={CUSTOM_CLOCK_VALUE}>Custom</option>
                  </select>
                  <div className="mt-2">
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={config.timeCompression}
                      onChange={(e) => applyCustomClockValue(e.target.value)}
                      placeholder="Custom ratio"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 outline-none transition focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-300">Sim Time</span>
                    <span className="font-mono text-cyan-300">{simulationClockLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Clock size={14}/> Business Time
                </h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${globalIsWorking ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-400'}`}>
                  {globalIsWorking ? 'Open' : 'Closed'}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-slate-950/50 px-2.5 py-1.5">
                  <span className="text-slate-400 text-[11px]">Date</span>
                  <span className="font-mono text-emerald-100 text-[11px]">{formatBusinessDateTime(currentBusinessDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5">
                  <span className="text-slate-400 text-[11px]">Demand</span>
                  <span className="font-mono font-bold text-amber-200 text-[11px]">x{currentDemandMultiplier.toFixed(2)}</span>
                </div>
                {activeDemandModifiers.length > 0 && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-1.5">
                    <div className="mb-1.5 text-[10px] text-slate-400">Active peaks:</div>
                    <div className="flex flex-wrap gap-1">
                      {activeDemandModifiers.map((modifier) => (
                        <span key={modifier.id} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-100">
                          {modifier.name} x{modifier.multiplier}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {autoPauseProgressRows.length > 0 && (
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5">
                    <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-rose-200">Auto Pause Progress</div>
                    <div className="space-y-1">
                      {autoPauseProgressRows.map((row) => {
                        const pct = Math.min(100, (row.value / Math.max(1, row.target)) * 100);
                        return (
                          <div key={row.label}>
                            <div className="mb-0.5 flex justify-between gap-2 text-[9px] text-slate-400">
                              <span>{row.label}</span>
                              <span className="font-mono text-rose-100">{row.valueLabel || Math.floor(row.value)}/{row.targetLabel || row.target}</span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                              <div className="h-full rounded-full bg-rose-400" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={14}/> Auto Pause
                </h3>
                <button
                  onClick={() => setConfig((previous) => ({ ...previous, autoPause: { ...(previous.autoPause || { enabled: false }), enabled: !previous.autoPause?.enabled } }))}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${config.autoPause?.enabled ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                >
                  {config.autoPause?.enabled ? 'On' : 'Off'}
                </button>
              </div>
              {(autoPauseNotice || autoPauseReason) && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-100">
                  Paused: {autoPauseNotice || autoPauseReason}
                </div>
              )}
              {config.autoPause?.enabled && (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-rose-200">Sim time</label>
                    <div className="grid grid-cols-[1fr_96px] gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="duration"
                        value={autoPauseTimeValue}
                        onChange={(e) => setConfig((previous) => {
                          const unit = previous.autoPause?.simulationTimeUnit || autoPauseTimeUnit;
                          const unitMs = AUTO_PAUSE_TIME_UNITS.find((option) => option.value === unit)?.ms || 1;
                          return {
                            ...previous,
                            autoPause: {
                              ...(previous.autoPause || { enabled: true }),
                              enabled: true,
                              simulationTimeUnit: unit,
                              simulationTimeMs: e.target.value ? Number(e.target.value) * unitMs : undefined,
                            },
                          };
                        })}
                        className="w-full rounded-lg border border-rose-500/30 bg-slate-900 px-2 py-1.5 text-xs text-rose-100 outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <select
                        value={autoPauseTimeUnit}
                        onChange={(e) => setConfig((previous) => {
                          const nextUnit = e.target.value as DurationUnit;
                          const previousUnit = previous.autoPause?.simulationTimeUnit || autoPauseTimeUnit;
                          const previousUnitMs = AUTO_PAUSE_TIME_UNITS.find((option) => option.value === previousUnit)?.ms || 1;
                          const nextUnitMs = AUTO_PAUSE_TIME_UNITS.find((option) => option.value === nextUnit)?.ms || 1;
                          const displayedValue = typeof previous.autoPause?.simulationTimeMs === 'number'
                            ? previous.autoPause.simulationTimeMs / previousUnitMs
                            : undefined;

                          return {
                            ...previous,
                            autoPause: {
                              ...(previous.autoPause || { enabled: true }),
                              enabled: true,
                              simulationTimeUnit: nextUnit,
                              simulationTimeMs: typeof displayedValue === 'number' ? displayedValue * nextUnitMs : undefined,
                            },
                          };
                        })}
                        className="w-full rounded-lg border border-rose-500/30 bg-slate-900 px-2 py-1.5 text-xs text-rose-100 outline-none focus:ring-1 focus:ring-rose-500"
                      >
                        {AUTO_PAUSE_TIME_UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>{unit.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-rose-200">Stop date</label>
                    <input
                      type="datetime-local"
                      min={calendarStartInputValue}
                      value={config.autoPause.stopDateIso ? config.autoPause.stopDateIso.slice(0, 16) : ''}
                      onChange={(e) => setConfig((previous) => ({
                        ...previous,
                        autoPause: {
                          ...(previous.autoPause || { enabled: true }),
                          enabled: true,
                          stopDateIso: e.target.value ? `${e.target.value}:00` : undefined,
                        },
                      }))}
                      className={`w-full rounded-lg border bg-slate-900 px-2 py-1.5 text-xs text-rose-100 outline-none focus:ring-1 focus:ring-rose-500 ${isStopDateBeforeStart ? 'border-amber-400/70' : 'border-rose-500/30'}`}
                    />
                    {isStopDateBeforeStart && (
                      <p className="mt-1 text-[10px] leading-snug text-amber-200">
                        Stop date must be after the simulation start ({calendarStartInputValue.replace('T', ' ')}).
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'totalItemsCreated' as const, label: 'Created', step: 1, placeholder: 'items' },
                      { key: 'totalItemsFinished' as const, label: 'Finished', step: 1, placeholder: 'items' },
                      { key: 'activeItems' as const, label: 'Active', step: 1, placeholder: 'items' },
                      { key: 'totalItemsFailed' as const, label: 'Failed', step: 1, placeholder: 'items' },
                      { key: 'totalItemsCancelled' as const, label: 'Cancelled', step: 1, placeholder: 'items' },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-rose-200">{field.label}</label>
                        <input
                          type="number"
                          min="0"
                          step={field.step}
                          placeholder={field.placeholder}
                          value={config.autoPause?.[field.key] ?? ''}
                          onChange={(e) => setConfig((previous) => ({
                            ...previous,
                            autoPause: {
                              ...(previous.autoPause || { enabled: true }),
                              enabled: true,
                              [field.key]: e.target.value ? Number(e.target.value) : undefined,
                            },
                          }))}
                          className="w-full rounded-lg border border-rose-500/30 bg-slate-900 px-2 py-1.5 text-xs text-rose-100 outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Clock size={14}/> Business Hours
                </h3>
                <button
                  onClick={() => updateBusinessCalendar({ enabled: !businessCalendar.enabled })}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${businessCalendar.enabled ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                >
                  {businessCalendar.enabled ? 'On' : 'Off'}
                </button>
              </div>
              {businessCalendar.enabled && (
                <div className="space-y-2.5">
                  <div>
                    <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-indigo-200">Start date</label>
                    <input
                      type="datetime-local"
                      value={(config.calendarStartIso || DEFAULT_CALENDAR_START_ISO).slice(0, 16)}
                      onChange={(e) => setConfig((previous) => ({ ...previous, calendarStartIso: e.target.value ? `${e.target.value}:00` : previous.calendarStartIso }))}
                      className="w-full rounded-lg border border-indigo-500/30 bg-slate-900 px-2 py-1.5 text-[11px] text-indigo-100 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-indigo-200">Working hours</label>
                      <button
                        onClick={() => {
                          const current = businessCalendar.workingHours || [{ start: 9, end: 17 }];
                          const lastSegment = current[current.length - 1];
                          const newStart = lastSegment ? Math.min(23, lastSegment.end) : 9;
                          const newEnd = Math.min(24, newStart + 1);
                          updateBusinessCalendar({
                            workingHours: [...current, { start: newStart, end: newEnd }]
                          });
                        }}
                        className="rounded border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-200 hover:bg-indigo-500/20"
                      >
                        + Segment
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {(businessCalendar.workingHours || [{ start: 9, end: 17 }]).map((segment, index) => (
                        <div key={index} className="flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-slate-950/70 p-1.5">
                          <input
                            type="number"
                            min="0"
                            max="23.99"
                            step="0.5"
                            value={segment.start}
                            onChange={(e) => {
                              const current = businessCalendar.workingHours || [{ start: 9, end: 17 }];
                              const updated = [...current];
                              updated[index] = { ...updated[index], start: Number(e.target.value) };
                              updateBusinessCalendar({ workingHours: updated });
                            }}
                            className="w-16 rounded border border-indigo-500/30 bg-slate-900 px-1.5 py-1 text-[11px] text-indigo-100 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-[10px] text-slate-500">–</span>
                          <input
                            type="number"
                            min="0.01"
                            max="24"
                            step="0.5"
                            value={segment.end}
                            onChange={(e) => {
                              const current = businessCalendar.workingHours || [{ start: 9, end: 17 }];
                              const updated = [...current];
                              updated[index] = { ...updated[index], end: Number(e.target.value) };
                              updateBusinessCalendar({ workingHours: updated });
                            }}
                            className="w-16 rounded border border-indigo-500/30 bg-slate-900 px-1.5 py-1 text-[11px] text-indigo-100 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          {(businessCalendar.workingHours || []).length > 1 && (
                            <button
                              onClick={() => {
                                const current = businessCalendar.workingHours || [{ start: 9, end: 17 }];
                                updateBusinessCalendar({
                                  workingHours: current.filter((_, i) => i !== index)
                                });
                              }}
                              className="ml-auto rounded border border-red-500/30 bg-red-500/10 p-1 text-red-300 hover:bg-red-500/20"
                              title="Remove"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-indigo-200">Working days</label>
                    <div className="grid grid-cols-7 gap-1">
                      {WEEKDAY_OPTIONS.map((day) => {
                        const selected = businessCalendar.daysOfWeek.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            onClick={() => updateBusinessCalendar({
                              daysOfWeek: selected
                                ? businessCalendar.daysOfWeek.filter((value) => value !== day.value)
                                : [...businessCalendar.daysOfWeek, day.value].sort(),
                            })}
                            className={`rounded border px-1 py-1 text-[10px] font-semibold ${selected ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-700 bg-slate-900 text-slate-500'}`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-indigo-200">Non-working arrivals</label>
                    <select
                      value={businessCalendar.nonWorkingArrivalPolicy || 'queue'}
                      onChange={(e) => updateBusinessCalendar({ nonWorkingArrivalPolicy: e.target.value as NonWorkingArrivalPolicy })}
                      className="w-full rounded-lg border border-indigo-500/30 bg-slate-900 px-2 py-1.5 text-[11px] text-indigo-100 outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {VALID_NON_WORKING_POLICIES.map((policy) => (
                        <option key={policy} value={policy}>{NON_WORKING_POLICY_LABELS[policy]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <ArrowDownUp size={14}/> Demand Peaks
                </h3>
                <button
                  onClick={addDemandModifier}
                  className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-100 hover:bg-amber-500/20"
                >
                  + Add
                </button>
              </div>
              {demandModifiers.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-500">No peak rules configured.</div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {demandModifiers.map((modifier) => {
                    const isActivePeak = activeDemandModifierIds.has(modifier.id);
                    return (
                    <div key={modifier.id} className={`rounded-lg border p-2.5 ${isActivePeak ? 'border-amber-400 bg-amber-500/15' : 'border-amber-500/20 bg-slate-950/60'}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={modifier.enabled}
                          onChange={(e) => updateDemandModifier(modifier.id, { enabled: e.target.checked })}
                          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-amber-500"
                        />
                        <input
                          type="text"
                          value={modifier.name}
                          onChange={(e) => updateDemandModifier(modifier.id, { name: e.target.value })}
                          className="min-w-0 flex-1 rounded border border-amber-500/30 bg-slate-900 px-2 py-1 text-xs text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          onClick={() => removeDemandModifier(modifier.id)}
                          className="rounded border border-rose-500/30 px-1.5 py-1 text-[10px] text-rose-200 hover:bg-rose-500/10"
                        >
                          Del
                        </button>
                      </div>
                      {isActivePeak && (
                        <div className="mb-2 rounded border border-amber-400/40 bg-amber-500/20 px-2 py-1 text-[9px] font-semibold text-amber-100">
                          Active now · x{modifier.multiplier}
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        <div>
                          <label className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">Mult</label>
                          <input
                            type="number" min="0.01" step="0.05"
                            value={modifier.multiplier}
                            onChange={(e) => updateDemandModifier(modifier.id, { multiplier: Number(e.target.value) })}
                            className="w-full rounded border border-amber-500/30 bg-slate-900 px-1.5 py-1 text-xs text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">Start</label>
                          <input
                            type="number" min="0" max="23" step="0.5"
                            value={modifier.startHour ?? 0}
                            onChange={(e) => updateDemandModifier(modifier.id, { startHour: Number(e.target.value) })}
                            className="w-full rounded border border-amber-500/30 bg-slate-900 px-1.5 py-1 text-xs text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">End</label>
                          <input
                            type="number" min="1" max="24" step="0.5"
                            value={modifier.endHour ?? 24}
                            onChange={(e) => updateDemandModifier(modifier.id, { endHour: Number(e.target.value) })}
                            className="w-full rounded border border-amber-500/30 bg-slate-900 px-1.5 py-1 text-xs text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                      <div className="mb-2">
                        <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">Days</label>
                        <div className="grid grid-cols-7 gap-1">
                          {WEEKDAY_OPTIONS.map((day) => {
                            const selected = (modifier.daysOfWeek || []).includes(day.value);
                            return (
                              <button
                                key={day.value}
                                onClick={() => updateDemandModifier(modifier.id, {
                                  daysOfWeek: selected
                                    ? (modifier.daysOfWeek || []).filter((value) => value !== day.value)
                                    : [...(modifier.daysOfWeek || []), day.value].sort(),
                                })}
                                className={`rounded border px-1 py-0.5 text-[9px] font-semibold ${selected ? 'border-amber-400 bg-amber-500 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-500'}`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">Start date</label>
                          <input
                            type="date"
                            value={modifier.startDate || ''}
                            onChange={(e) => updateDemandModifier(modifier.id, { startDate: e.target.value || undefined })}
                            className="w-full rounded border border-amber-500/30 bg-slate-900 px-1.5 py-1 text-[10px] text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">End date</label>
                          <input
                            type="date"
                            value={modifier.endDate || ''}
                            onChange={(e) => updateDemandModifier(modifier.id, { endDate: e.target.value || undefined })}
                            className="w-full rounded border border-amber-500/30 bg-slate-900 px-1.5 py-1 text-[10px] text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Simulation Mode</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfig(p => ({ ...p, simulationMode: 'realistic' }))}
                  className={`flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    (config.simulationMode || 'realistic') === 'realistic'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <PlayCircle size={16} className="mb-1" />
                  Realistic
                </button>
                <button
                  onClick={() => setConfig(p => ({ ...p, simulationMode: 'worst-case' }))}
                  className={`flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    config.simulationMode === 'worst-case'
                      ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <AlertTriangle size={16} className="mb-1" />
                  Worst-Case
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wait Time Calculation</h3>
              <div className="space-y-2">
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-[10px] text-slate-400">
                  Choose how queue wait time is calculated and displayed in metrics.
                </div>
                <div className="space-y-1.5">
                  <button
                    onClick={() => setConfig(p => ({ ...p, waitTimeCalculationMode: 'both' }))}
                    className={`w-full flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      (!config.waitTimeCalculationMode || config.waitTimeCalculationMode === 'both')
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <div className="font-semibold">📊 Both (Recommended)</div>
                      <div className="mt-0.5 text-[9px] text-slate-500">Show calendar and working time for complete analysis</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setConfig(p => ({ ...p, waitTimeCalculationMode: 'calendar' }))}
                    className={`w-full flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      config.waitTimeCalculationMode === 'calendar'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-200'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <div className="font-semibold">📅 Calendar Time</div>
                      <div className="mt-0.5 text-[9px] text-slate-500">Include non-working hours • Best for SLA/customer view</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setConfig(p => ({ ...p, waitTimeCalculationMode: 'working' }))}
                    className={`w-full flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      config.waitTimeCalculationMode === 'working'
                        ? 'border-yellow-500 bg-yellow-500/10 text-yellow-200'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <div className="font-semibold">⏱️ Working Time</div>
                      <div className="mt-0.5 text-[9px] text-slate-500">Exclude non-working hours • Best for queue efficiency</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14}/> AI Scenario
              </h3>
              <div className="relative">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="E.g., Car Wash, Hospital ER..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-20 transition-all"
                />
                <button
                  onClick={handleGenerateScenario}
                  disabled={isGenerating || !aiPrompt}
                  className="absolute bottom-2 right-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:opacity-50 transition-colors"
                >
                  {isGenerating ? <Loader2 size={14} className="animate-spin"/> : <ArrowRight size={14}/>}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 size={14}/> Analysis
                </h3>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || globalStats.totalItemsFinished < 5}
                  className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded transition-colors disabled:opacity-50"
                >
                  {isAnalyzing ? 'Thinking...' : 'Analyze'}
                </button>
              </div>

              {aiAnalysis ? (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5 text-xs text-slate-300 leading-relaxed">
                  <MessageSquare size={12} className="inline mr-1.5 text-blue-400"/>
                  {aiAnalysis}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic text-center py-2">
                  Run simulation to generate data
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Flow steps</h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {config.steps.map(step => (
                  <button
                    key={step.id}
                    onClick={() => { setEditingStep(step); setActiveTab('basic'); setIsSidebarOpen(false); }}
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-left hover:border-blue-500/50 hover:bg-slate-800 transition-colors"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: step.color }} />
                      <span className="truncate text-xs text-slate-200">{step.name}</span>
                    </span>
                    <span className="text-[9px] uppercase text-slate-500 shrink-0">{step.type}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {isSidebarOpen && (
           <div 
             className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
             onClick={() => setIsSidebarOpen(false)}
           />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto h-[calc(100vh-3.5rem)] p-3 lg:p-4 scroll-smooth relative bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.10),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_30%)]">
          <div className="max-w-none mx-auto space-y-4">
             <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 shadow-2xl shadow-black/20">
               <div className="mb-3 flex flex-col gap-3">
                 <div className="w-full min-w-0">
                   <h2 className="whitespace-nowrap text-lg font-semibold text-slate-100">Process Map</h2>
                   <p className="text-xs text-slate-500">
                     {canvasViewMode === 'map' ? (
                       <>
                         Presentation canvas · Sim time:{' '}
                         <span className="inline-block min-w-[8ch] text-right font-mono tabular-nums text-cyan-300">{simulationClockLabel}</span>
                         {' '}· Ctrl/Cmd + wheel to zoom, drag to pan.
                       </>
                     ) : (
                       <>
                         Metro demo mode · Sim time:{' '}
                         <span className="inline-block min-w-[8ch] text-right font-mono tabular-nums text-cyan-300">{simulationClockLabel}</span>
                         {' '}· Compact horizontal presentation lane with focus, zoom, and bottleneck highlights.
                       </>
                     )}
                   </p>
                   {importExportNotice && <p className="mt-1 text-xs text-cyan-300">{importExportNotice}</p>}
                   {draftStatusMessage && <p className={`mt-1 text-xs ${draftStatus === 'save-failed' ? 'text-rose-300' : 'text-emerald-300'}`}>{draftStatusMessage}</p>}
                 </div>
                 <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
                    <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
                      <button
                        onClick={() => setCanvasViewMode('map')}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${canvasViewMode === 'map' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
                        title="Classic editable process map"
                      >
                        <Box size={16} /> Map
                      </button>
                      <button
                        onClick={() => setCanvasViewMode('metro')}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${canvasViewMode === 'metro' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
                        title="Compact subway-style demo view"
                      >
                        <Dna size={16} /> Metro Demo
                      </button>
                    </div>
                    <button
                      onClick={copySelectedFlow}
                      disabled={selectedStepIds.length === 0}
                      className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Copy only the selected nodes"
                    >
                      <Copy size={16}/> Copy Selected{selectedStepIds.length > 0 ? ` (${selectedStepIds.length})` : ''}
                    </button>
                    <button
                      onClick={removeSelectedSteps}
                      disabled={selectedStepIds.length === 0}
                      className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-sm text-rose-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Delete only the selected nodes"
                    >
                      <Trash2 size={16}/> Delete Selected{selectedStepIds.length > 0 ? ` (${selectedStepIds.length})` : ''}
                    </button>
                    <button
                      onClick={() => copyFlow()}
                      className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors"
                      title="Copy the full current flow graph"
                    >
                      <Copy size={16}/> Copy Flow
                    </button>
                    <button
                      onClick={pasteFlow}
                      disabled={!flowClipboard || flowClipboard.length === 0}
                      className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Paste the copied flow to the right"
                    >
                      <ClipboardPaste size={16}/> Paste Flow
                    </button>
                    <button
                      onClick={loadRoutingDemo}
                      className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-sm font-semibold text-cyan-200 transition-colors"
                      title="Load a sample with VIP profile routing and load-aware balancing"
                    >
                      <Sparkles size={16}/> Routing Demo
                    </button>
                    <button
                      onClick={triggerImport}
                      className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors"
                    >
                      <Upload size={16}/> Import
                    </button>
                    <button
                      onClick={exportConfig}
                      className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors"
                    >
                      <Download size={16}/> Export
                    </button>
                    <button 
                      onClick={togglePlay}
                      className={`flex shrink-0 items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${config.isRunning ? 'bg-amber-500/10 text-amber-300 border border-amber-500/40' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'}`}
                    >
                      {config.isRunning ? <><Pause size={16}/> Pause</> : <><Play size={16}/> Start</>}
                    </button>
                    <button onClick={resetSimulation} className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors">
                      <RotateCcw size={16}/> Reset
                    </button>
                    <div className="hidden shrink-0 md:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                      <span className="text-xs text-slate-500">Speed</span>
                      <input 
                        type="range" min="1" max="10" step="1"
                        value={config.speedMultiplier}
                        onChange={(e) => setConfig(p => ({ ...p, speedMultiplier: parseInt(e.target.value) }))}
                        className="w-24 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                      <span className="w-8 text-right font-mono text-xs text-purple-300">{config.speedMultiplier}x</span>
                    </div>
                    <div className="hidden shrink-0 md:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                      <span className="text-xs text-slate-500">Clock</span>
                      <select
                        value={compressionSelectValue}
                        onChange={(e) => applyClockPreset(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-cyan-300 outline-none focus:border-cyan-500"
                      >
                        {TIME_COMPRESSION_PRESETS.map((preset) => (
                          <option key={preset.value} value={String(preset.value)}>{preset.label}</option>
                        ))}
                        <option value={CUSTOM_CLOCK_VALUE}>Custom</option>
                      </select>
                    </div>
                 </div>
               </div>

               {canvasViewMode === 'map' ? (
                 <>
                   <ProcessMap 
                      steps={config.steps} 
                      stepStats={stepStats} 
                     routeStats={routeStats}
                      items={items}
                    simulationTimeMs={simulationTimeMs}
                      isRunning={config.isRunning}
                      onEditStep={(s) => { setEditingStep(s); setActiveTab('basic'); }}
                      onRemoveStep={removeStep}
                    onAddStep={addStep}
                    onPositionChange={updateStepPosition}
                      selectedStepIds={selectedStepIds}
                      onSelectionChange={setSelectedStepIds}
                      onCopySelected={copySelectedFlow}
                    onDeleteSelected={removeSelectedSteps}
                    onClearCanvas={clearCanvas}
                   />
                   <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                     <span className="rounded-full bg-slate-900 px-3 py-1 border border-slate-800">Ctrl/Cmd + Wheel = Zoom</span>
                     <span className="rounded-full bg-slate-900 px-3 py-1 border border-slate-800">Drag background = Pan</span>
                     <span className="rounded-full bg-slate-900 px-3 py-1 border border-slate-800">Drag node header = Move</span>
                     <span className="rounded-full bg-slate-900 px-3 py-1 border border-slate-800">Ctrl in Mixed Mode = Select</span>
                   </div>
                 </>
               ) : (
                 <MetroDemoBoard
                   steps={config.steps}
                   stepStats={stepStats}
                   items={items}
                   simulationTimeMs={simulationTimeMs}
                 />
               )}

               {canvasViewMode === 'metro' && (
                 <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                   <span className="rounded-full bg-slate-900 px-3 py-1 border border-slate-800">Compare All / Focus Single Flow</span>
                   <span className="rounded-full bg-slate-900 px-3 py-1 border border-slate-800">Zoom In / Out</span>
                   <span className="rounded-full bg-slate-900 px-3 py-1 border border-slate-800">Fullscreen Demo</span>
                   <span className="rounded-full bg-slate-900 px-3 py-1 border border-slate-800">Bottleneck Highlight</span>
                 </div>
               )}
             </section>

               <section className="mt-6">
                 <RoutingDiagnosticsPanel steps={config.steps} routeStats={routeStats} />
               </section>

             <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-100">Live Metrics</h2>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Cycle Unit</span>
                      <select
                        value={metricsCycleTimeUnit}
                        onChange={(e) => setMetricsCycleTimeUnit(e.target.value as DurationUnit)}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-blue-300 outline-none focus:border-blue-500"
                      >
                        {DURATION_UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>{unit.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="text-xs text-slate-500">Queue: <span className="font-mono text-amber-300">{totalQueue}</span></div>
                  </div>
                </div>
                 <StatsBoard globalStats={globalStats} stepStats={stepStats} flowStats={flowStats} steps={config.steps} items={items} simulationTimeMs={simulationTimeMs} cycleTimeUnit={metricsCycleTimeUnit} config={config} />
             </section>
          </div>
          
          <div className="h-12"/>

          {/* Edit Modal */}
          {editingStep && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
               <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50 shrink-0">
                     <h3 className="font-bold text-slate-200 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: editingStep.color }}></span>
                        Edit {editingStep.type === 'start' ? 'Start Node' : editingStep.type === 'end' ? 'End Node' : 'Step'}: {editingStep.name}
                     </h3>
                     <button onClick={() => setEditingStep(null)} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20}/>
                     </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-slate-800 bg-slate-900/50">
                      <button 
                        onClick={() => setActiveTab('basic')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'basic' ? 'border-blue-500 text-blue-400 bg-slate-800/30' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                      >
                          <Settings size={14} className="inline mr-2 mb-0.5"/> Basic
                      </button>
                      
                      {editingStep.type !== 'end' && (
                        <button 
                            onClick={() => setActiveTab('connections')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'connections' ? 'border-blue-500 text-blue-400 bg-slate-800/30' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                        >
                            <ArrowDownUp size={14} className="inline mr-2 mb-0.5"/> Routing
                        </button>
                      )}

                      {editingStep.type === 'process' && (
                          <button 
                            onClick={() => setActiveTab('exceptions')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'exceptions' ? 'border-blue-500 text-blue-400 bg-slate-800/30' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                        >
                            <AlertTriangle size={14} className="inline mr-2 mb-0.5"/> Exceptions
                        </button>
                      )}

                      {editingStep.type !== 'start' && (
                        <button 
                            onClick={() => setActiveTab('rules')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'rules' ? 'border-blue-500 text-blue-400 bg-slate-800/30' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                        >
                            <Clock size={14} className="inline mr-2 mb-0.5"/> Rules
                        </button>
                      )}
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-900">
                     
                     {/* Basic Tab */}
                     {activeTab === 'basic' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Name</label>
                                <input 
                                type="text" 
                                value={editingStep.name} 
                                onChange={e => setEditingStep({...editingStep, name: e.target.value})}
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* RANDOMNESS MODE TOGGLE */}
                            {editingStep.type !== 'end' && (
                                <>
                                  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                                      <div className="flex items-center gap-2">
                                          <Shuffle size={16} className={editingStep.randomnessMode === 'range' ? 'text-purple-400' : 'text-slate-400'} />
                                          <span className="text-sm font-semibold text-slate-200">Random Range Mode</span>
                                      </div>
                                      <div className="flex items-center gap-2 bg-slate-900 rounded p-1">
                                          <button 
                                              onClick={() => setEditingStep({...editingStep, randomnessMode: 'fixed'})}
                                              className={`text-xs px-3 py-1.5 rounded transition-all ${editingStep.randomnessMode === 'fixed' || !editingStep.randomnessMode ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                          >
                                            Fixed
                                          </button>
                                          <button 
                                              onClick={() => setEditingStep({...editingStep, randomnessMode: 'range'})}
                                              className={`text-xs px-3 py-1.5 rounded transition-all ${editingStep.randomnessMode === 'range' ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                          >
                                              Random Range
                                          </button>
                                      </div>
                                  </div>

                                  {editingStep.type === 'start' && (
                                    <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                                      <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                          <label className="block text-xs font-semibold text-cyan-200 uppercase">Item Mix / Quality</label>
                                          <p className="mt-1 text-xs text-slate-500">Define what kind of items this Start Point creates. Probabilities must total 100%.</p>
                                        </div>
                                        <button
                                          onClick={() => {
                                            const profiles = sanitizeItemProfiles(editingStep.itemProfiles);
                                            setEditingStep({
                                              ...editingStep,
                                              itemProfiles: [
                                                ...profiles,
                                                {
                                                  id: `profile-${Date.now()}`,
                                                  name: `Profile ${profiles.length + 1}`,
                                                  probability: 0,
                                                  processingTimeMultiplier: 1,
                                                  failureMultiplier: 1,
                                                  cancellationMultiplier: 1,
                                                  priority: 1,
                                                  color: '#38bdf8',
                                                },
                                              ],
                                            });
                                          }}
                                          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                                        >
                                          Add Profile
                                        </button>
                                      </div>
                                      <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${Math.abs(getProfileProbabilityTotal(editingStep) - 1) <= 0.001 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/40 bg-rose-500/10 text-rose-200'}`}>
                                        Probability total: <span className="font-mono font-bold">{(getProfileProbabilityTotal(editingStep) * 100).toFixed(1)}%</span>
                                      </div>
                                      <div className="space-y-3">
                                        {sanitizeItemProfiles(editingStep.itemProfiles).map((profile) => (
                                          <div key={profile.id} className="rounded-lg border border-cyan-500/20 bg-slate-950/60 p-3">
                                            <div className="mb-2 grid grid-cols-[32px_1fr_80px_auto] items-center gap-2">
                                              <input
                                                type="color"
                                                value={profile.color}
                                                onChange={(e) => setEditingStep(updateItemProfile(editingStep, profile.id, { color: e.target.value }))}
                                                className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
                                                title="Profile color"
                                              />
                                              <input
                                                type="text"
                                                value={profile.name}
                                                onChange={(e) => setEditingStep(updateItemProfile(editingStep, profile.id, { name: e.target.value }))}
                                                className="min-w-0 rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
                                              />
                                              <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={Math.round(profile.probability * 100)}
                                                onChange={(e) => setEditingStep(updateItemProfile(editingStep, profile.id, { probability: Math.max(0, Math.min(1, Number(e.target.value) / 100)) }))}
                                                className="w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
                                                title="Probability %"
                                              />
                                              <button
                                                onClick={() => {
                                                  const profiles = sanitizeItemProfiles(editingStep.itemProfiles).filter((existing) => existing.id !== profile.id);
                                                  setEditingStep({ ...editingStep, itemProfiles: profiles.length > 0 ? profiles : [{ ...DEFAULT_ITEM_PROFILE }] });
                                                }}
                                                disabled={sanitizeItemProfiles(editingStep.itemProfiles).length <= 1}
                                                className="rounded border border-rose-500/30 px-2 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"
                                              >
                                                Remove
                                              </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                              <div>
                                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Time Factor</label>
                                                <input
                                                  type="number"
                                                  min="0.01"
                                                  step="0.05"
                                                  value={profile.processingTimeMultiplier}
                                                  onChange={(e) => setEditingStep(updateItemProfile(editingStep, profile.id, { processingTimeMultiplier: Number(e.target.value) }))}
                                                  className="w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
                                                />
                                              </div>
                                              <div>
                                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Failure Factor</label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.05"
                                                  value={profile.failureMultiplier}
                                                  onChange={(e) => setEditingStep(updateItemProfile(editingStep, profile.id, { failureMultiplier: Number(e.target.value) }))}
                                                  className="w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
                                                />
                                              </div>
                                              <div>
                                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Cancel Factor</label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.05"
                                                  value={profile.cancellationMultiplier}
                                                  onChange={(e) => setEditingStep(updateItemProfile(editingStep, profile.id, { cancellationMultiplier: Number(e.target.value) }))}
                                                  className="w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
                                                />
                                              </div>
                                              <div>
                                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Priority</label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="1"
                                                  value={profile.priority}
                                                  onChange={(e) => setEditingStep(updateItemProfile(editingStep, profile.id, { priority: Number(e.target.value) }))}
                                                  className="w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-2 py-1.5 text-xs text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                            )}

                            {/* START NODE SPECIFIC */}
                            {editingStep.type === 'start' && (
                              <StartNodeSettings
                                editingStep={editingStep}
                                setEditingStep={setEditingStep}
                                addStartDemandModifier={addStartDemandModifier}
                                addArrivalWindow={addArrivalWindow}
                                addArrivalEvent={addArrivalEvent}
                              />
                            )}

                            {editingStep.type === 'end' && (
                                <div className="p-4 bg-rose-900/20 border border-rose-900/50 rounded-lg">
                                  <label className="block text-xs font-semibold text-rose-400 uppercase mb-2">Average Time Display Unit</label>
                                  <div className="grid grid-cols-[180px_1fr] gap-3 items-center">
                                    <select
                                      value={editingStep.endTimeUnit || 'min'}
                                      onChange={(e) => setEditingStep({ ...editingStep, endTimeUnit: e.target.value as DurationUnit })}
                                      className="rounded-lg border border-rose-900/50 bg-slate-800 px-3 py-2 text-sm text-rose-100 outline-none focus:ring-2 focus:ring-rose-500"
                                    >
                                      {DURATION_UNITS.map((unit) => (
                                        <option key={unit.value} value={unit.value}>{unit.label}</option>
                                      ))}
                                    </select>
                                    <div className="rounded-lg border border-rose-900/40 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                                      Controls how the End Point card displays average end-to-end cycle time. Internal simulation stats remain in milliseconds.
                                    </div>
                                  </div>
                                </div>
                            )}

                            {editingStep.type !== 'end' && (
                              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <label className="block text-xs font-semibold text-indigo-200 uppercase">Calendar Override</label>
                                    <p className="mt-1 text-xs text-slate-500">Use global business hours or give this card its own schedule.</p>
                                  </div>
                                  <div className="flex rounded-lg bg-slate-900 p-1 text-xs">
                                    <button
                                      onClick={() => setEditingStep({ ...editingStep, calendarMode: 'inherit', businessCalendar: undefined })}
                                      className={`rounded px-3 py-1.5 font-semibold ${editingStep.calendarMode !== 'custom' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                      Inherit
                                    </button>
                                    <button
                                      onClick={() => setEditingStep({
                                        ...editingStep,
                                        calendarMode: 'custom',
                                        businessCalendar: normalizeBusinessCalendar({
                                          ...(editingStep.businessCalendar || businessCalendar),
                                          enabled: true,
                                        }),
                                      })}
                                      className={`rounded px-3 py-1.5 font-semibold ${editingStep.calendarMode === 'custom' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                      Custom
                                    </button>
                                  </div>
                                </div>

                                {editingStep.calendarMode === 'custom' && (() => {
                                  const stepCalendar = normalizeBusinessCalendar({ ...(editingStep.businessCalendar || businessCalendar), enabled: true });
                                  const updateStepCalendar = (updates: Partial<typeof stepCalendar>) => setEditingStep({
                                    ...editingStep,
                                    businessCalendar: normalizeBusinessCalendar({ ...stepCalendar, ...updates, enabled: true }),
                                  });

                                  return (
                                    <div className="space-y-3">
                                      <div>
                                        <div className="mb-2 flex items-center justify-between">
                                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Working hours</label>
                                          <button
                                            onClick={() => {
                                              const current = stepCalendar.workingHours || [{ start: 9, end: 17 }];
                                              const lastSegment = current[current.length - 1];
                                              const newStart = lastSegment ? Math.min(23, lastSegment.end) : 9;
                                              const newEnd = Math.min(24, newStart + 1);
                                              updateStepCalendar({
                                                workingHours: [...current, { start: newStart, end: newEnd }]
                                              });
                                            }}
                                            className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-200 hover:bg-indigo-500/20"
                                          >
                                            + Add
                                          </button>
                                        </div>
                                        <div className="space-y-2">
                                          {(stepCalendar.workingHours || [{ start: 9, end: 17 }]).map((segment, index) => (
                                            <div key={index} className="flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-slate-950/70 p-2">
                                              <div className="flex flex-1 items-center gap-2">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  max="23.99"
                                                  step="0.5"
                                                  value={segment.start}
                                                  onChange={(e) => {
                                                    const current = stepCalendar.workingHours || [{ start: 9, end: 17 }];
                                                    const updated = [...current];
                                                    updated[index] = { ...updated[index], start: Number(e.target.value) };
                                                    updateStepCalendar({ workingHours: updated });
                                                  }}
                                                  className="w-20 rounded border border-indigo-500/30 bg-slate-900 px-2 py-1 text-xs text-indigo-100 outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                                <span className="text-xs text-slate-500">to</span>
                                                <input
                                                  type="number"
                                                  min="0.01"
                                                  max="24"
                                                  step="0.5"
                                                  value={segment.end}
                                                  onChange={(e) => {
                                                    const current = stepCalendar.workingHours || [{ start: 9, end: 17 }];
                                                    const updated = [...current];
                                                    updated[index] = { ...updated[index], end: Number(e.target.value) };
                                                    updateStepCalendar({ workingHours: updated });
                                                  }}
                                                  className="w-20 rounded border border-indigo-500/30 bg-slate-900 px-2 py-1 text-xs text-indigo-100 outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                              </div>
                                              {(stepCalendar.workingHours || []).length > 1 && (
                                                <button
                                                  onClick={() => {
                                                    const current = stepCalendar.workingHours || [{ start: 9, end: 17 }];
                                                    updateStepCalendar({
                                                      workingHours: current.filter((_, i) => i !== index)
                                                    });
                                                  }}
                                                  className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                                                  title="Remove"
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Working days</label>
                                        <div className="grid grid-cols-7 gap-1">
                                          {WEEKDAY_OPTIONS.map((day) => {
                                            const selected = stepCalendar.daysOfWeek.includes(day.value);
                                            return (
                                              <button
                                                key={day.value}
                                                onClick={() => updateStepCalendar({
                                                  daysOfWeek: selected
                                                    ? stepCalendar.daysOfWeek.filter((value) => value !== day.value)
                                                    : [...stepCalendar.daysOfWeek, day.value].sort(),
                                                })}
                                                className={`rounded-lg border px-1.5 py-1.5 text-[10px] font-semibold ${selected ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-700 bg-slate-900 text-slate-500'}`}
                                              >
                                                {day.label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      {editingStep.type === 'start' && (
                                        <div>
                                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Non-working arrivals</label>
                                          <select
                                            value={stepCalendar.nonWorkingArrivalPolicy || 'queue'}
                                            onChange={(e) => updateStepCalendar({ nonWorkingArrivalPolicy: e.target.value as NonWorkingArrivalPolicy })}
                                            className="w-full rounded-lg border border-indigo-500/30 bg-slate-900 px-3 py-2 text-xs text-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500"
                                          >
                                            {VALID_NON_WORKING_POLICIES.map((policy) => (
                                              <option key={policy} value={policy}>{NON_WORKING_POLICY_LABELS[policy]}</option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {/* PROCESS NODE SPECIFIC */}
                            {editingStep.type === 'process' && (
                                <div className="space-y-4">
                                <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Simulation Type</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      onClick={() => setEditingStep({...editingStep, simulationMode: 'resource'})}
                                      className={`rounded-lg border px-3 py-3 text-left transition-all ${editingStep.simulationMode !== 'delay' ? 'border-blue-500 bg-blue-500/10 text-blue-200' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                                    >
                                      <div className="flex items-center gap-2 text-sm font-bold"><Users size={14}/> Resource Mode</div>
                                      <p className="mt-1 text-[11px] opacity-75">Uses capacity and can create queues.</p>
                                    </button>
                                    <button
                                      onClick={() => setEditingStep({...editingStep, simulationMode: 'delay'})}
                                      className={`rounded-lg border px-3 py-3 text-left transition-all ${editingStep.simulationMode === 'delay' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                                    >
                                      <div className="flex items-center gap-2 text-sm font-bold"><Clock size={14}/> Time Delay</div>
                                      <p className="mt-1 text-[11px] opacity-75">No resource limit; items start timing immediately.</p>
                                    </button>
                                  </div>
                                </div>

                                {editingStep.simulationMode !== 'delay' && <div className="space-y-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                                        <div>
                                          <label className="block text-xs font-semibold text-blue-300 uppercase mb-1">Capacity (Resources)</label>
                                          <input 
                                              type="number" min="1" max="50"
                                              value={editingStep.capacity} 
                                              onChange={e => setEditingStep({...editingStep, capacity: parseInt(e.target.value) || 1})}
                                              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                          />
                                          <p className="mt-1 text-xs text-slate-500">Resource units available at this step. Execution mode controls how those units are consumed.</p>
                                          {(editingStep.resourceExecutionMode || 'single') === 'collaborative' && (
                                            <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${getTeamResourceTotal(editingStep) === editingStep.capacity ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/40 bg-rose-500/10 text-rose-200'}`}>
                                              {getTeamAllocationMode(editingStep) === 'explicit'
                                                ? <>Capacity check: team resources <span className="font-mono font-bold">{getTeamResourceTotal(editingStep)}</span> / capacity <span className="font-mono font-bold">{editingStep.capacity}</span>. These must match before saving.</>
                                                : <>Auto teams: capacity <span className="font-mono font-bold">{editingStep.capacity}</span> will be split into teams of up to <span className="font-mono font-bold">{editingStep.targetResourcesPerItem ?? 1}</span>.</>}
                                            </div>
                                          )}
                                        </div>

                                        <div>
                                          <label className="block text-xs font-semibold text-blue-300 uppercase mb-2">Execution Mode</label>
                                          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                            {[
                                              { id: 'single' as ResourceExecutionMode, title: '1 resource / item', hint: 'Classic queue behavior.' },
                                              { id: 'collaborative' as ResourceExecutionMode, title: 'Team per item', hint: 'Fixed-size teams finish one item faster.' },
                                              { id: 'multitask' as ResourceExecutionMode, title: '1 resource / many items', hint: 'One person or AI handles multiple items.' },
                                            ].map((mode) => (
                                              <button
                                                key={mode.id}
                                                onClick={() => setEditingStep({
                                                  ...editingStep,
                                                  resourceExecutionMode: mode.id,
                                                  minResourcesPerItem: editingStep.minResourcesPerItem ?? 1,
                                                  targetResourcesPerItem: editingStep.targetResourcesPerItem ?? 2,
                                                  maxResourcesPerItem: editingStep.maxResourcesPerItem ?? 2,
                                                  teamAllocationMode: editingStep.teamAllocationMode ?? 'auto',
                                                  collaborativeTeams: editingStep.collaborativeTeams && editingStep.collaborativeTeams.length > 0 ? editingStep.collaborativeTeams : [{ id: `team-${Date.now()}`, name: 'Team 1', resources: editingStep.targetResourcesPerItem ?? 2 }],
                                                  collaborativeEfficiency: editingStep.collaborativeEfficiency || buildDefaultCollaborativeEfficiency(editingStep.maxResourcesPerItem ?? 2),
                                                  maxConcurrentItemsPerResource: editingStep.maxConcurrentItemsPerResource ?? 2,
                                                  multitaskEfficiency: editingStep.multitaskEfficiency || buildDefaultMultitaskEfficiency(editingStep.maxConcurrentItemsPerResource ?? 2),
                                                })}
                                                className={`rounded-lg border px-3 py-3 text-left transition-all ${(editingStep.resourceExecutionMode || 'single') === mode.id ? 'border-blue-500 bg-blue-500/15 text-blue-100' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                                              >
                                                <div className="text-sm font-bold">{mode.title}</div>
                                                <p className="mt-1 text-[11px] opacity-75">{mode.hint}</p>
                                              </button>
                                            ))}
                                          </div>
                                        </div>

                                        {(editingStep.resourceExecutionMode || 'single') === 'collaborative' && (
                                          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3">
                                            <label className="block text-[10px] text-indigo-200 uppercase mb-2">Team allocation</label>
                                            <div className="grid grid-cols-2 gap-2">
                                              {[
                                                { id: 'auto' as TeamAllocationMode, title: 'Auto teams', hint: 'Use Capacity and default team size.' },
                                                { id: 'explicit' as TeamAllocationMode, title: 'Explicit teams', hint: 'Name each team and set its people.' },
                                              ].map((mode) => (
                                                <button
                                                  key={mode.id}
                                                  onClick={() => setEditingStep({
                                                    ...editingStep,
                                                    teamAllocationMode: mode.id,
                                                    collaborativeTeams: mode.id === 'explicit' ? getEditableTeams(editingStep) : editingStep.collaborativeTeams,
                                                  })}
                                                  className={`rounded-lg border px-3 py-2 text-left transition-all ${getTeamAllocationMode(editingStep) === mode.id ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                                                >
                                                  <div className="text-sm font-bold">{mode.title}</div>
                                                  <p className="mt-1 text-[11px] opacity-75">{mode.hint}</p>
                                                </button>
                                              ))}
                                            </div>

                                            {getTeamAllocationMode(editingStep) === 'auto' && (
                                              <div className="mt-4 rounded-lg border border-indigo-500/20 bg-slate-950/50 p-3">
                                                <label className="block text-[10px] text-indigo-200 uppercase mb-1">Default team size</label>
                                                <input
                                                  type="number" min="1" max="50"
                                                  value={editingStep.targetResourcesPerItem ?? 2}
                                                  onChange={e => {
                                                    const targetResources = Math.max(1, Math.min(editingStep.capacity, parseInt(e.target.value) || 1));
                                                    setEditingStep({ ...editingStep, minResourcesPerItem: targetResources, targetResourcesPerItem: targetResources, maxResourcesPerItem: targetResources, collaborativeEfficiency: editingStep.collaborativeEfficiency || buildDefaultCollaborativeEfficiency(targetResources) });
                                                  }}
                                                  className="w-full bg-slate-900 border border-indigo-500/30 rounded p-2 text-indigo-100 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                                <p className="mt-2 text-xs text-slate-500">Example: Capacity 6 and default team size 2 allows up to 3 teams. The final team can use remaining resources if capacity is not evenly divisible.</p>
                                              </div>
                                            )}

                                            {getTeamAllocationMode(editingStep) === 'explicit' && <div className="mt-4 rounded-lg border border-indigo-500/20 bg-slate-950/50 p-3">
                                              <div className="mb-3 flex items-center justify-between gap-3">
                                                <div>
                                                  <label className="block text-[10px] text-indigo-200 uppercase">Explicit Teams</label>
                                                  <p className="text-xs text-slate-500">Each team can process one item at a time with its own resource count.</p>
                                                </div>
                                                <button
                                                  onClick={() => {
                                                    const teams = getEditableTeams(editingStep);
                                                    setEditingStep({
                                                      ...editingStep,
                                                      collaborativeTeams: [
                                                        ...teams,
                                                        { id: `team-${Date.now()}`, name: `Team ${teams.length + 1}`, resources: editingStep.targetResourcesPerItem ?? 2 },
                                                      ],
                                                    });
                                                  }}
                                                  className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20"
                                                >
                                                  Add Team
                                                </button>
                                              </div>
                                              <div className="space-y-2">
                                                {getEditableTeams(editingStep).map((team, teamIndex) => (
                                                  <div key={team.id} className="grid grid-cols-[1fr_90px_auto] items-center gap-2">
                                                    <input
                                                      type="text"
                                                      value={team.name}
                                                      onChange={e => {
                                                        const teams = getEditableTeams(editingStep).map((existingTeam) => existingTeam.id === team.id ? { ...existingTeam, name: e.target.value } : existingTeam);
                                                        setEditingStep({ ...editingStep, collaborativeTeams: teams });
                                                      }}
                                                      className="w-full bg-slate-900 border border-indigo-500/30 rounded p-2 text-indigo-100 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                    <input
                                                      type="number" min="1" max="50"
                                                      value={team.resources}
                                                      onChange={e => {
                                                        const resources = Math.max(1, parseInt(e.target.value) || 1);
                                                        const teams = getEditableTeams(editingStep).map((existingTeam) => existingTeam.id === team.id ? { ...existingTeam, resources } : existingTeam);
                                                        const maxResources = Math.max(editingStep.maxResourcesPerItem ?? 1, resources);
                                                        setEditingStep({ ...editingStep, collaborativeTeams: teams, maxResourcesPerItem: maxResources, collaborativeEfficiency: editingStep.collaborativeEfficiency || buildDefaultCollaborativeEfficiency(maxResources) });
                                                      }}
                                                      className="w-full bg-slate-900 border border-indigo-500/30 rounded p-2 text-indigo-100 font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                                                      title="Resources in this team"
                                                    />
                                                    <button
                                                      onClick={() => {
                                                        const teams = getEditableTeams(editingStep).filter((existingTeam) => existingTeam.id !== team.id);
                                                        setEditingStep({ ...editingStep, collaborativeTeams: teams.length > 0 ? teams : [{ id: `team-${Date.now()}`, name: 'Team 1', resources: 1 }] });
                                                      }}
                                                      disabled={teamIndex === 0 && getEditableTeams(editingStep).length === 1}
                                                      className="rounded border border-rose-500/30 px-2 py-2 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"
                                                    >
                                                      Remove
                                                    </button>
                                                  </div>
                                                ))}
                                              </div>
                                              <div className="mt-2 text-xs text-slate-500">
                                                Total team resources: <span className="font-mono text-indigo-200">{getTeamResourceTotal(editingStep)}</span>. Required capacity: <span className="font-mono text-indigo-200">{editingStep.capacity}</span>.
                                              </div>
                                              {getTeamResourceTotal(editingStep) !== editingStep.capacity && (
                                                <button
                                                  onClick={() => setEditingStep({ ...editingStep, capacity: getTeamResourceTotal(editingStep) })}
                                                  className="mt-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20"
                                                >
                                                  Set Capacity to {getTeamResourceTotal(editingStep)}
                                                </button>
                                              )}
                                            </div>}
                                            <div className="mt-3 space-y-2">
                                              <label className="block text-[10px] text-indigo-200 uppercase">Speed multiplier by assigned resources</label>
                                              {Array.from({ length: Math.max(1, editingStep.maxResourcesPerItem ?? 2) }, (_, index) => index + 1).map(resourceCount => (
                                                <div key={resourceCount} className="grid grid-cols-[90px_1fr_70px] items-center gap-2 text-xs">
                                                  <span className="text-slate-400">{resourceCount} resource{resourceCount > 1 ? 's' : ''}</span>
                                                  <input
                                                    type="range" min="0.1" max="10" step="0.05"
                                                    value={editingStep.collaborativeEfficiency?.[resourceCount] ?? (resourceCount === 1 ? 1 : 1 + (resourceCount - 1) * 0.65)}
                                                    onChange={e => setEditingStep({ ...editingStep, collaborativeEfficiency: updateEfficiencyValue(editingStep.collaborativeEfficiency, resourceCount, Number(e.target.value)) })}
                                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                  />
                                                  <input
                                                    type="number" min="0.1" max="10" step="0.05"
                                                    value={editingStep.collaborativeEfficiency?.[resourceCount] ?? (resourceCount === 1 ? 1 : 1 + (resourceCount - 1) * 0.65)}
                                                    onChange={e => setEditingStep({ ...editingStep, collaborativeEfficiency: updateEfficiencyValue(editingStep.collaborativeEfficiency, resourceCount, Number(e.target.value)) })}
                                                    className="w-full bg-slate-900 border border-indigo-500/30 rounded p-1.5 text-indigo-100 font-mono outline-none"
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {(editingStep.resourceExecutionMode || 'single') === 'multitask' && (
                                          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
                                            <label className="block text-[10px] text-cyan-200 uppercase mb-1">Max concurrent items / resource</label>
                                            <input
                                              type="number" min="1" max="50"
                                              value={editingStep.maxConcurrentItemsPerResource ?? 2}
                                              onChange={e => {
                                                const maxConcurrent = Math.max(1, parseInt(e.target.value) || 1);
                                                setEditingStep({ ...editingStep, maxConcurrentItemsPerResource: maxConcurrent, multitaskEfficiency: editingStep.multitaskEfficiency || buildDefaultMultitaskEfficiency(maxConcurrent) });
                                              }}
                                              className="w-full bg-slate-900 border border-cyan-500/30 rounded p-2 text-cyan-100 font-mono focus:ring-2 focus:ring-cyan-500 outline-none"
                                            />
                                            <div className="mt-3 space-y-2">
                                              <label className="block text-[10px] text-cyan-200 uppercase">Speed multiplier by concurrent load</label>
                                              {Array.from({ length: Math.max(1, editingStep.maxConcurrentItemsPerResource ?? 2) }, (_, index) => index + 1).map(load => (
                                                <div key={load} className="grid grid-cols-[90px_1fr_70px] items-center gap-2 text-xs">
                                                  <span className="text-slate-400">{load} item{load > 1 ? 's' : ''}</span>
                                                  <input
                                                    type="range" min="0.1" max="2" step="0.05"
                                                    value={editingStep.multitaskEfficiency?.[load] ?? Math.max(0.25, 1 - (load - 1) * 0.2)}
                                                    onChange={e => setEditingStep({ ...editingStep, multitaskEfficiency: updateEfficiencyValue(editingStep.multitaskEfficiency, load, Number(e.target.value)) })}
                                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                                  />
                                                  <input
                                                    type="number" min="0.1" max="2" step="0.05"
                                                    value={editingStep.multitaskEfficiency?.[load] ?? Math.max(0.25, 1 - (load - 1) * 0.2)}
                                                    onChange={e => setEditingStep({ ...editingStep, multitaskEfficiency: updateEfficiencyValue(editingStep.multitaskEfficiency, load, Number(e.target.value)) })}
                                                    className="w-full bg-slate-900 border border-cyan-500/30 rounded p-1.5 text-cyan-100 font-mono outline-none"
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>}
                                    
                                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                                          <label className="block text-xs font-semibold text-blue-400 uppercase mb-3">{editingStep.simulationMode === 'delay' ? 'Delay Duration (ms)' : 'Processing Duration (ms)'}</label>
                                        
                                        {editingStep.randomnessMode === 'range' ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] text-slate-400 uppercase mb-1 block">Min Duration</label>
                                                    <input 
                                                        type="number" step="100" min="100"
                                                        value={editingStep.minProcessingTime ?? 1000} 
                                                        onChange={e => setEditingStep({...editingStep, minProcessingTime: Number(e.target.value)})}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-400 uppercase mb-1 block">Max Duration</label>
                                                    <input 
                                                        type="number" step="100" min="100"
                                                        value={editingStep.maxProcessingTime ?? 3000} 
                                                        onChange={e => setEditingStep({...editingStep, maxProcessingTime: Number(e.target.value)})}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                                                    />
                                                </div>
                                                    <div className="col-span-2">
                                                      <label className="text-[10px] text-slate-400 uppercase mb-1 block">Unit</label>
                                                      <select
                                                        value={editingStep.rangeTimeUnit || editingStep.processingTimeUnit || 'ms'}
                                                        onChange={e => setEditingStep({...editingStep, rangeTimeUnit: e.target.value as DurationUnit})}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 focus:ring-2 focus:ring-purple-500 outline-none"
                                                      >
                                                        {DURATION_UNITS.map(unit => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                                                      </select>
                                                    </div>
                                                <div className="col-span-2 text-xs text-slate-500 flex items-center gap-2">
                                                    <Dna size={12} />
                                                      Each task will take a unique random time between Min and Max in the selected unit.
                                                </div>
                                            </div>
                                        ) : (
                                                  <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] text-slate-400 uppercase mb-1">Base Time</label>
                                                    <input 
                                                        type="number" step="100" min="100"
                                                        value={editingStep.processingTime ?? 1000} 
                                                        onChange={e => setEditingStep({...editingStep, processingTime: Number(e.target.value)})}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                                    <div>
                                                      <label className="block text-[10px] text-slate-400 uppercase mb-1">Unit</label>
                                                      <select
                                                        value={editingStep.processingTimeUnit || 'ms'}
                                                        onChange={e => setEditingStep({...editingStep, processingTimeUnit: e.target.value as DurationUnit})}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                                      >
                                                        {DURATION_UNITS.map(unit => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                                                      </select>
                                                    </div>
                                                {editingStep.simulationMode !== 'delay' && <div className="col-span-2 min-w-0">
                                                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Variance (0 = exact)</label>
                                                  <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3">
                                                    <input 
                                                      type="number" min="0" max="1" step="0.01"
                                                      value={editingStep.variance ?? 0} 
                                                      onChange={e => {
                                                      const val = parseFloat(e.target.value);
                                                      setEditingStep({...editingStep, variance: isNaN(val) ? 0 : Math.min(1, Math.max(0, val))});
                                                      }}
                                                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                    <input 
                                                      type="range" min="0" max="1" step="0.01"
                                                      value={editingStep.variance ?? 0} 
                                                      onChange={e => setEditingStep({...editingStep, variance: parseFloat(e.target.value)})}
                                                      className="min-w-0 w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                    />
                                                  </div>
                                                  <div className="text-xs text-slate-500 mt-1">0 keeps this step deterministic; values above 0 add random noise.</div>
                                                </div>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Visual Color</label>
                                <div className="flex gap-3 items-center">
                                    <input 
                                        type="color" 
                                        value={editingStep.color || '#3b82f6'} 
                                        onChange={(e) => setEditingStep({...editingStep, color: e.target.value})}
                                        className="w-10 h-10 rounded border-none bg-transparent cursor-pointer"
                                    />
                                    <span className="font-mono text-sm text-slate-400 uppercase">{editingStep.color}</span>
                                </div>
                            </div>
                        </div>
                     )}

                     {/* Exceptions Tab */}
                     {activeTab === 'exceptions' && editingStep.type === 'process' && (
                        <div className="space-y-6">
                            <p className="text-sm text-slate-400">Configure random adverse events like failures or queue cancellations.</p>
                            
                            <div className="p-4 bg-red-900/10 border border-red-900/30 rounded-lg">
                                <label className="flex items-center gap-2 text-xs font-semibold text-red-400 uppercase mb-2">
                                    <AlertTriangle size={14}/> Failure / Defect Probability (0.0 - 1.0)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="number" min="0" max="1" step="0.00001"
                                        value={editingStep.failureProbability ?? 0}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            setEditingStep({...editingStep, failureProbability: isNaN(val) ? 0 : Math.min(1, Math.max(0, val))})
                                        }}
                                        className="flex-1 bg-slate-800 border border-red-900/50 rounded-lg p-2 text-red-100 font-mono focus:ring-2 focus:ring-red-500 outline-none"
                                    />
                                    <span className="font-mono text-sm font-bold text-red-400 w-24 text-right">
                                        {((editingStep.failureProbability ?? 0) * 100).toFixed(4)}%
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2">
                                    Probability that a task will fail completely after finishing processing. Failed tasks do not move to the next step.
                                </p>
                            </div>

                            <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase mb-2">
                                    <Clock size={14}/> Cancellation Probability (0.0 - 1.0)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="number" min="0" max="1" step="0.00001"
                                        value={editingStep.cancellationProbability ?? 0}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            setEditingStep({...editingStep, cancellationProbability: isNaN(val) ? 0 : Math.min(1, Math.max(0, val))})
                                        }}
                                        className="flex-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-slate-200 font-mono focus:ring-2 focus:ring-slate-500 outline-none"
                                    />
                                    <span className="font-mono text-sm font-bold text-slate-400 w-24 text-right">
                                        {((editingStep.cancellationProbability ?? 0) * 100).toFixed(4)}%
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2">
                                    Approximate probability per second that an item waiting in the queue will be cancelled (e.g. user leaves).
                                </p>
                            </div>
                        </div>
                     )}

                     {/* Connections Tab */}
                     {activeTab === 'connections' && editingStep.type !== 'end' && (
                       <ConnectionsTab
                         config={config}
                         editingStep={editingStep}
                         setEditingStep={setEditingStep}
                         toggleConnection={toggleConnection}
                         updateProbability={updateProbability}
                         updateConnection={updateConnection}
                       />
                     )}

                     {/* Rules Tab */}
                     {activeTab === 'rules' && editingStep.type !== 'start' && (
                         <div className="space-y-4">
                             <p className="text-sm text-slate-400 mb-1">Override processing time based on where the item came from. (Applies mainly to Fixed mode)</p>
                             {(() => {
                               const sourceRuleUnitValue = editingStep.sourceProcessingTimeUnit || editingStep.processingTimeUnit || 'ms';
                               const sourceRuleUnit = DURATION_UNITS.find((unit) => unit.value === sourceRuleUnitValue)?.label || 'ms';

                               return (
                                 <>
                                   <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
                                     <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Source rule unit</label>
                                     <select
                                       value={sourceRuleUnitValue}
                                       onChange={(e) => setEditingStep({ ...editingStep, sourceProcessingTimeUnit: e.target.value as DurationUnit })}
                                       className="w-full rounded border border-slate-600 bg-slate-900 p-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                     >
                                       {DURATION_UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                                     </select>
                                     <p className="mt-2 text-xs text-slate-500">Source overrides use this explicit unit and do not silently change when the main fixed duration unit changes.</p>
                                   </div>
                             
                             {potentialSources.length === 0 ? (
                                 <div className="text-center py-8 text-slate-500 italic">
                                     No steps connect to this one yet.
                                 </div>
                             ) : (
                                 <div className="space-y-3">
                                     {potentialSources.map(source => {
                                         const ruleTime = editingStep.sourceProcessingTimes?.[source.id];
                                         return (
                                             <div key={source.id} className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700">
                                                 <div className="flex items-center gap-2">
                                                     <div className="w-2 h-2 rounded-full" style={{ background: source.color }}></div>
                                                     <span className="text-sm text-slate-300">From: <b>{source.name}</b></span>
                                                 </div>
                                                 <div className="flex items-center gap-2">
                                                     <input 
                                                         type="number"
                                                         placeholder={`${editingStep.processingTime} (Default)`}
                                                         value={ruleTime ?? ''}
                                                         onChange={(e) => updateSourceRule(source.id, e.target.value === '' ? Number.NaN : Number(e.target.value))}
                                                         className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-right focus:border-blue-500 outline-none"
                                                     />
                                                       <span className="w-20 truncate text-xs text-slate-500" title={sourceRuleUnit}>
                                                        {sourceRuleUnit}
                                                     </span>
                                                 </div>
                                             </div>
                                         )
                                     })}
                                 </div>
                             )}
                                 </>
                               );
                             })()}
                         </div>
                     )}

                  </div>
                  <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex flex-col gap-3 shrink-0">
                     {editingStepValidationError && (
                       <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                         Cannot save: {editingStepValidationError}
                       </div>
                     )}
                     <div className="flex justify-end gap-2">
                     <button 
                        onClick={() => setEditingStep(null)}
                        className="px-4 py-2 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                     >
                        Cancel
                     </button>
                     <button 
                        onClick={saveStepUpdate}
                      disabled={Boolean(editingStepValidationError)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                     >
                        Save Changes
                     </button>
                    </div>
                  </div>
               </div>
            </div>
          )}
        </main>
      </div>

      {/* Markdown Viewer */}
      <MarkdownViewer
        isOpen={markdownViewer.isOpen}
        onClose={() => setMarkdownViewer({ isOpen: false, file: '', title: '' })}
        markdownFile={markdownViewer.file}
        title={markdownViewer.title}
      />
    </div>
  );
};

export default App;
