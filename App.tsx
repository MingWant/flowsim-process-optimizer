
import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_CONFIG } from './constants';
import { useProcessSimulation } from './hooks/useProcessSimulation';
import { ProcessStep, SimulationConfig, NodeType, DurationUnit, RandomnessMode, StepSimulationMode, ArrivalInputMode } from './types';
import { ProcessMap } from './components/ProcessMap';
import { StatsBoard } from './components/StatsBoard';
import { MetroDemoBoard } from './components/MetroDemoBoard';
import { generateScenario, analyzeBottlenecks } from './services/geminiService';
import { Play, Pause, RotateCcw, Download, Upload, Zap, MessageSquare, Loader2, Sparkles, Menu, X, Settings, BarChart3, ArrowRight, ArrowDownUp, Clock, PlayCircle, StopCircle, Box, Shuffle, AlertTriangle, Palette, Users, Dna, Copy, ClipboardPaste, Trash2 } from 'lucide-react';

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
  { value: 'day', label: 'sim day' },
  { value: 'week', label: 'sim week' },
  { value: 'month', label: 'sim month' },
  { value: 'year', label: 'sim year' },
] as const;

const TIME_COMPRESSION_PRESETS = [
  { value: 1, label: 'Real-time', hint: '1 simulated second = 1 real second' },
  { value: 60, label: '1 sim min / sec', hint: 'Useful for short delay testing' },
  { value: 60 * 60, label: '1 sim hour / sec', hint: 'Good for shift-level simulations' },
  { value: 24 * 60 * 60, label: '1 sim day / sec', hint: 'Great for daily process playback' },
  { value: 7 * 24 * 60 * 60, label: '1 sim week / sec', hint: 'For weekly flow trends' },
  { value: 30 * 24 * 60 * 60, label: '1 sim month / sec', hint: 'For monthly cycle simulations' },
  { value: 365 * 24 * 60 * 60, label: '1 sim year / sec', hint: 'For long-horizon scenario testing' },
] as const;

const UI_THEMES: { id: UiTheme; label: string; swatch: string }[] = [
  { id: 'dark', label: 'Dark', swatch: 'bg-slate-950' },
  { id: 'light', label: 'Light', swatch: 'bg-slate-100' },
  { id: 'ocean', label: 'Ocean', swatch: 'bg-cyan-700' },
  { id: 'warm', label: 'Warm', swatch: 'bg-orange-500' },
];

