import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
export const accountInput = 'w-full min-w-0 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50';
export const accountButton = 'rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50';
export function PasswordField({ label, value, onChange, autoComplete = 'new-password', disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; autoComplete?: string; disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <label className="block space-y-2 text-sm text-gray-300"><span>{label}</span><span className="relative block">
    <input type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} disabled={disabled} required className={`${accountInput} pr-11`} />
    <button type="button" aria-label={visible ? `Скрыть: ${label}` : `Показать: ${label}`} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-white">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
  </span></label>;
}
