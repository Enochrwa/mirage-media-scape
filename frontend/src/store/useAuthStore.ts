import { create } from 'zustand';
import axios from 'axios';
import { API_BASE } from '../lib/utils';

interface User {
  id: string;
  username: string;
  role: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: true,

  init: async () => {
    const refreshToken = localStorage.getItem('ZOVYRA_refresh_token');
    if (!refreshToken) {
      set({ isLoading: false });
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken });
      const { accessToken } = res.data;
      set({ accessToken });

      const userRes = await axios.get(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      set({ user: userRes.data.user, isLoading: false });
    } catch (e) {
      localStorage.removeItem('ZOVYRA_refresh_token');
      set({ user: null, accessToken: null, isLoading: false });
    }
  },

  login: async (username, password) => {
    const res = await axios.post(`${API_BASE}/api/auth/login`, { username, password });
    const { accessToken, refreshToken, user } = res.data;
    localStorage.setItem('ZOVYRA_refresh_token', refreshToken);
    set({ accessToken, user });
  },

  register: async (username, email, password) => {
    const res = await axios.post(`${API_BASE}/api/auth/register`, { username, email, password });
    const { accessToken, refreshToken, user } = res.data;
    localStorage.setItem('ZOVYRA_refresh_token', refreshToken);
    set({ accessToken, user });
  },

  logout: () => {
    const refreshToken = localStorage.getItem('ZOVYRA_refresh_token');
    if (refreshToken) axios.post(`${API_BASE}/api/auth/logout`, { refreshToken });
    localStorage.removeItem('ZOVYRA_refresh_token');
    set({ user: null, accessToken: null });
  },
}));

// Interceptor
axios.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
