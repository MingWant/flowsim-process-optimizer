import type React from 'react';
import type { DurationUnit, ProcessStep, ResourceExecutionMode, TeamAllocationMode } from '../../types';
import { DURATION_UNITS } from '../../constants/timeUnits';
import {
  buildDefaultCollaborativeEfficiency,
  buildDefaultMultitaskEfficiency,
  getEditableTeams,
  getTeamAllocationMode,
  getTeamResourceTotal,
  updateEfficiencyValue,
} from '../../utils/configSerialization';
import { Clock, Dna, Users } from 'lucide-react';

type StepEditorSetter = React.Dispatch<React.SetStateAction<ProcessStep | null>>;

interface ProcessNodeSettingsProps {
  editingStep: ProcessStep;
  setEditingStep: StepEditorSetter;
}

interface ProcessSectionProps {
  editingStep: ProcessStep;
  setEditingStep: StepEditorSetter;
}

const EXECUTION_MODE_OPTIONS: Array<{ id: ResourceExecutionMode; title: string; hint: string }> = [
  { id: 'single', title: '1 resource / item', hint: 'Classic queue behavior.' },
  { id: 'collaborative', title: 'Team per item', hint: 'Fixed-size teams finish one item faster.' },
  { id: 'multitask', title: '1 resource / many items', hint: 'One person or AI handles multiple items.' },
];

const TEAM_ALLOCATION_OPTIONS: Array<{ id: TeamAllocationMode; title: string; hint: string }> = [
  { id: 'auto', title: 'Auto teams', hint: 'Use Capacity and default team size.' },
  { id: 'explicit', title: 'Explicit teams', hint: 'Name each team and set its people.' },
];

export const ProcessNodeSettings: React.FC<ProcessNodeSettingsProps> = ({ editingStep, setEditingStep }) => (
  <div className="space-y-4">
    <SimulationTypeSelector editingStep={editingStep} setEditingStep={setEditingStep} />

    {editingStep.simulationMode !== 'delay' && (
      <ResourceSettings editingStep={editingStep} setEditingStep={setEditingStep} />
    )}

    <ProcessingDurationPanel editingStep={editingStep} setEditingStep={setEditingStep} />
  </div>
);

const SimulationTypeSelector: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Simulation Type</label>
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => setEditingStep({ ...editingStep, simulationMode: 'resource' })}
        className={`rounded-lg border px-3 py-3 text-left transition-all ${editingStep.simulationMode !== 'delay' ? 'border-blue-500 bg-blue-500/10 text-blue-200' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
      >
        <div className="flex items-center gap-2 text-sm font-bold"><Users size={14} /> Resource Mode</div>
        <p className="mt-1 text-[11px] opacity-75">Uses capacity and can create queues.</p>
      </button>
      <button
        onClick={() => setEditingStep({ ...editingStep, simulationMode: 'delay' })}
        className={`rounded-lg border px-3 py-3 text-left transition-all ${editingStep.simulationMode === 'delay' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
      >
        <div className="flex items-center gap-2 text-sm font-bold"><Clock size={14} /> Time Delay</div>
        <p className="mt-1 text-[11px] opacity-75">No resource limit; items start timing immediately.</p>
      </button>
    </div>
  </div>
);

const ResourceSettings: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="space-y-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
    <CapacityField editingStep={editingStep} setEditingStep={setEditingStep} />
    <ExecutionModeSelector editingStep={editingStep} setEditingStep={setEditingStep} />

    {(editingStep.resourceExecutionMode || 'single') === 'collaborative' && (
      <CollaborativeSettings editingStep={editingStep} setEditingStep={setEditingStep} />
    )}

    {(editingStep.resourceExecutionMode || 'single') === 'multitask' && (
      <MultitaskSettings editingStep={editingStep} setEditingStep={setEditingStep} />
    )}
  </div>
);

