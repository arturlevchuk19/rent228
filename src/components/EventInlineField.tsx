import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EventInlineField({ label, icon: Icon, value, placeholder, options, disabled, onChange }: {
  label: string;
  icon: LucideIcon;
  value: string | null;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const text = options.find(option => option.value === value)?.label || placeholder;
  return <div className="flex w-fit max-w-full items-center gap-2 text-sm text-gray-300">
    <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" />
    {editing && !disabled ? <select autoFocus aria-label={label} value={value || ''}
      onChange={event => { onChange(event.target.value || null); setEditing(false); }}
      onBlur={() => setEditing(false)} onKeyDown={event => { if (event.key === 'Escape') setEditing(false); }}
      style={{ width: `${Math.max(12, text.length + 3)}ch` }}
      className="min-w-0 max-w-full rounded border border-gray-700 bg-gray-900 py-0.5 text-gray-200 outline-none focus:border-cyan-600">
      <option value="">{placeholder}</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select> : <button type="button" aria-label={label} disabled={disabled} onClick={() => setEditing(true)}
      className="min-w-0 border-b border-dashed border-gray-600 py-0.5 text-left [overflow-wrap:anywhere] hover:text-white disabled:cursor-default">{text}</button>}
  </div>;
}
