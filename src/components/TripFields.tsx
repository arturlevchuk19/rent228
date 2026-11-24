import type { ClaimLine } from '../lib/employeeClaims';

type TripValues = Pick<ClaimLine, 'kilometers' | 'own_car' | 'own_fuel'>;
export function TripFields({ value, onChange, inputClass, kilometersLabel, disabled = false }: {
  value: TripValues; onChange: (patch: Omit<TripValues, 'kilometers'> & { kilometers?: string }) => void; inputClass: string;
  kilometersLabel?: string; disabled?: boolean;
}) {
  return <>
    <p className="text-xs text-gray-400">Километраж подаёт водитель. Для личной машины и своего топлива отметьте соответствующие пункты.</p>
    <label className="block space-y-1 text-xs text-gray-400">Фактический километраж всей поездки, км
      <input aria-label={kilometersLabel} type="number" min="0" step="0.1" value={value.kilometers ?? ''} disabled={disabled}
        onChange={event => onChange({ kilometers: event.target.value })} className={inputClass} />
    </label>
    <div className="flex flex-wrap gap-4">
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value.own_car)} disabled={disabled}
          onChange={event => onChange({ own_car: event.target.checked })} className="h-4 w-4 accent-accent-500" />Своя машина
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value.own_fuel)} disabled={disabled}
          onChange={event => onChange({ own_fuel: event.target.checked })} className="h-4 w-4 accent-accent-500" />Своё топливо
      </label>
    </div>
  </>;
}
