import { dayNumber } from './calendar';

export interface ScheduleEntry { id: string; date: string; title: string; start: string; end: string; }
export interface ProjectPerson { id: string; personnel_id: string; name: string; group: 'team' | 'freelance' | 'external'; rate: string; }
export interface ProjectTransport { id: string; vehicle: string; driver: string; notes: string; }
export interface EventProjectDetails {
  description: string; schedule: ScheduleEntry[]; people: ProjectPerson[]; transport: ProjectTransport[];
  sound: string; light: string; media: string; io: string;
}
export const newProjectId = () => crypto.randomUUID();
const text = (value: unknown) => typeof value === 'string' ? value : '';
const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row)) : [];
export function normalizeProjectDetails(value: unknown): EventProjectDetails {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    description: text(data.description), sound: text(data.sound), light: text(data.light), media: text(data.media), io: text(data.io),
    schedule: records(data.schedule).map((row, index) => ({ id: text(row.id) || `schedule-${index}`, date: text(row.date), title: text(row.title), start: text(row.start), end: text(row.end) })),
    people: records(data.people).map((row, index) => ({ id: text(row.id) || `person-${index}`, personnel_id: text(row.personnel_id), name: text(row.name), group: row.group === 'freelance' || row.group === 'external' ? row.group : 'team', rate: text(row.rate) })),
    transport: records(data.transport).map((row, index) => ({ id: text(row.id) || `transport-${index}`, vehicle: text(row.vehicle), driver: text(row.driver), notes: text(row.notes) })),
  };
}
export function validateProjectDetails(value: EventProjectDetails, startDate: string, endDate: string): string | null {
  const start = dayNumber(startDate); const end = dayNumber(endDate || startDate);
  for (const row of value.schedule) {
    const date = dayNumber(row.date);
    if (date === null || !row.title.trim()) return 'Укажите дату и название каждого пункта тайминга.';
    if (start !== null && end !== null && (date < start || date > end)) return 'Даты тайминга должны входить в период мероприятия.';
    if ([row.start, row.end].some(time => time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return 'Время в тайминге должно быть в формате ЧЧ:ММ.';
  }
  if (value.people.some(person => !person.name.trim())) return 'Укажите имена всех добавленных участников.';
  if (value.people.some(person => person.rate && (!Number.isFinite(Number(person.rate)) || Number(person.rate) < 0))) return 'Ставка участника должна быть неотрицательным числом.';
  if (value.transport.some(row => !row.vehicle.trim())) return 'Укажите транспорт или удалите незаполненную строку.';
  return null;
}
export function eventDateLabel(start: string, end?: string): string {
  const format = (value: string) => {
    const date = dayNumber(value);
    return date === null ? (value ? value.split('-').reverse().join('.') : 'Дата не указана') : new Date(date * 86400000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  if (end && end !== start) {
    const first = dayNumber(start); const last = dayNumber(end);
    if (first !== null && last !== null) {
      const from = new Date(first * 86400000); const to = new Date(last * 86400000);
      if (from.getUTCFullYear() === to.getUTCFullYear() && from.getUTCMonth() === to.getUTCMonth()) return `${from.getUTCDate()}–${format(end)}`;
      if (from.getUTCFullYear() === to.getUTCFullYear()) return `${from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })} — ${format(end)}`;
    }
    return `${format(start)} — ${format(end)}`;
  }
  return format(start);
}
