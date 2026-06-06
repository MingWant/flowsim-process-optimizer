import { BusinessCalendar, DemandModifier, WorkingHourSegment } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_CALENDAR_START_ISO = '2026-01-05T00:00:00';

type NormalizedBusinessCalendar = BusinessCalendar & { workingHours: WorkingHourSegment[] };

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

const getCalendarStartMs = (calendarStartIso: string | undefined) => {
  const parsed = calendarStartIso ? Date.parse(calendarStartIso) : Date.parse(DEFAULT_CALENDAR_START_ISO);
  return Number.isFinite(parsed) ? parsed : Date.parse(DEFAULT_CALENDAR_START_ISO);
};

const getStartOfDayMs = (date: Date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay.getTime();
};

export const normalizeBusinessCalendar = (calendar?: Partial<BusinessCalendar>): NormalizedBusinessCalendar => {
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

const getDailyWorkingDurationMs = (calendar: NormalizedBusinessCalendar) => {
  return calendar.workingHours.reduce((total, segment) => total + Math.max(0, segment.end - segment.start) * HOUR_MS, 0);
};

const getWeeklyWorkingDurationMs = (calendar: NormalizedBusinessCalendar) => {
  return calendar.daysOfWeek.length * getDailyWorkingDurationMs(calendar);
};

const findNextWorkingWindowStartMs = (calendar: NormalizedBusinessCalendar, candidateMs: number) => {
  const candidateDayStartMs = getStartOfDayMs(new Date(candidateMs));

  // Search the current day plus the next full weekly cycle. Because calendars repeat weekly,
  // this is enough to find the next valid window without a fixed multi-day guard.
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const dayStartMs = candidateDayStartMs + dayOffset * DAY_MS;
    const day = new Date(dayStartMs).getDay();

    if (!calendar.daysOfWeek.includes(day)) {
      continue;
    }

    for (const segment of calendar.workingHours) {
      const windowStartMs = dayStartMs + segment.start * HOUR_MS;
      const windowEndMs = dayStartMs + segment.end * HOUR_MS;

      if (candidateMs < windowEndMs) {
        return Math.max(candidateMs, windowStartMs);
      }
    }
  }

  return undefined;
};

export const getBusinessDate = (calendarStartIso: string | undefined, simulationMs: number) => {
  return new Date(getCalendarStartMs(calendarStartIso) + Math.max(0, simulationMs));
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
  // Note: segment.end is exclusive (e.g., [9, 17) means 9:00:00.000 to 16:59:59.999)
  // This ensures consistency with addWorkingDuration and getWorkingDurationBetween
  return normalized.workingHours.some(segment => hour >= segment.start && hour < segment.end);
};

export const getNextWorkingSimulationTime = (calendar: BusinessCalendar | undefined, calendarStartIso: string | undefined, simulationMs: number) => {
  const normalized = normalizeBusinessCalendar(calendar);
  if (!normalized.enabled || isWorkingTime(normalized, calendarStartIso, simulationMs)) {
    return simulationMs;
  }

  const safeStartMs = getCalendarStartMs(calendarStartIso);
  const candidateMs = safeStartMs + Math.max(0, simulationMs);
  const nextWindowStartMs = findNextWorkingWindowStartMs(normalized, candidateMs);

  if (typeof nextWindowStartMs === 'number') {
    return Math.max(simulationMs, nextWindowStartMs - safeStartMs);
  }

  return Math.max(0, simulationMs);
};

