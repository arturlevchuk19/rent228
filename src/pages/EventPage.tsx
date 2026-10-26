import { ArrowLeft } from 'lucide-react';
import { EventForm } from '../components/EventForm';
import type { Event } from '../lib/events';
export function EventPage({ event, loading, error, onBack, onSave, onDirtyChange, onSpecificationOpen, onDeleted }: {
  event?: Event; loading: boolean; error: string; onBack: (eventId?: string) => void;
  onSave: (eventId?: string) => void; onDirtyChange: (dirty: boolean) => void;
  onSpecificationOpen: (eventId: string) => void; onDeleted: () => void;
}) {
  if (loading || error) return <div className="mx-auto max-w-5xl space-y-4"><button type="button" onClick={() => onBack()} className="flex items-center gap-2 text-sm text-gray-400"><ArrowLeft className="h-4 w-4" />Назад</button><p role={error ? 'alert' : 'status'} className="rounded-xl border border-gray-800 p-6 text-gray-400">{error || 'Загрузка мероприятия...'}</p></div>;
  return <EventForm event={event} presentation="page" onClose={onBack} onSave={onSave} onDirtyChange={onDirtyChange} onSpecificationOpen={onSpecificationOpen} onDeleted={onDeleted} />;
}
