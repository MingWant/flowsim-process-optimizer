import type { NonWorkingArrivalPolicy } from '../types';

export type UiTheme = 'dark' | 'light' | 'ocean' | 'warm';
export type CanvasViewMode = 'map' | 'metro';

export const UI_THEMES: { id: UiTheme; label: string; swatch: string }[] = [
  { id: 'dark', label: 'Dark', swatch: 'bg-slate-950' },
  { id: 'light', label: 'Light', swatch: 'bg-slate-100' },
  { id: 'ocean', label: 'Ocean', swatch: 'bg-cyan-700' },
  { id: 'warm', label: 'Warm', swatch: 'bg-orange-500' },
];

export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export const NON_WORKING_POLICY_LABELS: Record<NonWorkingArrivalPolicy, string> = {
  queue: 'Arrive and queue',
  delay: 'Delay arrivals',
  reject: 'Reject / cancel arrivals',
};
