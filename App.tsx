
import React, { useEffect, useRef, useState } from 'react';
import { useProcessSimulation } from './hooks/useProcessSimulation';
import type { ProcessStep, SimulationConfig, NodeType, DurationUnit, DemandModifier } from './types';
import { ProcessMap } from './components/ProcessMap';
import { StatsBoard } from './components/StatsBoard';
import { MetroDemoBoard } from './components/MetroDemoBoard';
import { AppSidebar } from './components/AppSidebar';
import { StepEditorModal, type StepEditorTab } from './components/StepEditorModal';
import { generateScenario, analyzeBottlenecks } from './services/geminiService';
import { getActiveDemandModifiers, getBusinessDate, getDemandMultiplier, isWorkingTime, normalizeBusinessCalendar, normalizeDemandModifiers } from './services/simulationCalendar';
import { FLOWSIM_DRAFT_STORAGE_KEY, FLOWSIM_EXPORT_VERSION, FLOWSIM_METRICS_CYCLE_UNIT_KEY, FLOWSIM_METRICS_EXCLUDE_NON_WORKING_KEY } from './constants/storage';
import { CUSTOM_CLOCK_VALUE, DURATION_UNITS, TIME_COMPRESSION_PRESETS } from './constants/timeUnits';
import { UI_THEMES, type CanvasViewMode, type UiTheme } from './constants/uiOptions';
import { formatSimulationTime, getAutoPauseProgressRows } from './utils/formatters';
import { buildClipboardSteps, buildUniqueCopyName, cloneStep, getStepBounds, normalizeConnections } from './utils/flowClipboard';
import {
  getStepValidationError,
  loadInitialConfig,
  parseImportedConfig,
  sanitizeScheduledArrivalEvents,
  sanitizeScheduledArrivalWindows,
} from './utils/configSerialization';
import { Play, Pause, RotateCcw, Download, Upload, Zap, Menu, X, Clock, Box, Palette, Dna, Copy, ClipboardPaste, Trash2 } from 'lucide-react';

