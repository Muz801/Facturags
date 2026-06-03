import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { query } from '../config/db.js';
import { asyncHandler, ok, fail } from '../utils/http.js';

function firmarToken(user) {
  return jwt.sign(
    { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return fail(res, 'Email y contrasena son requeridos');

  const rows = await query('SELECT * FROM usuarios WHERE email = :email AND activo = 1', { email });
  const user = rows[0];
  if (!user) return fail(res, 'Credenciales incorrectas', 401);

  const valido = await bcrypt.compare(password, user.password_hash);
  if (!valido) return fail(res, 'Credenciales incorrectas', 401);

  await query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = :id', { id: user.id });

  const token = firmarToken(user);
  return ok(res, {
    token,
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  });
});

export const me = asyncHandler(async (req, res) => {
  const rows = await query(
    'SELECT id, nombre, email, rol, telefono, ultimo_acceso FROM usuarios WHERE id = :id',
    { id: req.user.id }
  );
  if (!rows[0]) return fail(res, 'Usuario no encontrado', 404);
  return ok(res, rows[0]);
});

// Cambiar la propia contrasena
export const cambiarPassword = asyncHandler(async (req, res) => {
  const { actual, nueva } = req.body;
  if (!nueva || nueva.length < 6) return fail(res, 'La nueva contrasena debe tener al menos 6 caracteres');
  const rows = await query('SELECT * FROM usuarios WHERE id = :id', { id: req.user.id });
  const user = rows[0];
  const valido = await bcrypt.compare(actual || '', user.password_hash);
  if (!valido) return fail(res, 'La contrasena actual es incorrecta', 401);
  const hash = await bcrypt.hash(nueva, 10);
  await query('UPDATE usuarios SET password_hash = :hash WHERE id = :id', { hash, id: req.user.id });
  return ok(res, { mensaje: 'Contrasena actualizada' });
});