const CapacityField: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div>
    <label className="block text-xs font-semibold text-blue-300 uppercase mb-1">Capacity (Resources)</label>
    <input
      type="number"
      min="1"
      max="50"
      value={editingStep.capacity}
      onChange={(event) => setEditingStep({ ...editingStep, capacity: parseInt(event.target.value) || 1 })}
      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
    />
    <p className="mt-1 text-xs text-slate-500">Resource units available at this step. Execution mode controls how those units are consumed.</p>
    {(editingStep.resourceExecutionMode || 'single') === 'collaborative' && (
      <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${getTeamResourceTotal(editingStep) === editingStep.capacity ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/40 bg-rose-500/10 text-rose-200'}`}>
        {getTeamAllocationMode(editingStep) === 'explicit'
          ? <>Capacity check: team resources <span className="font-mono font-bold">{getTeamResourceTotal(editingStep)}</span> / capacity <span className="font-mono font-bold">{editingStep.capacity}</span>. These must match before saving.</>
          : <>Auto teams: capacity <span className="font-mono font-bold">{editingStep.capacity}</span> will be split into teams of up to <span className="font-mono font-bold">{editingStep.targetResourcesPerItem ?? 1}</span>.</>}
      </div>
    )}
  </div>
);

const ExecutionModeSelector: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div>
    <label className="block text-xs font-semibold text-blue-300 uppercase mb-2">Execution Mode</label>
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      {EXECUTION_MODE_OPTIONS.map((mode) => (
        <button
          key={mode.id}
          onClick={() => setEditingStep({
            ...editingStep,
            resourceExecutionMode: mode.id,
            minResourcesPerItem: editingStep.minResourcesPerItem ?? 1,
            targetResourcesPerItem: editingStep.targetResourcesPerItem ?? 2,
            maxResourcesPerItem: editingStep.maxResourcesPerItem ?? 2,
            teamAllocationMode: editingStep.teamAllocationMode ?? 'auto',
            collaborativeTeams: editingStep.collaborativeTeams && editingStep.collaborativeTeams.length > 0
              ? editingStep.collaborativeTeams
              : [{ id: `team-${Date.now()}`, name: 'Team 1', resources: editingStep.targetResourcesPerItem ?? 2 }],
            collaborativeEfficiency: editingStep.collaborativeEfficiency || buildDefaultCollaborativeEfficiency(editingStep.maxResourcesPerItem ?? 2),
            maxConcurrentItemsPerResource: editingStep.maxConcurrentItemsPerResource ?? 2,
            multitaskEfficiency: editingStep.multitaskEfficiency || buildDefaultMultitaskEfficiency(editingStep.maxConcurrentItemsPerResource ?? 2),
          })}
          className={`rounded-lg border px-3 py-3 text-left transition-all ${(editingStep.resourceExecutionMode || 'single') === mode.id ? 'border-blue-500 bg-blue-500/15 text-blue-100' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
        >
          <div className="text-sm font-bold">{mode.title}</div>
          <p className="mt-1 text-[11px] opacity-75">{mode.hint}</p>
        </button>
      ))}
    </div>
  </div>
);

const CollaborativeSettings: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3">
    <TeamAllocationSelector editingStep={editingStep} setEditingStep={setEditingStep} />

    {getTeamAllocationMode(editingStep) === 'auto' && (
      <AutoTeamSettings editingStep={editingStep} setEditingStep={setEditingStep} />
    )}

    {getTeamAllocationMode(editingStep) === 'explicit' && (
      <ExplicitTeamsEditor editingStep={editingStep} setEditingStep={setEditingStep} />
    )}

    <CollaborativeEfficiencyEditor editingStep={editingStep} setEditingStep={setEditingStep} />
  </div>
);

const TeamAllocationSelector: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <>
    <label className="block text-[10px] text-indigo-200 uppercase mb-2">Team allocation</label>
    <div className="grid grid-cols-2 gap-2">
      {TEAM_ALLOCATION_OPTIONS.map((mode) => (
        <button
          key={mode.id}
          onClick={() => setEditingStep({
            ...editingStep,
            teamAllocationMode: mode.id,
            collaborativeTeams: mode.id === 'explicit' ? getEditableTeams(editingStep) : editingStep.collaborativeTeams,
          })}
          className={`rounded-lg border px-3 py-2 text-left transition-all ${getTeamAllocationMode(editingStep) === mode.id ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
        >
          <div className="text-sm font-bold">{mode.title}</div>
          <p className="mt-1 text-[11px] opacity-75">{mode.hint}</p>
        </button>
      ))}
    </div>
  </>
);

const AutoTeamSettings: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="mt-4 rounded-lg border border-indigo-500/20 bg-slate-950/50 p-3">
    <label className="block text-[10px] text-indigo-200 uppercase mb-1">Default team size</label>
    <input
      type="number"
      min="1"
      max="50"
      value={editingStep.targetResourcesPerItem ?? 2}
      onChange={(event) => {
        const targetResources = Math.max(1, Math.min(editingStep.capacity, parseInt(event.target.value) || 1));
        setEditingStep({
          ...editingStep,
          minResourcesPerItem: targetResources,
          targetResourcesPerItem: targetResources,
          maxResourcesPerItem: targetResources,
          collaborativeEfficiency: editingStep.collaborativeEfficiency || buildDefaultCollaborativeEfficiency(targetResources),
        });
      }}
      className="w-full bg-slate-900 border border-indigo-500/30 rounded p-2 text-indigo-100 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
    />
    <p className="mt-2 text-xs text-slate-500">Example: Capacity 6 and default team size 2 allows up to 3 teams. The final team can use remaining resources if capacity is not evenly divisible.</p>
  </div>
);

