export type EventsCalendarView = 'month' | 'fortnight' | 'week' | 'day';
export interface EventsPreferences {
  view: 'calendar' | 'list';
  calendarView: EventsCalendarView;
  period: { year: number; month: number; day: number };
  search: string;
  type: string;
  status: string;
  allDates: boolean;
  showCancelled: boolean;
  filtersOpen: boolean;
}
const key = (userId: string) => `events-preferences-v1:${userId}`;
export function readEventsPreferences(userId: string): EventsPreferences {
  const now = new Date();
  const defaults: EventsPreferences = {
    view:'calendar', calendarView:'month', period:{year:now.getFullYear(),month:now.getMonth(),day:now.getDate()},
    search:'',type:'all',status:'all',allDates:false,showCancelled:false,filtersOpen:false,
  };
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return {...defaults, view:localStorage.getItem('events-display-mode') === 'list' ? 'list' : 'calendar'};
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object') return defaults;
    const period = value.period;
    const validPeriod = period && Number.isInteger(period.year) && period.year >= 100 && period.year <= 9999 &&
      Number.isInteger(period.month) && period.month >= 0 && period.month <= 11 && Number.isInteger(period.day) &&
      period.day >= 1 && period.day <= new Date(Date.UTC(period.year,period.month+1,0)).getUTCDate();
    return {
      view:value.view === 'list' ? 'list' : 'calendar',
      calendarView:['month','fortnight','week','day'].includes(value.calendarView) ? value.calendarView : 'month',
      period:validPeriod ? {year:period.year,month:period.month,day:period.day} : defaults.period,
      search:typeof value.search === 'string' ? value.search.slice(0,2000) : '',
      type:typeof value.type === 'string' && value.type.length <= 100 ? value.type : 'all',
      status:['all','Запрос','Подтверждено','Выполнено','Отменено'].includes(value.status) ? value.status : 'all',
      allDates:value.allDates === true,showCancelled:value.showCancelled === true,filtersOpen:value.filtersOpen === true,
    };
  } catch { return defaults; }
}
export function writeEventsPreferences(userId: string, preferences: EventsPreferences) {
  try { localStorage.setItem(key(userId), JSON.stringify(preferences)); } catch { /* Storage restrictions must not block filtering. */ }
}
