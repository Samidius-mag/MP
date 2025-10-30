'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { clientLogger } from './clientLogger';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'client' | 'operator' | 'admin';
  phone?: string;
  companyName?: string;
  inn?: string;
  address?: string;
  apiKeys?: any;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ requiresTwoFactor?: boolean; userId?: number; requiresPasswordChange?: boolean }>;
  register: (data: RegisterData) => Promise<{ userId: number; email: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  verifyTwoFactor: (userId: number, code: string) => Promise<string>;
  verifyEmail: (userId: number, code: string) => Promise<string>;
  resendCode: (userId: number, type: 'email') => Promise<void>;
  checkCompany: (inn: string) => Promise<any>;
  forceChangePassword: (userId: number, currentPassword: string, newPassword: string) => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'client' | 'operator';
  phone?: string;
  companyName?: string;
  inn?: string;
  companyData?: any;
  termsAccepted?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Устанавливаем токен в заголовки API
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const response = await api.get('/auth/profile');
      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      clientLogger.info('Login attempt', { component: 'Auth', action: 'login', metadata: { email } });
      
      const response = await api.post('/auth/login', { email, password });
      const { user: userData, token, requiresTwoFactor, userId, requiresPasswordChange } = response.data;

      if (requiresTwoFactor) {
        return { requiresTwoFactor: true, userId };
      }

      if (requiresPasswordChange) {
        return { requiresPasswordChange: true, userId };
      }

      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      
      clientLogger.info('Login successful', { component: 'Auth', action: 'login', metadata: { userId: userData.id, email } });
      return {};
    } catch (error: any) {
      const status = error?.response?.status;
      const serverMessage = error?.response?.data?.error;
      const message =
        status === 401
          ? 'Неверный email или пароль'
          : status === 500
            ? 'Ошибка сервера при входе'
            : (serverMessage || 'Ошибка входа');
      
      clientLogger.apiError('/auth/login', error, { email });
      throw new Error(message);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await api.post('/auth/register', data);
      const { userId, email } = response.data;
      return { userId, email };
    } catch (error: any) {
      const status = error?.response?.status;
      const serverMessage = error?.response?.data?.error;
      const message =
        status === 409
          ? 'Пользователь с таким email уже существует'
          : (serverMessage || 'Ошибка регистрации');
      throw new Error(message);
    }
  };

  const logout = () => {
    clientLogger.info('User logout', { component: 'Auth', action: 'logout', metadata: { userId: user?.id } });
    
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    // Перенаправляем на страницу входа
    window.location.href = '/login';
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const response = await api.put('/auth/profile', data);
      setUser(prev => prev ? { ...prev, ...response.data } : null);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Ошибка обновления профиля');
    }
  };

  const verifyTwoFactor = async (userId: number, code: string) => {
    try {
      const response = await api.post('/auth/verify-2fa', { userId, code });
      const { token, user: userData } = response.data;

      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      
      return token;
    } catch (error: any) {
      const serverMessage = error?.response?.data?.error;
      throw new Error(serverMessage || 'Ошибка подтверждения 2FA');
    }
  };

  const verifyEmail = async (userId: number, code: string) => {
    try {
      const response = await api.post('/auth/verify-email', { userId, code });
      const { token, user: userData } = response.data;

      if (token) {
        localStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(userData);
      }
      
      return token;
    } catch (error: any) {
      const serverMessage = error?.response?.data?.error;
      throw new Error(serverMessage || 'Ошибка подтверждения email');
    }
  };

  const resendCode = async (userId: number, type: 'email') => {
    try {
      await api.post('/auth/resend-code', { userId, type });
    } catch (error: any) {
      const serverMessage = error?.response?.data?.error;
      throw new Error(serverMessage || 'Ошибка отправки кода');
    }
  };

  const checkCompany = async (inn: string) => {
    try {
      const response = await api.post('/auth/check-company', { inn });
      return response.data;
    } catch (error: any) {
      const serverMessage = error?.response?.data?.error;
      throw new Error(serverMessage || 'Ошибка проверки компании');
    }
  };

  const forceChangePassword = async (userId: number, currentPassword: string, newPassword: string) => {
    try {
      await api.put('/auth/force-change-password', { userId, currentPassword, newPassword });
    } catch (error: any) {
      const serverMessage = error?.response?.data?.error;
      throw new Error(serverMessage || 'Ошибка смены пароля');
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    verifyTwoFactor,
    verifyEmail,
    resendCode,
    checkCompany,
    forceChangePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


