
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { SimulationStats, StepStats, ProcessStep } from '../types';
import { XCircle, Ban } from 'lucide-react';

interface Props {
  globalStats: SimulationStats;
  stepStats: StepStats[];
  steps: ProcessStep[];
}

export const StatsBoard: React.FC<Props> = ({ globalStats, stepStats, steps }) => {
  const chartData = stepStats.map(s => {
    const step = steps.find(st => st.id === s.stepId);
    return {
      name: step ? step.name : s.stepId.slice(0, 8),
      queue: s.queueLength,
      active: s.activeProcessing
    };
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 w-full">
      {/* Global Metrics Cards */}
      <div className="col-span-1 md:col-span-1 bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center gap-2 shadow-sm">
         <div className="text-sm text-slate-400">Items Finished</div>
         <div className="text-2xl font-mono font-bold text-white">{globalStats.totalItemsFinished}</div>
      </div>
      <div className="col-span-1 md:col-span-1 bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center gap-2 shadow-sm">
         <div className="text-sm text-slate-400">Throughput</div>
         <div className="text-2xl font-mono font-bold text-emerald-400">
            {(globalStats.totalItemsFinished / (Math.max(1, globalStats.avgCycleTime) / 1000 / 60)).toFixed(1)} <span className="text-xs text-slate-500">/ min</span>
         </div>
      </div>
      <div className="col-span-1 md:col-span-1 bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center gap-2 shadow-sm">
         <div className="text-sm text-slate-400">Avg Cycle Time</div>
         <div className="text-2xl font-mono font-bold text-blue-400">
            {(globalStats.avgCycleTime / 1000).toFixed(2)} <span className="text-xs text-slate-500">s</span>
         </div>
      </div>
      <div className="col-span-1 md:col-span-1 bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center gap-2 shadow-sm">
         <div className="text-sm text-slate-400">Active Work</div>
         <div className="text-2xl font-mono font-bold text-amber-400">{globalStats.activeItems}</div>
      </div>
      
      {/* Exceptions Cards */}
      <div className="col-span-1 md:col-span-1 bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center gap-2 shadow-sm relative overflow-hidden group">
         <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><XCircle size={48} className="text-red-500"/></div>
         <div className="text-sm text-red-300">Errors</div>
         <div className="text-2xl font-mono font-bold text-red-500">{globalStats.totalItemsFailed}</div>
      </div>
      <div className="col-span-1 md:col-span-1 bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center gap-2 shadow-sm relative overflow-hidden group">
         <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Ban size={48} className="text-slate-400"/></div>
         <div className="text-sm text-slate-400">Cancelled</div>
         <div className="text-2xl font-mono font-bold text-slate-500">{globalStats.totalItemsCancelled}</div>
      </div>

      {/* Queue Visualization */}
      <div className="col-span-2 md:col-span-6 bg-slate-800 p-4 rounded-xl border border-slate-700 h-96 flex flex-col shadow-sm">
        <h4 className="text-sm font-semibold text-slate-300 mb-2 shrink-0">Real-time Step Load (Queue vs Processing)</h4>
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
