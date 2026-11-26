import { ChevronDown } from 'lucide-react';
import { sumClaimAmounts, type ClaimLine, type EmployeeClaim } from '../lib/employeeClaims';

const money = (amount: number) => amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function accountingMonth(value: string) {
  const date = new Date(value);
  return Number.isFinite(+date) ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Minsk', year: 'numeric', month: '2-digit' }).format(date) : '';
}

export function AccountingExpenseGroups({ claims, onOpen }: { claims: EmployeeClaim[]; onOpen: (claim: EmployeeClaim) => void }) {
  const approved = claims.filter(claim => claim.state === 'approved' || claim.state === 'paid');
  const groups: { label: string; matches: (line: ClaimLine) => boolean }[] = [
    { label: 'Подтверждённые работы по заявкам', matches: line => ['time', 'trip', 'warehouse'].includes(line.kind) },
    { label: 'Расходы', matches: line => line.kind === 'allowance' },
    { label: 'Хозрасходы', matches: line => line.kind === 'expense' },
  ];
  return <div className="space-y-2">{groups.map(({ label, matches }) => {
    const rows = approved.flatMap(claim => claim.lines.flatMap((line, index) => matches(line) ? [{ claim, line, index }] : []));
    if (!rows.length) return null;
    const amount = sumClaimAmounts(rows.map(({ line }) => Number(line.amount) || 0));
    return <details key={label} className="group rounded-xl border border-gray-800 bg-gray-900">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2"><ChevronDown className="h-4 w-4 -rotate-90 group-open:rotate-0" />{label}</span>
        <span className="tabular-nums">{money(amount)} BYN</span>
      </summary>
      <ul className="divide-y divide-gray-800 border-t border-gray-800 px-3">{rows.map(({ claim, line, index }) => <li key={`${claim.id}:${index}`}>
        <button type="button" onClick={() => onOpen(claim)} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 py-2 text-left text-sm">
          <span className="min-w-0 break-words">{claim.employee_name}<span className="block text-xs text-gray-400">{line.description || line.work_name || label}</span></span>
          <span className="shrink-0 text-right tabular-nums">{money(Number(line.amount) || 0)} BYN<span className="block text-xs text-gray-400">{claim.state === 'paid' ? `Выплачено${claim.paid_at ? ` · ${new Date(claim.paid_at).toLocaleDateString('ru-RU', { timeZone: 'Europe/Minsk' })}` : ''}` : 'Утверждено'}</span></span>
        </button>
      </li>)}</ul>
    </details>;
  })}</div>;
}
