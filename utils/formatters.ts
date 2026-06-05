import type { AutoPauseConfig } from '../types';

interface AutoPauseProgressStats {
  totalItemsCreated: number;
  totalItemsFinished: number;
  totalItemsFailed: number;
  totalItemsCancelled: number;
  activeItems: number;
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

export const getAutoPauseProgressRows = (
  autoPause: AutoPauseConfig | undefined,
  stats: AutoPauseProgressStats,
  simMs: number
) => {
  if (!autoPause?.enabled) {
    return [];
  }

  return [
    { label: 'Sim time', target: autoPause.simulationTimeMs, value: simMs },
    { label: 'Created', target: autoPause.totalItemsCreated, value: stats.totalItemsCreated },
    { label: 'Finished', target: autoPause.totalItemsFinished, value: stats.totalItemsFinished },
    { label: 'Active', target: autoPause.activeItems, value: stats.activeItems },
    { label: 'Failed', target: autoPause.totalItemsFailed, value: stats.totalItemsFailed },
    { label: 'Cancelled', target: autoPause.totalItemsCancelled, value: stats.totalItemsCancelled },
  ].filter((row): row is { label: string; target: number; value: number } => typeof row.target === 'number' && row.target > 0);
};
