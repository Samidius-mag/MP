'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  ShoppingBagIcon, 
  CreditCardIcon, 
  CogIcon, 
  BellIcon,
  UserGroupIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  TagIcon,
  ArchiveBoxIcon,
  Squares2X2Icon,
  TruckIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  role: 'client' | 'operator' | 'admin';
}

export default function Sidebar({ role }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const shouldHideSimaForClient = user?.email === 'test+deposit@example.com';

  const getNavigationItems = () => {
    switch (role) {
      case 'client':
        return [
          { name: 'Дашборд', href: '/client/dashboard', icon: HomeIcon },
          { name: 'Заказы', href: '/client/orders', icon: ShoppingBagIcon },
          { name: 'Товары магазина', href: '/client/products', icon: Squares2X2Icon },
          { name: 'Склад', href: '/client/warehouse', icon: ArchiveBoxIcon },
          // скрываем СИМА ЛЕНД для конкретного клиента
          ...(!shouldHideSimaForClient ? [{ name: 'СИМА ЛЕНД', href: '/client/sima-land', icon: TruckIcon }] : []),
          { name: 'Депозит', href: '/client/deposit', icon: CreditCardIcon },
          { name: 'WB Ценообразование', href: '/client/wb-pricing', icon: TagIcon },
          { name: 'Настройки', href: '/client/settings', icon: CogIcon },
        ];
      case 'operator':
        return [
          { name: 'Дашборд', href: '/operator/dashboard', icon: HomeIcon },
          { name: 'Заказы', href: '/operator/orders', icon: ShoppingBagIcon },
          { name: 'Стикеры', href: '/operator/stickers', icon: BellIcon },
          { name: 'Клиенты', href: '/operator/clients', icon: UserGroupIcon },
        ];
      case 'admin':
        return [
          { name: 'Дашборд', href: '/admin', icon: HomeIcon },
          { name: 'Пользователи', href: '/admin/users', icon: UserGroupIcon },
          { name: 'Заказы', href: '/admin/orders', icon: ShoppingBagIcon },
          { name: 'Статистика', href: '/admin/stats', icon: ChartBarIcon },
          { name: 'Настройки', href: '/admin/settings', icon: CogIcon },
        ];
      default:
        return [];
    }
  };

  const navigationItems = getNavigationItems();

  return (
    <div className="flex flex-col w-64 bg-white shadow-lg">
      <div className="flex items-center justify-center h-16 px-4 bg-primary-600">
        <h1 className="text-xl font-bold text-white">
          {role === 'client' && 'Клиент'}
          {role === 'operator' && 'Оператор'}
          {role === 'admin' && 'Админ'}
        </h1>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                isActive
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={logout}
          className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
          Выйти
        </button>
      </div>
    </div>
  );
}

