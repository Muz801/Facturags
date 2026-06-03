import { query } from '../config/db.js';
import { asyncHandler, ok, fail } from '../utils/http.js';

export const listar = asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT c.*, COUNT(p.id) AS total_productos
    FROM categorias c
    LEFT JOIN productos p ON p.categoria_id = c.id AND p.activo = 1
    WHERE c.activa = 1
    GROUP BY c.id
    ORDER BY c.nombre
  `);
  return ok(res, rows);
});

export const crear = asyncHandler(async (req, res) => {
  const { nombre, descripcion, color } = req.body;
  if (!nombre || !nombre.trim()) return fail(res, 'El nombre de la categoria es requerido');
  // Evita duplicados por nombre
  const existe = await query('SELECT id FROM categorias WHERE nombre = :nombre AND activa = 1', { nombre: nombre.trim() });
  if (existe[0]) return fail(res, 'Ya existe una categoria con ese nombre', 409);

  const result = await query(
    'INSERT INTO categorias (nombre, descripcion, color) VALUES (:nombre, :descripcion, :color)',
    { nombre: nombre.trim(), descripcion: descripcion || '', color: color || '#7c3aed' }
  );
  const rows = await query('SELECT * FROM categorias WHERE id = :id', { id: result.insertId });
  return ok(res, rows[0], 201);
});

export const actualizar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, color } = req.body;
  await query(
    'UPDATE categorias SET nombre = :nombre, descripcion = :descripcion, color = :color WHERE id = :id',
    { nombre, descripcion: descripcion || '', color: color || '#7c3aed', id }
  );
  const rows = await query('SELECT * FROM categorias WHERE id = :id', { id });
  return ok(res, rows[0]);
});

export const eliminar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Soft delete para no romper productos historicos
  await query('UPDATE categorias SET activa = 0 WHERE id = :id', { id });
  return ok(res, { mensaje: 'Categoria eliminada' });
});
