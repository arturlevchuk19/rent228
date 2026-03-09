import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signOut, hasAccess } from '../lib/auth';
import {
  LayoutDashboard,
  FileText,
  Package,
  Calendar,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Truck,
  DollarSign,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const roleLabels: Record<string, string> = {
    superuser: 'Суперпользователь',
    admin: 'Администратор',
    clerk: 'Кладовщик',
    staff: 'Персонал',
    warehouse: 'Кладовщик',
  };

  const menuItems = [
    { id: 'dashboard', label: 'Главная', icon: LayoutDashboard, minRole: 'warehouse' },
    { id: 'templates', label: 'Шаблоны для сметы', icon: Package, minRole: 'admin' },
    { id: 'equipment', label: 'Оборудование', icon: Package, minRole: 'warehouse' },
    { id: 'events', label: 'Мероприятия', icon: Calendar, minRole: 'warehouse' },
    { id: 'contacts', label: 'Контакты', icon: Users, minRole: 'admin' },
    { id: 'logistics', label: 'Логистика', icon: Truck, minRole: 'clerk' },
    { id: 'payments', label: 'Выплаты', icon: DollarSign, minRole: 'admin' },
    { id: 'personnel-report', label: 'Отчет по выплатам', icon: FileText, minRole: 'admin' },
    { id: 'staff', label: 'Персонал', icon: Users, minRole: 'admin' },
    { id: 'users', label: 'Пользователи', icon: Users, minRole: 'admin' },
    { id: 'settings', label: 'Настройки', icon: Settings, minRole: 'admin' },
  ];

  const availableMenuItems = menuItems.filter((item) =>
    hasAccess(user, item.minRole as any)
  );

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
              <h1 className="text-xl font-bold text-white ml-4 lg:ml-0">
                RentMaster
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-white">{user.full_name}</p>
                <p className="text-xs text-gray-400">{roleLabels[user.role] || user.role}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
                title="Выйти"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex overflow-x-hidden">
        <aside
          className={`
            ${mobileMenuOpen ? 'block' : 'hidden'} lg:block
            w-64 bg-gray-900 border-r border-gray-800 min-h-[calc(100vh-4rem)]
            absolute lg:relative z-10 flex-shrink-0
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
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg
                    transition-colors
                    ${
                      isActive
                        ? 'bg-cyan-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
