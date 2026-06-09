import React from 'react';
import type { ProcessStep, RouteStats } from '../types';
import { ArrowRight, ChevronDown, ChevronRight, Clock, GitBranch, Shuffle } from 'lucide-react';
import { getFlowGroups } from './metro/metroBoardUtils';

interface Props {
  steps: ProcessStep[];
  routeStats: RouteStats[];
}

const formatPercent = (value: number, digits = 0) => `${(Math.max(0, value) * 100).toFixed(digits)}%`;
const formatNumber = (value: number, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '0.00';
const formatDuration = (value: number) => {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (safeValue < 1000) return `${safeValue.toFixed(0)}ms`;
  if (safeValue < 60_000) return `${(safeValue / 1000).toFixed(1)}s`;
  if (safeValue < 3_600_000) return `${(safeValue / 60_000).toFixed(1)}m`;
  return `${(safeValue / 3_600_000).toFixed(1)}h`;
};

export const RoutingDiagnosticsPanel: React.FC<Props> = ({ steps, routeStats }) => {
  const [expandedFlowIds, setExpandedFlowIds] = React.useState<Set<string>>(() => new Set());
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const routeStatsById = new Map(routeStats.map((route) => [route.routeId, route]));
  const configuredRoutes: RouteStats[] = steps.flatMap((step) => (step.connections || []).map((connection) => {
    const routeId = `${step.id}->${connection.targetId}`;
    const targetStep = stepById.get(connection.targetId);
    const existingStats = routeStatsById.get(routeId);

    return existingStats || {
      routeId,
      fromStepId: step.id,
      targetStepId: connection.targetId,
      selectedCount: 0,
      sourceDecisionCount: 0,
      sourceFallbackDecisionCount: 0,
      fallbackSelectedCount: 0,
      profileMatchedSelectionCount: 0,
      priorityMatchedSelectionCount: 0,
      lastBaseWeight: Math.max(0, connection.probability || 0),
      lastEffectiveWeight: 0,
      lastEffectiveShare: 0,
      lastCongestion: 0,
      lastEstimatedQueueWait: 0,
      lastEstimatedProcessingTime: 0,
      lastEstimatedCalendarDelay: 0,
      lastEstimatedTotalTime: 0,
      lastTargetType: targetStep?.type === 'process' ? 'process' : targetStep?.type === 'end' ? 'end' : 'missing',
      lastTargetWasWorking: true,
      lastWasFallback: false,
      lastSelectionMode: step.routingStrategy || 'probability',
    };
  }));
  const sourceSelectedTotals = new Map<string, number>();
  const sourceDecisionTotals = new Map<string, number>();

  configuredRoutes.forEach((route) => {
    sourceSelectedTotals.set(route.fromStepId, (sourceSelectedTotals.get(route.fromStepId) || 0) + route.selectedCount);
    sourceDecisionTotals.set(route.fromStepId, Math.max(sourceDecisionTotals.get(route.fromStepId) || 0, route.sourceDecisionCount));
  });

  const configuredRouteCount = steps.reduce((count, step) => count + (step.connections?.length || 0), 0);
  const sortedRoutes = configuredRoutes.sort((a, b) => {
    const sourceNameDelta = (stepById.get(a.fromStepId)?.name || a.fromStepId).localeCompare(stepById.get(b.fromStepId)?.name || b.fromStepId);
    if (sourceNameDelta !== 0) return sourceNameDelta;
    return (stepById.get(a.targetStepId)?.name || a.targetStepId).localeCompare(stepById.get(b.targetStepId)?.name || b.targetStepId);
  });
  const totalSelections = configuredRoutes.reduce((sum, route) => sum + route.selectedCount, 0);
  const totalFallbackSelections = configuredRoutes.reduce((sum, route) => sum + route.fallbackSelectedCount, 0);
  const loadAwareRoutes = configuredRoutes.filter((route) => route.lastSelectionMode === 'load-aware').length;
  const timeAwareRoutes = configuredRoutes.filter((route) => route.lastSelectionMode === 'time-aware').length;
  const flowGroups = getFlowGroups(steps);
  const routeGroups = flowGroups
    .map((flow) => {
      const routes = sortedRoutes.filter((route) => flow.stepIds.has(route.fromStepId));
      return {
        flow,
        routes,
        routeCount: routes.length,
        selectedCount: routes.reduce((sum, route) => sum + route.selectedCount, 0),
        fallbackCount: routes.reduce((sum, route) => sum + route.fallbackSelectedCount, 0),
        loadAwareCount: routes.filter((route) => route.lastSelectionMode === 'load-aware').length,
        timeAwareCount: routes.filter((route) => route.lastSelectionMode === 'time-aware').length,
      };
    })
    .filter((group) => group.routeCount > 0);

  const toggleFlow = (flowId: string) => {
    setExpandedFlowIds((current) => {
      const next = new Set(current);
      if (next.has(flowId)) {
        next.delete(flowId);
      } else {
        next.add(flowId);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedFlowIds(new Set(routeGroups.map((group) => group.flow.id)));
  const collapseAll = () => setExpandedFlowIds(new Set());

  const renderRouteTable = (routes: RouteStats[]) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] text-left text-xs">
        <thead className="border-b border-slate-800 bg-slate-900/70 text-[10px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3">Route</th>
            <th className="px-3 py-3 text-right">Selected</th>
            <th className="px-3 py-3 text-right">Actual Share</th>
            <th className="px-3 py-3 text-right">Base</th>
            <th className="px-3 py-3 text-right">Effective</th>
            <th className="px-3 py-3 text-right">ETA</th>
            <th className="px-3 py-3 text-right">Congestion</th>
            <th className="px-3 py-3 text-right">Fallback</th>
            <th className="px-3 py-3 text-right">Profile Hits</th>
            <th className="px-3 py-3 text-right">Priority Hits</th>
            <th className="px-4 py-3">Mode</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-900">
          {routes.map((route) => {
            const fromStep = stepById.get(route.fromStepId);
            const targetStep = stepById.get(route.targetStepId);
            const sourceTotal = sourceSelectedTotals.get(route.fromStepId) || 0;
            const actualShare = sourceTotal > 0 ? route.selectedCount / sourceTotal : 0;
            const fallbackShare = route.selectedCount > 0 ? route.fallbackSelectedCount / route.selectedCount : 0;
            const sourceDecisions = sourceDecisionTotals.get(route.fromStepId) || route.sourceDecisionCount;
            const consideredShare = sourceDecisions > 0 ? route.sourceDecisionCount / sourceDecisions : 0;
            const routeNotUsed = route.sourceDecisionCount === 0;
            const hasZeroBaseWeight = route.lastBaseWeight <= 0;

            return (
              <tr key={route.routeId} className="text-slate-300 hover:bg-slate-900/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-semibold text-slate-100">
                    <span className="max-w-[180px] truncate" title={fromStep?.name || route.fromStepId}>{fromStep?.name || route.fromStepId}</span>
                    <ArrowRight size={13} className="shrink-0 text-slate-500" />
                    <span className="max-w-[180px] truncate" title={targetStep?.name || route.targetStepId}>{targetStep?.name || route.targetStepId}</span>
                  </div>
                  <div className="mt-1 flex gap-2 text-[10px] text-slate-500">
                    <span>{routeNotUsed ? 'not yet used' : `considered ${route.sourceDecisionCount}`}</span>
                    <span>·</span>
                    <span>{formatPercent(consideredShare)} of source decisions</span>
                    {hasZeroBaseWeight && <><span>·</span><span className="font-semibold text-red-300">zero base weight</span></>}
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-mono text-cyan-200">{route.selectedCount}</td>
                <td className="px-3 py-3 text-right font-mono text-blue-200">{formatPercent(actualShare, 1)}</td>
                <td className="px-3 py-3 text-right font-mono text-slate-300">{formatPercent(route.lastBaseWeight, 1)}</td>
                <td className="px-3 py-3 text-right font-mono text-emerald-200">
                  {formatPercent(route.lastEffectiveShare, 1)}
                  <div className="text-[10px] text-slate-500">w {formatNumber(route.lastEffectiveWeight)}</div>
                </td>
                <td className="px-3 py-3 text-right font-mono text-purple-200">
                  {route.lastTargetType === 'end'
                    ? 'Terminal'
                    : route.lastTargetType === 'missing'
                      ? 'Missing target'
                      : route.lastSelectionMode === 'time-aware'
                        ? formatDuration(route.lastEstimatedTotalTime)
                        : '—'}
                  {route.lastSelectionMode === 'time-aware' && route.lastTargetType === 'process' && (
                    <div className="text-[10px] text-slate-500">
                      q {formatDuration(route.lastEstimatedQueueWait)} · p {formatDuration(route.lastEstimatedProcessingTime)} · cal {formatDuration(route.lastEstimatedCalendarDelay)}
                    </div>
                  )}
                  {route.lastTargetType === 'end' && (
                    <div className="text-[10px] text-slate-500">terminal route</div>
                  )}
                  {route.lastSelectionMode === 'time-aware' && route.lastTargetType === 'process' && !route.lastTargetWasWorking && (
                    <div className="text-[10px] font-semibold text-amber-300">off-hours target</div>
                  )}
                </td>
                <td className="px-3 py-3 text-right font-mono text-amber-200">{formatNumber(route.lastCongestion)}</td>
                <td className="px-3 py-3 text-right font-mono">
                  <span className={route.fallbackSelectedCount > 0 ? 'text-amber-200' : 'text-slate-500'}>{route.fallbackSelectedCount}</span>
                  <div className="text-[10px] text-slate-500">{formatPercent(fallbackShare)}</div>
                </td>
                <td className="px-3 py-3 text-right font-mono text-purple-200">{route.profileMatchedSelectionCount}</td>
                <td className="px-3 py-3 text-right font-mono text-indigo-200">{route.priorityMatchedSelectionCount}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${route.lastSelectionMode === 'time-aware' ? 'border-purple-500/30 bg-purple-500/10 text-purple-200' : route.lastSelectionMode === 'load-aware' ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>
                    {route.lastSelectionMode === 'load-aware' && <Shuffle size={11} />}
                    {route.lastSelectionMode === 'time-aware' && <Clock size={11} />}
                    {route.lastSelectionMode === 'time-aware' ? 'Time-aware' : route.lastSelectionMode === 'load-aware' ? 'Load-aware' : 'Probability'}
                  </span>
                  {route.lastWasFallback && <div className="mt-1 text-[10px] font-semibold text-amber-300">last decision used fallback</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl">
      <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <GitBranch size={16} className="text-cyan-300" />
            Routing Diagnostics
          </div>
          <p className="mt-1 text-xs text-slate-500">Per-connection routing counts, actual shares, dynamic effective weights, ETA estimates, and fallback signals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">Configured {configuredRouteCount}</span>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">Flows {routeGroups.length}</span>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-200">Selected {totalSelections}</span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">Fallback {totalFallbackSelections}</span>
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-blue-200">Load-aware {loadAwareRoutes}</span>
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-purple-200">Time-aware {timeAwareRoutes}</span>
          {routeGroups.length > 0 && (
            <>
              <button onClick={expandAll} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-semibold text-slate-300 transition-colors hover:bg-slate-800">Expand all</button>
              <button onClick={collapseAll} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-semibold text-slate-300 transition-colors hover:bg-slate-800">Collapse all</button>
            </>
          )}
        </div>
      </div>

      <div className="border-b border-slate-900 bg-slate-950/60 px-4 py-3">
        <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-4">
          <div><span className="font-semibold text-blue-200">Actual Share</span> is what happened from the same source node.</div>
          <div><span className="font-semibold text-emerald-200">Effective</span> is the latest dynamic share for Load-aware or Time-aware routes.</div>
          <div><span className="font-semibold text-amber-200">Fallback</span> means filters did not match before a safe route was used.</div>
          <div><span className="font-semibold text-purple-200">ETA</span> estimates queue, processing, and calendar delay for Time-aware decisions.</div>
        </div>
      </div>

      {routeGroups.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">
          Add routing connections to populate route diagnostics.
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {routeGroups.map((group) => {
            const isExpanded = expandedFlowIds.has(group.flow.id);

            return (
              <section key={group.flow.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70" style={{ borderLeftColor: group.flow.color, borderLeftWidth: 4 }}>
                <button
                  type="button"
                  onClick={() => toggleFlow(group.flow.id)}
                  className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-slate-900/50 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.flow.color }} />
                        <span className="truncate">{group.flow.name}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {group.flow.steps.length} steps · {group.routeCount} route{group.routeCount === 1 ? '' : 's'} · default collapsed
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-200">Selected {group.selectedCount}</span>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">Fallback {group.fallbackCount}</span>
                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-blue-200">Load-aware {group.loadAwareCount}</span>
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-purple-200">Time-aware {group.timeAwareCount}</span>
                  </div>
                </button>
                {isExpanded && renderRouteTable(group.routes)}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
