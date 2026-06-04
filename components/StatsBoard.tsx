
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { SimulationStats, StepStats, ProcessStep, DurationUnit, WorkItem } from '../types';
import { XCircle, Ban, CheckCircle2, Gauge, Timer, Activity, GitCompareArrows } from 'lucide-react';

interface Props {
  globalStats: SimulationStats;
  stepStats: StepStats[];
  steps: ProcessStep[];
  items?: WorkItem[];
  simulationTimeMs: number;
  cycleTimeUnit: DurationUnit;
}

interface FlowGroup {
  id: string;
  name: string;
  color: string;
  stepIds: Set<string>;
  steps: ProcessStep[];
}

const TIME_UNIT_TO_MS: Record<DurationUnit, number> = {
  ms: 1,
  s: 1000,
  min: 60 * 1000,
  h: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

const UNIT_LABELS: Record<DurationUnit, string> = {
  ms: 'ms',
  s: 'sec',
  min: 'min',
  h: 'hour',
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

const getPreferredThroughputUnit = (steps: ProcessStep[]): DurationUnit => {
  const startUnits = steps.filter(step => step.type === 'start').map(step => step.arrivalUnit || 's');
  return startUnits[0] || 'min';
};

const getFlowGroups = (steps: ProcessStep[]): FlowGroup[] => {
  const stepById = new Map(steps.map(step => [step.id, step]));
  const adjacency = new Map<string, Set<string>>();

  steps.forEach((step) => {
    if (!adjacency.has(step.id)) {
      adjacency.set(step.id, new Set());
    }

    step.connections.forEach((connection) => {
      if (!adjacency.has(connection.targetId)) {
        adjacency.set(connection.targetId, new Set());
      }

      adjacency.get(step.id)?.add(connection.targetId);
      adjacency.get(connection.targetId)?.add(step.id);
    });
  });

  if (steps.length === 0) {
    return [{
      id: 'flow-all',
      name: 'All Steps',
      color: '#64748b',
      stepIds: new Set(steps.map(step => step.id)),
      steps,
    }];
  }

  const visited = new Set<string>();
  const flowGroups: FlowGroup[] = [];

  steps.forEach((seedStep, index) => {
    if (visited.has(seedStep.id)) {
      return;
    }

    const stepIds = new Set<string>();
    const stack = [seedStep.id];

    while (stack.length > 0) {
      const stepId = stack.pop();
      if (!stepId || visited.has(stepId)) {
        continue;
      }

      const step = stepById.get(stepId);
      if (!step) {
        continue;
      }

      visited.add(stepId);
      stepIds.add(stepId);
      adjacency.get(stepId)?.forEach((neighborId) => stack.push(neighborId));
    }

    const flowSteps = steps.filter(step => stepIds.has(step.id));
    const startSteps = flowSteps.filter(step => step.type === 'start');
    const primaryStart = startSteps[0] || flowSteps[0];
    const derivedName = startSteps.length > 1
      ? `${primaryStart?.name || `Flow ${String.fromCharCode(65 + index)}`} +${startSteps.length - 1}`
      : primaryStart?.name || `Flow ${String.fromCharCode(65 + index)}`;

    flowGroups.push({
      id: primaryStart?.id || seedStep.id,
      name: derivedName,
      color: primaryStart?.color || seedStep.color || '#3b82f6',
      stepIds,
      steps: flowSteps,
    });
  });

  return flowGroups;
};

export const StatsBoard: React.FC<Props> = ({ globalStats, stepStats, steps, items = [], simulationTimeMs, cycleTimeUnit }) => {
  const flowGroups = getFlowGroups(steps);
  const stepStatsById = new Map(stepStats.map(stats => [stats.stepId, stats]));

  const chartData = stepStats.map(s => {
    const step = steps.find(st => st.id === s.stepId);
    const flow = flowGroups.find(group => group.stepIds.has(s.stepId));
    return {
      name: step ? `${flow ? `${flow.name}: ` : ''}${step.name}` : s.stepId.slice(0, 8),
      queue: s.queueLength,
      active: s.activeProcessing
    };
  });

  const throughputUnit = getPreferredThroughputUnit(steps);
  const throughputUnitMs = TIME_UNIT_TO_MS[throughputUnit];
  const cycleTimeUnitMs = TIME_UNIT_TO_MS[cycleTimeUnit];
  const throughputValue = simulationTimeMs > 0
    ? (globalStats.totalItemsFinished / simulationTimeMs) * throughputUnitMs
    : 0;
  const cycleTimeValue = globalStats.avgCycleTime / cycleTimeUnitMs;

  const flowMetrics = flowGroups.map((flow, index) => {
    const statsForFlow = flow.steps.map(step => stepStatsById.get(step.id)).filter((stats): stats is StepStats => Boolean(stats));
    const endStats = flow.steps
      .filter(step => step.type === 'end')
      .map(step => stepStatsById.get(step.id))
      .filter((stats): stats is StepStats => Boolean(stats));
    const startStats = flow.steps
      .filter(step => step.type === 'start')
      .map(step => stepStatsById.get(step.id))
      .filter((stats): stats is StepStats => Boolean(stats));
    const finished = endStats.reduce((sum, stats) => sum + stats.totalProcessed, 0);
    const created = startStats.reduce((sum, stats) => sum + stats.totalProcessed, 0);
    const failed = statsForFlow.reduce((sum, stats) => sum + stats.totalFailed, 0);
    const cancelled = statsForFlow.reduce((sum, stats) => sum + stats.totalCancelled, 0);
    const queue = statsForFlow.reduce((sum, stats) => sum + stats.queueLength, 0);
    const processing = statsForFlow.reduce((sum, stats) => sum + stats.activeProcessing, 0);
    const maxUtilization = statsForFlow.reduce((max, stats) => Math.max(max, stats.utilization), 0);
    const activeItems = items.filter(item => (
      !['finished', 'error', 'cancelled'].includes(item.status)
      && item.currentStepId !== 'finished'
      && flow.stepIds.has(item.currentStepId)
    )).length;
    const averageCycleTime = finished > 0
      ? endStats.reduce((sum, stats) => sum + stats.avgCompletionTime * stats.totalProcessed, 0) / finished
      : 0;
    const unit = getPreferredThroughputUnit(flow.steps);
    const flowThroughput = simulationTimeMs > 0 ? (finished / simulationTimeMs) * TIME_UNIT_TO_MS[unit] : 0;

    return {
      ...flow,
      label: `Flow ${String.fromCharCode(65 + index)}`,
      created,
      finished,
      failed,
      cancelled,
      queue,
      processing,
      activeItems,
      maxUtilization,
      averageCycleTime,
      throughputUnit: unit,
      throughput: flowThroughput,
      cycleTimeValue: averageCycleTime / TIME_UNIT_TO_MS[cycleTimeUnit],
    };
  });

  const maxFinished = Math.max(1, ...flowMetrics.map(flow => flow.finished));
  const maxThroughput = Math.max(0.000001, ...flowMetrics.map(flow => flow.throughput));

  const cards = [
    {
      label: 'Items Finished',
      value: globalStats.totalItemsFinished,
      color: 'text-white',
      icon: <CheckCircle2 size={22} className="text-emerald-400" />,
      suffix: ''
    },
    {
      label: 'Throughput',
      value: throughputValue.toFixed(1),
      color: 'text-emerald-400',
      icon: <Gauge size={22} className="text-emerald-400" />,
      suffix: `/ ${UNIT_LABELS[throughputUnit]}`
    },
    {
      label: 'Avg Cycle Time',
      value: cycleTimeValue.toFixed(cycleTimeUnit === 'ms' ? 0 : 2),
      color: 'text-blue-400',
      icon: <Timer size={22} className="text-blue-400" />,
      suffix: UNIT_LABELS[cycleTimeUnit]
    },
    {
      label: 'Active Work',
      value: globalStats.activeItems,
      color: 'text-amber-400',
      icon: <Activity size={22} className="text-amber-400" />,
      suffix: ''
    },
  ];

  return (
    <div className="space-y-4 w-full">
      {/* Global Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {cards.map(card => (
          <div key={card.label} className="col-span-1 md:col-span-1 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col justify-center gap-3 shadow-sm relative overflow-hidden">
             <div className="flex items-center justify-between gap-2">
               <div className="text-sm text-slate-400">{card.label}</div>
               {card.icon}
             </div>
             <div className={`text-2xl font-mono font-bold ${card.color}`}>
                {card.value} {card.suffix && <span className="text-xs text-slate-500">{card.suffix}</span>}
             </div>
          </div>
        ))}
        
        {/* Exceptions Cards */}
        <div className="col-span-1 md:col-span-1 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col justify-center gap-2 shadow-sm relative overflow-hidden group">
           <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><XCircle size={48} className="text-red-500"/></div>
           <div className="text-sm text-red-300">Errors</div>
           <div className="text-2xl font-mono font-bold text-red-500">{globalStats.totalItemsFailed}</div>
        </div>
        <div className="col-span-1 md:col-span-1 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col justify-center gap-2 shadow-sm relative overflow-hidden group">
           <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Ban size={48} className="text-slate-400"/></div>
           <div className="text-sm text-slate-400">Cancelled</div>
           <div className="text-2xl font-mono font-bold text-slate-500">{globalStats.totalItemsCancelled}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <GitCompareArrows size={16} className="text-cyan-300" /> Flow Comparison
            </h4>
            <p className="mt-1 text-xs text-slate-500">Flows are grouped by connected process graphs, so multiple start points can feed the same tracked flow.</p>
          </div>
          <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            {flowMetrics.length} live flow{flowMetrics.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {flowMetrics.map(flow => (
            <div key={flow.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: flow.color }} />
                    {flow.label}
                  </div>
                  <div className="truncate text-base font-bold text-slate-100" title={flow.name}>{flow.name}</div>
                  <div className="text-xs text-slate-500">{flow.steps.length} nodes · {flow.created} created</div>
                </div>
                <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${flow.maxUtilization > 0.9 || flow.queue > 10 ? 'bg-red-500/10 text-red-300 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>
                  {flow.maxUtilization > 0.9 || flow.queue > 10 ? 'Bottleneck risk' : 'Stable'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Finished</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-emerald-300">{flow.finished}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, (flow.finished / maxFinished) * 100)}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Throughput</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-cyan-300">
                    {flow.throughput.toFixed(1)} <span className="text-[10px] text-slate-500">/ {UNIT_LABELS[flow.throughputUnit]}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, (flow.throughput / maxThroughput) * 100)}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg Cycle</div>
                  <div className="mt-1 font-mono text-xl font-bold text-blue-300">
                    {flow.cycleTimeValue.toFixed(cycleTimeUnit === 'ms' ? 0 : 2)} <span className="text-[10px] text-slate-500">{UNIT_LABELS[cycleTimeUnit]}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Live Load</div>
                  <div className="mt-1 flex items-end gap-2 font-mono text-sm">
                    <span className="text-amber-300">Q {flow.queue}</span>
                    <span className="text-blue-300">P {flow.processing}</span>
                    <span className="text-slate-400">A {flow.activeItems}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-300">Errors {flow.failed}</span>
                <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-slate-400">Cancelled {flow.cancelled}</span>
                <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-purple-300">Max util {(flow.maxUtilization * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Queue Visualization */}
      <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 h-80 flex flex-col shadow-sm">
        <h4 className="text-sm font-semibold text-slate-300 mb-2 shrink-0">Real-time Step Load by Flow</h4>
        <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    interval={0} 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                />
                <YAxis 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#e2e8f0', fontSize: '12px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    cursor={{ stroke: '#64748b', strokeWidth: 1 }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Area 
                    type="monotone" 
                    dataKey="queue" 
                    stackId="1" 
                    stroke="#f59e0b" 
                    fill="#f59e0b" 
                    name="Queue" 
                    isAnimationActive={false}
                />
                <Area 
                    type="monotone" 
                    dataKey="active" 
                    stackId="1" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    name="Processing" 
                    isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
