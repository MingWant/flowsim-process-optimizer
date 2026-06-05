import type React from 'react';
import type { ProcessStep } from '../../types';
import { Shuffle } from 'lucide-react';

interface Props {
  editingStep: ProcessStep;
  setEditingStep: React.Dispatch<React.SetStateAction<ProcessStep | null>>;
}

export const RandomnessModeToggle: React.FC<Props> = ({ editingStep, setEditingStep }) => (
  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
    <div className="flex items-center gap-2">
      <Shuffle size={16} className={editingStep.randomnessMode === 'range' ? 'text-purple-400' : 'text-slate-400'} />
      <span className="text-sm font-semibold text-slate-200">Random Range Mode</span>
    </div>
    <div className="flex items-center gap-2 bg-slate-900 rounded p-1">
      <button
        onClick={() => setEditingStep({ ...editingStep, randomnessMode: 'fixed' })}
        className={`text-xs px-3 py-1.5 rounded transition-all ${editingStep.randomnessMode === 'fixed' || !editingStep.randomnessMode ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
      >
        Fixed
      </button>
      <button
        onClick={() => setEditingStep({ ...editingStep, randomnessMode: 'range' })}
        className={`text-xs px-3 py-1.5 rounded transition-all ${editingStep.randomnessMode === 'range' ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
      >
        Random Range
      </button>
    </div>
  </div>
);
