import { useEffect, useState } from 'react';
import { Plus, Trash2, Truck } from 'lucide-react';
import { GARAGE_CATEGORIES, GARAGE_GROUPS, getEventGarageVehicles, type EventGarageVehicle } from '../lib/garage';
import { newProjectId, type ProjectTransport } from '../lib/eventProject';
import { moneyRound, transportCost } from '../lib/eventPeople';
import { searchInputProps } from '../lib/searchInput';
import { PeoplePicker } from './PeoplePicker';
import { ProjectSection } from './ProjectSection';

const input = 'min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950/50 px-3 py-2 text-sm text-gray-200 focus:border-accent-500';
const money = (value: number) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function EventTransportPanel({ rows, editable, showPrices, prices, loadingPrices, onChange }: {
  rows: ProjectTransport[]; editable: boolean; showPrices: boolean;
  prices: Partial<Record<EventGarageVehicle['category'], number>>;
  loadingPrices: boolean; onChange: (rows: ProjectTransport[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  return <><ProjectSection title="Транспорт" count={rows.length} openSignal={open} titleActions={editable && (
    <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 items-center gap-1 rounded-lg p-2 text-sm text-accent-400 hover:bg-gray-800">
      <Plus className="h-4 w-4" />Добавить
    </button>
  )}>
    {!rows.length && <p className="text-sm text-gray-400">Транспорт пока не указан.</p>}
    <ul className="space-y-3">{rows.map(row => <li key={row.id} className="flex items-start gap-3 text-sm">
      <Truck className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1 break-words">
        <p className="text-gray-200">{row.vehicle}</p>
        {row.category && <p className="text-xs text-gray-400">{GARAGE_CATEGORIES[row.category]} · {GARAGE_GROUPS[row.employment_type ?? 'staff']}</p>}
        {row.driver && <p className="text-xs text-gray-400">{row.driver}</p>}
        {row.notes && <p className="whitespace-pre-wrap text-xs text-gray-400">{row.notes}</p>}
        {showPrices && row.trip_price !== undefined && <p className="mt-1 text-xs tabular-nums text-gray-300">Поездка {money(row.trip_price)} BYN · Затраты {money(transportCost(row))} BYN</p>}
      </div>
      {editable && <button type="button" aria-label={`Удалить автомобиль ${row.vehicle}`} onClick={() => onChange(rows.filter(item => item.id !== row.id))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>}
    </li>)}</ul>
    </ProjectSection>
    {editable && adding && <TransportPicker prices={prices} loadingPrices={loadingPrices}
      onClose={() => setAdding(false)} onAdd={row => { onChange([...rows, row]); setOpen(current => !current); setAdding(false); }} />}
  </>;
}

function TransportPicker({ prices, loadingPrices, onClose, onAdd }: {
  prices: Partial<Record<EventGarageVehicle['category'], number>>; loadingPrices: boolean;
  onClose: () => void; onAdd: (row: ProjectTransport) => void;
}) {
  const [vehicles, setVehicles] = useState<EventGarageVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<EventGarageVehicle['category'] | ''>('');
  const [type, setType] = useState<EventGarageVehicle['employment_type']>('staff');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EventGarageVehicle | null>(null);
  const [price, setPrice] = useState<string>();
  useEffect(() => {
    let active = true;
    getEventGarageVehicles().then(rows => { if (active) setVehicles(rows); })
      .catch(() => { if (active) setError('Не удалось загрузить автомобили. Закройте окно и попробуйте снова.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = vehicles.filter(vehicle => vehicle.category === category && vehicle.employment_type === type &&
    `${vehicle.name} ${vehicle.plate_number}`.toLowerCase().includes(search.trim().toLowerCase()));
  const budgetPrice = category ? prices[category] : undefined;
  const displayedPrice = price ?? (budgetPrice === undefined ? '' : String(budgetPrice));
  const amount = Number(displayedPrice);
  const validPrice = displayedPrice !== '' && Number.isFinite(amount) && amount >= 0;
  const draft: ProjectTransport | null = selected && validPrice ? {
    id: '', vehicle_id: selected.id, vehicle: [selected.name, selected.plate_number].filter(Boolean).join(' · '),
    driver: selected.driver_name, notes: '', category: selected.category, employment_type: selected.employment_type,
    trip_price: moneyRound(amount),
  } : null;
  return <PeoplePicker title="Добавить автомобиль" closeLabel="Закрыть выбор автомобиля" onClose={onClose}>
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault(); event.stopPropagation();
      if (draft) onAdd({ ...draft, id: newProjectId() });
    }}>
      <label className="block space-y-1 text-sm text-gray-300">Класс автомобиля
        <select value={category} onChange={event => {
          const value = event.target.value;
          setCategory(value === 'cargo' || value === 'passenger' ? value : '');
          setSelected(null); setPrice(undefined); setSearch(''); setType('staff');
        }} className={input}>
          <option value="">Выберите класс</option>
          {Object.entries(GARAGE_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {category && !error && <>
        <div className="flex gap-2" role="group" aria-label="Принадлежность автомобиля">
          {(['staff', 'freelance'] as const).map(value => <button key={value} type="button" aria-pressed={type === value}
            onClick={() => { setType(value); setSelected(null); }}
            className={`min-h-11 rounded-lg px-4 py-2 text-sm ${type === value ? 'bg-accent-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
            {GARAGE_GROUPS[value]}
          </button>)}
        </div>
        <input aria-label="Поиск автомобиля" placeholder="Название или номер" {...searchInputProps} value={search} onChange={event => setSearch(event.target.value)} className={input} />
        {loading ? <p role="status" className="text-sm text-gray-400">Загрузка автомобилей…</p> :
          <div className="max-h-[30dvh] overflow-y-auto" role="group" aria-label="Автомобили">
            {visible.map(vehicle => <label key={vehicle.id} className="flex min-h-12 items-center gap-3 border-b border-gray-800 py-2 text-sm text-gray-200">
              <input type="radio" name="event-vehicle" checked={selected?.id === vehicle.id} onChange={() => setSelected(vehicle)} className="h-4 w-4 shrink-0 accent-accent-500" />
              <span className="min-w-0 break-words">{vehicle.name}{vehicle.plate_number && <span className="ml-2 text-gray-400">{vehicle.plate_number}</span>}</span>
            </label>)}
            {!visible.length && <p className="py-3 text-center text-sm text-gray-400">Автомобили не найдены</p>}
          </div>}
        <label className="block space-y-1 text-sm text-gray-300">Стоимость поездки, BYN
          <input type="number" min="0" step="0.01" required inputMode="decimal" value={displayedPrice} onChange={event => setPrice(event.target.value)} className={input} />
        </label>
        {loadingPrices && price === undefined && <p role="status" className="text-xs text-gray-400">Загрузка стоимости из сметы…</p>}
        <div className="flex justify-between gap-3 border-t border-gray-800 pt-3 text-sm">
          <span>Итого затраты</span><output className="font-semibold tabular-nums">{draft ? `${money(transportCost(draft))} BYN` : '—'}</output>
        </div>
        <button type="submit" disabled={!draft} className="min-h-11 w-full rounded-lg bg-accent-500 px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-accent-400 disabled:opacity-40">Добавить</button>
      </>}
    </form>
  </PeoplePicker>;
}
