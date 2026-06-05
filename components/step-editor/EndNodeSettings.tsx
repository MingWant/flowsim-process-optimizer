import type React from 'react';
import type { DurationUnit, ProcessStep } from '../../types';
import { DURATION_UNITS } from '../../constants/timeUnits';

interface Props {
  editingStep: ProcessStep;
  setEditingStep: React.Dispatch<React.SetStateAction<ProcessStep | null>>;
}

export const EndNodeSettings: React.FC<Props> = ({ editingStep, setEditingStep }) => (
  <div className="p-4 bg-rose-900/20 border border-rose-900/50 rounded-lg">
    <label className="block text-xs font-semibold text-rose-400 uppercase mb-2">Average Time Display Unit</label>
    <div className="grid grid-cols-[180px_1fr] gap-3 items-center">
      <select
        value={editingStep.endTimeUnit || 'min'}
        onChange={(event) => setEditingStep({ ...editingStep, endTimeUnit: event.target.value as DurationUnit })}
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
);
