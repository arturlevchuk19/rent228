import { useEffect, useState } from 'react';

const pages = new Set([
  'my-claims', 'calendar', 'dashboard', 'equipment', 'events', 'contacts', 'payments',
  'personnel-report', 'staff', 'templates', 'logistics', 'users', 'settings',
]);

const readPage = () => {
  const page = new URL(window.location.href).searchParams.get('page');
  return page === 'calendar' ? 'events' : page && pages.has(page) ? page : 'events';
};

const readSpecification = () => {
  const params = new URL(window.location.href).searchParams;
  const eventId = params.get('specification');
  return eventId === null ? null : { eventId, budgetId: params.get('specificationBudget') ?? undefined };
};

export function usePageNavigation() {
  const [currentPage, setCurrentPage] = useState(readPage);
  const [specification, setSpecification] = useState(readSpecification);

  useEffect(() => {
    // Event navigation may restore the URL when the user declines to discard edits.
    // Read it after every popstate handler has had a chance to run.
    let active = true;
    const sync = () => queueMicrotask(() => {
      if (!active) return;
      setCurrentPage(readPage());
      setSpecification(readSpecification());
    });
    window.addEventListener('popstate', sync);
    return () => { active = false; window.removeEventListener('popstate', sync); };
  }, []);

  const navigate = (requestedPage: string) => {
    const page = requestedPage === 'calendar' ? 'events' : requestedPage;
    if (!pages.has(page)) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('page') !== page || url.searchParams.has('specification')) {
      url.searchParams.set('page', page);
      url.searchParams.delete('specification');
      url.searchParams.delete('specificationBudget');
      window.history.pushState({ ...window.history.state, eventPage: false, specificationPage: false }, '', url);
    }
    setCurrentPage(page);
    setSpecification(null);
  };

  const openSpecification = (eventId: string, budgetId?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('specification', eventId);
    if (budgetId) url.searchParams.set('specificationBudget', budgetId);
    else url.searchParams.delete('specificationBudget');
    if (url.href === window.location.href) return;
    window.history.pushState({ ...window.history.state, specificationPage: true }, '', url);
    setSpecification({ eventId, budgetId });
  };

  const closeSpecification = () => {
    if (window.history.state?.specificationPage) {
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('specification');
    url.searchParams.delete('specificationBudget');
    window.history.replaceState(window.history.state, '', url);
    setSpecification(null);
  };

  return { currentPage, navigate, specification, openSpecification, closeSpecification };
}
