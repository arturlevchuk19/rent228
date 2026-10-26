import { useEffect, useRef, useState } from 'react';
import { getEvent, type Event } from '../lib/events';

export function useEventPageNavigation(enabled: boolean) {
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState<Event>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dirty = useRef(false);
  const request = useRef(0);
  const currentUrl = useRef(window.location.href);
  const discard = () => !dirty.current || window.confirm('Есть несохранённые изменения. Уйти со страницы?');
  useEffect(() => {
    if (!enabled) { setOpen(false); return; }
    let active = true;
    const sync = async () => {
      const sequence = ++request.current;
      const id = new URL(window.location.href).searchParams.get('event');
      currentUrl.current = window.location.href;
      dirty.current = false; setError('');
      if (!id) { setOpen(false); setEvent(undefined); setLoading(false); return; }
      setOpen(true); setEvent(undefined);
      if (id === 'new') { setLoading(false); return; }
      if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) { setLoading(false); setError('Некорректная ссылка на мероприятие.'); return; }
      setLoading(true);
      try { const data = await getEvent(id); if (active && sequence === request.current) setEvent(data); }
      catch { if (active && sequence === request.current) setError('Не удалось загрузить мероприятие. Проверьте доступ и обновите страницу.'); }
      finally { if (active && sequence === request.current) setLoading(false); }
    };
    const pop = () => {
      if (!discard()) { window.history.pushState({ eventPage: true }, '', currentUrl.current); return; }
      void sync();
    };
    const beforeUnload = (message: BeforeUnloadEvent) => { if (dirty.current) { message.preventDefault(); message.returnValue = ''; } };
    void sync();
    window.addEventListener('popstate', pop);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { active = false; window.removeEventListener('popstate', pop); window.removeEventListener('beforeunload', beforeUnload); };
  }, [enabled]);
  const openEvent = (selected?: Event) => {
    if (!enabled || !discard()) return;
    request.current++; dirty.current = false; setError(''); setLoading(false); setEvent(selected); setOpen(true);
    const url = new URL(window.location.href); url.searchParams.set('event', selected?.id || 'new');
    window.history.pushState({ ...window.history.state, eventPage: true }, '', url); currentUrl.current = url.href;
  };
  const clear = () => {
    request.current++; dirty.current = false; setOpen(false); setEvent(undefined); setError(''); setLoading(false);
    const url = new URL(window.location.href); url.searchParams.delete('event');
    window.history.replaceState({ ...window.history.state, eventPage: false }, '', url); currentUrl.current = url.href;
  };
  const close = () => {
    if (!discard()) return false;
    dirty.current = false;
    if (window.history.state?.eventPage) window.history.back(); else clear();
    return true;
  };
  return {
    open, event, loading, error, openEvent, close,
    setDirty: (value: boolean) => { dirty.current = value; },
    navigateAway: () => { if (!discard()) return false; clear(); return true; },
    saved: (id?: string) => {
      dirty.current = false;
      if (!id || !open) return;
      const url = new URL(window.location.href); url.searchParams.set('event', id);
      window.history.replaceState(window.history.state, '', url); currentUrl.current = url.href;
    },
  };
}
