import type React from 'react';
import type {
  ArrivalInputMode,
  ArrivalModel,
  DurationUnit,
  ProcessStep,
  ScheduledArrivalRepeat,
  ScheduledArrivalSpreadMode,
} from '../../types';
import { ARRIVAL_UNITS, getArrivalMinValue, getArrivalUnitLabel } from '../../constants/timeUnits';
import { normalizeDemandModifiers } from '../../services/simulationCalendar';
import {
  MAX_SCHEDULED_ARRIVAL_QUANTITY,
  getBatchSize,
  sanitizeScheduledArrivalEvents,
  sanitizeScheduledArrivalWindows,
  updateScheduledArrivalEvent,
  updateScheduledArrivalWindow,
  updateStepDemandModifier,
} from '../../utils/configSerialization';

type StepEditorSetter = React.Dispatch<React.SetStateAction<ProcessStep | null>>;

interface StartNodeSettingsProps {
  editingStep: ProcessStep;
  setEditingStep: StepEditorSetter;
  addStartDemandModifier: () => void;
  addArrivalWindow: () => void;
  addArrivalEvent: () => void;
}

interface StartSectionProps {
  editingStep: ProcessStep;
  setEditingStep: StepEditorSetter;
}

const ARRIVAL_INPUT_OPTIONS: Array<{ mode: ArrivalInputMode; label: string; activeClassName: string }> = [
  { mode: 'rate', label: 'Rate', activeClassName: 'bg-emerald-600 text-white shadow' },
  { mode: 'interval', label: 'Interval', activeClassName: 'bg-cyan-600 text-white shadow' },
];

const ARRIVAL_MODEL_OPTIONS: Array<{ id: ArrivalModel; label: string }> = [
  { id: 'simple', label: 'Simple' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'events', label: 'Events' },
];

export const StartNodeSettings: React.FC<StartNodeSettingsProps> = ({
  editingStep,
  setEditingStep,
  addStartDemandModifier,
  addArrivalWindow,
  addArrivalEvent,
}) => (
  <div className="p-4 bg-emerald-900/20 border border-emerald-900/50 rounded-lg">
    <ArrivalInputControls editingStep={editingStep} setEditingStep={setEditingStep} />
    <ArrivalModelSelector editingStep={editingStep} setEditingStep={setEditingStep} />
    <DemandPeaksSection
      editingStep={editingStep}
      setEditingStep={setEditingStep}
      addStartDemandModifier={addStartDemandModifier}
    />

    {(editingStep.arrivalModel || 'simple') === 'schedule' && (
      <ScheduledWindowsSection
        editingStep={editingStep}
        setEditingStep={setEditingStep}
        addArrivalWindow={addArrivalWindow}
      />
    )}

    {(editingStep.arrivalModel || 'simple') === 'events' && (
      <ExactArrivalEventsSection
        editingStep={editingStep}
        setEditingStep={setEditingStep}
        addArrivalEvent={addArrivalEvent}
      />
    )}

    <BatchSizeField editingStep={editingStep} setEditingStep={setEditingStep} />
    <ArrivalRateFields editingStep={editingStep} setEditingStep={setEditingStep} />
  </div>
);

const ArrivalInputControls: React.FC<StartSectionProps> = ({ editingStep, setEditingStep }) => (
  <>
    <div className="flex items-center justify-between gap-3 mb-3">
      <label className="block text-xs font-semibold text-emerald-400 uppercase">Arrival Input</label>
      <div className="flex items-center gap-2 bg-slate-900 rounded p-1">
        {ARRIVAL_INPUT_OPTIONS.map((option) => {
          const isActive = (editingStep.arrivalInputMode || 'rate') === option.mode;

          return (
            <button
              key={option.mode}
              onClick={() => setEditingStep({ ...editingStep, arrivalInputMode: option.mode })}
              className={`text-xs px-3 py-1.5 rounded transition-all ${isActive ? option.activeClassName : 'text-slate-500 hover:text-slate-300'}`}
            >
              {option.label}
            </button>
          );
        })}
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
        onChange={(event) => setEditingStep({ ...editingStep, arrivalUnit: event.target.value as DurationUnit })}
        className="rounded-lg border border-emerald-900/50 bg-slate-800 px-3 py-2 text-sm text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {ARRIVAL_UNITS.map((unit) => (
          <option key={unit.value} value={unit.value}>{unit.label}</option>
        ))}
      </select>
    </div>
  </>
);

