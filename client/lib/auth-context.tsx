'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

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
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'client' | 'operator';
  phone?: string;
  companyName?: string;
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
      const response = await api.post('/auth/login', { email, password });
      const { user: userData, token } = response.data;

      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
    } catch (error: any) {
      const status = error?.response?.status;
      const serverMessage = error?.response?.data?.error;
      const message =
        status === 401
          ? 'Неверный email или пароль'
          : status === 500
            ? 'Ошибка сервера при входе'
            : (serverMessage || 'Ошибка входа');
      throw new Error(message);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await api.post('/auth/register', data);
      const { user: userData, token } = response.data;

      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
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

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
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


