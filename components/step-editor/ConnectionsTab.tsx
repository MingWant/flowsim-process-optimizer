import type React from 'react';
import type { ProcessStep, SimulationConfig } from '../../types';

interface Props {
  config: SimulationConfig;
  editingStep: ProcessStep;
  toggleConnection: (targetId: string, checked: boolean) => void;
  updateProbability: (targetId: string, newVal: number) => void;
}

export const ConnectionsTab: React.FC<Props> = ({
  config,
  editingStep,
  toggleConnection,
  updateProbability,
}) => (
  <div className="space-y-4">
    <p className="text-sm text-slate-400 mb-2">Select which steps items can move to next, and set the probability.</p>
    <div className="space-y-3">
      {config.steps.filter((step) => step.id !== editingStep.id).map((otherStep) => {
        if (otherStep.type === 'start') return null;

        const connection = editingStep.connections?.find((candidate) => candidate.targetId === otherStep.id);
        const isConnected = Boolean(connection);

        return (
          <div key={otherStep.id} className={`flex items-center justify-between p-3 rounded border transition-colors ${isConnected ? 'bg-slate-800 border-blue-500/50' : 'bg-slate-800/30 border-slate-700'}`}>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isConnected}
                onChange={(event) => toggleConnection(otherStep.id, event.target.checked)}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-300 font-medium">
                {otherStep.type === 'end' && <span className="text-red-400 mr-1">[END]</span>}
                {otherStep.name}
              </span>
            </div>

            {connection && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Prob:</span>
                <input
                  type="number" min="0" max="1" step="0.1"
                  value={connection.probability}
                  onChange={(event) => updateProbability(otherStep.id, parseFloat(event.target.value))}
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
        Total Probability: {(editingStep.connections.reduce((sum, connection) => sum + connection.probability, 0) * 100).toFixed(0)}%
        {Math.abs(editingStep.connections.reduce((sum, connection) => sum + connection.probability, 0) - 1) > 0.01 &&
          <span className="block mt-1 text-amber-400 font-bold">Warning: Probabilities do not sum to 100%</span>
        }
      </div>
    )}
  </div>
);
