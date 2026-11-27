import { InstallAppButton } from './InstallAppButton';
import { MobileHeaderContext } from './MobileHeaderContent';
import React, { useState, useSyncExternalStore, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../contexts/authContext';
import { canAccess, ROLE_NAMES, type AppModule } from '../lib/roles';
import { AccountDialog } from './AccountDialog';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
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

const menuGroups: { label: string; items: { id: AppModule | 'my-claims'; label: string; icon: LucideIcon }[] }[] = [
  { label: 'Работа', items: [
    { id: 'dashboard', label: 'Главная', icon: LayoutDashboard },
    { id: 'events', label: 'Мероприятия', icon: Calendar },
    { id: 'templates', label: 'Шаблоны для сметы', icon: FileText },
  ] },
  { label: 'Ресурсы', items: [
    { id: 'equipment', label: 'Оборудование', icon: Package },
    { id: 'logistics', label: 'Гараж', icon: Truck },
    { id: 'staff', label: 'Персонал', icon: Users },
    { id: 'contacts', label: 'Справочники', icon: Users },
  ] },
  { label: 'Финансы', items: [
    { id: 'my-claims', label: 'Мои начисления', icon: DollarSign },
    { id: 'payments', label: 'Бухгалтерия', icon: DollarSign },
    { id: 'personnel-report', label: 'Отчет по выплатам', icon: FileText },
  ] },
  { label: 'Управление', items: [
    { id: 'users', label: 'Пользователи', icon: Users },
    { id: 'settings', label: 'Настройки', icon: Settings },
  ] },
];

const menuItems = menuGroups.flatMap(group => group.items);

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  pageHeading?: string;
  onPageBack?: () => void;
  onNavigate: (page: string) => void;
}

export function Layout({ children, currentPage, onNavigate, pageHeading, onPageBack }: LayoutProps) {
  const { user } = useAuth();
  const [accountTab, setAccountTab] = useState<'profile' | 'users' | 'roles' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTitle, setMobileTitle] = useState<HTMLDivElement | null>(null);
  const [mobileActions, setMobileActions] = useState<HTMLDivElement | null>(null);

  const [mobileAfterTitle, setMobileAfterTitle] = useState<HTMLDivElement | null>(null);
  const [pageAfterTitle, setPageAfterTitle] = useState<HTMLDivElement | null>(null);
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

  const availableGroups = menuGroups.map(({ label, items }) => ({
    label,
    items: items.filter(({ id }) => id === 'my-claims'
      ? user.status === 'active'
      : canAccess(user, id) || (id === 'events' && canAccess(user, 'calendar'))),
  })).filter(group => group.items.length > 0);
  const heading = pageHeading || menuItems.find(item => item.id === currentPage)?.label || 'Главная';

  return (
    <MobileHeaderContext.Provider value={{ active: !pageOpen, title: mobile ? mobileTitle : pageTitle, actions: mobile ? mobileActions : pageActions, afterTitle: mobile ? mobileAfterTitle : pageAfterTitle }}>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-accent-500 focus:px-4 focus:py-3 focus:text-gray-950">Перейти к содержимому</a>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-950">
      <div className="relative z-20 flex h-14 shrink-0 border-b border-gray-800 bg-gray-900">
        <div className="hidden w-64 shrink-0 items-center border-r border-gray-800 px-6 lg:flex">
          <span className="text-lg font-bold text-white">RentMaster</span>
        </div>
        <header className="flex min-w-0 flex-1 items-center justify-between gap-2 px-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            {onPageBack ? (
              <button type="button" onClick={onPageBack} aria-label="Назад" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-gray-800">
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              </button>
            ) : (
              <button
                aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
                aria-expanded={mobileMenuOpen}
                aria-controls="main-navigation"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white lg:hidden"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            )}
            <div ref={setMobileTitle} className="flex min-w-0 flex-1 items-center gap-2 sm:hidden">
              <h1 className={`min-w-0 truncate text-base font-semibold text-white ${onPageBack || (!pageOpen && currentPage === 'payments') ? '' : 'flex-1'}`}>{heading}</h1>
              <div ref={setMobileAfterTitle} className="flex shrink-0 items-center" />
            </div>
            <div className="hidden min-w-0 flex-1 items-center gap-4 sm:flex">
              <h1 className="truncate text-xl font-semibold text-white">{heading}</h1>
              <div ref={setPageAfterTitle} className="flex shrink-0 items-center" />
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
            <button onClick={() => setAccountTab('profile')} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-accent-400" title="Мой профиль" aria-label="Мой профиль">
              <UserRound className="h-5 w-5" />
            </button>
          </div>
        </header>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-10 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        <aside
          className={`
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
            fixed lg:relative top-14 lg:top-0 left-0 h-[calc(100dvh-3.5rem)] lg:h-full
            w-64 bg-gray-900 border-r border-gray-800
            z-20 lg:z-auto flex-shrink-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
            transition-transform duration-200 ease-in-out
          `}
        >
          <nav id="main-navigation" aria-label="Главное меню" className="divide-y divide-gray-800 px-3 pb-5 pt-1">
            {availableGroups.map(({ label, items }) => (
              <div key={label} role="group" aria-label={label} className="space-y-0.5 py-2">
                <p className="px-3 pb-1 pt-0.5 text-xs font-semibold text-gray-400">{label}</p>
                {items.map(({ id, label: itemLabel, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    aria-current={currentPage === id ? 'page' : undefined}
                    onClick={() => {
                      if (id === 'users') setAccountTab('users');
                      else onNavigate(id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 lg:min-h-10 ${
                      currentPage === id
                        ? 'bg-accent-500/10 text-accent-300 ring-1 ring-inset ring-accent-700/60'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">{itemLabel}</span>
                  </button>
                ))}
              </div>
            ))}
            <div className="pt-2"><InstallAppButton /></div>
          </nav>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main id="main-content" tabIndex={-1} ref={main} onScroll={() => { if (!pageOpen && main.current) listScroll.current = main.current.scrollTop; }} className={`min-h-0 min-w-0 flex-1 ${onPageBack ? 'overflow-clip overscroll-none px-2 pt-1 sm:px-4 lg:px-6' : currentPage === 'events' && !pageOpen ? 'overflow-hidden p-2 sm:p-4 lg:p-6' : pageOpen ? 'overflow-x-hidden overflow-y-auto px-4 pb-4 pt-1 lg:px-6 lg:pb-6' : 'overflow-x-hidden overflow-y-auto p-4 lg:p-6'}`}>
          {children}
        </main>
        </div>
      </div>
    </div>
    {accountTab && <AccountDialog initialTab={accountTab} onClose={() => setAccountTab(null)} />}
    </MobileHeaderContext.Provider>
  );
}
