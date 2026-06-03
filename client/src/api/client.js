import axios from 'axios';

// En desarrollo, el proxy de package.json reenvia /api -> localhost:4000.
// En produccion, define REACT_APP_API_URL con la URL de tu backend en Render.
const baseURL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({ baseURL });

// Inyecta el token JWT en cada peticion
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el token expira (401), limpia sesion y manda al login
api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      localStorage.removeItem('fp_token');
      localStorage.removeItem('fp_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper para descargar reportes (CSV) con el token incluido
export async function descargarReporte(ruta, nombreArchivo) {
  const token = localStorage.getItem('fp_token');
  const resp = await fetch((baseURL === '/api' ? '/api' : baseURL) + ruta, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error('No se pudo generar el reporte');
  const blob = await resp.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default api;
