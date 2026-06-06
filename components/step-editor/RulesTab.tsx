import type React from 'react';
import type { ProcessStep } from '../../types';
import { DURATION_UNITS } from '../../constants/timeUnits';

interface Props {
  editingStep: ProcessStep;
  potentialSources: ProcessStep[];
  updateSourceRule: (sourceId: string, time: number) => void;
}

export const RulesTab: React.FC<Props> = ({
  editingStep,
  potentialSources,
  updateSourceRule,
}) => {
  const sourceRuleUnit = DURATION_UNITS.find((unit) => unit.value === (editingStep.processingTimeUnit || 'ms'))?.label || 'ms';

  return (
    <div className="space-y-4">
    <p className="text-sm text-slate-400 mb-1">Override processing time based on where the item came from. (Applies mainly to Fixed mode)</p>
    <p className="mb-4 text-xs text-slate-500">Values use this step&apos;s Fixed processing unit: <span className="font-mono text-slate-300">{sourceRuleUnit}</span>.</p>

    {potentialSources.length === 0 ? (
      <div className="text-center py-8 text-slate-500 italic">
        No steps connect to this one yet.
      </div>
    ) : (
      <div className="space-y-3">
        {potentialSources.map((source) => {
          const ruleTime = editingStep.sourceProcessingTimes?.[source.id];
          return (
            <div key={source.id} className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: source.color }} />
                <span className="text-sm text-slate-300">From: <b>{source.name}</b></span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder={`${editingStep.processingTime} (Default)`}
                  value={ruleTime || ''}
                  onChange={(event) => updateSourceRule(source.id, parseInt(event.target.value))}
                  className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-right focus:border-blue-500 outline-none"
                />
                <span className="w-20 truncate text-xs text-slate-500" title={sourceRuleUnit}>{sourceRuleUnit}</span>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
  );
};
