import { OfflineIndicator } from './components/OfflineIndicator';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { useEventPageNavigation } from './hooks/useEventPageNavigation';
import { usePageNavigation } from './hooks/usePageNavigation';
import { EventPage } from './pages/EventPage';
import { canAccess, type AppModule } from './lib/roles';
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/authContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Layout } from './components/Layout';
import { ClientForm } from './components/ClientForm';
import { VenueForm } from './components/VenueForm';
import { Client, Venue } from './lib/events';


const SpecificationPage = lazy(() => import('./components/WarehouseSpecification').then(m => ({ default: m.WarehouseSpecification })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Equipment = lazy(() => import('./pages/Equipment').then(m => ({ default: m.Equipment })));
const EventsWorkspace = lazy(() => import('./pages/EventsWorkspace').then(m => ({ default: m.EventsWorkspace })));
const Contacts = lazy(() => import('./pages/Contacts').then(m => ({ default: m.Contacts })));
const Garage = lazy(() => import('./pages/Garage'));
const Personnel = lazy(() => import('./pages/Personnel'));
const Accounting = lazy(() => import('./pages/EmployeeClaims').then(m => ({default:m.Accounting})));
const EmployeeClaims = lazy(() => import('./pages/EmployeeClaims').then(m => ({default:m.EmployeeClaims})));
const PersonnelPaymentsReport = lazy(() => import('./pages/PersonnelPaymentsReport'));
const Templates = lazy(() => import('./pages/Templates').then(m => ({ default: m.Templates })));

function PageFallback() {
  return <div className="flex min-h-64 items-center justify-center text-gray-400">Загрузка раздела...</div>;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { currentPage, navigate, specification, openSpecification, closeSpecification } = usePageNavigation();
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [venueFormOpen, setVenueFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client>();
  const [editingVenue, setEditingVenue] = useState<Venue>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastCreatedEventId, setLastCreatedEventId] = useState<string | null>(null);

  const pendingAccounting = useRef(new Set<string>());
  const reportPendingAccounting = useCallback((eventId: string, pending: boolean) => {
    if (pending) pendingAccounting.current.add(eventId);
    else pendingAccounting.current.delete(eventId);
  }, []);

  const eventPage = useEventPageNavigation(!!user && canAccess(user, 'events'));

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-xl">Загрузка...</div>;
  if (!user) return <>
    <OfflineIndicator />
    {authMode === 'login'
      ? <Login onSuccess={() => {}} onSwitchToRegister={() => setAuthMode('register')} />
      : <Register onSuccess={() => setAuthMode('login')} onSwitchToLogin={() => setAuthMode('login')} />}
  </>;

  const handleRefresh = (eventId?: string) => {
    setRefreshKey(value => value + 1);
    if (!eventId) setLastCreatedEventId(null);
  };
  const handleSpecificationOpen = (eventId: string, budgetId?: string) => {
    if (canAccess(user, 'specifications')) openSpecification(eventId, budgetId);
  };
  const validSpecificationId = (id: string) => /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id);

  const renderPage = () => {
    if (!(currentPage === 'my-claims' && user.status === 'active') && !canAccess(user, currentPage as AppModule) && !(currentPage === 'events' && canAccess(user, 'calendar'))) return <p className="rounded-lg border border-gray-800 p-6 text-sm text-gray-400">Нет доступа к этому разделу. Выберите доступный раздел в меню или откройте свой профиль.</p>;
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'templates': return <Templates />;
      case 'equipment': return <Equipment />;
      case 'events': return <EventsWorkspace key={user.id} refreshSignal={refreshKey} onEventFormOpen={eventPage.openEvent} onSpecificationOpen={handleSpecificationOpen} lastCreatedEventId={lastCreatedEventId} />;
      case 'contacts': return <Contacts refreshSignal={refreshKey} onClientFormOpen={client => { setEditingClient(client); setClientFormOpen(true); }} onVenueFormOpen={venue => { setEditingVenue(venue); setVenueFormOpen(true); }} />;
      case 'payments': return <Accounting key={user.id} refreshSignal={refreshKey} onPendingChange={reportPendingAccounting} />;
      case 'my-claims': return <EmployeeClaims key={user.id} />;
      case 'personnel-report': return <PersonnelPaymentsReport />;
      case 'staff': return <Personnel />;
      case 'logistics': return <Garage />;
      case 'users':
      case 'settings':
        return <div className="text-white"><h1 className="hidden text-3xl font-bold mb-4">{currentPage === 'users' ? 'Пользователи' : 'Настройки'}</h1><p className="text-gray-400">В разработке...</p></div>;
      default: return <Dashboard />;
    }
  };

  return <div className="flex h-dvh flex-col overflow-hidden overscroll-none">
    <OfflineIndicator />
    <Layout currentPage={currentPage} onPageBack={specification ? closeSpecification : undefined} pageHeading={specification ? 'Спецификация' : eventPage.open ? 'Мероприятие' : undefined} onNavigate={page => {
      if (currentPage === 'payments' && page !== currentPage && pendingAccounting.current.size &&
        !window.confirm('В бухгалтерии ещё есть несохранённые изменения. Покинуть раздел?')) return;
      if (!eventPage.open || eventPage.navigateAway()) navigate(page);
    }}>
      <div hidden={eventPage.open || !!specification} className="h-full"><PageErrorBoundary key={currentPage}><Suspense fallback={<PageFallback />}>{renderPage()}</Suspense></PageErrorBoundary></div>
      {eventPage.open && <div hidden={!!specification}><EventPage event={eventPage.event} loading={eventPage.loading} error={eventPage.error} onDirtyChange={eventPage.setDirty} onBack={eventId => { if (eventPage.close() && eventId && !eventPage.event) setLastCreatedEventId(eventId); }} onSave={eventId => { eventPage.saved(eventId); handleRefresh(eventId); }} onSpecificationOpen={handleSpecificationOpen} onDeleted={() => { eventPage.setDirty(false); eventPage.close(); handleRefresh(); }} /></div>}
      {specification && <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <PageErrorBoundary key={`${specification.eventId}:${specification.budgetId ?? ''}`}>
            <Suspense fallback={<PageFallback />}>
              {!canAccess(user, 'specifications')
                ? <p role="alert" className="p-4 text-sm text-gray-300">Нет доступа к спецификациям.</p>
                : !validSpecificationId(specification.eventId) || (specification.budgetId !== undefined && !validSpecificationId(specification.budgetId))
                  ? <p role="alert" className="p-4 text-sm text-gray-300">Некорректная ссылка на спецификацию.</p>
                  : <SpecificationPage eventId={specification.eventId} budgetId={specification.budgetId} />}
            </Suspense>
          </PageErrorBoundary>
        </div>
      </div>}
    </Layout>
    {clientFormOpen && <ClientForm client={editingClient} onClose={() => { setClientFormOpen(false); setEditingClient(undefined); }} onSave={handleRefresh} />}
    {venueFormOpen && <VenueForm venue={editingVenue} onClose={() => { setVenueFormOpen(false); setEditingVenue(undefined); }} onSave={handleRefresh} />}
  </div>;
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
