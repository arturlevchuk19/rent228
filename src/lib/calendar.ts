import type { Event } from './events';

const DAY = 86400000;
export const dayNumber = (value: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp / DAY : null;
};
export const dateFromDay = (day: number) => new Date(day * DAY);
export function monthWeeks(year: number, month: number) {
  const first = Date.UTC(year, month, 1) / DAY;
  const last = Date.UTC(year, month + 1, 0) / DAY;
  const start = first - (dateFromDay(first).getUTCDay() + 6) % 7;
  return Array.from({ length: Math.ceil((last - start + 1) / 7) }, (_, index) => start + index * 7);
}
export interface CalendarSegment {
  event: Event;
  start: number;
  end: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}
export function weekSegments(events: Event[], weekStart: number): CalendarSegment[] {
  const ranges = events.flatMap(event => {
    const start = dayNumber(event.event_date);
    if (start === null) return [];
    const end = Math.max(start, dayNumber(event.event_end_date || '') ?? start);
    return end < weekStart || start > weekStart + 6 ? [] : [{ event, start, end }];
  }).sort((a, b) => a.start - b.start || b.end - a.end || a.event.id.localeCompare(b.event.id));
  const laneEnds: number[] = [];
  return ranges.map(({ event, start, end }) => {
    const clippedStart = Math.max(start, weekStart);
    const clippedEnd = Math.min(end, weekStart + 6);
    let lane = laneEnds.findIndex(previousEnd => previousEnd < clippedStart);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = clippedEnd;
    return { event, start: clippedStart - weekStart, end: clippedEnd - weekStart, lane,
      continuesBefore: start < weekStart, continuesAfter: end > weekStart + 6 };
  });
}
