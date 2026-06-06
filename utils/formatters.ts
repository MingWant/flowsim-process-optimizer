import type { AutoPauseConfig } from '../types';

const DEFAULT_CALENDAR_START_ISO = '2026-01-05T00:00:00';

interface AutoPauseProgressStats {
  totalItemsCreated: number;
  totalItemsFinished: number;
  totalItemsFailed: number;
  totalItemsCancelled: number;
  activeItems: number;
}

export interface AutoPauseProgressRow {
  label: string;
  target?: number;
  value: number;
  targetLabel?: string;
  valueLabel?: string;
}

export const formatSimulationTime = (totalMs: number) => {
  const safeMs = Math.max(0, Math.floor(totalMs));
  const totalSeconds = Math.floor(safeMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  if (days > 0) {
    return `D${days} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(totalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const formatBusinessDateTime = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const getCalendarStartMs = (calendarStartIso: string | undefined) => {
  const parsed = calendarStartIso ? Date.parse(calendarStartIso) : Date.parse(DEFAULT_CALENDAR_START_ISO);
  return Number.isFinite(parsed) ? parsed : Date.parse(DEFAULT_CALENDAR_START_ISO);
};

export const getAutoPauseProgressRows = (
  autoPause: AutoPauseConfig | undefined,
  stats: AutoPauseProgressStats,
  simMs: number,
  calendarStartIso?: string
) => {
  if (!autoPause?.enabled) {
    return [];
  }

  const calendarStartMs = getCalendarStartMs(calendarStartIso);
  const currentBusinessDate = new Date(calendarStartMs + Math.max(0, simMs));
  const stopDateMs = autoPause.stopDateIso ? Date.parse(autoPause.stopDateIso) : NaN;
  const stopDateTarget = stopDateMs - calendarStartMs;

  const rows: AutoPauseProgressRow[] = [
    {
      label: 'Sim time',
      target: autoPause.simulationTimeMs,
      value: simMs,
      targetLabel: typeof autoPause.simulationTimeMs === 'number' ? formatSimulationTime(autoPause.simulationTimeMs) : undefined,
      valueLabel: formatSimulationTime(simMs),
    },
    {
      label: 'Stop date',
      target: Number.isFinite(stopDateTarget) && stopDateTarget > 0 ? stopDateTarget : undefined,
      value: simMs,
      targetLabel: Number.isFinite(stopDateMs) ? formatBusinessDateTime(new Date(stopDateMs)) : undefined,
      valueLabel: formatBusinessDateTime(currentBusinessDate),
    },
    { label: 'Created', target: autoPause.totalItemsCreated, value: stats.totalItemsCreated },
    { label: 'Finished', target: autoPause.totalItemsFinished, value: stats.totalItemsFinished },
    { label: 'Active', target: autoPause.activeItems, value: stats.activeItems },
    { label: 'Failed', target: autoPause.totalItemsFailed, value: stats.totalItemsFailed },
    { label: 'Cancelled', target: autoPause.totalItemsCancelled, value: stats.totalItemsCancelled },
  ];

  return rows.filter((row): row is AutoPauseProgressRow & { target: number } => typeof row.target === 'number' && row.target > 0);
};
