import React from 'react';
import type { ProcessStep } from '../../types';
import { AlertTriangle, Clock } from 'lucide-react';

interface Props {
  editingStep: ProcessStep;
  setEditingStep: React.Dispatch<React.SetStateAction<ProcessStep | null>>;
}

export const ExceptionsTab: React.FC<Props> = ({ editingStep, setEditingStep }) => (
  <div className="space-y-6">
    <p className="text-sm text-slate-400">Configure random adverse events like failures or queue cancellations.</p>

    <div className="p-4 bg-red-900/10 border border-red-900/30 rounded-lg">
      <label className="flex items-center gap-2 text-xs font-semibold text-red-400 uppercase mb-2">
        <AlertTriangle size={14} /> Failure / Defect Probability (0.0 - 1.0)
      </label>
      <div className="flex items-center gap-4">
        <input
          type="number" min="0" max="1" step="0.00001"
          value={editingStep.failureProbability ?? 0}
          onChange={(event) => {
            const value = parseFloat(event.target.value);
            setEditingStep({ ...editingStep, failureProbability: Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value)) });
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
        <Clock size={14} /> Cancellation Probability (0.0 - 1.0)
      </label>
      <div className="flex items-center gap-4">
        <input
          type="number" min="0" max="1" step="0.00001"
          value={editingStep.cancellationProbability ?? 0}
          onChange={(event) => {
            const value = parseFloat(event.target.value);
            setEditingStep({ ...editingStep, cancellationProbability: Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value)) });
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
);
