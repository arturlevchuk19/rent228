import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { GARAGE_CATEGORIES, GARAGE_GROUPS, getEventGarageVehicles, type EventGarageVehicle } from '../lib/garage';
import { isPositiveMileage, newProjectId, type ProjectTransport } from '../lib/eventProject';
import { driverMileageRate, driverPayout, moneyRound, passengerMileageRate, vehiclePayout, type PeopleDirectoryEntry } from '../lib/eventPeople';
import { searchInputProps } from '../lib/searchInput';
import { PeoplePicker } from './PeoplePicker';

const input = 'block min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950/50 px-3 py-2 text-sm text-gray-200 focus:border-accent-500';
const money = (value: number) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function EventDeliveryVehicleForm({ workName, defaultCategory, allowPassenger, previous, people, onSave, onClose }: {
  workName: string; defaultCategory: EventGarageVehicle['category']; allowPassenger: boolean;
  previous?: ProjectTransport; people: PeopleDirectoryEntry[];
  onSave: (row: ProjectTransport) => void; onClose: () => void;
}) {
  const [vehicles, setVehicles] = useState<EventGarageVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState(previous?.category ?? defaultCategory);
  const [group, setGroup] = useState(previous?.employment_type ?? 'staff');
  const [vehicleId, setVehicleId] = useState(previous?.vehicle_id ?? '');
  const [search, setSearch] = useState('');
  const [price, setPrice] = useState(previous?.trip_price?.toString() ?? '');
  const [kilometers, setKilometers] = useState(previous?.journey?.kilometers?.toString() ?? '');
  const [ownFuel, setOwnFuel] = useState(previous?.journey?.own_fuel ?? false);
  const [ownerId, setOwnerId] = useState(previous?.journey?.owner.id ?? '');
  const [withDriver, setWithDriver] = useState(Boolean(previous?.journey?.driver));
  const [driverId, setDriverId] = useState(previous?.journey?.driver?.id ?? '');
  const [driverKmOverride, setDriverKmOverride] = useState<string>();
  const driverKm = driverKmOverride ?? (previous?.journey?.driver &&
    previous.journey.driver.kilometers !== previous.journey.kilometers
    ? String(previous.journey.driver.kilometers) : category === 'passenger' ? kilometers : '');

  useEffect(() => {
    let active = true;
    getEventGarageVehicles().then(rows => { if (active) setVehicles(rows); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = vehicles.filter(vehicle => vehicle.category === category && vehicle.employment_type === group &&
    `${vehicle.name} ${vehicle.plate_number}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = vehicles.find(row => row.id === vehicleId);
  const existingVehicle = vehicleId && vehicleId === previous?.vehicle_id ? previous : undefined;
  const vehicleName = selected ? [selected.name, selected.plate_number].filter(Boolean).join(' · ') : existingVehicle?.vehicle;
  const person = (id: string) => {
    const entry = people.find(row => row.id === id);
    return entry && { id: entry.id, name: entry.full_name };
  };
  const owner = selected?.owner_id && selected.owner_name ? { id: selected.owner_id, name: selected.owner_name }
    : ownerId === previous?.journey?.owner.id ? previous.journey.owner : person(ownerId);
  const previousDriver = previous?.journey?.driver;
  const driver = driverId === previousDriver?.id ? previousDriver : person(driverId);
  const validVehicleCost = category === 'passenger' ? isPositiveMileage(Number(kilometers))
    : price !== '' && Number.isFinite(Number(price)) && Number(price) >= 0;
  const validDriver = !withDriver || (driver && isPositiveMileage(Number(driverKm)));
  const draft: ProjectTransport | undefined = vehicleName && owner && validVehicleCost && validDriver ? {
    id: previous?.id ?? '', vehicle_id: vehicleId, vehicle: vehicleName, category, employment_type: group,
    notes: previous?.notes ?? '', driver: withDriver ? driver?.name ?? '' : '',
    ...(category === 'cargo' ? { trip_price: moneyRound(Number(price)) } : {}),
    journey: {
      work_name: workName, owner,
      ...(category === 'passenger' ? { kilometers: Number(kilometers), own_fuel: ownFuel } : {}),
      ...(withDriver && driver ? { driver: { id: driver.id, name: driver.name, kilometers: Number(driverKm) } } : {}),
    },
  } : undefined;
  const estimate: ProjectTransport = {
    id: '', vehicle: '', driver: '', notes: '', category, employment_type: group, trip_price: Number(price || 0),
    journey: { work_name: workName, owner: { id: '', name: '' }, kilometers: Number(kilometers || 0),
      own_fuel: ownFuel, ...(withDriver ? { driver: { id: '', name: '', kilometers: Number(driverKm || 0) } } : {}) },
  };
  const peopleOptions = (saved?: { id: string; name: string }) => <>
    <option value="">Выберите из персонала</option>
    {saved && !people.some(row => row.id === saved.id) && <option value={saved.id}>{saved.name}</option>}
    {people.map(row => <option key={row.id} value={row.id}>{row.full_name}</option>)}
  </>;

  return <PeoplePicker title={previous ? 'Изменить поездку' : 'Добавить автомобиль'} closeLabel="Закрыть форму транспорта" onClose={onClose}>
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault(); event.stopPropagation();
      if (draft) onSave({ ...draft, id: draft.id || newProjectId() });
    }}>
      <p className="text-sm text-gray-300">{workName}</p>
      {allowPassenger && <label className="block space-y-1 text-sm text-gray-300">Класс автомобиля
        <select className={input} value={category} onChange={event => {
          setCategory(event.target.value === 'passenger' ? 'passenger' : 'cargo');
          setVehicleId(''); setOwnerId(''); setSearch(''); setDriverKmOverride(undefined);
        }}>{Object.entries(GARAGE_CATEGORIES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      </label>}
      <div className="flex gap-2" role="group" aria-label="Группа автомобилей">
        {(['staff', 'freelance'] as const).map(value => <button key={value} type="button" aria-pressed={group === value}
          onClick={() => { if (group !== value) { setGroup(value); setVehicleId(''); setOwnerId(''); } }}
          className={`min-h-11 rounded-lg px-4 py-2 text-sm ${group === value ? 'bg-accent-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
          {GARAGE_GROUPS[value]}
        </button>)}
      </div>
      <input aria-label="Поиск автомобиля" placeholder="Название или номер" {...searchInputProps} value={search} onChange={event => setSearch(event.target.value)} className={input} />
      {loading && <p role="status" className="text-sm text-gray-400">Загрузка автомобилей…</p>}
      {error && <p role="alert" className="text-sm text-red-300">Не удалось загрузить автомобили из гаража.</p>}
      <div className="max-h-[24dvh] overflow-y-auto" role="group" aria-label="Автомобили">
        {visible.map(vehicle => <label key={vehicle.id} className="flex min-h-11 items-center gap-3 border-b border-gray-800 py-2 text-sm text-gray-200">
          <input type="radio" name="delivery-vehicle" checked={vehicle.id === vehicleId} onChange={() => { setVehicleId(vehicle.id); setOwnerId(''); }} className="h-4 w-4 shrink-0 accent-accent-500" />
          <span className="break-words">{vehicle.name} <span className="text-gray-400">{vehicle.plate_number}</span></span>
        </label>)}
        {!loading && !error && !visible.length && <p className="py-2 text-sm text-gray-400">Автомобили не найдены.</p>}
      </div>
      {vehicleName && <div className="space-y-3 border-t border-gray-800 pt-3">
        <p className="text-sm font-medium text-gray-200">{vehicleName}</p>
        {selected?.owner_id || (existingVehicle && !selected && owner) ? <p className="text-sm text-gray-300">Владелец: {owner?.name}</p> :
          <label className="block space-y-1 text-sm text-gray-300">Владелец автомобиля
            <select required className={input} value={ownerId} onChange={event => setOwnerId(event.target.value)}>{peopleOptions(previous?.journey?.owner)}</select>
          </label>}
        {category === 'cargo' ? <label className="block space-y-1 text-sm text-gray-300">Стоимость поездки, BYN
          <input type="number" required min="0" step="0.01" inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} className={input} />
        </label> : <>
          <label className="block space-y-1 text-sm text-gray-300">Километраж автомобиля, км
            <input type="number" required min="0" step="any" inputMode="decimal" value={kilometers} onChange={event => setKilometers(event.target.value)} className={input} />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-gray-200">
            <input type="checkbox" checked={ownFuel} onChange={event => setOwnFuel(event.target.checked)} className="h-4 w-4 accent-accent-500" />Свой бензин
          </label>
        </>}
        <div className="flex flex-wrap justify-between gap-1 text-sm">
          <span>Выплата владельцу · {category === 'cargo' ? (group === 'staff' ? '60%' : '100%') : `${money(passengerMileageRate(ownFuel))} BYN/км`}</span>
          <output className="font-semibold tabular-nums">{money(vehiclePayout(estimate))} BYN</output>
        </div>
        {!withDriver ? <button type="button" onClick={() => setWithDriver(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm text-accent-400">
          <Plus className="h-4 w-4" />Добавить водителя
        </button> : <fieldset className="space-y-3 rounded-lg border border-gray-700 p-3">
          <legend className="px-1 text-sm font-medium">Водитель</legend>
          <select required aria-label="Водитель" className={input} value={driverId} onChange={event => setDriverId(event.target.value)}>{peopleOptions(previousDriver)}</select>
          <label className="block space-y-1 text-sm text-gray-300">Километраж водителя, км
            <input required type="number" min="0" step="any" inputMode="decimal" value={driverKm} onChange={event => setDriverKmOverride(event.target.value)} className={input} />
          </label>
          <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{money(driverMileageRate)} BYN/км</span>
            <output className="font-semibold tabular-nums">{money(driverPayout(estimate))} BYN</output>
          </div>
          <button type="button" className="min-h-11 text-sm text-red-300" onClick={() => setWithDriver(false)}>Убрать водителя</button>
        </fieldset>}
        <button type="submit" disabled={!draft} className="min-h-11 w-full rounded-lg bg-accent-500 px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-accent-400 disabled:opacity-40">
          {previous ? 'Сохранить поездку' : 'Добавить автомобиль'}
        </button>
      </div>}
    </form>
  </PeoplePicker>;
}
