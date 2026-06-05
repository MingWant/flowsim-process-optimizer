import { BusinessCalendar, DemandModifier, WorkingHourSegment } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const DEFAULT_BUSINESS_CALENDAR: BusinessCalendar = {
  enabled: false,
  daysOfWeek: [1, 2, 3, 4, 5],
  workingHours: [{ start: 9, end: 17 }],
  nonWorkingArrivalPolicy: 'queue',
};

const clampHour = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(24, value));
};

const normalizeWorkingHourSegment = (segment: Partial<WorkingHourSegment> | undefined): WorkingHourSegment | null => {
  if (!segment || typeof segment !== 'object') {
    return null;
  }

  const start = clampHour(segment.start ?? 0, 0);
  const end = clampHour(segment.end ?? 0, 24);

  if (end <= start) {
    return null;
  }

  return { start, end };
};

const normalizeWorkingHours = (calendar: Partial<BusinessCalendar> | undefined): WorkingHourSegment[] => {
  // Priority 1: Use workingHours if present
  if (Array.isArray(calendar?.workingHours) && calendar.workingHours.length > 0) {
    const segments = calendar.workingHours
      .map(normalizeWorkingHourSegment)
      .filter((seg): seg is WorkingHourSegment => seg !== null)
      .sort((a, b) => a.start - b.start);

    if (segments.length > 0) {
      return segments;
    }
  }

  // Priority 2: Migrate from legacy startHour/endHour
  if (typeof calendar?.startHour === 'number' && typeof calendar?.endHour === 'number') {
    const start = clampHour(calendar.startHour, 9);
    const end = clampHour(calendar.endHour, 17);
    if (end > start) {
      return [{ start, end }];
    }
  }

  // Fallback: Default working hours
  return [{ start: 9, end: 17 }];
};

const normalizeDateString = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  return value;
};

