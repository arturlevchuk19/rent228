import { useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { GARAGE_CATEGORIES, GARAGE_GROUPS, getEventGarageVehicles, type EventGarageVehicle } from '../lib/garage';
import { isPositiveMileage, journeyDrivers, newProjectId, type ProjectTransport, type TransportDriver, type TransportPayee } from '../lib/eventProject';
import { driverMileageRate, driverMileagePayout, moneyRound, passengerMileageRate, vehiclePayout, type PeopleDirectoryEntry } from '../lib/eventPeople';
import { searchInputProps } from '../lib/searchInput';
import { PeoplePicker } from './PeoplePicker';

const input = 'block min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950/50 px-3 py-2 text-base text-gray-200 focus:border-accent-500';
const money = (value: number) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const submit = 'min-h-11 w-full rounded-lg bg-accent-500 px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-accent-400';

type DeliveryFormProps = {
  workName: string; defaultCategory: EventGarageVehicle['category']; allowPassenger: boolean;
  previous?: ProjectTransport; people: PeopleDirectoryEntry[];
  onSave: (row: ProjectTransport) => void; onClose: () => void;
};
type DriverDraft = { key: string; person?: TransportPayee; kilometers?: string };

export function EventDeliveryVehicleForm({ workName, defaultCategory, allowPassenger, previous, people, onSave, onClose }: DeliveryFormProps) {
  const [vehicles, setVehicles] = useState<EventGarageVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState(previous?.category ?? defaultCategory);
  const [group, setGroup] = useState(previous?.employment_type ?? 'staff');
  const [vehicleId, setVehicleId] = useState(previous?.vehicle_id ?? '');
  const [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    getEventGarageVehicles().then(rows => { if (active) setVehicles(rows); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (vehicleId) {
    const selected = vehicles.find(row => row.id === vehicleId);
    const existingVehicle = previous?.vehicle_id === vehicleId ? previous : undefined;
    const owner = selected?.owner_id && selected.owner_name ? { id: selected.owner_id, name: selected.owner_name } : undefined;
    return <TripDetails key={vehicleId} workName={workName} people={people} previous={previous}
      vehicleId={vehicleId} vehicleName={selected ? [selected.name, selected.plate_number].filter(Boolean).join(' · ') : existingVehicle?.vehicle ?? ''}
      category={existingVehicle?.category ?? selected?.category ?? category}
      group={existingVehicle?.employment_type ?? selected?.employment_type ?? group}
      garageOwner={owner} onBack={() => setVehicleId('')} onClose={onClose} onSave={onSave} />;
  }

  const visible = vehicles.filter(vehicle => vehicle.category === category && vehicle.employment_type === group &&
    `${vehicle.name} ${vehicle.plate_number}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <PeoplePicker key="search" title="Выберите автомобиль" closeLabel="Закрыть поиск автомобиля" onClose={onClose}>
    <div className="space-y-3">
      {allowPassenger && <label className="block space-y-1 text-sm text-gray-300">Класс автомобиля
        <select className={input} value={category} onChange={event => {
          setCategory(event.target.value === 'passenger' ? 'passenger' : 'cargo'); setSearch('');
        }}>{Object.entries(GARAGE_CATEGORIES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      </label>}
      <div className="flex gap-2" role="group" aria-label="Группа автомобилей">
        {(['staff', 'freelance'] as const).map(value => <button key={value} type="button" aria-pressed={group === value}
          onClick={() => setGroup(value)}
          className={`min-h-11 rounded-lg px-4 py-2 text-sm ${group === value ? 'bg-accent-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
          {GARAGE_GROUPS[value]}
        </button>)}
      </div>
      <input autoFocus aria-label="Поиск автомобиля" placeholder="Название или номер" {...searchInputProps}
        value={search} onChange={event => setSearch(event.target.value)} className={input} />
      {loading && <p role="status" className="text-sm text-gray-400">Загрузка автомобилей…</p>}
      {error && <p role="alert" className="text-sm text-red-300">Не удалось загрузить автомобили из гаража.</p>}
      {!loading && !error && !visible.length && <p className="py-2 text-sm text-gray-400">Автомобили не найдены.</p>}
      <ul className="max-h-[40dvh] overflow-y-auto">
        {visible.map(vehicle => <li key={vehicle.id} className="border-b border-gray-800">
          <button type="button" onClick={() => setVehicleId(vehicle.id)} className="flex min-h-11 w-full flex-wrap items-center gap-x-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-800">
            <span className="break-words">{vehicle.name}</span><span className="text-gray-400">{vehicle.plate_number}</span>
          </button>
        </li>)}
      </ul>
    </div>
  </PeoplePicker>;
}

function TripDetails({ workName, people, previous, vehicleId, vehicleName, category, group, garageOwner, onBack, onClose, onSave }: {
  workName: string; people: PeopleDirectoryEntry[]; previous?: ProjectTransport;
  vehicleId: string; vehicleName: string; category: EventGarageVehicle['category']; group: EventGarageVehicle['employment_type'];
  garageOwner?: TransportPayee; onBack: () => void; onClose: () => void; onSave: (row: ProjectTransport) => void;
}) {
  const [price, setPrice] = useState(previous?.trip_price?.toString() ?? '');
  const [kilometers, setKilometers] = useState(previous?.journey?.kilometers?.toString() ?? '');
  const [ownFuel, setOwnFuel] = useState(previous?.journey?.own_fuel ?? false);
  const [owner, setOwner] = useState(previous?.vehicle_id === vehicleId ? previous.journey?.owner : undefined);
  const [drivers, setDrivers] = useState<DriverDraft[]>(() => journeyDrivers(previous?.journey).map((driver, index) => ({
    key: String(index), person: { id: driver.id, name: driver.name }, kilometers: String(driver.kilometers),
  })));
  const [error, setError] = useState('');
  const payee = (id: string) => {
    const entry = people.find(person => person.id === id);
    return entry && { id: entry.id, name: entry.full_name };
  };
  const driverKm = (driver: DriverDraft) => driver.kilometers ?? (category === 'passenger' ? kilometers : '');
  const updateDriver = (key: string, patch: Partial<DriverDraft>) => {
    setDrivers(current => current.map(driver => driver.key === key ? { ...driver, ...patch } : driver));
    setError('');
  };
  const resolvedOwner = garageOwner ?? owner;
  const trip = {
    id: previous?.id ?? '', vehicle_id: vehicleId, vehicle: vehicleName, category, employment_type: group,
    notes: previous?.notes ?? '', driver: '',
    ...(category === 'cargo' ? { trip_price: moneyRound(Number(price)) } : {}),
    journey: {
      work_name: workName,
      ...(resolvedOwner ? { owner: resolvedOwner } : {}),
      ...(category === 'passenger' ? { kilometers: Number(kilometers), own_fuel: ownFuel } : {}),
    },
  } satisfies ProjectTransport;
  const peopleOptions = (placeholder: string, saved?: TransportPayee, excluded = new Set<string>()) => <>
    <option value="">{placeholder}</option>
    {saved && !people.some(row => row.id === saved.id) && <option value={saved.id}>{saved.name}</option>}
    {people.filter(row => row.id === saved?.id || !excluded.has(row.id)).map(row => <option key={row.id} value={row.id}>{row.full_name}</option>)}
  </>;

  return <PeoplePicker title={previous ? 'Изменить поездку' : 'Новая поездка'} closeLabel="Закрыть форму поездки" onClose={onClose}>
    <form noValidate className="space-y-3" onSubmit={event => {
      event.preventDefault(); event.stopPropagation();
      if (!vehicleName) { setError('Выберите автомобиль.'); return; }
      if (category === 'cargo' && (price.trim() === '' || !Number.isFinite(Number(price)) || Number(price) < 0)) {
        setError('Укажите стоимость поездки.'); return;
      }
      if (category === 'passenger' && !isPositiveMileage(Number(kilometers))) { setError('Укажите пробег автомобиля больше нуля.'); return; }
      const savedDrivers: TransportDriver[] = [];
      for (const [index, row] of drivers.entries()) {
        const km = Number(driverKm(row));
        if (!row.person || !isPositiveMileage(km)) {
          setError(`Выберите водителя №${index + 1} и укажите его пробег больше нуля.`); return;
        }
        if (savedDrivers.some(driver => driver.id === row.person?.id)) {
          setError('Выберите разных водителей для одной поездки.'); return;
        }
        savedDrivers.push({ ...row.person, kilometers: km });
      }
      onSave({ ...trip, id: trip.id || newProjectId(), driver: savedDrivers.map(driver => driver.name).join(', '),
        journey: { ...trip.journey, drivers: savedDrivers } });
    }}>
      <div className="space-y-1 border-b border-gray-800 pb-3">
        <p className="break-words font-medium text-gray-100">{vehicleName}</p>
        <p className="text-sm text-gray-400">{workName} · {GARAGE_GROUPS[group]}</p>
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm text-accent-400">
          <ArrowLeft className="h-4 w-4" />Выбрать другой автомобиль
        </button>
      </div>
      {garageOwner ? <p className="text-sm text-gray-300">Владелец: {garageOwner.name}</p> :
        <label className="block space-y-1 text-sm text-gray-300">Владелец автомобиля
          <select className={input} value={owner?.id ?? ''} onChange={event => setOwner(payee(event.target.value))}>
            {peopleOptions('Не указан', owner)}
          </select>
        </label>}
      {category === 'cargo' ? <label className="block space-y-1 text-sm text-gray-300">Стоимость поездки, BYN
        <input type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={event => { setPrice(event.target.value); setError(''); }} className={input} />
      </label> : <>
        <label className="block space-y-1 text-sm text-gray-300">Километраж автомобиля, км
          <input type="number" min="0" step="any" inputMode="decimal" value={kilometers} onChange={event => { setKilometers(event.target.value); setError(''); }} className={input} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-gray-200">
          <input type="checkbox" checked={ownFuel} onChange={event => setOwnFuel(event.target.checked)} className="h-4 w-4 accent-accent-500" />Свой бензин
        </label>
      </>}
      <div className="flex flex-wrap justify-between gap-1 text-sm">
        <span>{resolvedOwner ? 'Выплата владельцу' : 'Затраты на автомобиль'} · {category === 'cargo'
          ? (group === 'staff' ? '60%' : '100%') : `${money(passengerMileageRate(ownFuel))} BYN/км`}</span>
        <output className="font-semibold tabular-nums">{money(vehiclePayout(trip))} BYN</output>
      </div>
      {drivers.map((driver, index) => {
        const selectedElsewhere = new Set(drivers.flatMap(other => other.key !== driver.key && other.person ? [other.person.id] : []));
        return <fieldset key={driver.key} className="space-y-3 rounded-lg border border-gray-700 p-3">
          <legend className="px-1 text-sm font-medium">Водитель {index + 1}</legend>
          <select aria-label={`Водитель ${index + 1}`} className={input} value={driver.person?.id ?? ''}
            onChange={event => updateDriver(driver.key, { person: payee(event.target.value) })}>
            {peopleOptions('Выберите из персонала', driver.person, selectedElsewhere)}
          </select>
          <label className="block space-y-1 text-sm text-gray-300">Километраж водителя, км
            <input type="number" min="0" step="any" inputMode="decimal" value={driverKm(driver)}
              onChange={event => updateDriver(driver.key, { kilometers: event.target.value })} className={input} />
          </label>
          <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{money(driverMileageRate)} BYN/км</span>
            <output className="font-semibold tabular-nums">{money(driverMileagePayout(Number(driverKm(driver))))} BYN</output>
          </div>
          <button type="button" className="min-h-11 text-sm text-red-300" onClick={() => {
            setDrivers(current => current.filter(row => row.key !== driver.key)); setError('');
          }}>Убрать водителя</button>
        </fieldset>;
      })}
      <button type="button" onClick={() => {
        setDrivers(current => [...current, { key: newProjectId() }]); setError('');
      }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm text-accent-400">
        <Plus className="h-4 w-4" />Добавить водителя
      </button>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button type="submit" className={submit}>Сохранить поездку</button>
    </form>
  </PeoplePicker>;
}
