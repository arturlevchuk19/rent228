import type { ReactNode } from 'react';
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|==[^=]+==)/g).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={index} className="font-semibold text-gray-100">{part.slice(2, -2)}</strong> : part.startsWith('==') && part.endsWith('==') ? <mark key={index} className="bg-amber-700/50 px-0.5 text-amber-100">{part.slice(2, -2)}</mark> : part);
}
export function ProjectText({ text, empty = 'Пока не заполнено.' }: { text: string; empty?: string }) {
  if (!text.trim()) return <p className="text-sm text-gray-500">{empty}</p>;
  return <div className="space-y-2 break-words text-sm leading-relaxed text-gray-300">{text.split('\n').map((line, index) => {
    const heading = line.match(/^#{1,3}\s+(.+)/);
    if (heading) return <h3 key={index} className="pt-2 text-base font-semibold text-gray-100">{inline(heading[1])}</h3>;
    if (/^[-*]\s+/.test(line)) return <p key={index} className="pl-3">• {inline(line.replace(/^[-*]\s+/, ''))}</p>;
    return line ? <p key={index}>{inline(line)}</p> : <div key={index} className="h-1" />;
  })}</div>;
}
