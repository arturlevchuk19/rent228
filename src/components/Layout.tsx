import { InstallAppButton } from './InstallAppButton';
import { MobileHeaderContext } from './MobileHeaderContent';
import React, { useState, useSyncExternalStore, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../contexts/authContext';
import { canAccess, ROLE_NAMES, type AppModule } from '../lib/roles';
import { AccountDialog } from './AccountDialog';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FileText,
  Package,
  Calendar,
  Users,
  Settings,
  UserRound,
  Menu,
  X,
  Truck,
  DollarSign,
} from 'lucide-react';

const subscribeToViewport = (onChange: () => void) => {
  const query = window.matchMedia('(max-width: 639px)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const isMobileViewport = () => window.matchMedia('(max-width: 639px)').matches;

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  pageHeading?: string;
  onNavigate: (page: string) => void;
}

export function Layout({ children, currentPage, onNavigate, pageHeading }: LayoutProps) {
  const { user } = useAuth();
  const [accountTab, setAccountTab] = useState<'profile' | 'users' | 'roles' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTitle, setMobileTitle] = useState<HTMLDivElement | null>(null);
  const [mobileActions, setMobileActions] = useState<HTMLDivElement | null>(null);

  const [pageTitle, setPageTitle] = useState<HTMLDivElement | null>(null);
  const [pageActions, setPageActions] = useState<HTMLDivElement | null>(null);
  const mobile = useSyncExternalStore(subscribeToViewport, isMobileViewport, () => false);

  const main = useRef<HTMLElement>(null);
  const listScroll = useRef(0);
  const pageOpen = !!pageHeading;
  useLayoutEffect(() => {
    if (main.current) main.current.scrollTop = pageOpen ? 0 : listScroll.current;
  }, [pageOpen]);

  if (!user) return null;

  const menuItems: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
  }> = [
    { id: 'calendar', label: 'Календарь', icon: Calendar },
    { id: 'dashboard', label: 'Главная', icon: LayoutDashboard },
    { id: 'templates', label: 'Шаблоны для сметы', icon: Package },
    { id: 'equipment', label: 'Оборудование', icon: Package },
    { id: 'events', label: 'Мероприятия', icon: Calendar },
    { id: 'contacts', label: 'Справочники', icon: Users },
    { id: 'logistics', label: 'Логистика', icon: Truck },
    { id: 'payments', label: 'Выплаты', icon: DollarSign },
    { id: 'personnel-report', label: 'Отчет по выплатам', icon: FileText },
    { id: 'staff', label: 'Персонал', icon: Users },
    { id: 'users', label: 'Пользователи', icon: Users },
    { id: 'settings', label: 'Настройки', icon: Settings },
  ];

  const availableMenuItems = menuItems.filter((item) =>
    canAccess(user, item.id as AppModule)
  );

  return (
    <MobileHeaderContext.Provider value={{ active: !pageOpen, title: mobile ? mobileTitle : pageTitle, actions: mobile ? mobileActions : pageActions }}>
    <div className="h-dvh flex flex-col bg-black overflow-hidden">
      <div className="relative z-20 flex h-14 shrink-0 border-b border-gray-800 bg-gray-900">
        <div className="hidden w-64 shrink-0 items-center border-r border-gray-800 px-6 lg:flex">
          <span className="text-lg font-bold text-white">RentMaster</span>
        </div>
        <header className="flex min-w-0 flex-1 items-center justify-between gap-2 px-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <button
              aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <div ref={setMobileTitle} className="min-w-0 flex-1 sm:hidden">
              {(currentPage !== 'calendar' || pageOpen) && <h1 className="truncate text-base font-semibold text-white">{pageHeading || menuItems.find(item => item.id === currentPage)?.label || 'Главная'}</h1>}
            </div>
            <div className="hidden min-w-0 flex-1 items-center gap-4 sm:flex">
              <h1 className="truncate text-xl font-semibold text-white">{pageHeading || menuItems.find(item => item.id === currentPage)?.label || 'Главная'}</h1>
              <div ref={setPageTitle} className="min-w-0 shrink-0" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <div ref={setMobileActions} className="flex items-center gap-1 sm:hidden" />
            <div ref={setPageActions} className="hidden shrink-0 items-center gap-2 sm:flex" />
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight text-white">{user.full_name}</p>
              <p className="text-xs leading-tight text-gray-400">{user.role_name || ROLE_NAMES[user.role]}</p>
            </div>
            <button onClick={() => setAccountTab('profile')} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-cyan-400" title="Мой профиль" aria-label="Мой профиль">
              <UserRound className="h-5 w-5" />
            </button>
          </div>
        </header>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-10 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        <aside
          className={`
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
            fixed lg:relative top-14 lg:top-0 left-0 h-[calc(100vh-3.5rem)] lg:h-full
            w-64 bg-gray-900 border-r border-gray-800
            z-20 lg:z-auto flex-shrink-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
            transition-transform duration-200 ease-in-out
          `}
        >
          <nav className="p-3 space-y-0.5">
            {availableMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'users') setAccountTab('users');
                    else onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg
                    transition-colors
                    ${
                      isActive
                        ? 'bg-cyan-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main ref={main} onScroll={() => { if (!pageOpen && main.current) listScroll.current = main.current.scrollTop; }} className={`min-h-0 min-w-0 flex-1 overflow-x-hidden ${currentPage === 'calendar' && !pageOpen ? 'overflow-hidden p-2 sm:p-4 lg:p-6' : pageOpen ? 'overflow-y-auto px-4 pb-4 pt-1 lg:px-6 lg:pb-6 lg:pt-1' : 'overflow-y-auto p-4 lg:p-6'}`}>
          {children}
        </main>
        </div>
      </div>
    </div>
    {!pageOpen && currentPage === 'calendar' && <InstallAppButton />}
    {accountTab && <AccountDialog initialTab={accountTab} onClose={() => setAccountTab(null)} />}
    </MobileHeaderContext.Provider>
  );
}