const ExplicitTeamsEditor: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => {
  const teams = getEditableTeams(editingStep);

  return (
    <div className="mt-4 rounded-lg border border-indigo-500/20 bg-slate-950/50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <label className="block text-[10px] text-indigo-200 uppercase">Explicit Teams</label>
          <p className="text-xs text-slate-500">Each team can process one item at a time with its own resource count.</p>
        </div>
        <button
          onClick={() => setEditingStep({
            ...editingStep,
            collaborativeTeams: [
              ...teams,
              { id: `team-${Date.now()}`, name: `Team ${teams.length + 1}`, resources: editingStep.targetResourcesPerItem ?? 2 },
            ],
          })}
          className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20"
        >
          Add Team
        </button>
      </div>
      <div className="space-y-2">
        {teams.map((team, teamIndex) => (
          <div key={team.id} className="grid grid-cols-[1fr_90px_auto] items-center gap-2">
            <input
              type="text"
              value={team.name}
              onChange={(event) => {
                const updatedTeams = getEditableTeams(editingStep).map((existingTeam) => (
                  existingTeam.id === team.id ? { ...existingTeam, name: event.target.value } : existingTeam
                ));
                setEditingStep({ ...editingStep, collaborativeTeams: updatedTeams });
              }}
              className="w-full bg-slate-900 border border-indigo-500/30 rounded p-2 text-indigo-100 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              min="1"
              max="50"
              value={team.resources}
              onChange={(event) => {
                const resources = Math.max(1, parseInt(event.target.value) || 1);
                const updatedTeams = getEditableTeams(editingStep).map((existingTeam) => (
                  existingTeam.id === team.id ? { ...existingTeam, resources } : existingTeam
                ));
                const maxResources = Math.max(editingStep.maxResourcesPerItem ?? 1, resources);
                setEditingStep({
                  ...editingStep,
                  collaborativeTeams: updatedTeams,
                  maxResourcesPerItem: maxResources,
                  collaborativeEfficiency: editingStep.collaborativeEfficiency || buildDefaultCollaborativeEfficiency(maxResources),
                });
              }}
              className="w-full bg-slate-900 border border-indigo-500/30 rounded p-2 text-indigo-100 font-mono outline-none focus:ring-2 focus:ring-indigo-500"
              title="Resources in this team"
            />
            <button
              onClick={() => {
                const updatedTeams = getEditableTeams(editingStep).filter((existingTeam) => existingTeam.id !== team.id);
                setEditingStep({
                  ...editingStep,
                  collaborativeTeams: updatedTeams.length > 0 ? updatedTeams : [{ id: `team-${Date.now()}`, name: 'Team 1', resources: 1 }],
                });
              }}
              disabled={teamIndex === 0 && teams.length === 1}
              className="rounded border border-rose-500/30 px-2 py-2 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Total team resources: <span className="font-mono text-indigo-200">{getTeamResourceTotal(editingStep)}</span>. Required capacity: <span className="font-mono text-indigo-200">{editingStep.capacity}</span>.
      </div>
      {getTeamResourceTotal(editingStep) !== editingStep.capacity && (
        <button
          onClick={() => setEditingStep({ ...editingStep, capacity: getTeamResourceTotal(editingStep) })}
          className="mt-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20"
        >
          Set Capacity to {getTeamResourceTotal(editingStep)}
        </button>
      )}
    </div>
  );
};

const CollaborativeEfficiencyEditor: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="mt-3 space-y-2">
    <label className="block text-[10px] text-indigo-200 uppercase">Speed multiplier by assigned resources</label>
    {Array.from({ length: Math.max(1, editingStep.maxResourcesPerItem ?? 2) }, (_, index) => index + 1).map((resourceCount) => {
      const value = editingStep.collaborativeEfficiency?.[resourceCount] ?? (resourceCount === 1 ? 1 : 1 + (resourceCount - 1) * 0.65);

      return (
        <div key={resourceCount} className="grid grid-cols-[90px_1fr_70px] items-center gap-2 text-xs">
          <span className="text-slate-400">{resourceCount} resource{resourceCount > 1 ? 's' : ''}</span>
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.05"
            value={value}
            onChange={(event) => setEditingStep({ ...editingStep, collaborativeEfficiency: updateEfficiencyValue(editingStep.collaborativeEfficiency, resourceCount, Number(event.target.value)) })}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.05"
            value={value}
            onChange={(event) => setEditingStep({ ...editingStep, collaborativeEfficiency: updateEfficiencyValue(editingStep.collaborativeEfficiency, resourceCount, Number(event.target.value)) })}
            className="w-full bg-slate-900 border border-indigo-500/30 rounded p-1.5 text-indigo-100 font-mono outline-none"
          />
        </div>
      );
    })}
  </div>
);

const MultitaskSettings: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
    <label className="block text-[10px] text-cyan-200 uppercase mb-1">Max concurrent items / resource</label>
    <input
      type="number"
      min="1"
      max="50"
      value={editingStep.maxConcurrentItemsPerResource ?? 2}
      onChange={(event) => {
        const maxConcurrent = Math.max(1, parseInt(event.target.value) || 1);
        setEditingStep({
          ...editingStep,
          maxConcurrentItemsPerResource: maxConcurrent,
          multitaskEfficiency: editingStep.multitaskEfficiency || buildDefaultMultitaskEfficiency(maxConcurrent),
        });
      }}
      className="w-full bg-slate-900 border border-cyan-500/30 rounded p-2 text-cyan-100 font-mono focus:ring-2 focus:ring-cyan-500 outline-none"
    />
    <MultitaskEfficiencyEditor editingStep={editingStep} setEditingStep={setEditingStep} />
  </div>
);

const MultitaskEfficiencyEditor: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="mt-3 space-y-2">
    <label className="block text-[10px] text-cyan-200 uppercase">Speed multiplier by concurrent load</label>
    {Array.from({ length: Math.max(1, editingStep.maxConcurrentItemsPerResource ?? 2) }, (_, index) => index + 1).map((load) => {
      const value = editingStep.multitaskEfficiency?.[load] ?? Math.max(0.25, 1 - (load - 1) * 0.2);

      return (
        <div key={load} className="grid grid-cols-[90px_1fr_70px] items-center gap-2 text-xs">
          <span className="text-slate-400">{load} item{load > 1 ? 's' : ''}</span>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.05"
            value={value}
            onChange={(event) => setEditingStep({ ...editingStep, multitaskEfficiency: updateEfficiencyValue(editingStep.multitaskEfficiency, load, Number(event.target.value)) })}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <input
            type="number"
            min="0.1"
            max="2"
            step="0.05"
            value={value}
            onChange={(event) => setEditingStep({ ...editingStep, multitaskEfficiency: updateEfficiencyValue(editingStep.multitaskEfficiency, load, Number(event.target.value)) })}
            className="w-full bg-slate-900 border border-cyan-500/30 rounded p-1.5 text-cyan-100 font-mono outline-none"
          />
        </div>
      );
    })}
  </div>
);