const getDateOnlyTime = (value: string, endOfDay = false) => {
  const time = Date.parse(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  return Number.isFinite(time) ? time : undefined;
};

export const normalizeBusinessCalendar = (calendar?: Partial<BusinessCalendar>): BusinessCalendar => {
  const daysOfWeek = Array.isArray(calendar?.daysOfWeek) && calendar.daysOfWeek.length > 0
    ? Array.from(new Set(calendar.daysOfWeek.map(day => Math.round(day)).filter(day => day >= 0 && day <= 6)))
    : DEFAULT_BUSINESS_CALENDAR.daysOfWeek;

  const workingHours = normalizeWorkingHours(calendar);

  return {
    enabled: Boolean(calendar?.enabled),
    daysOfWeek,
    workingHours,
    nonWorkingArrivalPolicy: calendar?.nonWorkingArrivalPolicy || DEFAULT_BUSINESS_CALENDAR.nonWorkingArrivalPolicy,
  };
};

export const getBusinessDate = (calendarStartIso: string | undefined, simulationMs: number) => {
  const startMs = calendarStartIso ? Date.parse(calendarStartIso) : Date.parse('2026-01-05T00:00:00');
  const safeStartMs = Number.isFinite(startMs) ? startMs : Date.parse('2026-01-05T00:00:00');
  return new Date(safeStartMs + Math.max(0, simulationMs));
};

export const isWorkingTime = (calendar: BusinessCalendar | undefined, calendarStartIso: string | undefined, simulationMs: number) => {
  const normalized = normalizeBusinessCalendar(calendar);
  if (!normalized.enabled) {
    return true;
  }

  const date = getBusinessDate(calendarStartIso, simulationMs);
  if (!normalized.daysOfWeek.includes(date.getDay())) {
    return false;
  }

  const hour = date.getHours() + (date.getMinutes() / 60) + (date.getSeconds() / 3600) + (date.getMilliseconds() / HOUR_MS);

  // Check if current hour falls within any working hour segment
  return normalized.workingHours.some(segment => hour >= segment.start && hour < segment.end);
};

export const getNextWorkingSimulationTime = (calendar: BusinessCalendar | undefined, calendarStartIso: string | undefined, simulationMs: number) => {
  const normalized = normalizeBusinessCalendar(calendar);
  if (!normalized.enabled || isWorkingTime(normalized, calendarStartIso, simulationMs)) {
    return simulationMs;
  }

  const startMs = calendarStartIso ? Date.parse(calendarStartIso) : Date.parse('2026-01-05T00:00:00');
  const safeStartMs = Number.isFinite(startMs) ? startMs : Date.parse('2026-01-05T00:00:00');
  let candidateDate = new Date(safeStartMs + Math.max(0, simulationMs));

  for (let guard = 0; guard < 14; guard++) {
    const day = candidateDate.getDay();
    const startOfDay = new Date(candidateDate);
    startOfDay.setHours(0, 0, 0, 0);
    const candidateMs = candidateDate.getTime();

    if (normalized.daysOfWeek.includes(day)) {
      const currentHour = (candidateMs - startOfDay.getTime()) / HOUR_MS;

      // Find the next working segment on this day
      for (const segment of normalized.workingHours) {
        const workStart = startOfDay.getTime() + segment.start * HOUR_MS;
        const workEnd = startOfDay.getTime() + segment.end * HOUR_MS;

        if (candidateMs < workEnd) {
          const nextMs = Math.max(candidateMs, workStart);
          return Math.max(simulationMs, nextMs - safeStartMs);
        }
      }
    }

    // No more working time today, try next day
    candidateDate = new Date(startOfDay.getTime() + DAY_MS);
  }

  return simulationMs + DAY_MS;
};

export const getWorkingDurationBetween = (calendar: BusinessCalendar | undefined, calendarStartIso: string | undefined, startSimulationMs: number, endSimulationMs: number) => {
  const start = Math.max(0, Math.min(startSimulationMs, endSimulationMs));
  const end = Math.max(0, Math.max(startSimulationMs, endSimulationMs));
  if (end <= start) {
    return 0;
  }

  const normalized = normalizeBusinessCalendar(calendar);
  if (!normalized.enabled) {
    return end - start;
  }

  const startMs = calendarStartIso ? Date.parse(calendarStartIso) : Date.parse('2026-01-05T00:00:00');
  const safeStartMs = Number.isFinite(startMs) ? startMs : Date.parse('2026-01-05T00:00:00');
  const absoluteStartMs = safeStartMs + start;
  const absoluteEndMs = safeStartMs + end;
  let cursorDate = new Date(absoluteStartMs);
  cursorDate.setHours(0, 0, 0, 0);
  let workingDuration = 0;

  while (cursorDate.getTime() <= absoluteEndMs) {
    if (normalized.daysOfWeek.includes(cursorDate.getDay())) {
      const dayStartMs = cursorDate.getTime();
      for (const segment of normalized.workingHours) {
        const segmentStartMs = dayStartMs + segment.start * HOUR_MS;
        const segmentEndMs = dayStartMs + segment.end * HOUR_MS;
        const overlapStart = Math.max(absoluteStartMs, segmentStartMs);
        const overlapEnd = Math.min(absoluteEndMs, segmentEndMs);
        if (overlapEnd > overlapStart) {
          workingDuration += overlapEnd - overlapStart;
        }
      }
    }

    cursorDate = new Date(cursorDate.getTime() + DAY_MS);
  }

  return Math.max(0, workingDuration);
};

export const normalizeDemandModifiers = (modifiers: Partial<DemandModifier>[] | undefined): DemandModifier[] => {
  if (!Array.isArray(modifiers)) {
    return [];
  }

  return modifiers.map((modifier, index) => ({
    id: modifier.id || `modifier-${index + 1}`,
    name: modifier.name || `Demand Modifier ${index + 1}`,
    enabled: modifier.enabled !== false,
    multiplier: Math.max(0.01, Number.isFinite(Number(modifier.multiplier)) ? Number(modifier.multiplier) : 1),
    startHour: typeof modifier.startHour === 'number' ? clampHour(modifier.startHour, 0) : undefined,
    endHour: typeof modifier.endHour === 'number' ? clampHour(modifier.endHour, 24) : undefined,
    daysOfWeek: Array.isArray(modifier.daysOfWeek)
      ? Array.from(new Set(modifier.daysOfWeek.map(day => Math.round(day)).filter(day => day >= 0 && day <= 6)))
      : undefined,
    months: Array.isArray(modifier.months)
      ? Array.from(new Set(modifier.months.map(month => Math.round(month)).filter(month => month >= 1 && month <= 12)))
      : undefined,
    startDate: normalizeDateString(modifier.startDate),
    endDate: normalizeDateString(modifier.endDate),
  }));
};

const isDemandModifierActive = (modifier: DemandModifier, date: Date) => {
  if (!modifier.enabled) {
    return false;
  }

  const hour = date.getHours() + (date.getMinutes() / 60) + (date.getSeconds() / 3600) + (date.getMilliseconds() / HOUR_MS);
  const day = date.getDay();
  const month = date.getMonth() + 1;
  const dateTime = date.getTime();

  if (modifier.daysOfWeek && modifier.daysOfWeek.length > 0 && !modifier.daysOfWeek.includes(day)) {
    return false;
  }

  if (modifier.months && modifier.months.length > 0 && !modifier.months.includes(month)) {
    return false;
  }

  if (modifier.startDate) {
    const startDateMs = getDateOnlyTime(modifier.startDate);
    if (typeof startDateMs === 'number' && dateTime < startDateMs) {
      return false;
    }
  }

  if (modifier.endDate) {
    const endDateMs = getDateOnlyTime(modifier.endDate, true);
    if (typeof endDateMs === 'number' && dateTime > endDateMs) {
      return false;
    }
  }

  if (typeof modifier.startHour === 'number' && hour < modifier.startHour) {
    return false;
  }

  if (typeof modifier.endHour === 'number' && hour >= modifier.endHour) {
    return false;
  }

  return true;
};

export const getActiveDemandModifiers = (modifiers: DemandModifier[] | undefined, calendarStartIso: string | undefined, simulationMs: number) => {
  const normalizedModifiers = normalizeDemandModifiers(modifiers);
  const date = getBusinessDate(calendarStartIso, simulationMs);
  return normalizedModifiers.filter((modifier) => isDemandModifierActive(modifier, date));
};

export const getDemandMultiplier = (modifiers: DemandModifier[] | undefined, calendarStartIso: string | undefined, simulationMs: number) => {
  const activeModifiers = getActiveDemandModifiers(modifiers, calendarStartIso, simulationMs);
  if (activeModifiers.length === 0) {
    return 1;
  }

  return activeModifiers.reduce((multiplier, modifier) => multiplier * modifier.multiplier, 1);
};