const formatSimulationTime = (totalMs: number) => {
  const safeMs = Math.max(0, Math.floor(totalMs));
  const totalSeconds = Math.floor(safeMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  if (days > 0) {
    return `D${days} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(totalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const CUSTOM_CLOCK_VALUE = 'custom';
const FLOWSIM_EXPORT_VERSION = 3;
const FLOWSIM_DRAFT_STORAGE_KEY = 'flowsim-local-draft';
const FLOWSIM_METRICS_CYCLE_UNIT_KEY = 'flowsim-metrics-cycle-unit';
const VALID_NODE_TYPES: NodeType[] = ['start', 'process', 'end'];
const VALID_RANDOMNESS_MODES: RandomnessMode[] = ['fixed', 'range'];
const VALID_SIMULATION_MODES: StepSimulationMode[] = ['resource', 'delay'];
const VALID_ARRIVAL_INPUT_MODES: ArrivalInputMode[] = ['rate', 'interval'];
const DEFAULT_ZERO_VARIANCE_STEP_IDS = new Set(['step-1', 'step-2', 'step-3', 'step-4']);

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

const getArrivalUnitLabel = (unit?: DurationUnit) => (
  ARRIVAL_UNITS.find((option) => option.value === unit)?.label || 'sim second'
);

const getArrivalMinValue = (mode?: ArrivalInputMode) => mode === 'interval' ? 0.001 : 0.000000001;
const getBatchSize = (value: unknown) => Math.max(1, Math.min(1000, Math.round(toFiniteNumber(value, 1))));

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

const normalizeConnections = (connections: ProcessStep['connections']) => {
  const validConnections = connections.filter((connection) => connection.targetId);

  if (validConnections.length === 0) {
    return [];
  }

  const probabilityTotal = validConnections.reduce((sum, connection) => sum + connection.probability, 0);

  if (probabilityTotal > 0) {
    return validConnections.map((connection) => ({
      ...connection,
      probability: connection.probability / probabilityTotal,
    }));
  }

  return validConnections.map((connection) => ({
    ...connection,
    probability: 1 / validConnections.length,
  }));
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
  const rawArrivalInputMode = rawStep.arrivalInputMode;
  const arrivalInputMode = isStart && typeof rawArrivalInputMode === 'string' && VALID_ARRIVAL_INPUT_MODES.includes(rawArrivalInputMode as ArrivalInputMode)
    ? rawArrivalInputMode as ArrivalInputMode
    : isStart ? 'rate' : undefined;
  const rawSimulationMode = rawStep.simulationMode;
  const simulationMode = isProcess && typeof rawSimulationMode === 'string' && VALID_SIMULATION_MODES.includes(rawSimulationMode as StepSimulationMode)
    ? rawSimulationMode as StepSimulationMode
    : isProcess ? 'resource' : undefined;
  const arrivalUnit = isStart && typeof rawStep.arrivalUnit === 'string' && DURATION_UNITS.some(unit => unit.value === rawStep.arrivalUnit)
    ? rawStep.arrivalUnit as DurationUnit
    : isStart ? 's' : undefined;
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
    arrivalInputMode,
    arrivalUnit,
    endTimeUnit,
    simulationMode,
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
      minArrivalRate: step.type === 'start' ? Math.min(step.minArrivalRate ?? 0.2, step.maxArrivalRate ?? 0.8) : undefined,
      maxArrivalRate: step.type === 'start' ? Math.max(step.minArrivalRate ?? 0.2, step.maxArrivalRate ?? 0.8) : undefined,
      arrivalBatchSize: step.type === 'start' ? getBatchSize(step.arrivalBatchSize) : undefined,
      minProcessingTime: step.type === 'process' ? Math.min(step.minProcessingTime ?? 1000, step.maxProcessingTime ?? 3000) : 0,
      maxProcessingTime: step.type === 'process' ? Math.max(step.minProcessingTime ?? 1000, step.maxProcessingTime ?? 3000) : 0,
    };
  });

  return {
    steps: normalizedSteps,
    isRunning: false,
    speedMultiplier: Math.max(1, Math.round(toFiniteNumber(rawConfig.speedMultiplier, 1))),
    timeCompression: toPositiveNumber(rawConfig.timeCompression, 1),
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
  const [config, setConfig] = useState<SimulationConfig>(loadInitialConfig);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
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
  const importInputRef = useRef<HTMLInputElement | null>(null);
  
  // Edit Modal State
  const [editingStep, setEditingStep] = useState<ProcessStep | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'connections' | 'rules' | 'exceptions'>('basic');

  // Simulation Hook
  const { items, stepStats, simulationTimeMs, globalStats, resetSimulation } = useProcessSimulation(config);

  // Handlers
  const togglePlay = () => setConfig(p => ({ ...p, isRunning: !p.isRunning }));
  
  const saveStepUpdate = () => {
    if (!editingStep) return;
    setConfig(p => ({
      ...p,
      steps: p.steps.map(s => s.id === editingStep.id ? editingStep : s)
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
          connections: normalizeConnections(
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

  const updateProbability = (targetId: string, newVal: number) => {
      if (!editingStep) return;
      const newConns = editingStep.connections.map(c => 
         c.targetId === targetId ? { ...c, probability: newVal } : c
      );
      setEditingStep({ ...editingStep, connections: newConns });
  };

  const updateSourceRule = (sourceId: string, time: number) => {
      if (!editingStep) return;
      const newRules = { ...editingStep.sourceProcessingTimes, [sourceId]: time };
      setEditingStep({ ...editingStep, sourceProcessingTimes: newRules });
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
      const importedConfig = parseImportedConfig(parsed);

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
           <div className={`hidden sm:flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${config.isRunning ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
             <span className={`h-2 w-2 rounded-full ${config.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
             {runningLabel}
           </div>
           <div className="hidden xl:flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
             <Clock size={14} />
             {simulationClockLabel}
           </div>
           {!hasApiKey && (
             <button onClick={selectApiKey} className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-full transition-colors font-medium">
               Select API Key
             </button>
           )}
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

          <div className="custom-scrollbar h-full overflow-y-auto p-5 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
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
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${
                    config.isRunning 
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/50 hover:bg-amber-500/20' 
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-lg shadow-emerald-900/20'
                  }`}
                >
                  {config.isRunning ? <><Pause size={18}/> Pause</> : <><Play size={18}/> Start</>}
                </button>
                <button 
                  onClick={resetSimulation}
                  className="p-3 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Reset"
                >
                  <RotateCcw size={18}/>
                </button>
              </div>

              <div className="space-y-4 pt-1">
                <div>
                  <div className="flex justify-between text-sm mb-1">
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
                  <div className="flex justify-between text-sm mb-1 gap-3">
                    <span className="text-slate-400">Simulation Clock</span>
                    <span className="text-right font-mono text-cyan-400 text-[11px]">{activeCompressionPreset?.label || `${config.timeCompression}x time`}</span>
                  </div>
                  <select
                    value={compressionSelectValue}
                    onChange={(e) => applyClockPreset(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30"
                  >
                    {TIME_COMPRESSION_PRESETS.map((preset) => (
                      <option key={preset.value} value={String(preset.value)}>{preset.label}</option>
                    ))}
                    <option value={CUSTOM_CLOCK_VALUE}>Custom</option>
                  </select>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{activeCompressionPreset?.hint || 'Choose how much simulated time passes during each real second.'}</p>
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Custom Ratio</span>
                      <span className="font-mono text-cyan-400">{config.timeCompression} sim sec / real sec</span>
                    </div>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={config.timeCompression}
                      onChange={(e) => applyCustomClockValue(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-300">Current Sim Time</span>
                    <span className="font-mono text-cyan-300">{simulationClockLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14}/> AI Scenario
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">Describe a real process and let AI rebuild the nodes and routes.</p>
              <div className="relative">
                <textarea 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="E.g., Car Wash, Hospital ER..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-24 transition-all"
                />
                <button 
                  onClick={handleGenerateScenario}
                  disabled={isGenerating || !aiPrompt}
                  className="absolute bottom-2 right-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:opacity-50 transition-colors"
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <ArrowRight size={16}/>}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex justify-between items-center">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 size={14}/> Analysis
                 </h3>
                 <button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing || globalStats.totalItemsFinished < 5}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded transition-colors disabled:opacity-50"
                 >
                    {isAnalyzing ? 'Thinking...' : 'Analyze'}
                 </button>
              </div>
              
              {aiAnalysis ? (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-sm text-slate-300 leading-relaxed">
                  <MessageSquare size={14} className="inline mr-2 text-blue-400"/>
                  {aiAnalysis}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic text-center py-2">
                   Run simulation to generate data
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Flow steps</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {config.steps.map(step => (
                  <button
                    key={step.id}
                    onClick={() => { setEditingStep(step); setActiveTab('basic'); setIsSidebarOpen(false); }}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-left hover:border-blue-500/50 hover:bg-slate-800 transition-colors"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: step.color }} />
                      <span className="truncate text-sm text-slate-200">{step.name}</span>
                    </span>
                    <span className="text-[10px] uppercase text-slate-500 shrink-0">{step.type}</span>
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

        <button
          onClick={() => setIsDesktopSidebarCollapsed((value) => !value)}
          className="fixed left-4 top-[4.25rem] z-40 hidden items-center gap-2 rounded-full border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-slate-300 shadow-2xl backdrop-blur transition hover:border-blue-500/50 hover:bg-slate-900 lg:flex"
          title={isDesktopSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar for presentation'}
        >
          {isDesktopSidebarCollapsed ? <Menu size={15} /> : <X size={15} />}
          {isDesktopSidebarCollapsed ? 'Show controls' : 'Hide controls'}
        </button>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto h-[calc(100vh-3.5rem)] p-3 lg:p-4 scroll-smooth relative bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.10),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_30%)]">
          <div className="max-w-none mx-auto space-y-4">
             <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 shadow-2xl shadow-black/20">
               <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between mb-3 pl-0 lg:pl-24">
                 <div>
                   <h2 className="text-lg font-semibold text-slate-100">Process Map</h2>
                   <p className="text-xs text-slate-500">
                     {canvasViewMode === 'map'
                       ? `Presentation canvas · Sim time: ${simulationClockLabel} · Ctrl/Cmd + wheel to zoom, drag to pan.`
                       : `Metro demo mode · Sim time: ${simulationClockLabel} · Compact horizontal presentation lane with focus, zoom, and bottleneck highlights.`}
                   </p>
                   {importExportNotice && <p className="mt-1 text-xs text-cyan-300">{importExportNotice}</p>}
                   {draftStatusMessage && <p className={`mt-1 text-xs ${draftStatus === 'save-failed' ? 'text-rose-300' : 'text-emerald-300'}`}>{draftStatusMessage}</p>}
                 </div>
                 <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
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
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Copy only the selected nodes"
                    >
                      <Copy size={16}/> Copy Selected{selectedStepIds.length > 0 ? ` (${selectedStepIds.length})` : ''}
                    </button>
                    <button
                      onClick={removeSelectedSteps}
                      disabled={selectedStepIds.length === 0}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-sm text-rose-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Delete only the selected nodes"
                    >
                      <Trash2 size={16}/> Delete Selected{selectedStepIds.length > 0 ? ` (${selectedStepIds.length})` : ''}
                    </button>
                    <button
                      onClick={copyFlow}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors"
                      title="Copy the full current flow graph"
                    >
                      <Copy size={16}/> Copy Flow
                    </button>
                    <button
                      onClick={pasteFlow}
                      disabled={!flowClipboard || flowClipboard.length === 0}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Paste the copied flow to the right"
                    >
                      <ClipboardPaste size={16}/> Paste Flow
                    </button>
                    <button
                      onClick={triggerImport}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors"
                    >
                      <Upload size={16}/> Import
                    </button>
                    <button
                      onClick={exportConfig}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors"
                    >
                      <Download size={16}/> Export
                    </button>
                    <button 
                      onClick={togglePlay}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${config.isRunning ? 'bg-amber-500/10 text-amber-300 border border-amber-500/40' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'}`}
                    >
                      {config.isRunning ? <><Pause size={16}/> Pause</> : <><Play size={16}/> Start</>}
                    </button>
                    <button onClick={resetSimulation} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm text-slate-300 transition-colors">
                      <RotateCcw size={16}/> Reset
                    </button>
                    <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                      <span className="text-xs text-slate-500">Speed</span>
                      <input 
                        type="range" min="1" max="10" step="1"
                        value={config.speedMultiplier}
                        onChange={(e) => setConfig(p => ({ ...p, speedMultiplier: parseInt(e.target.value) }))}
                        className="w-24 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                      <span className="w-8 text-right font-mono text-xs text-purple-300">{config.speedMultiplier}x</span>
                    </div>
                    <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
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
                 <StatsBoard globalStats={globalStats} stepStats={stepStats} steps={config.steps} items={items} simulationTimeMs={simulationTimeMs} cycleTimeUnit={metricsCycleTimeUnit} />
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
                            )}

                            {/* START NODE SPECIFIC */}
                            {editingStep.type === 'start' && (
                                <div className="p-4 bg-emerald-900/20 border border-emerald-900/50 rounded-lg">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                  <label className="block text-xs font-semibold text-emerald-400 uppercase">Arrival Input</label>
                                  <div className="flex items-center gap-2 bg-slate-900 rounded p-1">
                                    <button
                                      onClick={() => setEditingStep({ ...editingStep, arrivalInputMode: 'rate' })}
                                      className={`text-xs px-3 py-1.5 rounded transition-all ${(editingStep.arrivalInputMode || 'rate') === 'rate' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                      Rate
                                    </button>
                                    <button
                                      onClick={() => setEditingStep({ ...editingStep, arrivalInputMode: 'interval' })}
                                      className={`text-xs px-3 py-1.5 rounded transition-all ${editingStep.arrivalInputMode === 'interval' ? 'bg-cyan-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                      Interval
                                    </button>
                                  </div>
                                </div>
                                <div className="mb-4 grid grid-cols-[1fr_180px] gap-3">
                                  <div className="rounded-lg border border-emerald-900/40 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                                    {(editingStep.arrivalInputMode || 'rate') === 'interval'
                                      ? 'Define how much simulated time passes before one new item arrives.'
                                      : 'Define how many items arrive within the selected simulated time unit.'}
                                  </div>
                                  <select
                                    value={editingStep.arrivalUnit || 's'}
                                    onChange={(e) => setEditingStep({ ...editingStep, arrivalUnit: e.target.value as DurationUnit })}
                                    className="rounded-lg border border-emerald-900/50 bg-slate-800 px-3 py-2 text-sm text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-500"
                                  >
                                    {ARRIVAL_UNITS.map((unit) => (
                                      <option key={unit.value} value={unit.value}>{unit.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="mb-4">
                                  <label className="block text-xs font-semibold text-emerald-400 uppercase mb-2">Batch Size</label>
                                  <div className="grid grid-cols-[160px_1fr] gap-3 items-center">
                                    <input
                                      type="number"
                                      min="1"
                                      max="1000"
                                      step="1"
                                      value={editingStep.arrivalBatchSize ?? 1}
                                      onChange={e => setEditingStep({...editingStep, arrivalBatchSize: getBatchSize(e.target.value)})}
                                      className="w-full bg-slate-800 border border-emerald-900/50 rounded-lg p-2 text-emerald-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                    <div className="rounded-lg border border-emerald-900/40 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                                      Creates this many items at the same simulated arrival time.
                                    </div>
                                  </div>
                                </div>

                                <label className="block text-xs font-semibold text-emerald-400 uppercase mb-2">
                                  {(editingStep.arrivalInputMode || 'rate') === 'interval'
                                    ? `Arrival Interval (${getArrivalUnitLabel(editingStep.arrivalUnit)})`
                                    : `Arrival Rate (items / ${getArrivalUnitLabel(editingStep.arrivalUnit)})`}
                                </label>
                                    
                                    {editingStep.randomnessMode === 'range' ? (
                                         <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-slate-400 uppercase mb-1 block">Min {(editingStep.arrivalInputMode || 'rate') === 'interval' ? 'Interval' : 'Rate'}</label>
                                                <input 
                                        type="number" min={String(getArrivalMinValue(editingStep.arrivalInputMode))} step="0.001"
                                        value={editingStep.minArrivalRate ?? ((editingStep.arrivalInputMode || 'rate') === 'interval' ? 1 : 0.2)} 
                                        onChange={e => setEditingStep({...editingStep, minArrivalRate: Number(e.target.value)})}
                                                    className="w-full bg-slate-800 border border-emerald-900/50 rounded-lg p-2 text-emerald-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 uppercase mb-1 block">Max {(editingStep.arrivalInputMode || 'rate') === 'interval' ? 'Interval' : 'Rate'}</label>
                                                <input 
                                        type="number" min={String(getArrivalMinValue(editingStep.arrivalInputMode))} step="0.001"
                                        value={editingStep.maxArrivalRate ?? ((editingStep.arrivalInputMode || 'rate') === 'interval' ? 3 : 0.8)} 
                                        onChange={e => setEditingStep({...editingStep, maxArrivalRate: Number(e.target.value)})}
                                                    className="w-full bg-slate-800 border border-emerald-900/50 rounded-lg p-2 text-emerald-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-2 text-xs text-slate-500 mt-1">
                                      {(editingStep.arrivalInputMode || 'rate') === 'interval'
                                        ? `A batch of ${editingStep.arrivalBatchSize ?? 1} item(s) will arrive after a random interval between ${editingStep.minArrivalRate ?? 0} and ${editingStep.maxArrivalRate ?? 0} ${getArrivalUnitLabel(editingStep.arrivalUnit)}.`
                                        : `Total arrivals fluctuate between ${editingStep.minArrivalRate ?? 0} and ${editingStep.maxArrivalRate ?? 0} items per ${getArrivalUnitLabel(editingStep.arrivalUnit)}, grouped into batches of ${editingStep.arrivalBatchSize ?? 1}.`}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-4">
                                            <input 
                                      type="number" min={String(getArrivalMinValue(editingStep.arrivalInputMode))} step="0.001"
                                      value={editingStep.arrivalRate ?? ((editingStep.arrivalInputMode || 'rate') === 'interval' ? 1 : 0.5)} 
                                      onChange={e => setEditingStep({...editingStep, arrivalRate: Number(e.target.value)})}
                                                className="flex-1 bg-slate-800 border border-emerald-900/50 rounded-lg p-3 text-emerald-100 font-mono text-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                    <span className="font-mono text-sm text-emerald-500 font-bold whitespace-nowrap">
                                      {(editingStep.arrivalInputMode || 'rate') === 'interval'
                                        ? `${getArrivalUnitLabel(editingStep.arrivalUnit)} / batch`
                                        : `items / ${getArrivalUnitLabel(editingStep.arrivalUnit)}`}
                                    </span>
                                        </div>
                                    )}
                                </div>
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

                                {editingStep.simulationMode !== 'delay' && <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Capacity (Resources)</label>
                                        <input 
                                            type="number" min="1" max="50"
                                            value={editingStep.capacity} 
                                            onChange={e => setEditingStep({...editingStep, capacity: parseInt(e.target.value) || 1})}
                                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
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
                         <div className="space-y-4">
                            <p className="text-sm text-slate-400 mb-2">Select which steps items can move to next, and set the probability.</p>
                            <div className="space-y-3">
                                {config.steps.filter(s => s.id !== editingStep.id).map(otherStep => {
                                    // Don't allow connections back to Start nodes
                                    if (otherStep.type === 'start') return null;

                                    const conn = editingStep.connections?.find(c => c.targetId === otherStep.id);
                                    const isConnected = !!conn;
                                    
                                    return (
                                        <div key={otherStep.id} className={`flex items-center justify-between p-3 rounded border transition-colors ${isConnected ? 'bg-slate-800 border-blue-500/50' : 'bg-slate-800/30 border-slate-700'}`}>
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="checkbox"
                                                    checked={isConnected}
                                                    onChange={(e) => toggleConnection(otherStep.id, e.target.checked)}
                                                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-slate-300 font-medium">
                                                    {otherStep.type === 'end' && <span className="text-red-400 mr-1">[END]</span>}
                                                    {otherStep.name}
                                                </span>
                                            </div>
                                            
                                            {isConnected && (
                                               <div className="flex items-center gap-2">
                                                   <span className="text-xs text-slate-500">Prob:</span>
                                                   <input 
                                                      type="number" min="0" max="1" step="0.1"
                                                      value={conn.probability}
                                                      onChange={(e) => updateProbability(otherStep.id, parseFloat(e.target.value))}
                                                      className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:border-blue-500 outline-none"
                                                   />
                                               </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {editingStep.connections.length > 0 && (
                                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300">
                                    Total Probability: {(editingStep.connections.reduce((sum, c) => sum + c.probability, 0) * 100).toFixed(0)}%
                                    {Math.abs(editingStep.connections.reduce((sum, c) => sum + c.probability, 0) - 1) > 0.01 && 
                                        <span className="block mt-1 text-amber-400 font-bold">Warning: Probabilities do not sum to 100%</span>
                                    }
                                </div>
                            )}
                         </div>
                     )}

                     {/* Rules Tab */}
                     {activeTab === 'rules' && editingStep.type !== 'start' && (
                         <div className="space-y-4">
                             <p className="text-sm text-slate-400 mb-4">Override processing time based on where the item came from. (Applies mainly to Fixed mode)</p>
                             
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
                                                         value={ruleTime || ''}
                                                         onChange={(e) => updateSourceRule(source.id, parseInt(e.target.value))}
                                                         className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-right focus:border-blue-500 outline-none"
                                                     />
                                                     <span className="text-xs text-slate-500 w-6">ms</span>
                                                 </div>
                                             </div>
                                         )
                                     })}
                                 </div>
                             )}
                         </div>
                     )}

                  </div>
                  <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-end gap-2 shrink-0">
                     <button 
                        onClick={() => setEditingStep(null)}
                        className="px-4 py-2 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                     >
                        Cancel
                     </button>
                     <button 
                        onClick={saveStepUpdate}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
                     >
                        Save Changes
                     </button>
                  </div>
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
