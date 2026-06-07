import type { ArrivalInputMode, DurationUnit } from '../types';

export const DURATION_UNITS = [
  { value: 'ms', label: 'ms' },
  { value: 's', label: 'seconds' },
  { value: 'min', label: 'minutes' },
  { value: 'h', label: 'hours' },
  { value: 'workingDay', label: 'working days (8h)' },
  { value: 'day', label: 'days' },
  { value: 'week', label: 'weeks' },
  { value: 'month', label: 'months' },
  { value: 'year', label: 'years' },
] as const;

export const ARRIVAL_UNITS = [
  { value: 'ms', label: 'sim millisecond' },
  { value: 's', label: 'sim second' },
  { value: 'min', label: 'sim minute' },
  { value: 'h', label: 'sim hour' },
  { value: 'workingDay', label: 'sim working day (8h)' },
  { value: 'day', label: 'sim day' },
  { value: 'week', label: 'sim week' },
  { value: 'month', label: 'sim month' },
  { value: 'year', label: 'sim year' },
] as const;

export const TIME_COMPRESSION_PRESETS = [
  { value: 1, label: 'Real-time', hint: '1 simulated second = 1 real second' },
  { value: 60, label: '1 sim min / sec', hint: 'Useful for short delay testing' },
  { value: 60 * 60, label: '1 sim hour / sec', hint: 'Good for shift-level simulations' },
  { value: 8 * 60 * 60, label: '1 sim working day / sec', hint: '8 simulated working hours per real second' },
  { value: 24 * 60 * 60, label: '1 sim day / sec', hint: 'Great for daily process playback' },
  { value: 7 * 24 * 60 * 60, label: '1 sim week / sec', hint: 'For weekly flow trends' },
  { value: 30 * 24 * 60 * 60, label: '1 sim month / sec', hint: 'For monthly cycle simulations' },
  { value: 365 * 24 * 60 * 60, label: '1 sim year / sec', hint: 'For long-horizon scenario testing' },
] as const;

export const CUSTOM_CLOCK_VALUE = 'custom';

export const TIME_UNIT_TO_MS: Record<DurationUnit, number> = {
  ms: 1,
  s: 1000,
  min: 60 * 1000,
  h: 60 * 60 * 1000,
  workingDay: 8 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

export const DURATION_LABELS: Record<DurationUnit, string> = {
  ms: 'ms',
  s: 's',
  min: 'min',
  h: 'h',
  workingDay: 'working day',
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

export const getArrivalUnitLabel = (unit?: DurationUnit) => (
  ARRIVAL_UNITS.find((option) => option.value === unit)?.label || 'sim second'
);

export const getArrivalMinValue = (mode?: ArrivalInputMode) => mode === 'interval' ? 0.001 : 0.000000001;
