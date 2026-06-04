
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { ProcessStep, StepStats, WorkItem } from '../types';
import { ProcessNode } from './ProcessNode';
import { Move, ZoomIn, ZoomOut, Maximize, PlayCircle, Box, StopCircle, MousePointer2, Minimize2, PanelsTopLeft, Hand, Copy, ScanSearch, Trash2, Wrench } from 'lucide-react';

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
  selectedStepIds: string[];
  onSelectionChange: (stepIds: string[]) => void;
  onCopySelected: () => void;
  onDeleteSelected: () => void;
  onClearCanvas: () => void;
}

interface Position {
  x: number;
  y: number;
}

type InteractionMode = 'mixed' | 'pan' | 'select' | 'move';

interface SelectionBox {
  // Stored in canvas/world coordinates so the anchor stays attached to the
  // process canvas while the viewport pans or scrolls during selection.
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
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

const haveSameIds = (a: string[], b: string[]) => {
  if (a.length !== b.length) {
    return false;
  }

  const ids = new Set(a);
  return b.every((id) => ids.has(id));
};

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
  selectedStepIds,
  onSelectionChange,
  onCopySelected,
  onDeleteSelected,
  onClearCanvas,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isControlPressed, setIsControlPressed] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('mixed');
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [collapsedStepIds, setCollapsedStepIds] = useState<Record<string, boolean>>({});
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const selectionBaseIdsRef = useRef<string[]>([]);
  const selectionBoxRef = useRef<SelectionBox | null>(null);
  const selectionRectElementRef = useRef<HTMLDivElement | null>(null);
  const pendingSelectionIdsRef = useRef<string[]>(selectedStepIds);
  const selectionPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const selectionStartClientRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const canvasContentRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef(pan);
  const scaleRef = useRef(scale);
  const autoPanFrameRef = useRef<number | null>(null);
  const autoPanLastTimestampRef = useRef<number | null>(null);
  const autoPanVelocityRef = useRef({ x: 0, y: 0 });
  const emittedSelectionIdsRef = useRef<string[]>(selectedStepIds);
  const dragDeltaRef = useRef({ x: 0, y: 0 });
  const dragFrameRef = useRef<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const settleTimerRef = useRef<number | null>(null);
  const blankClickRef = useRef<{ clientX: number; clientY: number; shouldClear: boolean } | null>(null);
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

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    emittedSelectionIdsRef.current = selectedStepIds;
    pendingSelectionIdsRef.current = selectedStepIds;
  }, [selectedStepIds]);

  const isSelectionBoxActive = selectionBox !== null;

  const renderSelectionBox = useCallback((box: SelectionBox | null) => {
    const element = selectionRectElementRef.current;

    if (!element || !box) {
      if (element) {
        element.style.display = 'none';
      }
      return;
    }

    const left = Math.min(box.startX, box.currentX);
    const top = Math.min(box.startY, box.currentY);
    const width = Math.abs(box.currentX - box.startX);
    const height = Math.abs(box.currentY - box.startY);

    element.style.display = 'block';
    element.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
  }, []);

  const renderCanvasTransform = useCallback((nextPan: Position, nextScale = scaleRef.current) => {
    const element = canvasContentRef.current;

    if (!element) {
      return;
    }

    element.style.transform = `translate3d(${nextPan.x}px, ${nextPan.y}px, 0) scale(${nextScale})`;
  }, []);

  const getCanvasPointFromClient = useCallback((clientX: number, clientY: number, panOverride = panRef.current) => {
    const rect = containerRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    const viewportX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const viewportY = Math.min(Math.max(clientY - rect.top, 0), rect.height);

    return {
      x: (viewportX - panOverride.x) / scaleRef.current,
      y: (viewportY - panOverride.y) / scaleRef.current,
    };
  }, []);

  const isClientPointInsideCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();

    if (!rect) {
      return false;
    }

    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }, []);

  const computeSelectionInWorld = useCallback((box: SelectionBox) => {
    const left = Math.min(box.startX, box.currentX);
    const top = Math.min(box.startY, box.currentY);
    const right = Math.max(box.startX, box.currentX);
    const bottom = Math.max(box.startY, box.currentY);

    return steps.filter((step) => {
      const pos = positions[step.id] || (typeof step.x === 'number' && typeof step.y === 'number' ? { x: step.x, y: step.y } : null);
      if (!pos) {
        return false;
      }

      const { width, height } = getStepDimensions(step.type, collapsedStepIds[step.id] || false);
      const stepLeft = pos.x;
      const stepTop = pos.y;
      const stepRight = pos.x + width;
      const stepBottom = pos.y + height;

      return stepLeft < right && stepRight > left && stepTop < bottom && stepBottom > top;
    }).map((step) => step.id);
  }, [collapsedStepIds, positions, steps]);

  const updateSelectionFromClientPoint = useCallback((clientX: number, clientY: number, panOverride = panRef.current) => {
    const activeBox = selectionBoxRef.current;
    const canvasPoint = getCanvasPointFromClient(clientX, clientY, panOverride);

    if (!activeBox || !canvasPoint) {
      return;
    }

    const nextBox = {
      ...activeBox,
      currentX: canvasPoint.x,
      currentY: canvasPoint.y,
    };
    const nextSelectedIds = computeSelectionInWorld(nextBox);
    const mergedSelection = Array.from(new Set([...selectionBaseIdsRef.current, ...nextSelectedIds]));

    selectionBoxRef.current = nextBox;
    renderSelectionBox(nextBox);
    pendingSelectionIdsRef.current = mergedSelection;
  }, [computeSelectionInWorld, getCanvasPointFromClient, renderSelectionBox]);

  const canPanCanvas = interactionMode === 'pan' || interactionMode === 'mixed';
  const canMoveNodes = interactionMode === 'move' || interactionMode === 'mixed';
  const isTemporarySelectActive = interactionMode === 'mixed' && isControlPressed;

  const canvasCursor = useMemo(() => {
    if (selectionBox) {
      return 'crosshair';
    }

    if (isPanning) {
      return 'grabbing';
    }

    if (draggingId) {
      return 'default';
    }

    if (interactionMode === 'select' || isTemporarySelectActive) {
      return 'crosshair';
    }

    if (interactionMode === 'pan') {
      return 'grab';
    }

    if (interactionMode === 'move') {
      return 'default';
    }

    if (interactionMode === 'mixed') {
      return 'default';
    }

    return 'default';
  }, [draggingId, interactionMode, isPanning, isTemporarySelectActive, selectionBox]);

  const nodeDragHandleCursor = useMemo(() => {
    if (draggingId) {
      return 'move';
    }

    if (interactionMode === 'move') {
      return 'move';
    }

    if (interactionMode === 'mixed') {
      return isTemporarySelectActive ? 'crosshair' : 'move';
    }

    return 'default';
  }, [draggingId, interactionMode, isTemporarySelectActive]);

  const zoomAtClientPoint = useCallback((clientX: number, clientY: number, deltaY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const delta = -deltaY * 0.001;

    setScale((previousScale) => {
      const nextScale = Math.min(Math.max(0.2, previousScale + delta), 3);

      setPan((previousPan) => {
        const worldX = (mouseX - previousPan.x) / previousScale;
        const worldY = (mouseY - previousPan.y) / previousScale;

        return {
          x: mouseX - worldX * nextScale,
          y: mouseY - worldY * nextScale,
        };
      });

      return nextScale;
    });
  }, []);

  const handlePanStart = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = !!target.closest('button, input, textarea, select, [data-process-node]');
    const isTemporarySelectGesture = interactionMode === 'mixed' && e.ctrlKey;
    const isSelectionGesture = interactionMode === 'select' || isTemporarySelectGesture;

    if (isSelectionGesture) {
      if (isInteractiveElement) {
        return;
      }

      e.preventDefault();

      const startPoint = getCanvasPointFromClient(e.clientX, e.clientY);
      if (!startPoint) {
        return;
      }

      const nextBox = {
        startX: startPoint.x,
        startY: startPoint.y,
        currentX: startPoint.x,
        currentY: startPoint.y,
      };

      const isAdditiveSelection = isTemporarySelectGesture
        ? e.metaKey || e.shiftKey
        : e.metaKey || e.ctrlKey || e.shiftKey;
      selectionBaseIdsRef.current = isAdditiveSelection ? selectedStepIds : [];
      pendingSelectionIdsRef.current = selectionBaseIdsRef.current;

      if (!isAdditiveSelection) {
        emittedSelectionIdsRef.current = [];
        pendingSelectionIdsRef.current = [];
        onSelectionChange([]);
      }

      selectionPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
      selectionStartClientRef.current = { clientX: e.clientX, clientY: e.clientY };
      selectionBoxRef.current = nextBox;
      renderSelectionBox(nextBox);
      setSelectionBox(nextBox);
      return;
    }

    if (!isInteractiveElement) {
      blankClickRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        shouldClear: selectedStepIds.length > 0,
      };
    }

    if (!isInteractiveElement && canPanCanvas) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (interactionMode === 'mixed' && e.ctrlKey) {
      e.preventDefault();
    }
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (interactionMode === 'mixed') {
      setIsControlPressed(e.ctrlKey);
    }

    if (isPanning) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        const blankClick = blankClickRef.current;
        if (blankClick && (Math.abs(e.clientX - blankClick.clientX) > 3 || Math.abs(e.clientY - blankClick.clientY) > 3)) {
          blankClickRef.current = null;
        }
        setPan(p => ({ x: p.x + dx, y: p.y + dy }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
    }

    if (selectionBox) {
      selectionPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
    }
  };

  const handlePanEnd = () => {
    const activeSelectionBox = selectionBoxRef.current;

    if (blankClickRef.current?.shouldClear) {
      emittedSelectionIdsRef.current = [];
      onSelectionChange([]);
    }
    blankClickRef.current = null;

    if (activeSelectionBox) {
      const nextSelection = pendingSelectionIdsRef.current;
      if (!haveSameIds(emittedSelectionIdsRef.current, nextSelection)) {
        emittedSelectionIdsRef.current = nextSelection;
        onSelectionChange(nextSelection);
      }
      setPan(panRef.current);
    }

    setIsPanning(false);
    setSelectionBox(null);
    selectionBoxRef.current = null;
    renderSelectionBox(null);
    selectionPointerRef.current = null;
    selectionStartClientRef.current = null;
    selectionBaseIdsRef.current = [];
    pendingSelectionIdsRef.current = emittedSelectionIdsRef.current;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setIsControlPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setIsControlPressed(false);
      }
    };

    const handleBlur = () => {
      setIsControlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    if (!isSelectionBoxActive) {
      return;
    }

    const handleWindowMouseMove = (event: MouseEvent) => {
      selectionPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      if (isClientPointInsideCanvas(event.clientX, event.clientY)) {
        updateSelectionFromClientPoint(event.clientX, event.clientY);
      }
    };

    const handleWindowMouseUp = () => {
      handlePanEnd();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isClientPointInsideCanvas, isSelectionBoxActive, updateSelectionFromClientPoint]);

  useEffect(() => {
    if (!isSelectionBoxActive) {
      if (autoPanFrameRef.current !== null) {
        window.cancelAnimationFrame(autoPanFrameRef.current);
        autoPanFrameRef.current = null;
      }
      autoPanLastTimestampRef.current = null;
      autoPanVelocityRef.current = { x: 0, y: 0 };
      return;
    }

    const edgePadding = 160;
    const minSpeed = 0;
    const maxSpeed = 260;
    const smoothing = 0.1;

    const runAutoPan = (timestamp: number) => {
      autoPanFrameRef.current = null;

      const rect = containerRef.current?.getBoundingClientRect();
      const pointer = selectionPointerRef.current;
      const startPointer = selectionStartClientRef.current;
      const activeBox = selectionBoxRef.current;

      if (!rect || !pointer || !startPointer || !activeBox) {
        return;
      }

      const elapsedMs = autoPanLastTimestampRef.current === null
        ? 16.67
        : Math.min(34, Math.max(0, timestamp - autoPanLastTimestampRef.current));
      autoPanLastTimestampRef.current = timestamp;

      const getAxisVelocity = (distanceIntoEdge: number) => {
        const normalizedDistance = Math.min(1, Math.max(0, distanceIntoEdge) / edgePadding);
        if (normalizedDistance === 0) {
          return 0;
        }

        return minSpeed + normalizedDistance * normalizedDistance * normalizedDistance * (maxSpeed - minSpeed);
      };
      let dx = 0;
      let dy = 0;
      const intentThreshold = 24;
      const movedX = pointer.clientX - startPointer.clientX;
      const movedY = pointer.clientY - startPointer.clientY;
      const wantsLeft = pointer.clientX < rect.left || movedX < -intentThreshold;
      const wantsRight = pointer.clientX > rect.right || movedX > intentThreshold;
      const wantsUp = pointer.clientY < rect.top || movedY < -intentThreshold;
      const wantsDown = pointer.clientY > rect.bottom || movedY > intentThreshold;

      if (wantsLeft && pointer.clientX < rect.left + edgePadding) {
        dx = getAxisVelocity(rect.left + edgePadding - pointer.clientX);
      } else if (wantsRight && pointer.clientX > rect.right - edgePadding) {
        dx = -getAxisVelocity(pointer.clientX - (rect.right - edgePadding));
      }

      if (wantsUp && pointer.clientY < rect.top + edgePadding) {
        dy = getAxisVelocity(rect.top + edgePadding - pointer.clientY);
      } else if (wantsDown && pointer.clientY > rect.bottom - edgePadding) {
        dy = -getAxisVelocity(pointer.clientY - (rect.bottom - edgePadding));
      }

      autoPanVelocityRef.current = {
        x: autoPanVelocityRef.current.x + (dx - autoPanVelocityRef.current.x) * smoothing,
        y: autoPanVelocityRef.current.y + (dy - autoPanVelocityRef.current.y) * smoothing,
      };

      if (dx === 0 && Math.abs(autoPanVelocityRef.current.x) < 0.5) {
        autoPanVelocityRef.current.x = 0;
      }
      if (dy === 0 && Math.abs(autoPanVelocityRef.current.y) < 0.5) {
        autoPanVelocityRef.current.y = 0;
      }

      dx = autoPanVelocityRef.current.x * elapsedMs / 1000;
      dy = autoPanVelocityRef.current.y * elapsedMs / 1000;

      if (Math.abs(dx) >= 0.35 || Math.abs(dy) >= 0.35) {
        const nextPan = {
          x: panRef.current.x + dx,
          y: panRef.current.y + dy,
        };

        panRef.current = nextPan;
        renderCanvasTransform(nextPan);
        updateSelectionFromClientPoint(pointer.clientX, pointer.clientY, nextPan);
      }

      if (selectionBoxRef.current) {
        autoPanFrameRef.current = window.requestAnimationFrame(runAutoPan);
      }
    };

    autoPanFrameRef.current = window.requestAnimationFrame(runAutoPan);

    return () => {
      if (autoPanFrameRef.current !== null) {
        window.cancelAnimationFrame(autoPanFrameRef.current);
        autoPanFrameRef.current = null;
      }
      autoPanLastTimestampRef.current = null;
      autoPanVelocityRef.current = { x: 0, y: 0 };
    };
  }, [isSelectionBoxActive, updateSelectionFromClientPoint]);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleNativeWheel = (event: WheelEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        if (interactionMode === 'select' || selectionBoxRef.current) {
          event.preventDefault();
          event.stopPropagation();

          const panDelta = {
            x: -event.deltaX,
            y: -event.deltaY,
          };
          const nextPan = {
            x: panRef.current.x + panDelta.x,
            y: panRef.current.y + panDelta.y,
          };

          panRef.current = nextPan;
          if (selectionBoxRef.current) {
            renderCanvasTransform(nextPan);
          } else {
            setPan(nextPan);
          }

          const pointer = selectionPointerRef.current;
          if (pointer && selectionBoxRef.current) {
            updateSelectionFromClientPoint(pointer.clientX, pointer.clientY, nextPan);
          }
        }

        return;
      }

      event.preventDefault();
      event.stopPropagation();
      zoomAtClientPoint(event.clientX, event.clientY, event.deltaY);
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [computeSelectionInWorld, interactionMode, onSelectionChange, pan.x, pan.y, scale, zoomAtClientPoint]);

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
    if (!canMoveNodes) {
      return;
    }

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
       <div className={`absolute left-4 top-4 z-50 flex max-w-[calc(100%-7rem)] flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950/85 p-2 shadow-2xl backdrop-blur-sm transition-all ${isToolbarExpanded ? 'max-h-48 overflow-y-auto' : 'max-h-[3.35rem] overflow-hidden [&_[data-toolbar-extra]]:hidden'}`}>
         <button onClick={() => setIsToolbarExpanded((expanded) => !expanded)} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"><Wrench size={14}/> Tools</button>
         <button data-toolbar-extra onClick={() => handleAddStep('start')} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"><PlayCircle size={14}/> Start</button>
         <button data-toolbar-extra onClick={() => handleAddStep('process')} className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-colors"><Box size={14}/> Process</button>
         <button data-toolbar-extra onClick={() => handleAddStep('end')} className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"><StopCircle size={14}/> End</button>
         <div data-toolbar-extra className="mx-1 hidden h-8 w-px bg-slate-800 lg:block" />
         <button data-toolbar-extra onClick={() => setInteractionMode('mixed')} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${interactionMode === 'mixed' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}><MousePointer2 size={14}/> Mixed</button>
         <button data-toolbar-extra onClick={() => setInteractionMode('pan')} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${interactionMode === 'pan' ? 'bg-cyan-500/20 text-cyan-200' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}><Hand size={14}/> Pan</button>
         <button data-toolbar-extra onClick={() => setInteractionMode('select')} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${interactionMode === 'select' ? 'bg-blue-500/20 text-blue-200' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}><ScanSearch size={14}/> Select</button>
         <button data-toolbar-extra onClick={() => setInteractionMode('move')} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${interactionMode === 'move' ? 'bg-violet-500/20 text-violet-200' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}><Move size={14}/> Move</button>
         <button data-toolbar-extra onClick={onCopySelected} disabled={selectedStepIds.length === 0} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><Copy size={14}/> Copy selected{selectedStepIds.length > 0 ? ` (${selectedStepIds.length})` : ''}</button>
         <button data-toolbar-extra onClick={onDeleteSelected} disabled={selectedStepIds.length === 0} className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 size={14}/> Delete selected{selectedStepIds.length > 0 ? ` (${selectedStepIds.length})` : ''}</button>
         <button data-toolbar-extra onClick={onClearCanvas} disabled={steps.length === 0} className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 size={14}/> Clear canvas</button>
         <button data-toolbar-extra onClick={() => setAllStepsCollapsed(true)} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"><Minimize2 size={14}/> Compact all</button>
         <button data-toolbar-extra onClick={() => setAllStepsCollapsed(false)} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"><PanelsTopLeft size={14}/> Expand all</button>
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
         <span>{interactionMode === 'select' ? 'Drag on empty canvas to box-select nodes like draw.io. Hold Ctrl/Cmd + wheel to zoom.' : interactionMode === 'pan' ? 'Pan mode: drag empty canvas to move around. Hold Ctrl/Cmd + wheel to zoom.' : interactionMode === 'move' ? 'Move mode: drag node headers to reposition steps. Hold Ctrl/Cmd + wheel to zoom.' : isTemporarySelectActive ? 'Mixed mode: Control held, box-select is active. Release Control to return to pan/move.' : 'Mixed mode: drag empty canvas to pan, drag node headers to move steps, or hold Control to box-select. Hold Ctrl/Cmd + wheel to zoom.'}</span>
       </div>

       <div className="absolute bottom-4 right-4 z-50 rounded-full border border-slate-800 bg-slate-950/85 px-3 py-2 text-xs font-mono text-slate-400 backdrop-blur-sm">
         {(scale * 100).toFixed(0)}%
       </div>

       <div 
          ref={containerRef}
         className="w-full h-full overscroll-none bg-[linear-gradient(rgba(30,41,59,.45)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,.45)_1px,transparent_1px),radial-gradient(circle_at_center,rgba(59,130,246,.08),transparent_45%)] [background-size:40px_40px,40px_40px,100%_100%]"
          style={{ cursor: canvasCursor }}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={() => {
            if (!selectionBoxRef.current) {
              handlePanEnd();
            }
          }}
           onContextMenu={handleContextMenu}
       >
          <div 
            ref={canvasContentRef}
            className={isSelectionBoxActive ? 'pointer-events-none' : undefined}
            style={{ 
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
                transformOrigin: '0 0',
                willChange: isSelectionBoxActive || isPanning ? 'transform' : undefined,
                width: '100%', height: '100%'
            }}
          >
              <div
                ref={selectionRectElementRef}
                className="pointer-events-none absolute left-0 top-0 z-20 hidden border border-blue-400/80 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]"
                style={{ willChange: 'transform, width, height' }}
              />

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
                        isSelected={selectedStepIds.includes(step.id)}
                        dragHandleCursor={nodeDragHandleCursor}
                      />
                  );
              })}

          </div>
       </div>
    </div>
  );
};
