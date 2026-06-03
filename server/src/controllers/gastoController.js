import { query } from '../config/db.js';
import { asyncHandler, ok, fail } from '../utils/http.js';

export const listar = asyncHandler(async (req, res) => {
  const { desde, hasta, categoria } = req.query;
  let sql = `
    SELECT g.*, p.nombre AS proveedor_nombre, u.nombre AS usuario_nombre
    FROM gastos g
    LEFT JOIN proveedores p ON p.id = g.proveedor_id
    LEFT JOIN usuarios u ON u.id = g.usuario_id
    WHERE 1=1
  `;
  const params = {};
  if (desde) { sql += ' AND g.fecha >= :desde'; params.desde = desde; }
  if (hasta) { sql += ' AND g.fecha <= :hasta'; params.hasta = hasta; }
  if (categoria) { sql += ' AND g.categoria = :categoria'; params.categoria = categoria; }
  sql += ' ORDER BY g.fecha DESC, g.id DESC';
  return ok(res, await query(sql, params));
});

export const crear = asyncHandler(async (req, res) => {
  const { descripcion, categoria, monto, fecha, metodo_pago, proveedor_id, notas } = req.body;
  if (!descripcion || !monto) return fail(res, 'Descripcion y monto son requeridos');
  const r = await query(
    `INSERT INTO gastos (descripcion, categoria, monto, fecha, metodo_pago, proveedor_id, usuario_id, notas)
     VALUES (:descripcion, :categoria, :monto, :fecha, :metodo_pago, :proveedor_id, :usuario_id, :notas)`,
    {
      descripcion, categoria: categoria || 'General', monto,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      metodo_pago: metodo_pago || 'efectivo',
      proveedor_id: proveedor_id || null, usuario_id: req.user.id, notas: notas || '',
    }
  );
  const rows = await query('SELECT * FROM gastos WHERE id = :id', { id: r.insertId });
  return ok(res, rows[0], 201);
});

export const actualizar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const campos = ['descripcion', 'categoria', 'monto', 'fecha', 'metodo_pago', 'proveedor_id', 'notas'];
  const data = { id };
  const sets = [];
  campos.forEach((c) => {
    if (req.body[c] !== undefined) {
      data[c] = c === 'proveedor_id' ? (req.body[c] || null) : req.body[c];
      sets.push(`${c} = :${c}`);
    }
  });
  if (sets.length === 0) return fail(res, 'Nada que actualizar');
  await query(`UPDATE gastos SET ${sets.join(', ')} WHERE id = :id`, data);
  const rows = await query('SELECT * FROM gastos WHERE id = :id', { id });
  return ok(res, rows[0]);
});

export const eliminar = asyncHandler(async (req, res) => {
  await query('DELETE FROM gastos WHERE id = :id', { id: req.params.id });
  return ok(res, { mensaje: 'Gasto eliminado' });
});
