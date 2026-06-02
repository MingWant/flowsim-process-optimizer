
import React, { forwardRef, memo } from 'react';
import { ProcessStep, StepStats, WorkItem } from '../types';
import { Users, Clock, Edit2, Trash2, GripHorizontal, ListFilter, Play, Square, AlertTriangle, CheckCircle2, Ban, XCircle, Timer } from 'lucide-react';

interface Props {
  step: ProcessStep;
  stats: StepStats;
  items: WorkItem[];
  onEdit: () => void;
  onRemove: () => void;
  style?: React.CSSProperties;
  onMouseDown?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}

const ARRIVAL_UNIT_LABELS: Record<string, string> = {
  ms: 'sim ms',
  s: 'sim sec',
  min: 'sim min',
  h: 'sim hour',
  day: 'sim day',
  week: 'sim week',
  month: 'sim month',
  year: 'sim year',
};

const ProcessNodeComponent = forwardRef<HTMLDivElement, Props>(({ step, stats, items, onEdit, onRemove, style, onMouseDown, isDragging = false }, ref) => {
  const queuedItems = items.filter(i => i.status === 'queued');
  const processingItems = items.filter(i => i.status === 'processing');
  
  const isBottleneck = (stats?.queueLength || 0) > 10 && (stats?.utilization || 0) > 0.9;
  const baseColor = step.color || '#64748b';
  const isDelayMode = step.simulationMode === 'delay';

  // --- START NODE RENDERING ---
  if (step.type === 'start') {
    const arrivalUnitLabel = ARRIVAL_UNIT_LABELS[step.arrivalUnit || 's'] || 'sim sec';
    const arrivalModeLabel = step.arrivalInputMode === 'interval'
      ? step.randomnessMode === 'range'
        ? `Every ${(step.minArrivalRate ?? 0.2).toFixed(2)}-${(step.maxArrivalRate ?? 0.8).toFixed(2)} ${arrivalUnitLabel}`
        : `Every ${(step.arrivalRate ?? 0.5).toFixed(2)} ${arrivalUnitLabel}`
      : step.randomnessMode === 'range'
        ? `${(step.minArrivalRate ?? 0.2).toFixed(2)}-${(step.maxArrivalRate ?? 0.8).toFixed(2)} items / ${arrivalUnitLabel}`
        : `${(step.arrivalRate ?? 0.5).toFixed(2)} items / ${arrivalUnitLabel}`;

    return (
        <div 
          ref={ref}
          data-process-node="true"
        style={{ 
        ...style,
        borderColor: baseColor,
        boxShadow: `0 6px 24px ${baseColor}25`
        }}
        className={`absolute flex w-[220px] flex-col overflow-hidden rounded-2xl border-2 bg-slate-950 z-10 select-none ${isDragging ? '' : 'transition-all hover:-translate-y-0.5 hover:shadow-2xl'}`}
          onMouseDown={onMouseDown}
        >
        <div className="flex cursor-grab items-center justify-between border-b border-slate-800 bg-slate-900/80 p-3 active:cursor-grabbing" onMouseDown={onMouseDown}>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${baseColor}20`, color: baseColor }}>
              <Play fill={baseColor} size={16} style={{ color: baseColor }} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-100" title={step.name}>{step.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-300/80">Start Point</div>
            </div>
          </div>
          <div className="flex gap-1 shrink-0" onMouseDown={e => e.stopPropagation()}>
            <button onClick={onEdit} className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"><Edit2 size={12}/></button>
            <button onClick={onRemove} className="rounded p-1 text-red-400 transition-colors hover:bg-red-900/30 hover:text-red-300"><Trash2 size={12}/></button>
          </div>
            </div>
        <div className="grid grid-cols-2 gap-3 bg-gradient-to-b from-slate-950 to-slate-900 p-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70">Arrival</div>
            <div className="mt-1 font-mono text-sm font-bold leading-snug text-emerald-200">{arrivalModeLabel}</div>
            <div className="text-[10px] text-slate-500">Based on selected simulated time unit</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Mode</div>
            <div className="mt-1 text-sm font-semibold text-slate-200">{step.arrivalInputMode === 'interval' ? 'Interval Input' : 'Rate Input'}</div>
            <div className="text-[10px] text-slate-500">Feeds the first connected step</div>
          </div>
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
            className={`absolute flex w-[220px] flex-col overflow-hidden rounded-2xl border-2 bg-slate-950 z-10 select-none ${isDragging ? '' : 'transition-all hover:-translate-y-0.5 hover:shadow-2xl'}`}
          onMouseDown={onMouseDown}
        >
            <div className="flex cursor-grab items-center justify-between border-b border-slate-800 bg-slate-900/80 p-3 active:cursor-grabbing" onMouseDown={onMouseDown}>
              <div className="flex min-w-0 items-center gap-2 text-slate-200 font-bold truncate">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${baseColor}20`, color: baseColor }}>
                  <Square fill={baseColor} size={16} style={{ color: baseColor }} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-100" title={step.name}>{step.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-rose-300/80">End Point</div>
                </div>
                </div>
              <div className="flex gap-1 shrink-0" onMouseDown={e => e.stopPropagation()}>
                <button onClick={onEdit} className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"><Edit2 size={12}/></button>
                <button onClick={onRemove} className="rounded p-1 text-red-400 transition-colors hover:bg-red-900/30 hover:text-red-300"><Trash2 size={12}/></button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-gradient-to-b from-slate-950 to-slate-900 p-4">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/70">Completed</div>
                <div className="mt-1 font-mono text-2xl font-bold text-rose-100">{stats?.totalProcessed || 0}</div>
                <div className="text-[10px] text-slate-500">items delivered</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Role</div>
                <div className="mt-1 text-sm font-semibold text-slate-200">Final Sink</div>
                <div className="text-[10px] text-slate-500">Collects completed flow output</div>
              </div>
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
    ? `${step.minProcessingTime ?? 1000}-${step.maxProcessingTime ?? 3000}${step.rangeTimeUnit || step.processingTimeUnit || 'ms'}`
    : `${step.processingTime ?? 2000}${step.processingTimeUnit || 'ms'}`;

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
      className={`absolute flex flex-col w-[280px] border-2 rounded-2xl overflow-hidden z-10 select-none ${isDragging ? '' : 'transition-all hover:-translate-y-0.5 hover:shadow-2xl'}`}
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
            <span className={`flex items-center gap-1 ${isDelayMode ? 'text-cyan-300' : ''}`}>
              {isDelayMode ? <Timer size={12}/> : <Users size={12}/>} {isDelayMode ? 'Delay' : step.capacity}
            </span>
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
            <span>{isDelayMode ? 'Timed Delay' : 'Processing'}</span>
            <span>{processingItems.length}{isDelayMode ? ' active' : ` / ${step.capacity}`}</span>
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
              <span className="text-xs text-slate-500 opacity-60 text-center py-2">{isDelayMode ? 'No active timers' : 'Resources Idle'}</span>
            )}
          </div>
        </div>

        {/* Queue List */}
        {!isDelayMode && <div className="bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col flex-grow overflow-hidden">
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
        </div>}

        {isDelayMode && (
          <div className="bg-cyan-500/10 rounded-xl border border-cyan-500/20 flex flex-col flex-grow p-3 text-xs text-cyan-100/80">
            <div className="font-semibold text-cyan-300 mb-1">Time-only mode</div>
            <p className="leading-relaxed text-slate-400">Items start their timer immediately. No capacity, resource queue, or utilization is used.</p>
          </div>
        )}
      </div>

      {/* Metrics Footer */}
      <div className="px-3 pb-3 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs bg-slate-900/50">
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">{isDelayMode ? 'Mode' : 'Utilization'}</div>
          <div className={`font-mono font-bold ${isDelayMode ? 'text-cyan-300' : (stats?.utilization || 0) > 0.9 ? 'text-red-400' : 'text-emerald-400'}`}>
            {isDelayMode ? 'Delay' : `${((stats?.utilization || 0) * 100).toFixed(0)}%`}
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

ProcessNodeComponent.displayName = 'ProcessNode';

export const ProcessNode = memo(ProcessNodeComponent, (prevProps, nextProps) => {
  return prevProps.step === nextProps.step
    && prevProps.stats === nextProps.stats
    && prevProps.items === nextProps.items
    && prevProps.onEdit === nextProps.onEdit
    && prevProps.onRemove === nextProps.onRemove
    && prevProps.onMouseDown === nextProps.onMouseDown
    && prevProps.isDragging === nextProps.isDragging
    && prevProps.style?.left === nextProps.style?.left
    && prevProps.style?.top === nextProps.style?.top;
});

ProcessNode.displayName = 'ProcessNode';
