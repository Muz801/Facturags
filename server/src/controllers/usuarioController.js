import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { asyncHandler, ok, fail } from '../utils/http.js';

export const listar = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT id, nombre, email, rol, telefono, activo, ultimo_acceso, created_at
     FROM usuarios ORDER BY nombre`
  );
  return ok(res, rows);
});

export const crear = asyncHandler(async (req, res) => {
  const { nombre, email, password, rol, telefono } = req.body;
  if (!nombre || !email || !password) return fail(res, 'Nombre, email y contrasena son requeridos');
  if (password.length < 6) return fail(res, 'La contrasena debe tener al menos 6 caracteres');
  const hash = await bcrypt.hash(password, 10);
  const r = await query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol, telefono)
     VALUES (:nombre, :email, :hash, :rol, :telefono)`,
    { nombre, email, hash, rol: rol || 'cajero', telefono: telefono || '' }
  );
  const rows = await query(
    'SELECT id, nombre, email, rol, telefono, activo FROM usuarios WHERE id = :id',
    { id: r.insertId }
  );
  return ok(res, rows[0], 201);
});

export const actualizar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, email, rol, telefono, activo, password } = req.body;
  const data = { id };
  const sets = [];
  if (nombre !== undefined) { data.nombre = nombre; sets.push('nombre = :nombre'); }
  if (email !== undefined) { data.email = email; sets.push('email = :email'); }
  if (rol !== undefined) { data.rol = rol; sets.push('rol = :rol'); }
  if (telefono !== undefined) { data.telefono = telefono; sets.push('telefono = :telefono'); }
  if (activo !== undefined) { data.activo = activo ? 1 : 0; sets.push('activo = :activo'); }
  if (password) { data.password_hash = await bcrypt.hash(password, 10); sets.push('password_hash = :password_hash'); }
  if (sets.length === 0) return fail(res, 'Nada que actualizar');
  await query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = :id`, data);
  const rows = await query('SELECT id, nombre, email, rol, telefono, activo FROM usuarios WHERE id = :id', { id });
  return ok(res, rows[0]);
});

export const eliminar = asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return fail(res, 'No puedes desactivar tu propia cuenta');
  await query('UPDATE usuarios SET activo = 0 WHERE id = :id', { id: req.params.id });
  return ok(res, { mensaje: 'Empleado desactivado' });
});
