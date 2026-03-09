import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Equipment } from './pages/Equipment';
import { Events } from './pages/Events';
import { Contacts } from './pages/Contacts';
import Personnel from './pages/Personnel';
import Payments from './pages/Payments';
import PersonnelPaymentsReport from './pages/PersonnelPaymentsReport';
import { Templates } from './pages/Templates';
import { ClientForm } from './components/ClientForm';
import { VenueForm } from './components/VenueForm';
import { OrganizerForm } from './components/OrganizerForm';
import { EventForm } from './components/EventForm';
import { WarehouseSpecification } from './components/WarehouseSpecification';
import { Client, Venue, Organizer, Event, getEvent } from './lib/events';

function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentPage, setCurrentPage] = useState('dashboard');

  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [venueFormOpen, setVenueFormOpen] = useState(false);
  const [organizerFormOpen, setOrganizerFormOpen] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [editingVenue, setEditingVenue] = useState<Venue | undefined>();
  const [editingOrganizer, setEditingOrganizer] = useState<Organizer | undefined>();
  const [editingEvent, setEditingEvent] = useState<Event | undefined>();
  const [specificationEventId, setSpecificationEventId] = useState<string | null>(null);
  const [specificationEvent, setSpecificationEvent] = useState<Event | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return authMode === 'login' ? (
      <Login
        onSuccess={() => {}}
        onSwitchToRegister={() => setAuthMode('register')}
      />
    ) : (
      <Register
        onSuccess={() => setAuthMode('login')}
        onSwitchToLogin={() => setAuthMode('login')}
      />
    );
  }

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSpecificationOpen = async (eventId: string) => {
    try {
      const event = await getEvent(eventId);
      if (event) {
        setSpecificationEvent(event);
        setSpecificationEventId(eventId);
      }
    } catch (error) {
      console.error('Error loading event:', error);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'templates':
        return <Templates />;
      case 'equipment':
        return <Equipment />;
      case 'events':
        return (
          <Events
            key={refreshKey}
            onEventFormOpen={(event) => {
              setEditingEvent(event);
              setEventFormOpen(true);
            }}
            onSpecificationOpen={handleSpecificationOpen}
          />
        );
      case 'contacts':
        return (
          <Contacts
            refreshSignal={refreshKey}
            onClientFormOpen={(client) => {
              setEditingClient(client);
              setClientFormOpen(true);
            }}
            onVenueFormOpen={(venue) => {
              setEditingVenue(venue);
              setVenueFormOpen(true);
            }}
            onOrganizerFormOpen={(organizer) => {
              setEditingOrganizer(organizer);
              setOrganizerFormOpen(true);
            }}
          />
        );
      case 'logistics':
        return (
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-4">Логистика</h1>
            <p className="text-gray-400">В разработке...</p>
          </div>
        );
      case 'payments':
        return <Payments />;
      case 'personnel-report':
        return <PersonnelPaymentsReport />;
      case 'staff':
        return <Personnel />;
      case 'users':
        return (
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-4">Пользователи</h1>
            <p className="text-gray-400">В разработке...</p>
          </div>
        );
      case 'settings':
        return (
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-4">Настройки</h1>
            <p className="text-gray-400">В разработке...</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderPage()}
      </Layout>

      {clientFormOpen && (
        <ClientForm
          client={editingClient}
          onClose={() => {
            setClientFormOpen(false);
            setEditingClient(undefined);
          }}
          onSave={handleRefresh}
        />
      )}

      {venueFormOpen && (
        <VenueForm
          venue={editingVenue}
          onClose={() => {
            setVenueFormOpen(false);
            setEditingVenue(undefined);
          }}
          onSave={handleRefresh}
        />
      )}

      {organizerFormOpen && (
        <OrganizerForm
          organizer={editingOrganizer}
          onClose={() => {
            setOrganizerFormOpen(false);
            setEditingOrganizer(undefined);
          }}
          onSave={handleRefresh}
        />
      )}

      {eventFormOpen && (
        <EventForm
          event={editingEvent}
          onClose={() => {
            setEventFormOpen(false);
            setEditingEvent(undefined);
          }}
          onSave={handleRefresh}
        />
      )}

      {specificationEvent && specificationEventId && (
        <WarehouseSpecification
          eventId={specificationEventId}
          eventName={specificationEvent.name || 'Мероприятие'}
          onClose={() => {
            setSpecificationEventId(null);
            setSpecificationEvent(null);
          }}
        />
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
