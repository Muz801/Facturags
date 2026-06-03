import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { fail } from '../utils/http.js';

export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 'No autenticado', 401);
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch (err) {
    return fail(res, 'Sesion invalida o expirada', 401);
  }
}

// Restringe a ciertos roles. Uso: requireRole('admin', 'gerente')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 'No autenticado', 401);
    if (!roles.includes(req.user.rol)) {
      return fail(res, 'No tiene permisos para esta accion', 403);
    }
    next();
  };
}