export const addWorkingDuration = (
  calendar: BusinessCalendar | undefined,
  calendarStartIso: string | undefined,
  simulationMs: number,
  durationMs: number
) => {
  const normalized = normalizeBusinessCalendar(calendar);
  const safeDuration = Math.max(0, Number.isFinite(durationMs) ? durationMs : 0);
  const safeSimulationMs = Math.max(0, simulationMs);

  if (!normalized.enabled) {
    return safeSimulationMs + safeDuration;
  }

  if (safeDuration === 0) {
    return getNextWorkingSimulationTime(normalized, calendarStartIso, safeSimulationMs);
  }

  const safeStartMs = getCalendarStartMs(calendarStartIso);
  let cursorMs = safeStartMs + safeSimulationMs;
  let remainingMs = safeDuration;
  const weeklyWorkingDurationMs = getWeeklyWorkingDurationMs(normalized);

  while (remainingMs > 0) {
    const nextWindowStartMs = findNextWorkingWindowStartMs(normalized, cursorMs);
    if (typeof nextWindowStartMs !== 'number' || weeklyWorkingDurationMs <= 0) {
      return safeSimulationMs + safeDuration;
    }

    cursorMs = nextWindowStartMs;
    const cursorDate = new Date(cursorMs);
    const startOfDayMs = getStartOfDayMs(cursorDate);
    const nextDayMs = startOfDayMs + DAY_MS;

    if (normalized.daysOfWeek.includes(cursorDate.getDay())) {
      for (const segment of normalized.workingHours) {
        const windowStartMs = startOfDayMs + segment.start * HOUR_MS;
        const windowEndMs = startOfDayMs + segment.end * HOUR_MS;

        // Skip if cursor is already past this window
        if (cursorMs >= windowEndMs) {
          continue;
        }

        const effectiveStartMs = Math.max(cursorMs, windowStartMs);

        // Double-check: if effectiveStart is at or past the window end, skip
        // This handles the edge case where cursorMs === windowEndMs
        if (effectiveStartMs >= windowEndMs) {
          continue;
        }

        const availableMs = windowEndMs - effectiveStartMs;
        if (remainingMs <= availableMs) {
          // Return the exact moment when the duration is exhausted
          return effectiveStartMs + remainingMs - safeStartMs;
        }

        // Consume this window and move to the end of it
        remainingMs -= availableMs;
        cursorMs = windowEndMs;
      }
    }

    // Move to the start of the next day. If the remaining work spans many full
    // weekly cycles, skip those cycles in one jump while leaving the final week
    // to be resolved window-by-window so the endpoint remains exact.
    cursorMs = Math.max(cursorMs, nextDayMs);
    if (remainingMs > weeklyWorkingDurationMs) {
      const weeksToSkip = Math.floor((remainingMs - 1) / weeklyWorkingDurationMs);
      if (weeksToSkip > 0) {
        remainingMs -= weeksToSkip * weeklyWorkingDurationMs;
        cursorMs += weeksToSkip * 7 * DAY_MS;
      }
    }
  }

  return cursorMs - safeStartMs;
};

export const getWorkingDurationBetween = (
  calendar: BusinessCalendar | undefined,
  calendarStartIso: string | undefined,
  fromSimulationMs: number,
  toSimulationMs: number
) => {
  const normalized = normalizeBusinessCalendar(calendar);
  const fromMs = Math.max(0, fromSimulationMs);
  const toMs = Math.max(fromMs, toSimulationMs);

  if (!normalized.enabled) {
    return toMs - fromMs;
  }

  const safeStartMs = getCalendarStartMs(calendarStartIso);
  const endMs = safeStartMs + toMs;
  let cursorMs = safeStartMs + fromMs;
  let workingMs = 0;
  const weeklyWorkingDurationMs = getWeeklyWorkingDurationMs(normalized);

  while (cursorMs < endMs) {
    const cursorDate = new Date(cursorMs);
    const startOfDayMs = getStartOfDayMs(cursorDate);
    const nextDayMs = startOfDayMs + DAY_MS;

    if (cursorMs === startOfDayMs && weeklyWorkingDurationMs > 0) {
      const fullWeeks = Math.floor((endMs - cursorMs) / (7 * DAY_MS));
      if (fullWeeks > 0) {
        workingMs += fullWeeks * weeklyWorkingDurationMs;
        cursorMs += fullWeeks * 7 * DAY_MS;
        continue;
      }
    }

    if (normalized.daysOfWeek.includes(cursorDate.getDay())) {
      for (const segment of normalized.workingHours) {
        const windowStartMs = startOfDayMs + segment.start * HOUR_MS;
        const windowEndMs = startOfDayMs + segment.end * HOUR_MS;

        // Calculate overlap between [cursorMs, endMs) and [windowStartMs, windowEndMs)
        // Both intervals use exclusive end boundaries for consistency
        const overlapStartMs = Math.max(cursorMs, windowStartMs);
        const overlapEndMs = Math.min(endMs, windowEndMs);

        if (overlapEndMs > overlapStartMs) {
          workingMs += overlapEndMs - overlapStartMs;
        }
      }
    }

    cursorMs = Math.min(nextDayMs, endMs);
  }

  return workingMs;
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
