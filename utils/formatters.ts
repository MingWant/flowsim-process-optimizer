import type { AutoPauseConfig } from '../types';

const DEFAULT_CALENDAR_START_ISO = '2026-01-05T00:00:00';

interface AutoPauseProgressStats {
  totalItemsCreated: number;
  totalItemsFinished: number;
  totalItemsFailed: number;
  totalItemsCancelled: number;
  activeItems: number;
}

interface AutoPauseProgressRow {
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

const getAutoPauseTimeTarget = (autoPause: AutoPauseConfig, calendarStartIso: string | undefined) => {
  if (autoPause.stopDateIso) {
    const stopDateMs = Date.parse(autoPause.stopDateIso);
    const targetMs = stopDateMs - getCalendarStartMs(calendarStartIso);
    if (Number.isFinite(targetMs) && targetMs > 0) {
      return targetMs;
    }
  }

  return autoPause.simulationTimeMs;
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
  const timeTarget = getAutoPauseTimeTarget(autoPause, calendarStartIso);
  const currentBusinessDate = new Date(calendarStartMs + Math.max(0, simMs));

  const rows: AutoPauseProgressRow[] = [
    {
      label: autoPause.stopDateIso ? 'Stop date' : 'Sim time',
      target: timeTarget,
      value: simMs,
      targetLabel: autoPause.stopDateIso ? formatBusinessDateTime(new Date(Date.parse(autoPause.stopDateIso))) : typeof timeTarget === 'number' ? formatSimulationTime(timeTarget) : undefined,
      valueLabel: autoPause.stopDateIso ? formatBusinessDateTime(currentBusinessDate) : formatSimulationTime(simMs),
    },
    { label: 'Created', target: autoPause.totalItemsCreated, value: stats.totalItemsCreated },
    { label: 'Finished', target: autoPause.totalItemsFinished, value: stats.totalItemsFinished },
    { label: 'Active', target: autoPause.activeItems, value: stats.activeItems },
    { label: 'Failed', target: autoPause.totalItemsFailed, value: stats.totalItemsFailed },
    { label: 'Cancelled', target: autoPause.totalItemsCancelled, value: stats.totalItemsCancelled },
  ];

  return rows.filter((row): row is AutoPauseProgressRow & { target: number } => typeof row.target === 'number' && row.target > 0);
};
