
import React, { forwardRef } from 'react';
import { ProcessStep, StepStats, WorkItem } from '../types';
import { Users, Clock, AlertCircle, Edit2, Trash2, GripHorizontal, ListFilter, Play, Square, AlertTriangle, CheckCircle2, Ban, XCircle } from 'lucide-react';
import { WorkItemVisual } from './WorkItemVisual';

interface Props {
  step: ProcessStep;
  stats: StepStats;
  items: WorkItem[];
  onEdit: () => void;
  onRemove: () => void;
  style?: React.CSSProperties;
  onMouseDown?: (e: React.MouseEvent) => void;
  scale?: number;
}

export const ProcessNode = forwardRef<HTMLDivElement, Props>(({ step, stats, items, onEdit, onRemove, style, onMouseDown, scale = 1 }, ref) => {
  const queuedItems = items.filter(i => i.status === 'queued');
  const processingItems = items.filter(i => i.status === 'processing');
  
  const isBottleneck = (stats?.queueLength || 0) > 10 && (stats?.utilization || 0) > 0.9;
  const baseColor = step.color || '#64748b';

  // --- START NODE RENDERING ---
  if (step.type === 'start') {
    const rateDisplay = step.randomnessMode === 'range' 
        ? `${(step.minArrivalRate ?? 0.2).toFixed(1)}-${(step.maxArrivalRate ?? 0.8).toFixed(1)}` 
        : (step.arrivalRate ?? 0.5).toFixed(1);

    return (
        <div 
          ref={ref}
          data-process-node="true"
          style={{ ...style }}
          className="absolute flex flex-col items-center group z-10"
          onMouseDown={onMouseDown}
        >
            <div 
              className="w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg border-2 bg-slate-950 transition-all hover:scale-105 cursor-grab active:cursor-grabbing ring-4 ring-slate-950"
                style={{ borderColor: baseColor, boxShadow: `0 0 15px ${baseColor}40` }}
            >
                <Play fill={baseColor} className="text-slate-900" size={24} style={{ color: baseColor }} />
                <span className="text-[10px] text-slate-300 font-mono mt-1">{rateDisplay}/s</span>
            </div>
            
            <div className="mt-2 bg-slate-950/90 px-2 py-1 rounded-lg text-xs font-bold text-slate-200 border border-slate-700 whitespace-nowrap flex items-center gap-2 shadow-xl">
                {step.name}
                <button onClick={onEdit} className="hover:text-blue-400 p-0.5"><Edit2 size={10}/></button>
                <button onClick={onRemove} className="hover:text-red-400 p-0.5"><Trash2 size={10}/></button>
            </div>
        </div>
    );
  }

  // --- END NODE RENDERING (Custom Endpoint Bucket) ---
  if (step.type === 'end') {
    return (
        <div 
          ref={ref}
          data-process-node="true"
          style={{ 
             ...style,
             borderColor: baseColor,
             boxShadow: `0 4px 20px ${baseColor}30`
          }}
          className="absolute flex flex-col w-[200px] bg-slate-950 border-2 rounded-2xl overflow-hidden z-10 select-none transition-all hover:-translate-y-0.5 hover:shadow-2xl"
          onMouseDown={onMouseDown}
        >
            <div className="bg-slate-900/80 p-2 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-2 text-slate-200 font-bold truncate">
                    <Square fill={baseColor} className="text-slate-900" size={14} style={{ color: baseColor }} />
                    <span className="truncate text-sm" title={step.name}>{step.name}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                    <button onClick={onEdit} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition-colors"><Edit2 size={12}/></button>
                    <button onClick={onRemove} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-900/30 rounded transition-colors"><Trash2 size={12}/></button>
                </div>
            </div>

            <div className="p-4 flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900">
                <span className="text-3xl font-mono font-bold text-white mb-1">
                    {stats?.totalProcessed || 0}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Total Items
                </span>
            </div>
            
            {/* Visual stacking of finished items */}
            <div className="h-2 w-full bg-slate-900 relative overflow-hidden">
                 <div 
                   className="h-full transition-all duration-500" 
                   style={{ width: '100%', backgroundColor: baseColor, opacity: 0.3 }}
                 />
            </div>
        </div>
    );
  }
  
  // --- PROCESS NODE RENDERING ---
  const timeDisplay = step.randomnessMode === 'range'
    ? `${step.minProcessingTime ?? 1000}-${step.maxProcessingTime ?? 3000}ms`
    : `${step.processingTime ?? 2000}ms`;

  return (
    <div 
      ref={ref}
      data-process-node="true"
      style={{
        ...style,
        borderColor: isBottleneck ? '#ef4444' : baseColor,
        boxShadow: isBottleneck ? `0 0 20px rgba(239, 68, 68, 0.4)` : `0 4px 15px ${baseColor}30`,
        backgroundColor: '#0f172a',
      }}
      className={`absolute flex flex-col w-[280px] border-2 rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-2xl z-10 select-none`}
    >
      {/* Header */}
      <div 
        className="flex justify-between items-start p-4 pb-2 cursor-grab active:cursor-grabbing group bg-slate-900/80 border-b border-slate-800/80"
        onMouseDown={onMouseDown}
      >
        <div className="flex-1 mr-2 overflow-hidden">
          <div className="flex items-center gap-2">
             <GripHorizontal size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
             <h3 className="font-bold text-slate-100 text-lg truncate" title={step.name}>{step.name}</h3>
             {(step.failureProbability > 0 || step.cancellationProbability > 0) && (
                <div title="Exceptions configured" className="flex items-center">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                </div>
             )}
          </div>
          <div className="flex items-center text-xs text-slate-400 gap-2 mt-1 pl-6">
            <span className="flex items-center gap-1"><Users size={12}/> {step.capacity}</span>
            <span className="flex items-center gap-1"><Clock size={12}/> {timeDisplay}</span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0" onMouseDown={e => e.stopPropagation()}>
            <button onClick={onEdit} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition-colors"><Edit2 size={14}/></button>
            <button onClick={onRemove} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-900/30 rounded transition-colors"><Trash2 size={14}/></button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 flex-grow min-h-[140px] p-4 pt-2">
        
        {/* Active Processing */}
        <div 
          className="rounded-xl p-2 border border-slate-700/50"
            style={{ backgroundColor: `${baseColor}10` }}
        >
          <div className="text-xs mb-1 flex justify-between font-medium" style={{ color: baseColor }}>
            <span>Processing</span>
            <span>{processingItems.length} / {step.capacity}</span>
          </div>
          <div className="flex flex-col gap-1 min-h-[2.5rem]">
            {processingItems.length > 0 ? processingItems.map(item => (
               <div key={item.id} className="w-full relative h-3 bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-75 ease-linear"
                    style={{ width: `${item.progress * 100}%`, backgroundColor: baseColor }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white/70 font-mono">
                      Item {item.id.split('-')[1]}
                  </span>
               </div>
            )) : (
                <span className="text-xs text-slate-500 opacity-60 text-center py-2">Resources Idle</span>
            )}
          </div>
        </div>

        {/* Queue List */}
        <div className="bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col flex-grow overflow-hidden">
          <div className="text-xs text-slate-400 p-2 flex justify-between border-b border-slate-800">
            <span className="flex items-center gap-1"><ListFilter size={10}/> Queue</span>
            <span className="font-mono">{queuedItems.length}</span>
          </div>
          
          <div className="overflow-y-auto custom-scrollbar p-1 max-h-[100px] space-y-1">
             {queuedItems.length === 0 && (
                <div className="text-center py-4 text-xs text-slate-600 italic">Queue Empty</div>
             )}
             {queuedItems.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between text-[10px] bg-slate-900 px-2 py-1 rounded-lg text-slate-300 border border-slate-800">
                    <span className="font-mono text-slate-500">#{item.id.split('-')[1]}</span>
                    <span className="text-slate-400">Wait: {(item.totalWaitTime/1000).toFixed(1)}s</span>
                    <div className={`w-2 h-2 rounded-full ${item.status === 'queued' ? 'bg-amber-500' : 'bg-slate-500'}`}></div>
                </div>
             ))}
          </div>
        </div>
      </div>

      {/* Metrics Footer */}
      <div className="px-3 pb-3 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs bg-slate-900/50">
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Utilization</div>
          <div className={`font-mono font-bold ${(stats?.utilization || 0) > 0.9 ? 'text-red-400' : 'text-emerald-400'}`}>
            {((stats?.utilization || 0) * 100).toFixed(0)}%
            {isBottleneck && <span className="text-red-500 ml-1 inline-block animate-pulse">!</span>}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1 text-right">Results</div>
          <div className="flex justify-end gap-2 font-mono">
             <span className="text-emerald-500 flex items-center gap-0.5" title="Success">
                <CheckCircle2 size={10}/> {stats?.totalProcessed || 0}
             </span>
             {(stats?.totalFailed > 0) && (
                <span className="text-red-500 flex items-center gap-0.5" title="Failed">
                    <XCircle size={10}/> {stats.totalFailed}
                </span>
             )}
             {(stats?.totalCancelled > 0) && (
                <span className="text-slate-400 flex items-center gap-0.5" title="Cancelled">
                    <Ban size={10}/> {stats.totalCancelled}
                </span>
             )}
          </div>
        </div>
      </div>
    </div>
  );
});

ProcessNode.displayName = 'ProcessNode';