const ArrivalModelSelector: React.FC<StartSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
    <div className="mb-2 flex items-center justify-between gap-3">
      <div>
        <label className="block text-xs font-semibold uppercase text-emerald-300">Arrival Model</label>
        <p className="mt-1 text-[11px] text-slate-500">Use a simple flow, a time schedule, or exact event times.</p>
      </div>
      <div className="flex rounded-lg bg-slate-950 p-1 text-xs">
        {ARRIVAL_MODEL_OPTIONS.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setEditingStep({
              ...editingStep,
              arrivalModel: mode.id,
              demandModifiers: editingStep.demandModifiers || [],
              arrivalSchedule: editingStep.arrivalSchedule || [],
              arrivalEvents: editingStep.arrivalEvents || [],
            })}
            className={`rounded px-3 py-1.5 font-semibold transition-colors ${(editingStep.arrivalModel || 'simple') === mode.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);

const DemandPeaksSection: React.FC<StartSectionProps & { addStartDemandModifier: () => void }> = ({
  editingStep,
  setEditingStep,
  addStartDemandModifier,
}) => {
  const modifiers = normalizeDemandModifiers(editingStep.demandModifiers);

  return (
    <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase text-amber-200">Demand Peaks</label>
          <p className="mt-1 text-[11px] text-slate-500">These are Start Point local multipliers and stack with the global demand peaks.</p>
        </div>
        <button
          onClick={addStartDemandModifier}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20"
        >
          + Add Peak
        </button>
      </div>
      {modifiers.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-500">No local peaks yet.</div>
      ) : (
        <div className="space-y-2">
          {modifiers.map((modifier) => (
            <div key={modifier.id} className="rounded-lg border border-amber-500/20 bg-slate-950/60 p-2.5">
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={modifier.enabled}
                  onChange={(event) => setEditingStep(updateStepDemandModifier(editingStep, modifier.id, { enabled: event.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-amber-500"
                />
                <input
                  type="text"
                  value={modifier.name}
                  onChange={(event) => setEditingStep(updateStepDemandModifier(editingStep, modifier.id, { name: event.target.value }))}
                  className="min-w-0 flex-1 rounded border border-amber-500/30 bg-slate-900 px-2 py-1 text-xs text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  onClick={() => setEditingStep({
                    ...editingStep,
                    demandModifiers: normalizeDemandModifiers((editingStep.demandModifiers || []).filter((item) => item.id !== modifier.id)),
                  })}
                  className="rounded border border-rose-500/30 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-500/10"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">Multiplier</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.05"
                    value={modifier.multiplier}
                    onChange={(event) => setEditingStep(updateStepDemandModifier(editingStep, modifier.id, { multiplier: Number(event.target.value) }))}
                    className="w-full rounded border border-amber-500/30 bg-slate-900 px-2 py-1 text-xs text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">Start</label>
                  <input
                    type="number"
                    min="0"
                    max="23.5"
                    step="0.5"
                    value={modifier.startHour ?? 0}
                    onChange={(event) => setEditingStep(updateStepDemandModifier(editingStep, modifier.id, { startHour: Number(event.target.value) }))}
                    className="w-full rounded border border-amber-500/30 bg-slate-900 px-2 py-1 text-xs text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-amber-200">End</label>
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={modifier.endHour ?? 24}
                    onChange={(event) => setEditingStep(updateStepDemandModifier(editingStep, modifier.id, { endHour: Number(event.target.value) }))}
                    className="w-full rounded border border-amber-500/30 bg-slate-900 px-2 py-1 text-xs text-amber-100 outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ScheduledWindowsSection: React.FC<StartSectionProps & { addArrivalWindow: () => void }> = ({
  editingStep,
  setEditingStep,
  addArrivalWindow,
}) => {
  const windows = sanitizeScheduledArrivalWindows(editingStep.arrivalSchedule);

  return (
    <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase text-cyan-200">Scheduled Windows</label>
          <p className="mt-1 text-[11px] text-slate-500">Set quantity per time window. Spread mode distributes items across the window.</p>
        </div>
        <button
          onClick={addArrivalWindow}
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
        >
          + Add Window
        </button>
      </div>
      <div className="space-y-2">
        {windows.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-500">No schedule windows yet.</div>
        ) : (
          windows.map((window) => (
            <div key={window.id} className="rounded-lg border border-cyan-500/20 bg-slate-950/60 p-2.5">
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={window.enabled}
                  onChange={(event) => setEditingStep(updateScheduledArrivalWindow(editingStep, window.id, { enabled: event.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-cyan-500"
                />
                <input
                  type="text"
                  value={window.name}
                  onChange={(event) => setEditingStep(updateScheduledArrivalWindow(editingStep, window.id, { name: event.target.value }))}
                  className="min-w-0 flex-1 rounded border border-cyan-500/30 bg-slate-900 px-2 py-1 text-xs text-cyan-100 outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  onClick={() => setEditingStep({
                    ...editingStep,
                    arrivalSchedule: sanitizeScheduledArrivalWindows((editingStep.arrivalSchedule || []).filter((item) => item.id !== window.id)),
                  })}
                  className="rounded border border-rose-500/30 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-500/10"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-cyan-200">Start</label>
                  <input
                    type="number"
                    min="0"
                    max="23.5"
                    step="0.5"
                    value={window.startHour}
                    onChange={(event) => setEditingStep(updateScheduledArrivalWindow(editingStep, window.id, { startHour: Number(event.target.value) }))}
                    className="w-full rounded border border-cyan-500/30 bg-slate-900 px-2 py-1 text-xs text-cyan-100 outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-cyan-200">End</label>
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={window.endHour}
                    onChange={(event) => setEditingStep(updateScheduledArrivalWindow(editingStep, window.id, { endHour: Number(event.target.value) }))}
                    className="w-full rounded border border-cyan-500/30 bg-slate-900 px-2 py-1 text-xs text-cyan-100 outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-cyan-200">Qty</label>
                  <input
                    type="number"
                    min="1"
                    max={MAX_SCHEDULED_ARRIVAL_QUANTITY}
                    step="1"
                    value={window.quantity}
                    onChange={(event) => setEditingStep(updateScheduledArrivalWindow(editingStep, window.id, { quantity: Number(event.target.value) }))}
                    className="w-full rounded border border-cyan-500/30 bg-slate-900 px-2 py-1 text-xs text-cyan-100 outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-cyan-200">Mode</label>
                  <select
                    value={window.spreadMode}
                    onChange={(event) => setEditingStep(updateScheduledArrivalWindow(editingStep, window.id, { spreadMode: event.target.value as ScheduledArrivalSpreadMode }))}
                    className="w-full rounded border border-cyan-500/30 bg-slate-900 px-2 py-1 text-xs text-cyan-100 outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="spread">Spread</option>
                    <option value="burst">Burst</option>
                  </select>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-cyan-200">Start date</label>
                  <input
                    type="date"
                    value={window.startDate || ''}
                    onChange={(event) => setEditingStep(updateScheduledArrivalWindow(editingStep, window.id, { startDate: event.target.value || undefined }))}
                    className="w-full rounded border border-cyan-500/30 bg-slate-900 px-2 py-1 text-xs text-cyan-100 outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-cyan-200">End date</label>
                  <input
                    type="date"
                    value={window.endDate || ''}
                    onChange={(event) => setEditingStep(updateScheduledArrivalWindow(editingStep, window.id, { endDate: event.target.value || undefined }))}
                    className="w-full rounded border border-cyan-500/30 bg-slate-900 px-2 py-1 text-xs text-cyan-100 outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ExactArrivalEventsSection: React.FC<StartSectionProps & { addArrivalEvent: () => void }> = ({
  editingStep,
  setEditingStep,
  addArrivalEvent,
}) => {
  const arrivalEvents = sanitizeScheduledArrivalEvents(editingStep.arrivalEvents);

  return (
    <div className="mb-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase text-fuchsia-200">Exact Arrival Events</label>
          <p className="mt-1 text-[11px] text-slate-500">Set exact spawn times. Daily and weekly repeats are supported.</p>
        </div>
        <button
          onClick={addArrivalEvent}
          className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-500/20"
        >
          + Add Event
        </button>
      </div>
      <div className="space-y-2">
        {arrivalEvents.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-500">No exact events yet.</div>
        ) : (
          arrivalEvents.map((arrivalEvent) => (
            <div key={arrivalEvent.id} className="rounded-lg border border-fuchsia-500/20 bg-slate-950/60 p-2.5">
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={arrivalEvent.enabled}
                  onChange={(event) => setEditingStep(updateScheduledArrivalEvent(editingStep, arrivalEvent.id, { enabled: event.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-fuchsia-500"
                />
                <input
                  type="text"
                  value={arrivalEvent.name}
                  onChange={(event) => setEditingStep(updateScheduledArrivalEvent(editingStep, arrivalEvent.id, { name: event.target.value }))}
                  className="min-w-0 flex-1 rounded border border-fuchsia-500/30 bg-slate-900 px-2 py-1 text-xs text-fuchsia-100 outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
                <button
                  onClick={() => setEditingStep({
                    ...editingStep,
                    arrivalEvents: sanitizeScheduledArrivalEvents((editingStep.arrivalEvents || []).filter((item) => item.id !== arrivalEvent.id)),
                  })}
                  className="rounded border border-rose-500/30 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-500/10"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-fuchsia-200">Day Offset</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={arrivalEvent.dayOffset}
                    onChange={(event) => setEditingStep(updateScheduledArrivalEvent(editingStep, arrivalEvent.id, { dayOffset: Number(event.target.value) }))}
                    className="w-full rounded border border-fuchsia-500/30 bg-slate-900 px-2 py-1 text-xs text-fuchsia-100 outline-none focus:ring-1 focus:ring-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-fuchsia-200">Hour</label>
                  <input
                    type="number"
                    min="0"
                    max="23.5"
                    step="0.5"
                    value={arrivalEvent.hour}
                    onChange={(event) => setEditingStep(updateScheduledArrivalEvent(editingStep, arrivalEvent.id, { hour: Number(event.target.value) }))}
                    className="w-full rounded border border-fuchsia-500/30 bg-slate-900 px-2 py-1 text-xs text-fuchsia-100 outline-none focus:ring-1 focus:ring-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-fuchsia-200">Qty</label>
                  <input
                    type="number"
                    min="1"
                    max={MAX_SCHEDULED_ARRIVAL_QUANTITY}
                    step="1"
                    value={arrivalEvent.quantity}
                    onChange={(event) => setEditingStep(updateScheduledArrivalEvent(editingStep, arrivalEvent.id, { quantity: Number(event.target.value) }))}
                    className="w-full rounded border border-fuchsia-500/30 bg-slate-900 px-2 py-1 text-xs text-fuchsia-100 outline-none focus:ring-1 focus:ring-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-fuchsia-200">Repeat</label>
                  <select
                    value={arrivalEvent.repeat}
                    onChange={(event) => setEditingStep(updateScheduledArrivalEvent(editingStep, arrivalEvent.id, { repeat: event.target.value as ScheduledArrivalRepeat }))}
                    className="w-full rounded border border-fuchsia-500/30 bg-slate-900 px-2 py-1 text-xs text-fuchsia-100 outline-none focus:ring-1 focus:ring-fuchsia-500"
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const BatchSizeField: React.FC<StartSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="mb-4">
    <label className="block text-xs font-semibold text-emerald-400 uppercase mb-2">Batch Size</label>
    <div className="grid grid-cols-[160px_1fr] gap-3 items-center">
      <input
        type="number"
        min="1"
        max="1000"
        step="1"
        value={editingStep.arrivalBatchSize ?? 1}
        onChange={(event) => setEditingStep({ ...editingStep, arrivalBatchSize: getBatchSize(event.target.value) })}
        className="w-full bg-slate-800 border border-emerald-900/50 rounded-lg p-2 text-emerald-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
      />
      <div className="rounded-lg border border-emerald-900/40 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
        Creates this many items at the same simulated arrival time.
      </div>
    </div>
  </div>
);

const ArrivalRateFields: React.FC<StartSectionProps> = ({ editingStep, setEditingStep }) => {
  const isInterval = (editingStep.arrivalInputMode || 'rate') === 'interval';
  const arrivalUnitLabel = getArrivalUnitLabel(editingStep.arrivalUnit);
  const minValue = String(getArrivalMinValue(editingStep.arrivalInputMode));

  return (
    <>
      <label className="block text-xs font-semibold text-emerald-400 uppercase mb-2">
        {isInterval
          ? `Arrival Interval (${arrivalUnitLabel})`
          : `Arrival Rate (items / ${arrivalUnitLabel})`}
      </label>

      {editingStep.randomnessMode === 'range' ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-slate-400 uppercase mb-1 block">Min {isInterval ? 'Interval' : 'Rate'}</label>
            <input
              type="number"
              min={minValue}
              step="0.001"
              value={editingStep.minArrivalRate ?? (isInterval ? 1 : 0.2)}
              onChange={(event) => setEditingStep({ ...editingStep, minArrivalRate: Number(event.target.value) })}
              className="w-full bg-slate-800 border border-emerald-900/50 rounded-lg p-2 text-emerald-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase mb-1 block">Max {isInterval ? 'Interval' : 'Rate'}</label>
            <input
              type="number"
              min={minValue}
              step="0.001"
              value={editingStep.maxArrivalRate ?? (isInterval ? 3 : 0.8)}
              onChange={(event) => setEditingStep({ ...editingStep, maxArrivalRate: Number(event.target.value) })}
              className="w-full bg-slate-800 border border-emerald-900/50 rounded-lg p-2 text-emerald-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="col-span-2 text-xs text-slate-500 mt-1">
            {isInterval
              ? `A batch of ${editingStep.arrivalBatchSize ?? 1} item(s) will arrive after a random interval between ${editingStep.minArrivalRate ?? 0} and ${editingStep.maxArrivalRate ?? 0} ${arrivalUnitLabel}.`
              : `Total arrivals fluctuate between ${editingStep.minArrivalRate ?? 0} and ${editingStep.maxArrivalRate ?? 0} items per ${arrivalUnitLabel}, grouped into batches of ${editingStep.arrivalBatchSize ?? 1}.`}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <input
            type="number"
            min={minValue}
            step="0.001"
            value={editingStep.arrivalRate ?? (isInterval ? 1 : 0.5)}
            onChange={(event) => setEditingStep({ ...editingStep, arrivalRate: Number(event.target.value) })}
            className="flex-1 bg-slate-800 border border-emerald-900/50 rounded-lg p-3 text-emerald-100 font-mono text-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <span className="font-mono text-sm text-emerald-500 font-bold whitespace-nowrap">
            {isInterval ? `${arrivalUnitLabel} / batch` : `items / ${arrivalUnitLabel}`}
          </span>
        </div>
      )}
    </>
  );
};
