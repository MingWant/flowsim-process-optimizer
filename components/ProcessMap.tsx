
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ProcessStep, StepStats, WorkItem } from '../types';
import { ProcessNode } from './ProcessNode';
import { Move, ZoomIn, ZoomOut, Maximize, PlayCircle, Box, StopCircle, MousePointer2 } from 'lucide-react';

interface Props {
  steps: ProcessStep[];
  stepStats: StepStats[];
  items: WorkItem[];
  isRunning: boolean;
  onEditStep: (step: ProcessStep) => void;
  onRemoveStep: (id: string) => void;
  onAddStep: (type: 'process' | 'start' | 'end') => void;
}

interface Position {
  x: number;
  y: number;
}

const NODE_WIDTH = 280;
const NODE_HEIGHT = 300; 

// Helper to calculate point on Cubic Bezier Curve
const getPointOnBezier = (t: number, p0: Position, p1: Position, p2: Position, p3: Position): Position => {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
    const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;
    return { x, y };
};

export const ProcessMap: React.FC<Props> = ({ 
  steps, 
  stepStats, 
  items, 
  isRunning,
  onEditStep, 
  onRemoveStep,
  onAddStep 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    setPositions(prev => {
      const newPos = { ...prev };
      let hasChanges = false;
      
      const setIfMissing = (id: string, x: number, y: number) => {
        if (!newPos[id]) {
          newPos[id] = { x, y };
          hasChanges = true;
        }
      };

      if (steps.length > 0) {
        steps.forEach((step, index) => {
           if (!newPos[step.id]) {
               // Prefer saved position if available
               if (step.x !== undefined && step.y !== undefined) {
                   setIfMissing(step.id, step.x, step.y);
               } else {
                   const col = index % 3;
                   const row = Math.floor(index / 3);
                   const x = 100 + (col * 350);
                   const y = 100 + (row * 400);
                   setIfMissing(step.id, x, y);
               }
           }
        });
      }
      return hasChanges ? newPos : prev;
    });
  }, [steps]);

    const handlePanStart = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractiveElement = !!target.closest('button, input, textarea, select, [data-process-node]');

      if (!isInteractiveElement) {
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
      }
    };

  const handlePanMove = (e: React.MouseEvent) => {
    if (isPanning) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        setPan(p => ({ x: p.x + dx, y: p.y + dy }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePanEnd = () => setIsPanning(false);
  
  const handleWheel = (e: React.WheelEvent) => {
      const delta = -e.deltaY * 0.001;
      setScale(s => Math.min(Math.max(0.2, s + delta), 3));
  };

  const handleNodeDragStart = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(id);
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (draggingId) {
         setPositions(prev => ({
            ...prev,
            [draggingId]: { 
                x: (prev[draggingId]?.x || 0) + e.movementX / scale, 
                y: (prev[draggingId]?.y || 0) + e.movementY / scale 
            }
         }));
      }
    };
    const handleWindowMouseUp = () => setDraggingId(null);
    if (draggingId) {
        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingId, scale]);

  // SMART CONNECTIONS LOGIC
  const connections = useMemo(() => {
    const lines = [];

    // Helper to find the best anchor points between two rectangles
    const getBestAnchors = (fromId: string, toId: string) => {
        const fromStep = steps.find(s => s.id === fromId);
        const toStep = steps.find(s => s.id === toId);

        const fromPos = positions[fromId] || {x:0, y:0};
        const toPos = positions[toId] || {x:0, y:0};
        
        // Dimensions vary by node type
        const w1 = fromStep?.type === 'process' ? NODE_WIDTH : 80;
        const h1 = fromStep?.type === 'process' ? NODE_HEIGHT : 80;
        const w2 = toStep?.type === 'process' ? NODE_WIDTH : 80;
        const h2 = toStep?.type === 'process' ? NODE_HEIGHT : 80;

        const fromCenter = { x: fromPos.x + w1/2, y: fromPos.y + h1/2 };
        const toCenter = { x: toPos.x + w2/2, y: toPos.y + h2/2 };

        const dx = toCenter.x - fromCenter.x;
        const dy = toCenter.y - fromCenter.y;

        // Determine direction
        let fromAnchor, toAnchor;

        // Horizontal dominance
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) {
                // Target is to the Right
                fromAnchor = { x: fromPos.x + w1, y: fromPos.y + h1 / 2 }; // Right
                toAnchor = { x: toPos.x, y: toPos.y + h2 / 2 }; // Left
            } else {
                // Target is to the Left
                fromAnchor = { x: fromPos.x, y: fromPos.y + h1 / 2 }; // Left
                toAnchor = { x: toPos.x + w2, y: toPos.y + h2 / 2 }; // Right
            }
        } else {
            // Vertical dominance
            if (dy > 0) {
                // Target is Below
                fromAnchor = { x: fromPos.x + w1 / 2, y: fromPos.y + h1 }; // Bottom
                toAnchor = { x: toPos.x + w2 / 2, y: toPos.y }; // Top
            } else {
                // Target is Above
                fromAnchor = { x: fromPos.x + w1 / 2, y: fromPos.y }; // Top
                toAnchor = { x: toPos.x + w2 / 2, y: toPos.y + h2 }; // Bottom
            }
        }
        
        return { start: fromAnchor, end: toAnchor };
    };

    const calculateControlPoints = (from: Position, to: Position, fromId: string, toId: string) => {
        const fromStep = steps.find(s => s.id === fromId);
        
        const getOutwardDir = (pos: Position, id: string) => {
            const rectPos = positions[id] || {x:0,y:0};
            const s = steps.find(x => x.id === id);
            const w = s?.type === 'process' ? NODE_WIDTH : 80;
            const h = s?.type === 'process' ? NODE_HEIGHT : 80;
            
            // Simple proximity check
            if (Math.abs(pos.x - (rectPos.x + w)) < 2) return { x: 1, y: 0 }; // Right
            if (Math.abs(pos.x - rectPos.x) < 2) return { x: -1, y: 0 }; // Left
            if (Math.abs(pos.y - (rectPos.y + h)) < 2) return { x: 0, y: 1 }; // Bottom
            if (Math.abs(pos.y - rectPos.y) < 2) return { x: 0, y: -1 }; // Top
            return { x: 1, y: 0 }; // Default
        };

        const dir1 = getOutwardDir(from, fromId);
        const dir2 = getOutwardDir(to, toId);

        const dist = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
        const controlDist = Math.min(dist * 0.5, 150);

        const cp1 = { x: from.x + dir1.x * controlDist, y: from.y + dir1.y * controlDist };
        const cp2 = { x: to.x + dir2.x * controlDist, y: to.y + dir2.y * controlDist };

        return { cp1, cp2 };
    };

    // Build connections from all steps
    steps.forEach(step => {
        if (!step.connections) return;
        step.connections.forEach(conn => {
            if (positions[step.id] && positions[conn.targetId]) {
                const { start, end } = getBestAnchors(step.id, conn.targetId);
                const { cp1, cp2 } = calculateControlPoints(start, end, step.id, conn.targetId);
                
                lines.push({ 
                    id: `${step.id}-${conn.targetId}`, 
                    fromId: step.id,
                    toId: conn.targetId,
                    p0: start, p1: cp1, p2: cp2, p3: end,
                    color: step.color
                });
            }
        });
    });
    return lines;
  }, [positions, steps]);

    return (
     <div className="relative w-full h-[72vh] min-h-[560px] bg-slate-950 overflow-hidden border border-slate-800 rounded-2xl select-none group shadow-inner">
       <div className="absolute left-4 top-4 z-50 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950/85 p-2 shadow-2xl backdrop-blur-sm">
         <button onClick={() => onAddStep('start')} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"><PlayCircle size={14}/> Start</button>
         <button onClick={() => onAddStep('process')} className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-colors"><Box size={14}/> Process</button>
         <button onClick={() => onAddStep('end')} className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"><StopCircle size={14}/> End</button>
       </div>

       <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 bg-slate-950/85 p-2 rounded-2xl backdrop-blur-sm border border-slate-800 shadow-2xl">
         <button title="Zoom in" onClick={() => setScale(s => Math.min(s + 0.1, 3))} className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 transition-colors"><ZoomIn size={18}/></button>
         <button title="Zoom out" onClick={() => setScale(s => Math.max(s - 0.1, 0.2))} className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 transition-colors"><ZoomOut size={18}/></button>
         <button title="Reset view" onClick={() => { setScale(1); setPan({x:0,y:0}); }} className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 transition-colors"><Maximize size={18}/></button>
         <div className="h-px bg-slate-700 my-1"/>
         <div className="p-2 text-slate-500 cursor-move flex justify-center" title="Drag canvas to pan"><Move size={18}/></div>
       </div>

       <div className="absolute bottom-4 left-4 z-50 hidden md:flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/85 px-3 py-2 text-xs text-slate-400 backdrop-blur-sm">
         <MousePointer2 size={14} className="text-blue-300" />
         <span>Tip: use edit icons to configure routing and processing rules.</span>
       </div>

       <div className="absolute bottom-4 right-4 z-50 rounded-full border border-slate-800 bg-slate-950/85 px-3 py-2 text-xs font-mono text-slate-400 backdrop-blur-sm">
         {(scale * 100).toFixed(0)}%
       </div>

       <div 
          ref={containerRef}
         className="w-full h-full cursor-grab active:cursor-grabbing bg-[linear-gradient(rgba(30,41,59,.45)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,.45)_1px,transparent_1px),radial-gradient(circle_at_center,rgba(59,130,246,.08),transparent_45%)] [background-size:40px_40px,40px_40px,100%_100%]"
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
          onWheel={handleWheel}
       >
          <div 
            style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: '0 0',
                width: '100%', height: '100%'
            }}
          >
              <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none z-0 overflow-visible">
                <defs>
                   {steps.map(s => (
                       <marker key={s.id} id={`arrow-${s.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                           <polygon points="0 0, 10 3.5, 0 7" fill={s.color || '#3b82f6'} />
                       </marker>
                   ))}
                </defs>

                {/* Draw Paths */}
                {connections.map(conn => (
                    <g key={conn.id}>
                        <path 
                            d={`M ${conn.p0.x} ${conn.p0.y} C ${conn.p1.x} ${conn.p1.y}, ${conn.p2.x} ${conn.p2.y}, ${conn.p3.x} ${conn.p3.y}`} 
                            stroke={conn.color || "#475569"} 
                            strokeWidth="3" 
                            fill="none" 
                            opacity="0.3"
                        />
                        <path 
                            d={`M ${conn.p0.x} ${conn.p0.y} C ${conn.p1.x} ${conn.p1.y}, ${conn.p2.x} ${conn.p2.y}, ${conn.p3.x} ${conn.p3.y}`} 
                            stroke={conn.color || "#475569"} 
                            strokeWidth="2" 
                            fill="none" 
                            markerEnd={`url(#arrow-${steps.find(s => s.id === conn.toId)?.id || 'default'})`}
                            strokeDasharray="10,10"
                            className={isRunning ? "animate-flow" : ""}
                        />
                    </g>
                ))}

                {/* Render Transmitting Items as Dots */}
                {items.filter(i => i.status === 'transmitting').map(item => {
                    const fromId = item.previousStepId || 'start'; // Fallback
                    const toId = item.targetStepId;

                    const conn = connections.find(c => c.fromId === fromId && c.toId === toId);
                    
                    if (!conn) return null;

                    // Calculate position based on progress
                    const pos = getPointOnBezier(item.transmissionProgress, conn.p0, conn.p1, conn.p2, conn.p3);

                    return (
                        <circle 
                            key={item.id}
                            cx={pos.x} 
                            cy={pos.y} 
                            r={6} 
                            fill={conn.color}
                            stroke="#fff"
                            strokeWidth={2}
                            className="drop-shadow-lg"
                        />
                    );
                })}
              </svg>

              {steps.map((step) => {
                  const pos = positions[step.id];
                  if (!pos) return null;
                  
                  const stats = stepStats.find(s => s.stepId === step.id) || {
                    stepId: step.id,
                    queueLength: 0,
                    activeProcessing: 0,
                    utilization: 0,
                    avgWaitTime: 0,
                    totalProcessed: 0,
                    totalFailed: 0,
                    totalCancelled: 0
                  };
                  
                  // Only pass non-transmitting items to the node itself
                  const stepItems = items.filter(i => 
                    i.currentStepId === step.id && i.status !== 'transmitting' && i.status !== 'finished'
                  );

                  return (
                      <ProcessNode 
                        key={step.id}
                        step={step}
                        stats={stats}
                        items={stepItems}
                        onEdit={() => onEditStep(step)}
                        onRemove={() => onRemoveStep(step.id)}
                        style={{ left: pos.x, top: pos.y }}
                        onMouseDown={(e) => handleNodeDragStart(e, step.id)}
                        scale={scale}
                      />
                  );
              })}
          </div>
       </div>
    </div>
  );
};
