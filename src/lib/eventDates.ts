export function displayEventDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
}

// Keep approximate dates with 00 supported by the existing event editor.
export function parseEventDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed)
    || /^(\d{2})(\d{2})(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const [, day, month, year] = match;
  const d = Number(day), m = Number(month), y = Number(year);
  if (y < 1000 || m > 12 || d > 31) return null;
  if (d && m && new Date(Date.UTC(y, m - 1, d)).getUTCDate() !== d) return null;
  return `${year}-${month}-${day}`;
}
