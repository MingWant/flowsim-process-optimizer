
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { ProcessStep, StepStats, WorkItem } from '../types';
import { ProcessNode } from './ProcessNode';
import { Move, ZoomIn, ZoomOut, Maximize, PlayCircle, Box, StopCircle, MousePointer2, Minimize2, PanelsTopLeft } from 'lucide-react';

interface Props {
  steps: ProcessStep[];
  stepStats: StepStats[];
  items: WorkItem[];
  simulationTimeMs: number;
  isRunning: boolean;
  onEditStep: (step: ProcessStep) => void;
  onRemoveStep: (id: string) => void;
  onAddStep: (type: 'process' | 'start' | 'end', position?: Position) => void;
  onPositionChange: (id: string, position: Position) => void;
}

interface Position {
  x: number;
  y: number;
}

const NODE_WIDTH = 320;
const NODE_HEIGHT = 300; 
const START_END_WIDTH = 280;
const START_HEIGHT = 118;
const END_HEIGHT = 186;
const COLLAPSED_PROCESS_HEIGHT = 104;
const COLLAPSED_START_HEIGHT = 104;
const COLLAPSED_END_HEIGHT = 104;
const NODE_SPAWN_OFFSETS: Position[] = [
  { x: 0, y: 0 },
  { x: 48, y: 36 },
  { x: -48, y: 36 },
  { x: 72, y: -28 },
  { x: -72, y: -28 },
  { x: 0, y: 72 },
];

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

const getStepDimensions = (type?: ProcessStep['type'], collapsed = false) => ({
  width: type === 'process' ? NODE_WIDTH : type === 'start' ? 260 : START_END_WIDTH,
  height: collapsed
    ? type === 'process'
      ? COLLAPSED_PROCESS_HEIGHT
      : type === 'start'
        ? COLLAPSED_START_HEIGHT
        : COLLAPSED_END_HEIGHT
    : type === 'process'
      ? NODE_HEIGHT
      : type === 'start'
        ? START_HEIGHT
        : END_HEIGHT,
});

