import axios from 'axios';

// В браузере используем относительный путь, чтобы ходить через Nginx (https://vgk-perv.ru/api)
// На сервере (SSR/ISR) используем переменную окружения как абсолютный URL
const baseURL = typeof window !== 'undefined'
  ? '/api'
  : (process.env.NEXT_PUBLIC_API_URL || 'https://vgk-perv.ru/api');

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

// Интерцептор для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Токен истек или недействителен
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Интерцептор для добавления токена к запросам
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);



