import { workDurationMinutes } from './employeeClaimMath';
import type { GarageGroup, GarageVehicleFields } from './garage';
import { dayNumber } from './calendar';

export interface ScheduleEntry { id: string; date: string; title: string; start: string; end: string; }
export interface ProjectTrip { kilometers: string; own_car: boolean; own_fuel: boolean; }
export interface ProjectPerson { id: string; personnel_id: string; name: string; group: 'team' | 'freelance' | 'external'; rate: string; work_id?: string; work_name?: string; hours?: string; starts_at?: string; ends_at?: string; trip?: ProjectTrip; }
export interface TransportPayee { id: string; name: string; }
export type TransportDriver = TransportPayee & { kilometers: number };
export interface TransportJourney {
  work_name: string;
  owner?: TransportPayee;
  kilometers?: number;
  own_fuel?: boolean;
  driver?: TransportDriver;
  drivers?: TransportDriver[];
}
export interface ProjectTransport { id: string; vehicle: string; driver: string; notes: string; vehicle_id?: string; category?: GarageVehicleFields['category']; employment_type?: GarageGroup; trip_price?: number; journey?: TransportJourney; }
export interface EventProjectDetails {
  description: string; schedule: ScheduleEntry[]; people: ProjectPerson[]; transport: ProjectTransport[];
  people_budget_id?: string; people_works?: { id: string; name: string; budgetAmount?: number }[];
  sound: string; light: string; media: string; io: string;
}
export function operationalProjectDetails(project: EventProjectDetails) {
  const { description, schedule, sound, light, media, io } = project;
  return { description, schedule, sound, light, media, io };
}
export const newProjectId = () => crypto.randomUUID();
const text = (value: unknown) => typeof value === 'string' ? value : '';
const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row)) : [];
function normalizeTrip(value: unknown): ProjectTrip | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  return { kilometers: text(row.kilometers), own_car: row.own_car === true, own_fuel: row.own_fuel === true };
}
function normalizeJourney(value: unknown): TransportJourney | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const payee = (value: unknown): TransportPayee | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const entry = value as Record<string, unknown>;
    return text(entry.id) && text(entry.name) ? { id: text(entry.id), name: text(entry.name) } : undefined;
  };
  const owner = payee(row.owner);
  const work_name = text(row.work_name);
  if (!work_name) return undefined;
  const readDriver = (value: unknown): TransportDriver | undefined => {
    const person = payee(value);
    const kilometers = (value as { kilometers?: unknown } | undefined)?.kilometers;
    return person && typeof kilometers === 'number' ? { ...person, kilometers } : undefined;
  };
  const driver = readDriver(row.driver);
  return { work_name,
    ...(owner ? { owner } : {}),
    ...(typeof row.kilometers === 'number' ? { kilometers: row.kilometers, own_fuel: row.own_fuel === true } : {}),
    ...(Array.isArray(row.drivers)
      ? { drivers: row.drivers.flatMap(value => { const entry = readDriver(value); return entry ? [entry] : []; }) }
      : driver ? { driver } : {}),
  };
}
export function journeyDrivers(journey?: TransportJourney): TransportDriver[] {
  return journey?.drivers ?? (journey?.driver ? [journey.driver] : []);
}
export const isPositiveMileage = (value: number) => Number.isFinite(value) && value > 0;
export function normalizeProjectDetails(value: unknown): EventProjectDetails {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    ...(typeof data.people_budget_id === 'string' ? { people_budget_id: data.people_budget_id } : {}),
    ...(Array.isArray(data.people_works) ? { people_works: records(data.people_works).map(row => ({ id: text(row.id), name: text(row.name), ...(typeof row.budgetAmount === 'number' && Number.isFinite(row.budgetAmount) && row.budgetAmount >= 0 ? { budgetAmount: row.budgetAmount } : {}) })).filter(row => row.id && row.name.trim()) } : {}),
    description: text(data.description), sound: text(data.sound), light: text(data.light), media: text(data.media), io: text(data.io),
    schedule: records(data.schedule).map((row, index) => ({ id: text(row.id) || `schedule-${index}`, date: text(row.date), title: text(row.title), start: text(row.start), end: text(row.end) })),
    people: records(data.people).map((row, index) => ({ id: text(row.id) || `person-${index}`, personnel_id: text(row.personnel_id), name: text(row.name), group: row.group === 'freelance' || row.group === 'external' ? row.group : 'team', rate: text(row.rate), ...(typeof row.work_id === 'string' ? { work_id: row.work_id } : {}), ...(typeof row.work_name === 'string' ? { work_name: row.work_name } : {}), ...(typeof row.hours === 'string' ? { hours: row.hours } : {}), ...(typeof row.starts_at === 'string' ? { starts_at: row.starts_at } : {}), ...(row.trip ? { trip: normalizeTrip(row.trip) } : {}), ...(typeof row.ends_at === 'string' ? { ends_at: row.ends_at } : {}) })),
    transport: records(data.transport).map((row, index) => ({ id: text(row.id) || `transport-${index}`, vehicle: text(row.vehicle), driver: text(row.driver), notes: text(row.notes),
      ...(row.journey ? { journey: normalizeJourney(row.journey) } : {}),
      ...(typeof row.vehicle_id === 'string' ? { vehicle_id: row.vehicle_id } : {}),
      ...(row.category === 'cargo' || row.category === 'passenger' ? { category: row.category } : {}),
      ...(row.employment_type === 'staff' || row.employment_type === 'freelance' ? { employment_type: row.employment_type } : {}),
      ...(typeof row.trip_price === 'number' && Number.isFinite(row.trip_price) && row.trip_price >= 0 ? { trip_price: row.trip_price } : {}),
    })),
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
  if (value.people.some(person => (person.starts_at || person.ends_at) && workDurationMinutes(person.starts_at, person.ends_at) <= 0)) {
    return 'Укажите начало и окончание работы. Для ночной смены укажите следующую дату окончания.';
  }
  if (value.people.some(person => person.hours && (!Number.isFinite(Number(person.hours)) || Number(person.hours) < 0))) return 'Количество часов должно быть неотрицательным числом.';
  if (value.people.some(({ trip }) => trip && (!Number.isFinite(Number(trip.kilometers)) || Number(trip.kilometers) <= 0))) return 'Укажите фактический километраж поездки.';
  if (value.transport.some(({ category, journey, trip_price }) => journey && (
    (category === 'passenger' && !isPositiveMileage(journey.kilometers ?? 0)) ||
    (category === 'cargo' && (!Number.isFinite(trip_price) || (trip_price ?? -1) < 0)) ||
    journeyDrivers(journey).some(driver => !isPositiveMileage(driver.kilometers))
  ))) return 'Проверьте стоимость и километраж поездки в доставке.';
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