const ProcessingDurationPanel: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
    <label className="block text-xs font-semibold text-blue-400 uppercase mb-3">{editingStep.simulationMode === 'delay' ? 'Delay Duration (ms)' : 'Processing Duration (ms)'}</label>

    {editingStep.randomnessMode === 'range' ? (
      <RangeDurationFields editingStep={editingStep} setEditingStep={setEditingStep} />
    ) : (
      <FixedDurationFields editingStep={editingStep} setEditingStep={setEditingStep} />
    )}
  </div>
);

const RangeDurationFields: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="text-[10px] text-slate-400 uppercase mb-1 block">Min Duration</label>
      <input
        type="number"
        step="100"
        min="100"
        value={editingStep.minProcessingTime ?? 1000}
        onChange={(event) => setEditingStep({ ...editingStep, minProcessingTime: Number(event.target.value) })}
        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 font-mono focus:ring-2 focus:ring-purple-500 outline-none"
      />
    </div>
    <div>
      <label className="text-[10px] text-slate-400 uppercase mb-1 block">Max Duration</label>
      <input
        type="number"
        step="100"
        min="100"
        value={editingStep.maxProcessingTime ?? 3000}
        onChange={(event) => setEditingStep({ ...editingStep, maxProcessingTime: Number(event.target.value) })}
        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 font-mono focus:ring-2 focus:ring-purple-500 outline-none"
      />
    </div>
    <div className="col-span-2">
      <label className="text-[10px] text-slate-400 uppercase mb-1 block">Unit</label>
      <select
        value={editingStep.rangeTimeUnit || editingStep.processingTimeUnit || 'ms'}
        onChange={(event) => setEditingStep({ ...editingStep, rangeTimeUnit: event.target.value as DurationUnit })}
        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 focus:ring-2 focus:ring-purple-500 outline-none"
      >
        {DURATION_UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
      </select>
    </div>
    <div className="col-span-2 text-xs text-slate-500 flex items-center gap-2">
      <Dna size={12} />
      Each task will take a unique random time between Min and Max in the selected unit.
    </div>
  </div>
);