export const ProcessMap: React.FC<Props> = ({ 
  steps, 
  stepStats, 
  items, 
  simulationTimeMs,
  isRunning,
  onEditStep, 
  onRemoveStep,
  onAddStep,
  onPositionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [collapsedStepIds, setCollapsedStepIds] = useState<Record<string, boolean>>({});
  const [dragPreview, setDragPreview] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const dragDeltaRef = useRef({ x: 0, y: 0 });
  const dragFrameRef = useRef<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const settleTimerRef = useRef<number | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement | null>());
  const addCounterRef = useRef(0);

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

  useEffect(() => {
    setCollapsedStepIds((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;

      steps.forEach((step) => {
        next[step.id] = prev[step.id] ?? false;
        if (!(step.id in prev)) {
          changed = true;
        }
      });

      if (Object.keys(prev).length !== steps.length) {
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [steps]);

  const fitViewToProcess = useCallback(() => {
    const container = containerRef.current;
    if (!container || steps.length === 0) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const positionedSteps = steps
      .map((step) => ({
        step,
        collapsed: collapsedStepIds[step.id] || false,
        position: positions[step.id] || (typeof step.x === 'number' && typeof step.y === 'number' ? { x: step.x, y: step.y } : null),
      }))
      .filter((entry): entry is { step: ProcessStep; collapsed: boolean; position: Position } => entry.position !== null);

    if (positionedSteps.length === 0) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const bounds = positionedSteps.reduce(
      (acc, { step, collapsed, position }) => {
        const { width, height } = getStepDimensions(step.type, collapsed);
        return {
          minX: Math.min(acc.minX, position.x),
          minY: Math.min(acc.minY, position.y),
          maxX: Math.max(acc.maxX, position.x + width),
          maxY: Math.max(acc.maxY, position.y + height),
        };
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );

    const rect = container.getBoundingClientRect();
    const padding = 96;
    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
    const nextScale = Math.max(
      0.22,
      Math.min((rect.width - padding) / contentWidth, (rect.height - padding) / contentHeight, 1.25)
    );
    const centerX = bounds.minX + contentWidth / 2;
    const centerY = bounds.minY + contentHeight / 2;

    setScale(nextScale);
    setPan({
      x: Math.round(rect.width / 2 - centerX * nextScale),
      y: Math.round(rect.height / 2 - centerY * nextScale),
    });
  }, [collapsedStepIds, positions, steps]);

  const hasAutoFitRef = useRef(false);

  useEffect(() => {
    if (hasAutoFitRef.current || steps.length === 0 || Object.keys(positions).length < steps.length) {
      return;
    }

    hasAutoFitRef.current = true;
    const frameId = window.requestAnimationFrame(fitViewToProcess);
    return () => window.cancelAnimationFrame(frameId);
  }, [fitViewToProcess, positions, steps.length]);

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

  const getViewportSpawnPosition = (type: 'process' | 'start' | 'end'): Position => {
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    const viewportWidth = rect?.width ?? 1200;
    const viewportHeight = rect?.height ?? 720;

    const nodeWidth = type === 'process' ? NODE_WIDTH : START_END_WIDTH;
    const nodeHeight = type === 'process' ? NODE_HEIGHT : type === 'start' ? START_HEIGHT : END_HEIGHT;

    const worldCenterX = (-pan.x + viewportWidth / 2) / scale;
    const worldCenterY = (-pan.y + viewportHeight / 2) / scale;
    const offset = NODE_SPAWN_OFFSETS[addCounterRef.current % NODE_SPAWN_OFFSETS.length];

    addCounterRef.current += 1;

    return {
      x: Math.round(worldCenterX - nodeWidth / 2 + offset.x),
      y: Math.round(worldCenterY - nodeHeight / 2 + offset.y),
    };
  };

  const handleAddStep = (type: 'process' | 'start' | 'end') => {
    onAddStep(type, getViewportSpawnPosition(type));
  };

  const toggleStepCollapse = useCallback((stepId: string) => {
    setCollapsedStepIds((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  }, []);

  const setAllStepsCollapsed = useCallback((collapsed: boolean) => {
    setCollapsedStepIds(
      Object.fromEntries(steps.map((step) => [step.id, collapsed]))
    );
  }, [steps]);

  const handleNodeDragStart = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    setSettlingId(null);
    dragDeltaRef.current = { x: 0, y: 0 };
    dragOffsetRef.current = { x: 0, y: 0 };
    setDragPreview({ id, offsetX: 0, offsetY: 0 });
    setDraggingId(id);
  };

  useEffect(() => {
    const flushDraggedPosition = () => {
      const activeId = draggingId;
      dragFrameRef.current = null;

      if (!activeId) {
        dragDeltaRef.current = { x: 0, y: 0 };
        return;
      }

      const { x, y } = dragDeltaRef.current;
      if (x === 0 && y === 0) {
        return;
      }

      dragDeltaRef.current = { x: 0, y: 0 };

      dragOffsetRef.current = {
        x: dragOffsetRef.current.x + x / scale,
        y: dragOffsetRef.current.y + y / scale,
      };

      const node = nodeRefs.current.get(activeId);
      if (node) {
        node.style.transform = `translate(${dragOffsetRef.current.x}px, ${dragOffsetRef.current.y}px)`;
        node.style.willChange = 'transform';
        node.style.zIndex = '30';
      }

      setDragPreview({
        id: activeId,
        offsetX: dragOffsetRef.current.x,
        offsetY: dragOffsetRef.current.y,
      });
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (draggingId) {
        dragDeltaRef.current.x += e.movementX;
        dragDeltaRef.current.y += e.movementY;

        if (dragFrameRef.current === null) {
          dragFrameRef.current = window.requestAnimationFrame(flushDraggedPosition);
        }
      }
    };
    const handleWindowMouseUp = () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        flushDraggedPosition();
      }

      if (draggingId) {
        const { x, y } = dragOffsetRef.current;
        const node = nodeRefs.current.get(draggingId);
        const releasedId = draggingId;
        const current = positions[draggingId] || { x: 0, y: 0 };
        const nextPosition = {
          x: current.x + x,
          y: current.y + y,
        };

        if (x !== 0 || y !== 0) {
          flushSync(() => {
            setPositions(prev => ({
              ...prev,
              [draggingId]: nextPosition,
            }));
            onPositionChange(draggingId, nextPosition);
          });
        }

        if (node) {
          node.style.transform = '';
          node.style.willChange = '';
          node.style.zIndex = '';
        }

        setSettlingId(releasedId);
        settleTimerRef.current = window.setTimeout(() => {
          setSettlingId((currentId) => currentId === releasedId ? null : currentId);
          settleTimerRef.current = null;
        }, 140);
      }

      dragDeltaRef.current = { x: 0, y: 0 };
      dragOffsetRef.current = { x: 0, y: 0 };
      setDragPreview(null);
      setDraggingId(null);
    };

    if (draggingId) {
        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    }
    return () => {
        if (dragFrameRef.current !== null) {
          window.cancelAnimationFrame(dragFrameRef.current);
          dragFrameRef.current = null;
        }
        if (settleTimerRef.current !== null) {
          window.clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingId, onPositionChange, positions, scale]);

  const stepById = useMemo(() => new Map(steps.map(step => [step.id, step])), [steps]);

  const statsByStepId = useMemo(() => {
    const map = new Map<string, StepStats>();
    stepStats.forEach((stats) => map.set(stats.stepId, stats));
    return map;
  }, [stepStats]);

  const itemsByStepId = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    items.forEach((item) => {
      if (item.status === 'transmitting' || item.status === 'finished') {
        return;
      }

      const stepItems = map.get(item.currentStepId) || [];
      stepItems.push(item);
      map.set(item.currentStepId, stepItems);
    });
    return map;
  }, [items]);

  const transmittingItems = useMemo(
    () => items.filter((item) => item.status === 'transmitting' || typeof item.visualTransmissionProgress === 'number'),
    [items]
  );

  const effectivePositions = useMemo(() => {
    if (!dragPreview) {
      return positions;
    }

    return {
      ...positions,
      [dragPreview.id]: {
        x: (positions[dragPreview.id]?.x || 0) + dragPreview.offsetX,
        y: (positions[dragPreview.id]?.y || 0) + dragPreview.offsetY,
      }
    };
  }, [dragPreview, positions]);

  // SMART CONNECTIONS LOGIC
  const connections = useMemo(() => {
    const lines: Array<{
      id: string;
      fromId: string;
      toId: string;
      p0: Position;
      p1: Position;
      p2: Position;
      p3: Position;
      color: string;
    }> = [];

    // Helper to find the best anchor points between two rectangles
    const getBestAnchors = (fromId: string, toId: string) => {
        const fromStep = stepById.get(fromId);
        const toStep = stepById.get(toId);

        const fromPos = effectivePositions[fromId] || {x:0, y:0};
        const toPos = effectivePositions[toId] || {x:0, y:0};
        
        // Dimensions vary by node type
          const { width: w1, height: h1 } = getStepDimensions(fromStep?.type, fromStep ? (collapsedStepIds[fromStep.id] || false) : false);
          const { width: w2, height: h2 } = getStepDimensions(toStep?.type, toStep ? (collapsedStepIds[toStep.id] || false) : false);

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
        const getOutwardDir = (pos: Position, id: string) => {
        const rectPos = effectivePositions[id] || {x:0,y:0};
      const s = stepById.get(id);
            const { width: w, height: h } = getStepDimensions(s?.type, s ? (collapsedStepIds[s.id] || false) : false);
            
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
        if (effectivePositions[step.id] && effectivePositions[conn.targetId]) {
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
  }, [collapsedStepIds, effectivePositions, stepById, steps]);

  const connectionByRoute = useMemo(() => {
    const map = new Map<string, (typeof connections)[number]>();
    connections.forEach((connection) => {
      map.set(`${connection.fromId}->${connection.toId}`, connection);
    });
    return map;
  }, [connections]);

  const editHandlersByStepId = useMemo(() => {
    const map = new Map<string, () => void>();
    steps.forEach((step) => {
      map.set(step.id, () => onEditStep(step));
    });
    return map;
  }, [onEditStep, steps]);

  const removeHandlersByStepId = useMemo(() => {
    const map = new Map<string, () => void>();
    steps.forEach((step) => {
      map.set(step.id, () => onRemoveStep(step.id));
    });
    return map;
  }, [onRemoveStep, steps]);

  const dragHandlersByStepId = useMemo(() => {
    const map = new Map<string, (e: React.MouseEvent) => void>();
    steps.forEach((step) => {
      map.set(step.id, (e: React.MouseEvent) => handleNodeDragStart(e, step.id));
    });
    return map;
  }, [steps]);

  const nodeRefHandlersByStepId = useMemo(() => {
    const map = new Map<string, (node: HTMLDivElement | null) => void>();
    steps.forEach((step) => {
      map.set(step.id, (node: HTMLDivElement | null) => {
        nodeRefs.current.set(step.id, node);
      });
    });
    return map;
  }, [steps]);

    return (
     <div className="relative w-full h-[calc(100vh-15rem)] min-h-[620px] bg-slate-950 overflow-hidden border border-slate-800 rounded-2xl select-none group shadow-inner xl:h-[calc(100vh-13rem)]">
       <div className="absolute left-4 top-4 z-50 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950/85 p-2 shadow-2xl backdrop-blur-sm">
         <button onClick={() => handleAddStep('start')} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"><PlayCircle size={14}/> Start</button>
         <button onClick={() => handleAddStep('process')} className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-colors"><Box size={14}/> Process</button>
         <button onClick={() => handleAddStep('end')} className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"><StopCircle size={14}/> End</button>
         <div className="mx-1 hidden h-8 w-px bg-slate-800 lg:block" />
         <button onClick={() => setAllStepsCollapsed(true)} className="hidden items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors lg:flex"><Minimize2 size={14}/> Compact all</button>
         <button onClick={() => setAllStepsCollapsed(false)} className="hidden items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors lg:flex"><PanelsTopLeft size={14}/> Expand all</button>
       </div>

       <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 bg-slate-950/85 p-2 rounded-2xl backdrop-blur-sm border border-slate-800 shadow-2xl">
         <button title="Zoom in" onClick={() => setScale(s => Math.min(s + 0.1, 3))} className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 transition-colors"><ZoomIn size={18}/></button>
         <button title="Zoom out" onClick={() => setScale(s => Math.max(s - 0.1, 0.2))} className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 transition-colors"><ZoomOut size={18}/></button>
         <button title="Fit full process" onClick={fitViewToProcess} className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 transition-colors"><Maximize size={18}/></button>
         <div className="h-px bg-slate-700 my-1"/>
         <div className="p-2 text-slate-500 cursor-move flex justify-center" title="Drag canvas to pan"><Move size={18}/></div>
       </div>

       <div className="absolute bottom-4 left-4 z-50 hidden md:flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/85 px-3 py-2 text-xs text-slate-400 backdrop-blur-sm">
         <MousePointer2 size={14} className="text-blue-300" />
         <span>Presentation tip: use Fit to keep the full flow in frame.</span>
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
                    <circle
                      cx={conn.p0.x}
                      cy={conn.p0.y}
                      r={6}
                      fill="#0f172a"
                      stroke={conn.color || '#475569'}
                      strokeWidth={2.5}
                      opacity="0.95"
                    />
                    <circle
                      cx={conn.p0.x}
                      cy={conn.p0.y}
                      r={2.5}
                      fill={conn.color || '#475569'}
                    />
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
                          markerEnd={`url(#arrow-${conn.toId})`}
                            strokeDasharray="10,10"
                            className={isRunning ? "animate-flow" : ""}
                        />
                        <circle
                          cx={conn.p3.x}
                          cy={conn.p3.y}
                          r={4}
                          fill="#0f172a"
                          stroke={conn.color || '#475569'}
                          strokeWidth={1.5}
                          opacity="0.65"
                        />
                    </g>
                ))}

                {/* Render Transmitting Items as Dots */}
                {transmittingItems.map(item => {
                    const fromId = item.visualPreviousStepId || item.previousStepId || 'start'; // Fallback
                    const toId = item.visualTargetStepId || item.targetStepId;

                  const conn = toId ? connectionByRoute.get(`${fromId}->${toId}`) : undefined;
                    
                    if (!conn) return null;

                    // Calculate position based on progress
                    const progress = item.visualTransmissionProgress ?? item.transmissionProgress;
                    const pos = getPointOnBezier(progress, conn.p0, conn.p1, conn.p2, conn.p3);

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
                  
                  const stats = statsByStepId.get(step.id) || {
                    stepId: step.id,
                    queueLength: 0,
                    activeProcessing: 0,
                    utilization: 0,
                    avgWaitTime: 0,
                    avgCompletionTime: 0,
                    totalProcessed: 0,
                    totalFailed: 0,
                    totalCancelled: 0
                  };
                  
                  // Only pass non-transmitting items to the node itself
                  const stepItems = itemsByStepId.get(step.id) || [];

                  return (
                      <ProcessNode 
                        key={step.id}
                        ref={nodeRefHandlersByStepId.get(step.id)}
                        step={step}
                        stats={stats}
                        items={stepItems}
                        simulationTimeMs={simulationTimeMs}
                        onEdit={editHandlersByStepId.get(step.id) || (() => onEditStep(step))}
                        onRemove={removeHandlersByStepId.get(step.id) || (() => onRemoveStep(step.id))}
                        onToggleCollapse={() => toggleStepCollapse(step.id)}
                        style={{ left: pos.x, top: pos.y }}
                        onMouseDown={dragHandlersByStepId.get(step.id)}
                        isDragging={draggingId === step.id || settlingId === step.id}
                        isCollapsed={collapsedStepIds[step.id] || false}
                      />
                  );
              })}
          </div>
       </div>
    </div>
  );
};
