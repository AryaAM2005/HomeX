import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { socket } from '../api/socket';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    // Any 401 means the session ended elsewhere, such as a logout in another tab.
    const interceptor = api.interceptors.response.use(undefined, (err) => {
      if (err.response?.status === 401) setUser(null);
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(interceptor);
  }, []);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return undefined;

    socket.connect();
    return () => socket.disconnect();
  }, [userId]);

  const login = useCallback(async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (details) => {
    const res = await api.post('/auth/register', details);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