const FixedDurationFields: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="block text-[10px] text-slate-400 uppercase mb-1">Base Time</label>
      <input
        type="number"
        step="100"
        min="100"
        value={editingStep.processingTime ?? 1000}
        onChange={(event) => setEditingStep({ ...editingStep, processingTime: Number(event.target.value) })}
        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
      />
    </div>
    <div>
      <label className="block text-[10px] text-slate-400 uppercase mb-1">Unit</label>
      <select
        value={editingStep.processingTimeUnit || 'ms'}
        onChange={(event) => setEditingStep({ ...editingStep, processingTimeUnit: event.target.value as DurationUnit })}
        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
      >
        {DURATION_UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
      </select>
    </div>
    {editingStep.simulationMode !== 'delay' && (
      <VarianceField editingStep={editingStep} setEditingStep={setEditingStep} />
    )}
  </div>
);

const VarianceField: React.FC<ProcessSectionProps> = ({ editingStep, setEditingStep }) => (
  <div className="col-span-2 min-w-0">
    <label className="block text-[10px] text-slate-400 uppercase mb-1">Variance (0 = exact)</label>
    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3">
      <input
        type="number"
        min="0"
        max="1"
        step="0.01"
        value={editingStep.variance ?? 0}
        onChange={(event) => {
          const value = parseFloat(event.target.value);
          setEditingStep({ ...editingStep, variance: isNaN(value) ? 0 : Math.min(1, Math.max(0, value)) });
        }}
        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
      />
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={editingStep.variance ?? 0}
        onChange={(event) => setEditingStep({ ...editingStep, variance: parseFloat(event.target.value) })}
        className="min-w-0 w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
    <div className="text-xs text-slate-500 mt-1">0 keeps this step deterministic; values above 0 add random noise.</div>
  </div>
);
