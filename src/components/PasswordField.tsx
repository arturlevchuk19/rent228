import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
export const accountInput = 'w-full min-h-11 min-w-0 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 disabled:opacity-50';
export const accountButton = 'rounded-lg min-h-11 bg-accent-500 px-4 py-2.5 text-sm font-semibold text-gray-950 hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-50';
export function PasswordField({ label, value, onChange, autoComplete = 'new-password', disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; autoComplete?: string; disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <label className="block space-y-2 text-sm text-gray-300"><span>{label}</span><span className="relative block">
    <input type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} disabled={disabled} required className={`${accountInput} pr-12`} />
    <button type="button" aria-label={visible ? `Скрыть: ${label}` : `Показать: ${label}`} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:text-white">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
  </span></label>;
}
