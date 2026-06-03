import { fail } from '../utils/http.js';

export function errorHandler(err, req, res, next) { // eslint-disable-line
  console.error('[ERROR]', err.message);
  if (process.env.NODE_ENV === 'development') console.error(err.stack);

  // Errores de MySQL comunes -> mensajes amigables
  if (err.code === 'ER_DUP_ENTRY') {
    return fail(res, 'Ya existe un registro con ese valor unico (ej: email)', 409);
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return fail(res, 'Referencia invalida a otro registro', 400);
  }
  return fail(res, err.message || 'Error interno del servidor', err.status || 500);
}

export function notFound(req, res) {
  return fail(res, `Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404);
}
