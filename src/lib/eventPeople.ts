import type { Personnel, WorkItem } from './personnel';
import type { ProjectPerson } from './eventProject';

export interface PeopleWork { id: string; name: string; }
const normalized = (name: string) => name.trim().toLocaleLowerCase('ru-RU');
export function orderedPeopleWorks(works: WorkItem[]): PeopleWork[] {
  const first = ['Монтаж', 'Демонтаж'].map((name, index) => works.find(work => normalized(work.name) === normalized(name)) || { id: `default-work-${index}`, name });
  return [...first, ...works.filter(work => !first.some(row => row.id === work.id)).sort((a, b) => a.name.localeCompare(b.name, 'ru'))];
}
export function peopleWorkRate(person: Personnel, workName: string): string {
  return String(/склад/i.test(workName) ? person.warehouse_rate ?? 0 : person.installation_rate ?? 0);
}
export function addWorkPeople(current: ProjectPerson[], selected: Personnel[], work: PeopleWork, id: () => string): ProjectPerson[] {
  return [...current, ...selected.filter(person => !current.some(row => row.personnel_id === person.id && (row.work_id === work.id || (!row.work_id && row.work_name === work.name)))).map(person => ({
    id: id(), personnel_id: person.id, name: person.full_name,
    group: person.employment_type === 'freelance' ? 'freelance' as const : 'team' as const,
    work_id: work.id, work_name: work.name, rate: peopleWorkRate(person, work.name), hours: '',
  }))];
}
