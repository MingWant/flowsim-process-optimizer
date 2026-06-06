import React from 'react';
import type {
  BusinessCalendar,
  DemandModifier,
  DurationUnit,
  NonWorkingArrivalPolicy,
  ProcessStep,
  SimulationConfig,
  SimulationStats,
  WaitTimeCalculationMode,
} from '../types';
import { CUSTOM_CLOCK_VALUE, TIME_COMPRESSION_PRESETS } from '../constants/timeUnits';
import { NON_WORKING_POLICY_LABELS, UI_THEMES, WEEKDAY_OPTIONS, type UiTheme } from '../constants/uiOptions';
import { VALID_NON_WORKING_POLICIES } from '../utils/configSerialization';
import { formatBusinessDateTime } from '../utils/formatters';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  BarChart3,
  Clock,
  Loader2,
  MessageSquare,
  Palette,
  Pause,
  Play,
  PlayCircle,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

interface AutoPauseProgressRow {
  label: string;
  target: number;
  value: number;
  targetLabel?: string;
  valueLabel?: string;
}

interface Props {
  aiAnalysis: string | null;
  aiPrompt: string;
  autoPauseNotice: string | null;
  autoPauseProgressRows: AutoPauseProgressRow[];
  autoPauseReason?: string | null;
  businessCalendar: BusinessCalendar;
  config: SimulationConfig;
  currentBusinessDate: Date;
  currentDemandMultiplier: number;
  demandModifiers: DemandModifier[];
  globalIsWorking: boolean;
  globalStats: SimulationStats;
  isAnalyzing: boolean;
  isDesktopSidebarCollapsed: boolean;
  isGenerating: boolean;
  isSidebarOpen: boolean;
  simulationClockLabel: string;
  uiTheme: UiTheme;
  activeDemandModifiers: DemandModifier[];
  activeDemandModifierIds: Set<string>;
  addDemandModifier: () => void;
  applyClockPreset: (value: string) => void;
  applyCustomClockValue: (value: string) => void;
  handleAnalyze: () => void;
  handleGenerateScenario: () => void;
  onCloseMobile: () => void;
  onEditStep: (step: ProcessStep) => void;
  removeDemandModifier: (modifierId: string) => void;
  resetSimulation: () => void;
  setAiPrompt: (prompt: string) => void;
  setConfig: React.Dispatch<React.SetStateAction<SimulationConfig>>;
  setUiTheme: (theme: UiTheme) => void;
  togglePlay: () => void;
  updateBusinessCalendar: (updates: Partial<BusinessCalendar>) => void;
  updateDemandModifier: (modifierId: string, updates: Partial<DemandModifier>) => void;
}

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

const autoPauseFields = [
  { key: 'totalItemsCreated' as const, label: 'Created', step: 1, placeholder: 'items' },
  { key: 'totalItemsFinished' as const, label: 'Finished', step: 1, placeholder: 'items' },
  { key: 'activeItems' as const, label: 'Active', step: 1, placeholder: 'items' },
  { key: 'totalItemsFailed' as const, label: 'Failed', step: 1, placeholder: 'items' },
  { key: 'totalItemsCancelled' as const, label: 'Cancelled', step: 1, placeholder: 'items' },
];

