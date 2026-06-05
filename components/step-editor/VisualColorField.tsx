import type React from 'react';
import type { ProcessStep } from '../../types';

interface Props {
  editingStep: ProcessStep;
  setEditingStep: React.Dispatch<React.SetStateAction<ProcessStep | null>>;
}

export const VisualColorField: React.FC<Props> = ({ editingStep, setEditingStep }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Visual Color</label>
    <div className="flex gap-3 items-center">
      <input
        type="color"
        value={editingStep.color || '#3b82f6'}
        onChange={(event) => setEditingStep({ ...editingStep, color: event.target.value })}
        className="w-10 h-10 rounded border-none bg-transparent cursor-pointer"
      />
      <span className="font-mono text-sm text-slate-400 uppercase">{editingStep.color}</span>
    </div>
  </div>
);
