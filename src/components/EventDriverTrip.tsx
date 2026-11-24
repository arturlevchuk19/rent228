import { useEffect, useState } from 'react';
import { getClaimRates, lineEstimate, type ClaimRates } from '../lib/employeeClaims';
import type { ProjectTrip } from '../lib/eventProject';
import { TripFields } from './TripFields';

const emptyTrip: ProjectTrip = { kilometers: '', own_car: false, own_fuel: false };
const input = 'min-h-11 w-full min-w-0 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-accent-500';
const money = (value: number) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function EventDriverTrip({ initial, initialRate, showPrices, saveLabel, manual, onSave }: {
  initial?: ProjectTrip; initialRate?: string; showPrices: boolean; saveLabel: string; manual?: boolean;
  onSave: (trip: ProjectTrip, rate: string, name: string) => void;
}) {
  const [trip, setTrip] = useState(initial ?? emptyTrip);
  const [rate, setRate] = useState(initialRate);
  const [rates, setRates] = useState<ClaimRates>();
  const [error, setError] = useState(false);
  const [name, setName] = useState('');
  useEffect(() => {
    let active = true;
    getClaimRates().then(settings => { if (active) setRates(settings); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  const estimate = rates && lineEstimate({ kind: 'trip', ...trip, rate }, null, rates, rate !== undefined);
  const valid = !!estimate && Number(trip.kilometers) > 0 && Number.isFinite(Number(trip.kilometers)) &&
    (rate === undefined || (rate.trim() !== '' && Number.isFinite(Number(rate)) && Number(rate) >= 0)) &&
    (!manual || !!name.trim());

  return <form className="space-y-3" onSubmit={event => {
    event.preventDefault(); event.stopPropagation();
    if (valid) onSave({ ...trip, kilometers: String(Number(trip.kilometers)) }, String(estimate.rate), name.trim());
  }}>
    {manual && <label className="block space-y-1 text-xs text-gray-400">ФИО водителя
      <input required value={name} onChange={event => setName(event.target.value)} className={input} />
    </label>}
    <TripFields value={trip} inputClass={input} onChange={updates => {
      if (!('kilometers' in updates)) setRate(undefined);
      setTrip(current => ({ ...current, ...updates }));
    }} />
    {error && <p role="alert" className="text-sm text-red-300">Не удалось загрузить ставки из бухгалтерии. Закройте окно и попробуйте снова.</p>}
    {!rates && !error && <p role="status" className="text-sm text-gray-400">Загрузка ставки поездки…</p>}
    {showPrices && <label className="block space-y-1 text-xs text-gray-400">Ставка BYN/км
      <input type="number" min="0" step="0.01" inputMode="decimal" value={rate ?? estimate?.rate ?? ''} onChange={event => setRate(event.target.value)} className={input} />
    </label>}
    {showPrices && estimate && <p className="text-right text-sm tabular-nums">{trip.kilometers || 0} км × {money(estimate.rate)} BYN/км = <strong>{money(estimate.amount)} BYN</strong></p>}
    <button type="submit" disabled={!valid} className="min-h-11 w-full rounded-lg bg-accent-500 px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-accent-400 disabled:opacity-40">{saveLabel}</button>
  </form>;
}
