import { canAccess, type AppModule } from './lib/roles';
import { lazy, Suspense, useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/authContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Layout } from './components/Layout';
import { ClientForm } from './components/ClientForm';
import { VenueForm } from './components/VenueForm';
import { EventForm } from './components/EventForm';
import { WarehouseSpecification } from './components/WarehouseSpecification';
import { Client, Venue, Event, getEvent } from './lib/events';

const Calendar = lazy(() => import('./pages/Calendar').then(m => ({ default: m.Calendar })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Equipment = lazy(() => import('./pages/Equipment').then(m => ({ default: m.Equipment })));
const Events = lazy(() => import('./pages/Events').then(m => ({ default: m.Events })));
const Contacts = lazy(() => import('./pages/Contacts').then(m => ({ default: m.Contacts })));
const Personnel = lazy(() => import('./pages/Personnel'));
const Payments = lazy(() => import('./pages/Payments'));
const PersonnelPaymentsReport = lazy(() => import('./pages/PersonnelPaymentsReport'));
const Templates = lazy(() => import('./pages/Templates').then(m => ({ default: m.Templates })));

function PageFallback() {
  return <div className="flex min-h-64 items-center justify-center text-gray-400">Загрузка раздела...</div>;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentPage, setCurrentPage] = useState('calendar');
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [venueFormOpen, setVenueFormOpen] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client>();
  const [editingVenue, setEditingVenue] = useState<Venue>();
  const [editingEvent, setEditingEvent] = useState<Event>();
  const [specificationEventId, setSpecificationEventId] = useState<string | null>(null);
  const [specificationEvent, setSpecificationEvent] = useState<Event | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastCreatedEventId, setLastCreatedEventId] = useState<string | null>(null);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-xl">Загрузка...</div>;
  if (!user) return authMode === 'login'
    ? <Login onSuccess={() => {}} onSwitchToRegister={() => setAuthMode('register')} />
    : <Register onSuccess={() => setAuthMode('login')} onSwitchToLogin={() => setAuthMode('login')} />;

  const handleRefresh = (eventId?: string) => {
    setRefreshKey(value => value + 1);
    if (!eventId) setLastCreatedEventId(null);
  };
  const handleSpecificationOpen = async (eventId: string) => {
    if (!canAccess(user, 'specifications')) return;
    try {
      const event = await getEvent(eventId);
      if (event) { setSpecificationEvent(event); setSpecificationEventId(eventId); }
    } catch (error) { console.error('Error loading event:', error); }
  };

  const renderPage = () => {
    if (!canAccess(user, currentPage as AppModule)) return <p className="rounded-lg border border-gray-800 p-6 text-sm text-gray-400">Нет доступа к этому разделу. Выберите доступный раздел в меню или откройте свой профиль.</p>;
    switch (currentPage) {
      case 'calendar': return <Calendar refreshSignal={refreshKey} onEventFormOpen={event => { if (canAccess(user, 'events')) { setEditingEvent(event); setEventFormOpen(true); } }} onSpecificationOpen={handleSpecificationOpen} />;
      case 'dashboard': return <Dashboard />;
      case 'templates': return <Templates />;
      case 'equipment': return <Equipment />;
      case 'events': return <Events refreshSignal={refreshKey} onEventFormOpen={event => { if (canAccess(user, 'events')) { setEditingEvent(event); setEventFormOpen(true); } }} onSpecificationOpen={handleSpecificationOpen} lastCreatedEventId={lastCreatedEventId} />;
      case 'contacts': return <Contacts refreshSignal={refreshKey} onClientFormOpen={client => { setEditingClient(client); setClientFormOpen(true); }} onVenueFormOpen={venue => { setEditingVenue(venue); setVenueFormOpen(true); }} />;
      case 'payments': return <Payments />;
      case 'personnel-report': return <PersonnelPaymentsReport />;
      case 'staff': return <Personnel />;
      case 'logistics':
      case 'users':
      case 'settings':
        return <div className="text-white"><h1 className="hidden text-3xl font-bold mb-4">{currentPage === 'logistics' ? 'Логистика' : currentPage === 'users' ? 'Пользователи' : 'Настройки'}</h1><p className="text-gray-400">В разработке...</p></div>;
      default: return <Dashboard />;
    }
  };

  return <>
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}><Suspense fallback={<PageFallback />}>{renderPage()}</Suspense></Layout>
    {clientFormOpen && <ClientForm client={editingClient} onClose={() => { setClientFormOpen(false); setEditingClient(undefined); }} onSave={handleRefresh} />}
    {venueFormOpen && <VenueForm venue={editingVenue} onClose={() => { setVenueFormOpen(false); setEditingVenue(undefined); }} onSave={handleRefresh} />}
    {eventFormOpen && <EventForm event={editingEvent} onClose={eventId => { setEventFormOpen(false); setEditingEvent(undefined); if (eventId && !editingEvent) setLastCreatedEventId(eventId); }} onSave={handleRefresh} onSpecificationOpen={handleSpecificationOpen} />}
    {specificationEvent && specificationEventId && <WarehouseSpecification eventId={specificationEventId} eventName={specificationEvent.name || 'Мероприятие'} onClose={() => { setSpecificationEventId(null); setSpecificationEvent(null); handleRefresh(); }} />}
  </>;
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
