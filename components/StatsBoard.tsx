
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { SimulationStats, StepStats, ProcessStep, DurationUnit } from '../types';
import { XCircle, Ban, CheckCircle2, Gauge, Timer, Activity } from 'lucide-react';

interface Props {
  globalStats: SimulationStats;
  stepStats: StepStats[];
  steps: ProcessStep[];
  simulationTimeMs: number;
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

const getPreferredCycleTimeUnit = (steps: ProcessStep[]): DurationUnit => {
  const processUnits = steps
    .filter(step => step.type === 'process')
    .map(step => step.randomnessMode === 'range' ? step.rangeTimeUnit || step.processingTimeUnit || 'ms' : step.processingTimeUnit || 'ms');

  if (processUnits.length === 0) {
    return 's';
  }

  const counts = processUnits.reduce<Record<string, number>>((acc, unit) => {
    acc[unit] = (acc[unit] || 0) + 1;
    return acc;
  }, {});

  return processUnits.reduce<DurationUnit>((selected, unit) => (
    (counts[unit] || 0) > (counts[selected] || 0) ? unit : selected
  ), processUnits[0]);
};

export const StatsBoard: React.FC<Props> = ({ globalStats, stepStats, steps, simulationTimeMs }) => {
  const chartData = stepStats.map(s => {
    const step = steps.find(st => st.id === s.stepId);
    return {
      name: step ? step.name : s.stepId.slice(0, 8),
      queue: s.queueLength,
      active: s.activeProcessing
    };
  });

  const throughputUnit = getPreferredThroughputUnit(steps);
  const cycleTimeUnit = getPreferredCycleTimeUnit(steps);
  const throughputUnitMs = TIME_UNIT_TO_MS[throughputUnit];
  const cycleTimeUnitMs = TIME_UNIT_TO_MS[cycleTimeUnit];
  const throughputValue = simulationTimeMs > 0
    ? (globalStats.totalItemsFinished / simulationTimeMs) * throughputUnitMs
    : 0;
  const cycleTimeValue = globalStats.avgCycleTime / cycleTimeUnitMs;

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
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 w-full">
      {/* Global Metrics Cards */}
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

      {/* Queue Visualization */}
      <div className="col-span-2 md:col-span-6 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 h-80 flex flex-col shadow-sm">
        <h4 className="text-sm font-semibold text-slate-300 mb-2 shrink-0">Real-time Step Load</h4>
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
