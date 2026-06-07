import type React from 'react';
import type { ProcessStep, SimulationConfig, StepConnection } from '../../types';

interface Props {
  config: SimulationConfig;
  editingStep: ProcessStep;
  setEditingStep: React.Dispatch<React.SetStateAction<ProcessStep | null>>;
  toggleConnection: (targetId: string, checked: boolean) => void;
  updateProbability?: (targetId: string, newVal: number) => void;
  updateConnection?: (targetId: string, updates: Partial<StepConnection>) => void;
}

export const ConnectionsTab: React.FC<Props> = ({
  config,
  editingStep,
  setEditingStep,
  toggleConnection,
  updateProbability,
  updateConnection,
}) => {
  const routingStrategy = editingStep.routingStrategy || 'probability';
  const isLoadAware = routingStrategy === 'load-aware';
  const isTimeAware = routingStrategy === 'time-aware';
  const isDynamicRouting = isLoadAware || isTimeAware;
  const profileOptions = Array.from(
    config.steps
      .filter((step) => step.type === 'start')
      .flatMap((step) => step.itemProfiles || [])
      .reduce((map, profile) => {
        if (!map.has(profile.id)) {
          map.set(profile.id, profile.name || profile.id);
        }
        return map;
      }, new Map<string, string>())
  ).map(([id, name]) => ({ id, name }));

  const setStepUpdates = (updates: Partial<ProcessStep>) => {
    setEditingStep((current) => current && current.id === editingStep.id ? { ...current, ...updates } : current);
  };

  const applyConnectionUpdate = (targetId: string, updates: Partial<StepConnection>) => {
    const normalizedUpdates: Partial<StepConnection> = { ...updates };
    if ('itemProfileIds' in updates) {
      normalizedUpdates.itemProfileIds = updates.itemProfileIds && updates.itemProfileIds.length > 0 ? updates.itemProfileIds : undefined;
    }
    if ('minPriority' in updates) {
      normalizedUpdates.minPriority = typeof updates.minPriority === 'number' && Number.isFinite(updates.minPriority) ? Math.max(0, updates.minPriority) : undefined;
    }
    if ('maxPriority' in updates) {
      normalizedUpdates.maxPriority = typeof updates.maxPriority === 'number' && Number.isFinite(updates.maxPriority) ? Math.max(0, updates.maxPriority) : undefined;
    }

    if (updateConnection) {
      updateConnection(targetId, normalizedUpdates);
      return;
    }

    setEditingStep((current) => {
      if (!current || current.id !== editingStep.id) {
        return current;
      }

      return {
        ...current,
        connections: current.connections.map((connection) => (
          connection.targetId === targetId ? { ...connection, ...normalizedUpdates } : connection
        )),
      };
    });
  };

  const setProbability = (targetId: string, value: number) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    if (updateProbability) {
      updateProbability(targetId, safeValue);
      return;
    }
    applyConnectionUpdate(targetId, { probability: safeValue });
  };

  const toggleProfile = (connection: StepConnection, profileId: string, checked: boolean) => {
    const currentIds = connection.itemProfileIds || [];
    const nextIds = checked
      ? Array.from(new Set([...currentIds, profileId]))
      : currentIds.filter((id) => id !== profileId);
    applyConnectionUpdate(connection.targetId, { itemProfileIds: nextIds.length > 0 ? nextIds : undefined });
  };

  const totalWeight = editingStep.connections.reduce((sum, connection) => sum + (connection.probability || 0), 0);

  return (
  <div className="space-y-4">
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200">Routing Strategy</label>
          <p className="mt-1 text-xs text-slate-500">Choose plain probability, current load balancing, or ETA-based routing that estimates queue, capacity, and calendar delay.</p>
        </div>
        <div className="flex flex-wrap rounded-lg bg-slate-950 p-1 text-xs">
          <button
            onClick={() => setStepUpdates({ routingStrategy: 'probability' })}
            className={`rounded px-3 py-1.5 font-semibold ${routingStrategy === 'probability' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Probability
          </button>
          <button
            onClick={() => setStepUpdates({ routingStrategy: 'load-aware', routingLoadSensitivity: editingStep.routingLoadSensitivity ?? 1 })}
            className={`rounded px-3 py-1.5 font-semibold ${isLoadAware ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Load-aware
          </button>
          <button
            onClick={() => setStepUpdates({ routingStrategy: 'time-aware', routingTimeSensitivity: editingStep.routingTimeSensitivity ?? 2, routingCalendarAware: editingStep.routingCalendarAware ?? true })}
            className={`rounded px-3 py-1.5 font-semibold ${isTimeAware ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Time-aware / ETA
          </button>
        </div>
      </div>

      {isLoadAware && (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px] md:items-center">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Load sensitivity</label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={editingStep.routingLoadSensitivity ?? 1}
              onChange={(event) => setStepUpdates({ routingLoadSensitivity: Math.max(0, Math.min(10, Number(event.target.value))) })}
              className="mt-2 w-full accent-cyan-500"
            />
            <p className="mt-1 text-xs text-slate-500">0 ignores load; higher values avoid queued or fully occupied targets more strongly.</p>
          </div>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={editingStep.routingLoadSensitivity ?? 1}
            onChange={(event) => setStepUpdates({ routingLoadSensitivity: Math.max(0, Math.min(10, Number(event.target.value) || 0)) })}
            className="rounded-lg border border-cyan-500/30 bg-slate-950 px-3 py-2 text-right text-sm font-mono text-cyan-100 outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      )}

      {isTimeAware && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_120px] md:items-center">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-purple-200">ETA sensitivity</label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={editingStep.routingTimeSensitivity ?? 2}
                onChange={(event) => setStepUpdates({ routingTimeSensitivity: Math.max(0, Math.min(10, Number(event.target.value))) })}
                className="mt-2 w-full accent-purple-500"
              />
              <p className="mt-1 text-xs text-slate-500">0 keeps only base weights; higher values favor routes with shorter estimated completion time.</p>
            </div>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={editingStep.routingTimeSensitivity ?? 2}
              onChange={(event) => setStepUpdates({ routingTimeSensitivity: Math.max(0, Math.min(10, Number(event.target.value) || 0)) })}
              className="rounded-lg border border-purple-500/30 bg-slate-950 px-3 py-2 text-right text-sm font-mono text-purple-100 outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={editingStep.routingCalendarAware !== false}
              onChange={(event) => setStepUpdates({ routingCalendarAware: event.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
            />
            <span>
              <span className="block font-semibold text-purple-200">Calendar-aware ETA</span>
              Include target business hours and off-hours delay when estimating route completion time.
            </span>
          </label>
        </div>
      )}
    </div>

    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-slate-400">
      <div className="font-semibold text-cyan-200">Routing rule order</div>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>First, FlowSim tries routes whose profile / priority filters match the item.</li>
        <li>If nothing matches, it falls back to unfiltered routes, then all valid routes.</li>
        <li>In dynamic modes, the number below is still the base weight; current load or ETA adjusts the effective share during simulation.</li>
      </ul>
    </div>

    <p className="text-sm text-slate-400 mb-2">Select which steps items can move to next, set the base weight, and optionally restrict routes by item profile or priority.</p>
    <div className="space-y-3">
      {config.steps.filter((step) => step.id !== editingStep.id).map((otherStep) => {
        if (otherStep.type === 'start') return null;

        const connection = editingStep.connections?.find((candidate) => candidate.targetId === otherStep.id);
        const isConnected = Boolean(connection);

        return (
          <div key={otherStep.id} className={`rounded border p-3 transition-colors ${isConnected ? 'bg-slate-800 border-blue-500/50' : 'bg-slate-800/30 border-slate-700'}`}>
            <div className="flex items-center justify-between gap-3">
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
                  <span className="text-xs text-slate-500">{isDynamicRouting ? 'Base:' : 'Prob:'}</span>
                  <input
                    type="number" min="0" max="1" step="0.05"
                    value={connection.probability}
                    onChange={(event) => setProbability(otherStep.id, parseFloat(event.target.value))}
                    className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:border-blue-500 outline-none"
                  />
                </div>
              )}
            </div>

            {connection && (
              <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Item filters</span>
                  <button
                    onClick={() => applyConnectionUpdate(otherStep.id, { itemProfileIds: undefined, minPriority: undefined, maxPriority: undefined })}
                    className="text-[10px] font-semibold text-slate-500 hover:text-slate-200"
                  >
                    Clear filters
                  </button>
                </div>

                {profileOptions.length > 0 ? (
                  <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {profileOptions.map((profile) => {
                      const checked = (connection.itemProfileIds || []).includes(profile.id);
                      return (
                        <label key={profile.id} className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => toggleProfile(connection, profile.id, event.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-cyan-500"
                          />
                          <span className="truncate">{profile.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mb-3 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-500">No start-node profiles yet. Add profiles in a Start node to use profile-based routing.</div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Min Priority
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={connection.minPriority ?? ''}
                      onChange={(event) => applyConnectionUpdate(otherStep.id, { minPriority: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value)) })}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-blue-500"
                      placeholder="Any"
                    />
                  </label>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Max Priority
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={connection.maxPriority ?? ''}
                      onChange={(event) => applyConnectionUpdate(otherStep.id, { maxPriority: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value)) })}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-blue-500"
                      placeholder="Any"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">If no route matches an item, FlowSim falls back to unfiltered routes, then all valid routes.</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
    {editingStep.connections.length > 0 && (
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300">
        Total {isDynamicRouting ? 'Base Weight' : 'Probability'}: {(totalWeight * 100).toFixed(0)}%
        {Math.abs(totalWeight - 1) > 0.01 &&
          <span className="block mt-1 text-amber-400 font-bold">Warning: weights do not sum to 100%; simulation will normalize them.</span>
        }
      </div>
    )}
  </div>
  );
};