export const AppSidebar: React.FC<Props> = ({
  aiAnalysis,
  aiPrompt,
  autoPauseNotice,
  autoPauseProgressRows,
  autoPauseReason,
  businessCalendar,
  config,
  currentBusinessDate,
  currentDemandMultiplier,
  demandModifiers,
  globalIsWorking,
  globalStats,
  isAnalyzing,
  isDesktopSidebarCollapsed,
  isGenerating,
  isSidebarOpen,
  simulationClockLabel,
  uiTheme,
  activeDemandModifiers,
  activeDemandModifierIds,
  addDemandModifier,
  applyClockPreset,
  applyCustomClockValue,
  handleAnalyze,
  handleGenerateScenario,
  onCloseMobile,
  onEditStep,
  removeDemandModifier,
  resetSimulation,
  setAiPrompt,
  setConfig,
  setUiTheme,
  togglePlay,
  updateBusinessCalendar,
  updateDemandModifier,
}) => {
  const activeCompressionPreset = TIME_COMPRESSION_PRESETS.find((preset) => preset.value === config.timeCompression);
  const compressionSelectValue = activeCompressionPreset ? String(activeCompressionPreset.value) : CUSTOM_CLOCK_VALUE;
  const autoPauseTimeUnit = config.autoPause?.simulationTimeUnit || 'ms';
  const autoPauseTimeUnitMs = AUTO_PAUSE_TIME_UNITS.find((unit) => unit.value === autoPauseTimeUnit)?.ms || 1;
  const autoPauseTimeValue = typeof config.autoPause?.simulationTimeMs === 'number'
    ? Number((config.autoPause.simulationTimeMs / autoPauseTimeUnitMs).toFixed(3))
    : '';

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-40 w-80 bg-slate-950/95 backdrop-blur-xl border-r border-slate-800
      transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:bg-slate-900/70 lg:backdrop-blur-none
      flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden
      ${isDesktopSidebarCollapsed ? 'lg:w-0 lg:border-r-0' : 'lg:w-80'}
      ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="p-4 flex items-center justify-between lg:hidden border-b border-slate-800">
        <span className="font-semibold text-slate-200">AI & Insights</span>
        <button onClick={onCloseMobile} className="text-slate-400"><X size={20} /></button>
      </div>

      <div className="custom-scrollbar h-full overflow-y-auto p-4 space-y-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Settings size={14} /> Quick Controls
          </h3>
          <div className="md:hidden space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Palette size={14} /> Theme
            </div>
            <div className="grid grid-cols-2 gap-2">
              {UI_THEMES.map((theme) => (
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
              {config.isRunning ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start</>}
            </button>
            <button
              onClick={resetSimulation}
              className="p-2.5 rounded-lg bg-slate-700 border border-slate-500 hover:bg-slate-600 text-slate-200 transition-colors"
              title="Reset"
            >
              <RotateCcw size={18} />
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
                onChange={(event) => setConfig((previous) => ({ ...previous, speedMultiplier: parseInt(event.target.value) }))}
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
                onChange={(event) => applyClockPreset(event.target.value)}
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
                  onChange={(event) => applyCustomClockValue(event.target.value)}
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
              <Clock size={14} /> Business Time
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
              <AlertTriangle size={14} /> Auto Pause
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
                    onChange={(event) => setConfig((previous) => {
                      const unit = previous.autoPause?.simulationTimeUnit || autoPauseTimeUnit;
                      const unitMs = AUTO_PAUSE_TIME_UNITS.find((option) => option.value === unit)?.ms || 1;
                      return {
                        ...previous,
                        autoPause: {
                          ...(previous.autoPause || { enabled: true }),
                          enabled: true,
                          simulationTimeUnit: unit,
                          simulationTimeMs: event.target.value ? Number(event.target.value) * unitMs : undefined,
                        },
                      };
                    })}
                    className="w-full rounded-lg border border-rose-500/30 bg-slate-900 px-2 py-1.5 text-xs text-rose-100 outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <select
                    value={autoPauseTimeUnit}
                    onChange={(event) => setConfig((previous) => {
                      const nextUnit = event.target.value as DurationUnit;
                      const currentMs = previous.autoPause?.simulationTimeMs;
                      return {
                        ...previous,
                        autoPause: {
                          ...(previous.autoPause || { enabled: true }),
                          enabled: true,
                          simulationTimeUnit: nextUnit,
                          simulationTimeMs: typeof currentMs === 'number' ? currentMs : undefined,
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
                  value={config.autoPause.stopDateIso ? config.autoPause.stopDateIso.slice(0, 16) : ''}
                  onChange={(event) => setConfig((previous) => ({
                    ...previous,
                    autoPause: {
                      ...(previous.autoPause || { enabled: true }),
                      enabled: true,
                      stopDateIso: event.target.value ? `${event.target.value}:00` : undefined,
                    },
                  }))}
                  className="w-full rounded-lg border border-rose-500/30 bg-slate-900 px-2 py-1.5 text-xs text-rose-100 outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {autoPauseFields.map((field) => (
                  <div key={field.key}>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-rose-200">{field.label}</label>
                  <input
                    type="number"
                    min="0"
                    step={field.step}
                    placeholder={field.placeholder}
                    value={config.autoPause?.[field.key] ?? ''}
                    onChange={(event) => setConfig((previous) => ({
                      ...previous,
                      autoPause: {
                        ...(previous.autoPause || { enabled: true }),
                        enabled: true,
                        [field.key]: event.target.value ? Number(event.target.value) : undefined,
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
              <Clock size={14} /> Business Hours
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
                  value={(config.calendarStartIso || '2026-01-05T00:00:00').slice(0, 16)}
                  onChange={(event) => setConfig((previous) => ({ ...previous, calendarStartIso: event.target.value ? `${event.target.value}:00` : previous.calendarStartIso }))}
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
                        workingHours: [...current, { start: newStart, end: newEnd }],
                      });
                    }}
                    className="rounded border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-200 hover:bg-indigo-500/20"
                  >
                    + Segment
                  </button>
                </div>
                <div className="space-y-1.5">
                  {(businessCalendar.workingHours || [{ start: 9, end: 17 }]).map((segment, index) => (
                    <div key={`${segment.start}-${segment.end}-${index}`} className="flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-slate-950/70 p-1.5">
                      <input
                        type="number"
                        min="0"
                        max="23.99"
                        step="0.5"
                        value={segment.start}
                        onChange={(event) => {
                          const current = businessCalendar.workingHours || [{ start: 9, end: 17 }];
                          const updated = [...current];
                          updated[index] = { ...updated[index], start: Number(event.target.value) };
                          updateBusinessCalendar({ workingHours: updated });
                        }}
                        className="w-16 rounded border border-indigo-500/30 bg-slate-900 px-1.5 py-1 text-[11px] text-indigo-100 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-500">-</span>
                      <input
                        type="number"
                        min="0.01"
                        max="24"
                        step="0.5"
                        value={segment.end}
                        onChange={(event) => {
                          const current = businessCalendar.workingHours || [{ start: 9, end: 17 }];
                          const updated = [...current];
                          updated[index] = { ...updated[index], end: Number(event.target.value) };
                          updateBusinessCalendar({ workingHours: updated });
                        }}
                        className="w-16 rounded border border-indigo-500/30 bg-slate-900 px-1.5 py-1 text-[11px] text-indigo-100 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {(businessCalendar.workingHours || []).length > 1 && (
                        <button
                          onClick={() => {
                            const current = businessCalendar.workingHours || [{ start: 9, end: 17 }];
                            updateBusinessCalendar({
                              workingHours: current.filter((_, i) => i !== index),
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
                  onChange={(event) => updateBusinessCalendar({ nonWorkingArrivalPolicy: event.target.value as NonWorkingArrivalPolicy })}
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
              <ArrowDownUp size={14} /> Demand Peaks
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
                        onChange={(event) => updateDemandModifier(modifier.id, { enabled: event.target.checked })}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-amber-500"
                      />
                      <input
                        type="text"
                        value={modifier.name}
                        onChange={(event) => updateDemandModifier(modifier.id, { name: event.target.value })}
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
                        Active now - x{modifier.multiplier}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      <div>
                        <label className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">Mult</label>
                        <input
                          type="number" min="0.01" step="0.05"
                          value={modifier.multiplier}
                          onChange={(event) => updateDemandModifier(modifier.id, { multiplier: Number(event.target.value) })}
                          className="w-full rounded border border-amber-500/30 bg-slate-900 px-1.5 py-1 text-xs text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">Start</label>
                        <input
                          type="number" min="0" max="23" step="0.5"
                          value={modifier.startHour ?? 0}
                          onChange={(event) => updateDemandModifier(modifier.id, { startHour: Number(event.target.value) })}
                          className="w-full rounded border border-amber-500/30 bg-slate-900 px-1.5 py-1 text-xs text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">End</label>
                        <input
                          type="number" min="1" max="24" step="0.5"
                          value={modifier.endHour ?? 24}
                          onChange={(event) => updateDemandModifier(modifier.id, { endHour: Number(event.target.value) })}
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
                          onChange={(event) => updateDemandModifier(modifier.id, { startDate: event.target.value || undefined })}
                          className="w-full rounded border border-amber-500/30 bg-slate-900 px-1.5 py-1 text-[10px] text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">End date</label>
                        <input
                          type="date"
                          value={modifier.endDate || ''}
                          onChange={(event) => updateDemandModifier(modifier.id, { endDate: event.target.value || undefined })}
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
              onClick={() => setConfig((previous) => ({ ...previous, simulationMode: 'realistic' }))}
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
              onClick={() => setConfig((previous) => ({ ...previous, simulationMode: 'worst-case' }))}
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

        <div className="rounded-2xl border-4 border-red-500 bg-slate-950/60 p-3.5 space-y-2.5">
          <h3 className="text-lg font-bold text-red-500 uppercase tracking-wider">⚠️⚠️⚠️ Wait Time Calculation ⚠️⚠️⚠️</h3>
          <div className="space-y-2">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-[10px] text-slate-400">
              Choose how queue wait time is calculated and displayed in metrics.
            </div>
            <div className="space-y-1.5">
              <button
                onClick={() => setConfig((previous) => ({ ...previous, waitTimeCalculationMode: 'both' }))}
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
                onClick={() => setConfig((previous) => ({ ...previous, waitTimeCalculationMode: 'calendar' }))}
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
                onClick={() => setConfig((previous) => ({ ...previous, waitTimeCalculationMode: 'working' }))}
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
            <Sparkles size={14} /> AI Scenario
          </h3>
          <div className="relative">
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="E.g., Car Wash, Hospital ER..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-20 transition-all"
            />
            <button
              onClick={handleGenerateScenario}
              disabled={isGenerating || !aiPrompt}
              className="absolute bottom-2 right-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:opacity-50 transition-colors"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 size={14} /> Analysis
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
              <MessageSquare size={12} className="inline mr-1.5 text-blue-400" />
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
            {config.steps.map((step) => (
              <button
                key={step.id}
                onClick={() => onEditStep(step)}
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
  );
};
