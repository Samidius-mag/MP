'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
  requiredRole?: 'client' | 'operator' | 'admin';
}

export default function Layout({ children, requiredRole }: LayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
        return;
      }

      if (requiredRole && user.role !== requiredRole) {
        // Перенаправляем в соответствующий кабинет
        switch (user.role) {
          case 'client':
            router.push('/client/dashboard');
            break;
          case 'operator':
            router.push('/operator/dashboard');
            break;
          case 'admin':
            router.push('/admin');
            break;
        }
        return;
      }
    }
  }, [user, loading, router, requiredRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requiredRole && user.role !== requiredRole) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar role={user.role} />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}






