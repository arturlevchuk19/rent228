import { useEffect, useState } from 'react';
import { PeoplePicker } from './PeoplePicker';
import { getClaimPersonnelTypes, type ClaimPerson } from '../lib/employeeClaims';
import { getErrorMessage } from '../lib/errors';
import { searchInputProps } from '../lib/searchInput';

export function ClaimPersonPicker({ people, currentIds, onSelect, onClose }: {
  people: ClaimPerson[];
  currentIds: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [types, setTypes] = useState<Map<string, 'staff' | 'freelance'> | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [group, setGroup] = useState<'staff' | 'freelance'>('staff');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set(currentIds));

  useEffect(() => {
    if (!people.length) { setTypes(new Map()); return; }
    const request = new AbortController();
    setError('');
    setTypes(null);
    void getClaimPersonnelTypes(people.map(person => person.id), request.signal).then(
      result => {
        if (request.signal.aborted) return;
        setTypes(result);
        setGroup(result.get(currentIds[0]) ?? (people.some(person => result.get(person.id) === 'staff') ? 'staff' : 'freelance'));
      },
      caught => { if (!request.signal.aborted) setError(getErrorMessage(caught)); },
    );
    return () => request.abort();
  }, [attempt, people, currentIds]);

  const query = search.trim().toLocaleLowerCase('ru-RU');
  const visible = people.filter(person => types?.get(person.id) === group &&
    person.full_name.toLocaleLowerCase('ru-RU').includes(query));

  return <PeoplePicker title="Выберите сотрудников" onClose={onClose}>
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
      {error ? <p role="alert" className="py-4 text-sm text-red-300">{error}{' '}
        <button type="button" onClick={() => setAttempt(value => value + 1)} className="underline">Повторить</button>
      </p> : !types ? <p role="status" className="py-6 text-sm text-gray-400">Загрузка сотрудников…</p>
        : visible.length ? visible.map(person => <label key={person.id} className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-gray-800 py-3 text-sm text-gray-200">
          <input type="checkbox" checked={selected.has(person.id)} onChange={event => {
            const checked = event.target.checked;
            setSelected(current => {
              const next = new Set(current);
              if (checked) next.add(person.id);
              else next.delete(person.id);
              return next;
            });
          }}
            className="h-4 w-4 shrink-0 accent-accent-500" />
          <span className="min-w-0 break-words">{person.full_name}</span>
        </label>) : <p className="py-6 text-center text-sm text-gray-400">Сотрудники не найдены</p>}
    </div>
    <button type="button" disabled={!types || !selected.size} onClick={() => { onSelect([...selected]); onClose(); }}
      className="mt-4 min-h-11 w-full rounded-lg bg-accent-500 px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-accent-400 disabled:opacity-40">
      Выбрать ({selected.size})
    </button>
  </PeoplePicker>;
}
