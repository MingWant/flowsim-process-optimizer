import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ProcessStep, StepStats, WorkItem } from '../types';
import { MetroStatPill } from './metro/MetroStatPill';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  buildFlowLayout,
  formatMetricTimeInUnit,
  getArrivalSummary,
  getFlowGroups,
  getMetroPath,
  getMetroRoutePoints,
  getPointOnPolyline,
  isBottleneckStep,
} from './metro/metroBoardUtils';
import { Activity, AlertTriangle, Clock3, FastForward, Maximize2, Minimize2, Minus, PauseCircle, PlayCircle, Plus, Square, Timer, Users } from 'lucide-react';

interface Props {
  steps: ProcessStep[];
  stepStats: StepStats[];
  items: WorkItem[];
  simulationTimeMs: number;
}

interface MetroConnectionRoute {
  id: string;
  fromId: string;
  toId: string;
  points: Array<{ x: number; y: number }>;
  path: string;
  color: string;
}

export const MetroDemoBoard: React.FC<Props> = ({ steps, stepStats, items, simulationTimeMs }) => {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const flowGroups = useMemo(() => getFlowGroups(steps), [steps]);
  const statsByStepId = useMemo(() => new Map(stepStats.map((stats) => [stats.stepId, stats])), [stepStats]);
  const [focusedFlowId, setFocusedFlowId] = useState<string>('all');
  const [zoom, setZoom] = useState(1);
  const [showBottlenecks, setShowBottlenecks] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoTourEnabled, setAutoTourEnabled] = useState(false);

  useEffect(() => {
    if (focusedFlowId !== 'all' && !flowGroups.some((flow) => flow.id === focusedFlowId)) {
      setFocusedFlowId('all');
    }
  }, [flowGroups, focusedFlowId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === boardRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!autoTourEnabled || flowGroups.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setFocusedFlowId((current) => {
        if (flowGroups.length <= 1) {
          return current === 'all' ? flowGroups[0]?.id || 'all' : 'all';
        }

        if (current === 'all') {
          return flowGroups[0].id;
        }

        const currentIndex = flowGroups.findIndex((flow) => flow.id === current);
        const nextIndex = currentIndex < 0 ? 0 : currentIndex + 1;
        return nextIndex >= flowGroups.length ? 'all' : flowGroups[nextIndex].id;
      });
    }, 6500);

    return () => window.clearInterval(intervalId);
  }, [autoTourEnabled, flowGroups]);

  const visibleFlows = focusedFlowId === 'all'
    ? flowGroups
    : flowGroups.filter((flow) => flow.id === focusedFlowId);

  const adjustZoom = (delta: number) => {
    setZoom((current) => Math.max(0.7, Math.min(1.6, Number((current + delta).toFixed(2)))));
  };

  const toggleFullscreen = async () => {
    if (!boardRef.current) {
      return;
    }

    if (document.fullscreenElement === boardRef.current) {
      await document.exitFullscreen();
      return;
    }

    await boardRef.current.requestFullscreen();
  };

  if (steps.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 px-6 py-12 text-center text-sm text-slate-500">
        Add a few steps first, then switch to Metro Demo mode for a compact presentation view.
      </div>
    );
  }

  return (
    <div ref={boardRef} className="space-y-5 rounded-3xl bg-transparent text-slate-200 fullscreen:bg-slate-950 fullscreen:p-5 fullscreen:overflow-auto">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-2xl shadow-black/10">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300">Presentation Controls</div>
            <h3 className="mt-1 text-lg font-semibold text-slate-100">Metro Demo Board</h3>
            <p className="mt-1 text-xs text-slate-500">Focus one flow, zoom the lane, or enter fullscreen for cleaner live demos.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-2xl border border-slate-800 bg-slate-900/90 p-1">
              <button
                onClick={() => setFocusedFlowId('all')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${focusedFlowId === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
              >
                Compare All
              </button>
              {flowGroups.map((flow, index) => (
                <button
                  key={flow.id}
                  onClick={() => setFocusedFlowId(flow.id)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${focusedFlowId === flow.id ? 'text-white shadow' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
                  style={focusedFlowId === flow.id ? { backgroundColor: flow.color } : undefined}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-current opacity-80" />
                  Flow {String.fromCharCode(65 + index)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-2xl border border-slate-800 bg-slate-900/90 p-1">
              <button onClick={() => adjustZoom(-0.1)} className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white" title="Zoom out">
                <Minus size={16} />
              </button>
              <div className="min-w-16 px-2 text-center text-xs font-mono text-cyan-300">{Math.round(zoom * 100)}%</div>
              <button onClick={() => adjustZoom(0.1)} className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white" title="Zoom in">
                <Plus size={16} />
              </button>
            </div>

            <button
              onClick={() => setAutoTourEnabled((current) => !current)}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${autoTourEnabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'}`}
            >
              {autoTourEnabled ? <PauseCircle size={15} /> : <FastForward size={15} />}
              {autoTourEnabled ? 'Auto Tour On' : 'Auto Tour'}
            </button>

            <button
              onClick={() => setShowBottlenecks((current) => !current)}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${showBottlenecks ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'}`}
            >
              <AlertTriangle size={15} />
              {showBottlenecks ? 'Bottlenecks On' : 'Bottlenecks Off'}
            </button>

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-flex min-w-[5.75rem] items-center justify-center rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
            Sim <span className="ml-1 min-w-[4ch] text-right font-mono tabular-nums">{formatMetricTimeInUnit(simulationTimeMs, 's')}</span>
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">{visibleFlows.length} visible flow{visibleFlows.length === 1 ? '' : 's'}</span>
          {autoTourEnabled && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">Auto tour cycles every 6.5s</span>}
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Animated transfer dots</span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Focused presentation layout</span>
        </div>
      </div>

      {visibleFlows.map((flow) => {
        const flowIndex = flowGroups.findIndex((candidate) => candidate.id === flow.id);
        const { layoutById, width, height } = buildFlowLayout(flow.steps);
        const bottleneckStepIds = new Set(
          flow.steps
            .filter((step) => isBottleneckStep(step, statsByStepId.get(step.id)))
            .map((step) => step.id)
        );
        const connectionRoutes = flow.steps.flatMap((step) => {
          const from = layoutById.get(step.id);
          if (!from) {
            return [] as MetroConnectionRoute[];
          }

          return step.connections
            .filter((connection) => flow.stepIds.has(connection.targetId))
            .map((connection) => {
              const to = layoutById.get(connection.targetId);
              if (!to) {
                return null;
              }

              const points = getMetroRoutePoints(from, to);

              return {
                id: `${step.id}-${connection.targetId}`,
                fromId: step.id,
                toId: connection.targetId,
                points,
                path: getMetroPath(points),
                color: step.color,
              };
            })
            .filter((route): route is MetroConnectionRoute => Boolean(route));
        });

        const connectionById = new Map<string, MetroConnectionRoute>(connectionRoutes.map((route) => [`${route.fromId}->${route.toId}`, route]));
        const flowStats = flow.steps.map((step) => statsByStepId.get(step.id)).filter((stats): stats is StepStats => Boolean(stats));
        const flowQueue = flowStats.reduce((sum, stats) => sum + stats.queueLength, 0);
        const flowProcessing = flowStats.reduce((sum, stats) => sum + stats.activeProcessing, 0);
        const flowFinished = flow.steps
          .filter((step) => step.type === 'end')
          .reduce((sum, step) => sum + (statsByStepId.get(step.id)?.totalProcessed || 0), 0);
        const flowFailed = flowStats.reduce((sum, stats) => sum + stats.totalFailed, 0);
        const flowActive = items.filter((item) => !['finished', 'cancelled', 'error'].includes(item.status) && item.currentStepId !== 'finished' && flow.stepIds.has(item.currentStepId)).length;
        const animatedItems = items.filter((item) => (
          (item.status === 'transmitting' || typeof item.visualTransmissionProgress === 'number')
          && item.visualTargetStepId
          && item.visualPreviousStepId
          && flow.stepIds.has(item.visualPreviousStepId)
          && flow.stepIds.has(item.visualTargetStepId)
        ));

        return (
          <section key={flow.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 shadow-2xl shadow-black/15">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: flow.color }} />
                  Metro Demo · Flow {String.fromCharCode(65 + flowIndex)}
                </div>
                <h3 className="text-lg font-bold text-slate-100">{flow.name}</h3>
                <p className="text-xs text-slate-500">Compact presentation lane with animated transfer dots, clearer bottleneck cues, and fast side-by-side comparison.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MetroStatPill label="Nodes" value={flow.steps.length} />
                <MetroStatPill label="Live" value={flowActive} tone="text-cyan-300" />
                <MetroStatPill label="Queue" value={flowQueue} tone={flowQueue > 0 ? 'text-amber-300' : 'text-slate-100'} />
                <MetroStatPill label="Done" value={flowFinished} tone="text-emerald-300" />
              </div>
            </div>

            <div className="mb-4" style={{ minHeight: '36px' }}>
              {showBottlenecks && bottleneckStepIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  <AlertTriangle size={14} className="text-amber-300" />
                  <span>{bottleneckStepIds.size} bottleneck candidate{bottleneckStepIds.size === 1 ? '' : 's'} in this flow</span>
                  <span className="text-amber-200/80">· Queue, utilization, or failure pressure is elevated</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto pb-2">
              <div style={{ width: width * zoom, height: height * zoom }}>
                <div
                  className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]"
                  style={{ width, height, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                >
                <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.55) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
                <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                  {connectionRoutes.map((route) => (
                    <g key={route.id}>
                      <path
                        d={route.path}
                        fill="none"
                        stroke={route.color}
                        strokeWidth={showBottlenecks && (bottleneckStepIds.has(route.fromId) || bottleneckStepIds.has(route.toId)) ? 18 : 15}
                        strokeOpacity={showBottlenecks && (bottleneckStepIds.has(route.fromId) || bottleneckStepIds.has(route.toId)) ? 0.22 : 0.13}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={route.path}
                        fill="none"
                        stroke={showBottlenecks && (bottleneckStepIds.has(route.fromId) || bottleneckStepIds.has(route.toId)) ? '#f59e0b' : route.color}
                        strokeWidth={showBottlenecks && (bottleneckStepIds.has(route.fromId) || bottleneckStepIds.has(route.toId)) ? 7 : 6}
                        strokeOpacity="0.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={route.path}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="1.4"
                        strokeOpacity="0.35"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  ))}

                  {flow.steps.map((step) => {
                    const layout = layoutById.get(step.id);
                    if (!layout) {
                      return null;
                    }

                    const centerX = layout.x + CARD_WIDTH / 2;
                    const centerY = layout.y + CARD_HEIGHT / 2;
                    const isHot = showBottlenecks && bottleneckStepIds.has(step.id);

                    return (
                      <g key={`station-dot-${step.id}`}>
                        <circle cx={centerX} cy={centerY} r={18} fill={isHot ? '#f59e0b' : step.color} opacity="0.16" />
                        <circle cx={centerX} cy={centerY} r={9} fill="#020617" stroke={isHot ? '#f59e0b' : step.color} strokeWidth="4" />
                        <circle cx={centerX} cy={centerY} r={3.5} fill={isHot ? '#f59e0b' : step.color} opacity="0.9" />
                      </g>
                    );
                  })}

                  {animatedItems.map((item) => {
                    const route = item.visualTargetStepId ? connectionById.get(`${item.visualPreviousStepId}->${item.visualTargetStepId}`) : undefined;
                    if (!route) {
                      return null;
                    }

                    const progress = Math.max(0, Math.min(1, item.visualTransmissionProgress ?? item.transmissionProgress ?? 0));
                    const point = getPointOnPolyline(progress, route.points);

                    return (
                      <g key={item.id}>
                        <circle cx={point.x} cy={point.y} r={11} fill={showBottlenecks && (bottleneckStepIds.has(route.fromId) || bottleneckStepIds.has(route.toId)) ? '#f59e0b' : route.color} opacity="0.16" />
                        <circle cx={point.x} cy={point.y} r={6} fill={showBottlenecks && (bottleneckStepIds.has(route.fromId) || bottleneckStepIds.has(route.toId)) ? '#f59e0b' : route.color} stroke="#e2e8f0" strokeWidth="2" />
                      </g>
                    );
                  })}
                </svg>

                {flow.steps.map((step) => {
                  const layout = layoutById.get(step.id);
                  if (!layout) {
                    return null;
                  }

                  const stats = statsByStepId.get(step.id);
                  const liveItems = items.filter((item) => item.currentStepId === step.id && !['finished', 'cancelled', 'error', 'transmitting'].includes(item.status));
                  const isStart = step.type === 'start';
                  const isEnd = step.type === 'end';
                  const isDelay = step.simulationMode === 'delay';
                  const endUnit = step.endTimeUnit || 'min';
                  const queue = stats?.queueLength || 0;
                  const active = stats?.activeProcessing || 0;
                  const done = stats?.totalProcessed || 0;
                  const failure = stats?.totalFailed || 0;
                  const cycle = formatMetricTimeInUnit(stats?.avgCompletionTime || 0, endUnit);
                  const utilization = isDelay ? 'Delay' : `${Math.round((stats?.utilization || 0) * 100)}%`;
                  const bottleneck = showBottlenecks && bottleneckStepIds.has(step.id);

                  return (
                    <div
                      key={step.id}
                      className={`absolute z-10 flex flex-col overflow-hidden rounded-3xl border p-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-md transition-all ${bottleneck ? 'border-amber-400/60 bg-[linear-gradient(180deg,rgba(120,53,15,0.38),rgba(15,23,42,0.98))]' : 'border-white/10 bg-slate-900/96'}`}
                      style={{ left: layout.x, top: layout.y, width: CARD_WIDTH, height: CARD_HEIGHT, boxShadow: bottleneck ? '0 0 0 1px rgba(251,191,36,0.45) inset, 0 0 0 1px rgba(251,191,36,0.15), 0 14px 28px rgba(2,6,23,0.35)' : `0 0 0 1px ${step.color}35 inset, 0 14px 28px rgba(2,6,23,0.35)` }}
                    >
                      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: bottleneck ? '#f59e0b' : step.color }} />
                      <div className="flex shrink-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-slate-500">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: bottleneck ? '#f59e0b' : step.color }} />
                            {isStart ? 'Start' : isEnd ? 'End' : isDelay ? 'Delay' : 'Station'}
                            {bottleneck && <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[8px] text-amber-200">hot</span>}
                          </div>
                          <div
                            className="mt-1.5 min-h-8 overflow-hidden text-[13px] font-black leading-4 text-slate-100"
                            title={step.name}
                            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                          >
                            {step.name}
                          </div>
                        </div>
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border bg-slate-950/80 ${bottleneck ? 'border-amber-400/40 text-amber-300' : 'border-white/10'}`} style={bottleneck ? undefined : { color: step.color }}>
                          {isStart ? <PlayCircle size={15} /> : isEnd ? <Square size={14} /> : isDelay ? <Timer size={15} /> : <Users size={15} />}
                        </div>
                      </div>

                      <div className="mt-2 grid shrink-0 grid-cols-3 gap-1.5">
                        {isStart ? (
                          <>
                            <MetroStatPill label="Rate" value={getArrivalSummary(step)} tone="text-emerald-300" />
                            <MetroStatPill label="Out" value={done} tone="text-cyan-300" />
                            <MetroStatPill label="Err" value={failure} tone={failure > 0 ? 'text-rose-300' : 'text-slate-100'} />
                          </>
                        ) : isEnd ? (
                          <>
                            <MetroStatPill label="Done" value={done} tone="text-emerald-300" />
                            <MetroStatPill label="Avg" value={cycle} tone="text-blue-300" />
                            <MetroStatPill label="Live" value={liveItems.length} tone="text-cyan-300" />
                          </>
                        ) : (
                          <>
                            <MetroStatPill label="Q" value={queue} tone={queue > 0 ? 'text-amber-300' : 'text-slate-100'} />
                            <MetroStatPill label={isDelay ? 'A' : 'P'} value={active} tone="text-cyan-300" />
                            <MetroStatPill label="U" value={utilization} tone={isDelay ? 'text-cyan-300' : 'text-emerald-300'} />
                          </>
                        )}
                      </div>

                      <div className="mt-auto flex shrink-0 items-center justify-between gap-2 border-t border-white/5 pt-1.5 text-[10px] leading-none text-slate-500">
                        <span className="flex min-w-0 items-center gap-1 truncate"><Activity size={10} className="shrink-0" /> {liveItems.length} live</span>
                        {!isStart && !isEnd && <span className="flex min-w-0 items-center justify-end gap-1 truncate"><Clock3 size={10} className="shrink-0" /> {done} out</span>}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Horizontal demo layout</span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Animated transfer dots</span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Queue {flowQueue}</span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Processing {flowProcessing}</span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Failures {flowFailed}</span>
              {showBottlenecks && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-200">Bottlenecks {bottleneckStepIds.size}</span>}
            </div>
          </section>
        );
      })}
    </div>
  );
};
