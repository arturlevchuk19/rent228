import { useCallback, useEffect, useRef, useState } from 'react';
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
  const loadEvent = useCallback(async (id: string | null) => {
    const sequence = ++request.current;
    dirty.current = false;
    setError('');
    setEvent(undefined);
    setOpen(Boolean(id));
    if (!id || id === 'new') { setLoading(false); return; }
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) {
      setLoading(false);
      setError('Некорректная ссылка на мероприятие.');
      return;
    }
    setLoading(true);
    try {
      const data = await getEvent(id);
      if (sequence === request.current) setEvent(data);
    } catch {
      if (sequence === request.current) setError('Не удалось загрузить мероприятие. Проверьте доступ и обновите страницу.');
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!enabled) { setOpen(false); return; }
    const sync = () => {
      currentUrl.current = window.location.href;
      void loadEvent(new URL(currentUrl.current).searchParams.get('event'));
    };
    const pop = () => {
      // Opening or closing a specification over the same event keeps its editor mounted.
      const nextUrl = new URL(window.location.href);
      if (nextUrl.searchParams.get('event') === new URL(currentUrl.current).searchParams.get('event')) {
        currentUrl.current = nextUrl.href;
        return;
      }
      if (!discard()) { window.history.pushState({ eventPage: true }, '', currentUrl.current); return; }
      void sync();
    };
    const beforeUnload = (message: BeforeUnloadEvent) => { if (dirty.current) { message.preventDefault(); message.returnValue = ''; } };
    void sync();
    window.addEventListener('popstate', pop);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { request.current++; window.removeEventListener('popstate', pop); window.removeEventListener('beforeunload', beforeUnload); };
  }, [enabled, loadEvent]);
  const openEvent = (selected?: Event | string) => {
    if (!enabled || !discard()) return;
    const id = typeof selected === 'string' ? selected : selected?.id || 'new';
    const url = new URL(window.location.href);
    url.searchParams.set('event', id);
    window.history.pushState({ ...window.history.state, eventPage: true }, '', url);
    currentUrl.current = url.href;
    if (typeof selected === 'string') { void loadEvent(id); return; }
    request.current++; dirty.current = false; setError(''); setLoading(false); setEvent(selected); setOpen(true);
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
