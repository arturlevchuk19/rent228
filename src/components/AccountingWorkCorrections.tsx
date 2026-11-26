import { useEffect, useState } from 'react';
import { driverMileagePayout, personWorkAmount, vehiclePayout } from '../lib/eventPeople';
import type { ProjectPerson, ProjectTransport, TransportDriver } from '../lib/eventProject';
import { getErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/authContext';
import { accountingMonth, AccountingExpenseGroups } from './AccountingExpenseGroups';
import type { ClaimEvent, ClaimLine, EmployeeClaim } from '../lib/employeeClaims';
import { PeoplePicker } from './PeoplePicker';

const input = 'block min-h-11 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-base text-gray-100';
const button = 'min-h-11 rounded-lg border border-gray-700 px-3 py-2 text-sm text-accent-300 hover:bg-gray-800 disabled:opacity-50';
const money = (amount: number) => amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
type Assignment = { event_id: string; event_date: string; event_name: string; work_name: string; target_id: string } & (
  { kind: 'person'; item: ProjectPerson; part: ProjectPerson } |
  { kind: 'driver'; item: { vehicle: string }; part: TransportDriver } |
  { kind: 'owner'; item: ProjectTransport; part: { id: string; name: string } }
);
type Correction = {
  id: string; employee_name: string; event_name: string; work_name: string; review_note: string;
  state: 'submitted' | 'approved' | 'rejected'; created_at: string; archived_at: string | null;
  target_kind: Assignment['kind'] | 'claim'; original: { lines?: ClaimLine[] }; proposal: Record<string, string | number | ClaimLine[]>;
};
const amountFor = (row: Assignment) => row.kind === 'person' ? personWorkAmount(row.item)
  : row.kind === 'driver' ? driverMileagePayout(row.part.kilometers) : vehiclePayout(row.item);

export function PersonalAccountingWork({ refresh, claims, events, onOpenClaim }: { refresh: number; claims: EmployeeClaim[]; events: ClaimEvent[]; onOpenClaim: (claim: EmployeeClaim) => void }) {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [editing, setEditing] = useState<Assignment>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    supabase.rpc('accounting_my_work').then(({ data, error }) => {
      if (!active) return;
      if (error) setError(getErrorMessage(error));
      else { setError(''); setRows(data ?? []); }
    });
    return () => { active = false; };
  }, [refresh]);
  const groups = new Map<string, Assignment[]>();
  for (const row of rows) {
    const group = groups.get(row.event_id) ?? [];
    group.push(row);
    groups.set(row.event_id, group);
  }
  const approved = claims.filter(row => row.event_id && ['approved','paid'].includes(row.state));
  for (const claim of approved) if (claim.event_id && !groups.has(claim.event_id)) groups.set(claim.event_id, []);
  return <section className="space-y-2">
    <h2 className="font-semibold">Мои начисления по мероприятиям</h2>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-gray-300">{notice}</p>}
    {!error && !groups.size && <p className="text-sm text-gray-400">Начислений пока нет.</p>}
    {[...groups].map(([id, works]) => {
      const confirmed = approved.filter(row => row.event_id === id);
      const event = events.find(row => row.id === id);
      const amount = works.reduce((total, row) => total + amountFor(row), 0) + confirmed.reduce((total, row) => total + row.work_amount, 0);
      return <details key={id} className="rounded-xl border border-gray-800 bg-gray-900">
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">{event?.name ?? works[0]?.event_name ?? confirmed[0]?.event_name} · {event?.event_date ?? works[0]?.event_date ?? ''} · {money(amount)} BYN</summary>
        <div className="space-y-2 px-3 pb-3">
          <ul className="divide-y divide-gray-800">{works.map(row => <li key={`${row.kind}:${row.target_id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>{row.work_name || 'Работа'}{row.kind !== 'person' && ` · ${row.kind === 'owner' ? 'Автомобиль' : 'Водитель'} · ${row.item.vehicle}`}
              <span className="block text-gray-300">{money(amountFor(row))} BYN</span></span>
            <button type="button" className={button} onClick={() => setEditing(row)}>Предложить правку</button>
          </li>)}</ul>
          <AccountingExpenseGroups claims={confirmed} onOpen={onOpenClaim} />
        </div>
      </details>;
    })}
    {editing && <ProposalForm assignment={editing} onClose={() => setEditing(undefined)} onSaved={() => {
      setEditing(undefined); setNotice('Правка отправлена. Её статус появится во вкладке «Модерация».');
    }} />}
  </section>;
}

function ProposalForm({ assignment: row, onClose, onSaved }: { assignment: Assignment; onClose: () => void; onSaved: () => void }) {
  const person = row.kind === 'person' ? row.item : undefined;
  const trip = row.kind === 'driver' || (row.kind === 'owner' && row.item.category === 'passenger') || Boolean(person?.trip);
  const timed = Boolean(person && !trip && (person.starts_at || person.ends_at || !person.hours));
  const initialKm = row.kind === 'driver' ? row.part.kilometers : row.kind === 'owner' ? row.item.journey?.kilometers : person?.trip?.kilometers;
  const [km, setKm] = useState(initialKm?.toString() ?? '');
  const [start, setStart] = useState(person?.starts_at ?? '');
  const [end, setEnd] = useState(person?.ends_at ?? '');
  const [hours, setHours] = useState(person?.hours ?? '');
  const [amount, setAmount] = useState(row.kind === 'owner' && !trip ? String(row.item.trip_price ?? 0) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <PeoplePicker title="Предложить правку" onClose={busy ? () => {} : onClose}>
    <form className="space-y-3" onSubmit={async event => {
      event.preventDefault(); event.stopPropagation();
      if (busy) return;
      setBusy(true); setError('');
      try {
        const { error } = await supabase.rpc('accounting_submit_work_correction', {
          p_event: row.event_id, p_kind: row.kind, p_target: row.target_id,
          p_original: row.kind === 'driver' ? row.part : row.item,
          p_proposal: { ...(trip ? { kilometers: km } : timed ? { starts_at: start, ends_at: end } : person ? { hours } : {}),
            ...(amount.trim() !== '' ? { amount } : {}) },
        });
        if (error) throw error;
        onSaved();
      } catch (caught) { setError(getErrorMessage(caught)); }
      finally { setBusy(false); }
    }}>
      <p className="text-sm text-gray-300">{row.event_name} · {row.work_name}</p>
      {trip && <label className="block text-sm">Километраж, км<input type="number" min="0.01" step="any" required className={input} value={km} onChange={e => setKm(e.target.value)} /></label>}
      {timed && <><label className="block text-sm">Начало<input type="datetime-local" required className={input} value={start} onChange={e => setStart(e.target.value)} /></label>
        <label className="block text-sm">Окончание<input type="datetime-local" required className={input} value={end} onChange={e => setEnd(e.target.value)} /></label></>}
      {person && !trip && !timed && <label className="block text-sm">Часы<input type="number" min="0.01" step="any" required className={input} value={hours} onChange={e => setHours(e.target.value)} /></label>}
      {(person || !trip) && <label className="block text-sm">{person ? 'Предлагаемая сумма, BYN (необязательно)' : 'Стоимость поездки, BYN'}
        <input type="number" min="0" step="0.01" required={!person} className={input} value={amount} onChange={e => setAmount(e.target.value)} /></label>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button className={button} disabled={busy} type="submit">Отправить на проверку</button>
    </form>
  </PeoplePicker>;
}

const states = { submitted: 'На проверке', approved: 'Утверждена', rejected: 'Отклонена' };
const proposalLabels: Record<string, string> = { amount: 'Сумма', description: 'Назначение', starts_at: 'Начало', ends_at: 'Окончание', hours: 'Часы', kilometers: 'Километраж', rate: 'Ставка', trip_price: 'Стоимость поездки' };

export function AccountingWorkCorrections({ review, canReview = false, archived, month, onChanged }: {
  review: boolean; canReview?: boolean; archived: boolean; month?: string; onChanged: () => void;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Correction[]>([]);
  const [selected, setSelected] = useState<Correction>();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (!review && !user?.id) return;
    const query = supabase.from('accounting_work_corrections').select('*');
    (review ? query : query.eq('user_id', user!.id)).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) setError(getErrorMessage(error));
      else { setError(''); setRows(data ?? []); }
    });
    return () => { active = false; };
  }, [version, archived, review, user?.id]);
  const visible = rows.filter(row => (!month || accountingMonth(row.created_at) === month) &&
    (archived ? row.state !== 'submitted' : row.state === 'submitted' || (!review && !row.archived_at)));
  const act = async (row: Correction, action: 'approve' | 'reject' | 'archive') => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { error } = await supabase.rpc('accounting_review_work_correction', { p_id: row.id, p_action: action, p_note: action === 'archive' ? '' : note });
      if (error) throw error;
      setSelected(undefined); setVersion(value => value + 1); onChanged();
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setBusy(false); }
  };
  return <section className="space-y-2">
    <h2 className="font-semibold">Правки к начислениям</h2>
    {error && !selected && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {!visible.length && !error && <p className="text-sm text-gray-400">Правок в этом списке пока нет.</p>}
    {visible.map(row => <button key={row.id} type="button" className={`${button} block w-full text-left`}
      onClick={() => { setSelected(row); setNote(''); setError(''); }}>
      {review && `${row.employee_name} · `}{row.event_name} · {row.work_name}
      <span className="block text-xs text-gray-400">{states[row.state]}{row.review_note && ` · ${row.review_note}`}</span>
    </button>)}
    {selected && <PeoplePicker title={`Правка · ${states[selected.state]}`} onClose={busy ? () => {} : () => setSelected(undefined)}>
      <div className="space-y-3 text-sm">
        <p>{selected.employee_name} · {selected.event_name} · {selected.work_name}</p>
        {selected.target_kind === 'claim' && Array.isArray(selected.proposal.lines) ? <ol className="space-y-2">
          {selected.proposal.lines.map((line, index) => <li key={index} className="rounded-lg border border-gray-800 p-2">
            <p>{line.work_name || line.description || `Позиция ${index + 1}`}</p>
            <dl>{(['description','starts_at','ends_at','kilometers','amount','rate'] as const).filter(key =>
              line[key] !== selected.original.lines?.[index]?.[key] && line[key] !== undefined).map(key => <div key={key} className="flex flex-wrap gap-2">
                <dt className="text-gray-400">{proposalLabels[key] ?? key}</dt>
                <dd>{String(selected.original.lines?.[index]?.[key] ?? '—').replace('T',' ')} → {String(line[key]).replace('T',' ')}</dd>
              </div>)}</dl>
          </li>)}
        </ol> : <dl>{Object.entries(selected.proposal).map(([key, value]) => <div key={key} className="flex flex-wrap gap-2 py-1">
          <dt className="text-gray-400">{proposalLabels[key] ?? key}</dt><dd>{String(value).replace('T', ' ')}</dd>
        </div>)}</dl>}
        {selected.review_note && <p className="whitespace-pre-wrap">{selected.review_note}</p>}
        {canReview && selected.state === 'submitted' && <><label className="block">Комментарий<textarea className={input} value={note} onChange={e => setNote(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={() => void act(selected, 'approve')}>Утвердить</button>
            <button type="button" className={button} disabled={busy || !note.trim()} onClick={() => void act(selected, 'reject')}>Отклонить</button></div></>}
        {!review && selected.state !== 'submitted' && !selected.archived_at && <button type="button" className={button} disabled={busy} onClick={() => void act(selected, 'archive')}>Убрать в архив</button>}
        {error && <p role="alert" className="text-red-300">{error}</p>}
      </div>
    </PeoplePicker>}
  </section>;
}