interface CanvasSpawnPosition {
  x: number;
  y: number;
}

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
  const [excludeNonWorkingFromCycleTime, setExcludeNonWorkingFromCycleTime] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(FLOWSIM_METRICS_EXCLUDE_NON_WORKING_KEY) === 'true';
  });
  const [canvasViewMode, setCanvasViewMode] = useState<CanvasViewMode>('map');
  const [flowClipboard, setFlowClipboard] = useState<ProcessStep[] | null>(null);
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  const [autoPauseNotice, setAutoPauseNotice] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  
  // Edit Modal State
  const [editingStep, setEditingStep] = useState<ProcessStep | null>(null);
  const [activeTab, setActiveTab] = useState<StepEditorTab>('basic');
  const editingStepValidationError = getStepValidationError(editingStep);

  // Simulation Hook
  const { items, stepStats, simulationTimeMs, globalStats, autoPauseReason, resetSimulation } = useProcessSimulation(config, (reason) => {
    setConfig((previous) => previous.isRunning ? { ...previous, isRunning: false } : previous);
    setAutoPauseNotice(reason);
  });

  // Handlers
  const togglePlay = () => {
    setAutoPauseNotice(null);
    setConfig(p => ({ ...p, isRunning: !p.isRunning }));
  };
  
  const saveStepUpdate = () => {
    if (!editingStep) return;
    if (editingStepValidationError) return;
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
    const usedNames = new Set<string>(config.steps.map((step) => step.name));

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

  const addStartDemandModifier = () => {
    if (!editingStep) return;

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
    if (!editingStep) return;

    const windows = sanitizeScheduledArrivalWindows(editingStep.arrivalSchedule);
    const lastWindow = windows[windows.length - 1];
    const startHour = lastWindow ? Math.min(23.5, lastWindow.endHour) : 9;
    const endHour = Math.min(24, startHour + 1);

    setEditingStep({
      ...editingStep,
      arrivalSchedule: sanitizeScheduledArrivalWindows([
        ...windows,
        {
          id: `window-${Date.now()}`,
          name: `Window ${windows.length + 1}`,
          enabled: true,
          startHour,
          endHour,
          quantity: 10,
          spreadMode: 'spread',
        },
      ]),
    });
  };

  const addArrivalEvent = () => {
    if (!editingStep) return;

    const events = sanitizeScheduledArrivalEvents(editingStep.arrivalEvents);
    setEditingStep({
      ...editingStep,
      arrivalEvents: sanitizeScheduledArrivalEvents([
        ...events,
        {
          id: `event-${Date.now()}`,
          name: `Event ${events.length + 1}`,
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
      ]),
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
    window.localStorage.setItem(FLOWSIM_METRICS_EXCLUDE_NON_WORKING_KEY, String(excludeNonWorkingFromCycleTime));
  }, [excludeNonWorkingFromCycleTime]);

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
      businessCalendar: normalizeBusinessCalendar({ ...businessCalendar, ...updates }),
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
           <button 
             className="lg:hidden p-2 text-slate-400 hover:text-white"
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
           >
             <Menu size={24} />
           </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row relative overflow-hidden">
        <AppSidebar
          aiAnalysis={aiAnalysis}
          aiPrompt={aiPrompt}
          autoPauseNotice={autoPauseNotice}
          autoPauseProgressRows={autoPauseProgressRows}
          autoPauseReason={autoPauseReason}
          businessCalendar={businessCalendar}
          config={config}
          currentBusinessDate={currentBusinessDate}
          currentDemandMultiplier={currentDemandMultiplier}
          demandModifiers={demandModifiers}
          globalIsWorking={globalIsWorking}
          globalStats={globalStats}
          isAnalyzing={isAnalyzing}
          isDesktopSidebarCollapsed={isDesktopSidebarCollapsed}
          isGenerating={isGenerating}
          isSidebarOpen={isSidebarOpen}
          simulationClockLabel={simulationClockLabel}
          uiTheme={uiTheme}
          activeDemandModifiers={activeDemandModifiers}
          activeDemandModifierIds={activeDemandModifierIds}
          addDemandModifier={addDemandModifier}
          applyClockPreset={applyClockPreset}
          applyCustomClockValue={applyCustomClockValue}
          handleAnalyze={handleAnalyze}
          handleGenerateScenario={handleGenerateScenario}
          onCloseMobile={() => setIsSidebarOpen(false)}
          onEditStep={(step) => { setEditingStep(step); setActiveTab('basic'); setIsSidebarOpen(false); }}
          removeDemandModifier={removeDemandModifier}
          resetSimulation={resetSimulation}
          setAiPrompt={setAiPrompt}
          setConfig={setConfig}
          setUiTheme={setUiTheme}
          togglePlay={togglePlay}
          updateBusinessCalendar={updateBusinessCalendar}
          updateDemandModifier={updateDemandModifier}
        />

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
                 <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
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
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <input
                        type="checkbox"
                        checked={excludeNonWorkingFromCycleTime}
                        onChange={(event) => setExcludeNonWorkingFromCycleTime(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500"
                      />
                      <span>Exclude non-working</span>
                    </label>
                    <div className="text-xs text-slate-500">Queue: <span className="font-mono text-amber-300">{totalQueue}</span></div>
                  </div>
                </div>
                 <StatsBoard globalStats={globalStats} stepStats={stepStats} steps={config.steps} items={items} simulationTimeMs={simulationTimeMs} cycleTimeUnit={metricsCycleTimeUnit} excludeNonWorkingFromCycleTime={excludeNonWorkingFromCycleTime} />
             </section>
          </div>
          
          <div className="h-12"/>

          <StepEditorModal
            config={config}
            businessCalendar={businessCalendar}
            editingStep={editingStep}
            activeTab={activeTab}
            editingStepValidationError={editingStepValidationError}
            potentialSources={potentialSources}
            setEditingStep={setEditingStep}
            setActiveTab={setActiveTab}
            saveStepUpdate={saveStepUpdate}
            toggleConnection={toggleConnection}
            updateProbability={updateProbability}
            updateSourceRule={updateSourceRule}
            addStartDemandModifier={addStartDemandModifier}
            addArrivalWindow={addArrivalWindow}
            addArrivalEvent={addArrivalEvent}
          />
        </main>
      </div>
    </div>
  );
};

export default App;
