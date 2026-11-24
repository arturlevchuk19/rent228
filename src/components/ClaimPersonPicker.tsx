import { useState } from 'react';
import { PeoplePicker } from './PeoplePicker';
import type { ClaimPerson } from '../lib/employeeClaims';
import { searchInputProps } from '../lib/searchInput';

export function ClaimPersonPicker({ people, currentIds, onSelect, onClose, single = false, title = 'Выберите сотрудников' }: {
  people: Pick<ClaimPerson, 'id' | 'full_name' | 'employment_type'>[];
  single?: boolean;
  title?: string;
  currentIds: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<'staff' | 'freelance'>(() =>
    people.find(person => person.id === currentIds[0])?.employment_type ??
    (people.some(person => person.employment_type !== 'freelance') ? 'staff' : 'freelance'));
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set(currentIds));

  const query = search.trim().toLocaleLowerCase('ru-RU');
  const visible = people.filter(person => (person.employment_type || 'staff') === group &&
    person.full_name.toLocaleLowerCase('ru-RU').includes(query));

  return <PeoplePicker title={title} onClose={onClose}>
    <div aria-label="Тип сотрудников" role="group" className="mb-3 flex gap-2">
      {(['staff', 'freelance'] as const).map(type => <button key={type} type="button" aria-pressed={group === type}
        onClick={() => setGroup(type)} className={`min-h-11 rounded-lg px-4 py-2 text-sm ${group === type ? 'bg-accent-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>
        {type === 'staff' ? 'Штат' : 'Фриланс'}
      </button>)}
    </div>
    <input aria-label="Поиск сотрудника" placeholder="Поиск по ФИО" {...searchInputProps} value={search}
      onChange={event => setSearch(event.target.value)}
      className="mb-3 min-h-11 w-full min-w-0 rounded-lg border border-gray-700 bg-gray-950/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-accent-500" />
    <div className="max-h-[40dvh] overflow-y-auto">
      {visible.length ? visible.map(person => <label key={person.id} className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-gray-800 py-3 text-sm text-gray-200">
          <input type={single ? "radio" : "checkbox"} name={single ? "vehicle-owner" : undefined} checked={selected.has(person.id)} onChange={event => {
            const checked = event.target.checked;
            setSelected(current => {
              const next = new Set(single ? [] : current);
              if (checked) next.add(person.id);
              else next.delete(person.id);
              return next;
            });
          }}
            className="h-4 w-4 shrink-0 accent-accent-500" />
          <span className="min-w-0 break-words">{person.full_name}</span>
        </label>) : <p className="py-6 text-center text-sm text-gray-400">Сотрудники не найдены</p>}
    </div>
    <button type="button" disabled={!selected.size} onClick={() => { onSelect([...selected]); onClose(); }}
      className="mt-4 min-h-11 w-full rounded-lg bg-accent-500 px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-accent-400 disabled:opacity-40">
      {single ? 'Выбрать' : `Выбрать (${selected.size})`}
    </button>
  </PeoplePicker>;
}
