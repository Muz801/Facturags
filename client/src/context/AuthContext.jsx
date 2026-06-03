import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('fp_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('fp_token', data.data.token);
    localStorage.setItem('fp_user', JSON.stringify(data.data.user));
    setUser(data.data.user);
    return data.data.user;
  };

  const logout = () => {
    localStorage.removeItem('fp_token');
    localStorage.removeItem('fp_user');
    setUser(null);
  };

  // Verifica el token al cargar
  useEffect(() => {
    const token = localStorage.getItem('fp_token');
    if (token && user) {
      api.get('/auth/me').catch(() => logout());
    }
    // eslint-disable-next-line
  }, []);

  const esAdmin = user?.rol === 'admin';
  const esGerente = user?.rol === 'admin' || user?.rol === 'gerente';

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, esAdmin, esGerente }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
