import { query, transaction } from '../config/db.js';
import { asyncHandler, ok, fail } from '../utils/http.js';

export const listar = asyncHandler(async (req, res) => {
  const { q, categoria, stockBajo } = req.query;
  let sql = `
    SELECT p.*, c.nombre AS categoria_nombre, c.color AS categoria_color,
           pr.nombre AS proveedor_nombre
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
    WHERE p.activo = 1
  `;
  const params = {};
  if (q) { sql += ' AND (p.nombre LIKE :q OR p.sku LIKE :q OR p.codigo_barras LIKE :q)'; params.q = `%${q}%`; }
  if (categoria) { sql += ' AND p.categoria_id = :categoria'; params.categoria = categoria; }
  if (stockBajo === 'true') { sql += ' AND p.stock <= p.stock_minimo'; }
  sql += ' ORDER BY p.nombre';
  const rows = await query(sql, params);
  return ok(res, rows);
});

export const obtener = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM productos WHERE id = :id', { id: req.params.id });
  if (!rows[0]) return fail(res, 'Producto no encontrado', 404);
  return ok(res, rows[0]);
});

const CAMPOS = [
  'sku', 'codigo_barras', 'nombre', 'descripcion', 'categoria_id', 'proveedor_id',
  'codigo_cabys', 'precio_costo', 'precio_venta', 'tarifa_iva', 'stock',
  'stock_minimo', 'unidad_medida', 'imagen_url',
];

export const crear = asyncHandler(async (req, res) => {
  if (!req.body.nombre) return fail(res, 'El nombre del producto es requerido');
  const data = {};
  CAMPOS.forEach((c) => { data[c] = req.body[c] ?? null; });
  data.categoria_id = data.categoria_id || null;
  data.proveedor_id = data.proveedor_id || null;

  const cols = CAMPOS.join(', ');
  const vals = CAMPOS.map((c) => `:${c}`).join(', ');
  const result = await query(`INSERT INTO productos (${cols}) VALUES (${vals})`, data);

  if (Number(data.stock) > 0) {
    await query(
      `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_resultante, referencia, usuario_id)
       VALUES (:pid, 'ajuste', :cant, :stock, 'Stock inicial', :uid)`,
      { pid: result.insertId, cant: data.stock, stock: data.stock, uid: req.user.id }
    );
  }
  const rows = await query('SELECT * FROM productos WHERE id = :id', { id: result.insertId });
  return ok(res, rows[0], 201);
});

export const actualizar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = { id };
  const sets = [];
  CAMPOS.forEach((c) => {
    if (req.body[c] !== undefined) {
      data[c] = (c === 'categoria_id' || c === 'proveedor_id') ? (req.body[c] || null) : req.body[c];
      sets.push(`${c} = :${c}`);
    }
  });
  if (sets.length === 0) return fail(res, 'Nada que actualizar');
  await query(`UPDATE productos SET ${sets.join(', ')} WHERE id = :id`, data);
  const rows = await query('SELECT * FROM productos WHERE id = :id', { id });
  return ok(res, rows[0]);
});

export const eliminar = asyncHandler(async (req, res) => {
  await query('UPDATE productos SET activo = 0 WHERE id = :id', { id: req.params.id });
  return ok(res, { mensaje: 'Producto eliminado' });
});

// Ajuste manual de stock (entrada, salida o merma)
export const ajustarStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cantidad, tipo, motivo } = req.body; // cantidad puede ser +/-
  if (!cantidad || isNaN(cantidad)) return fail(res, 'Cantidad invalida');

  await transaction(async (conn) => {
    const [prod] = await conn.execute('SELECT stock FROM productos WHERE id = ?', [id]);
    if (!prod[0]) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
    const nuevoStock = Number(prod[0].stock) + Number(cantidad);
    await conn.execute('UPDATE productos SET stock = ? WHERE id = ?', [nuevoStock, id]);
    await conn.execute(
      `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_resultante, referencia, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tipo || 'ajuste', cantidad, nuevoStock, motivo || 'Ajuste manual', req.user.id]
    );
  });
  const rows = await query('SELECT * FROM productos WHERE id = :id', { id });
  return ok(res, rows[0]);
});

// Historial de movimientos de un producto
export const movimientos = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT m.*, u.nombre AS usuario FROM movimientos_inventario m
     LEFT JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.producto_id = :id ORDER BY m.fecha DESC LIMIT 100`,
    { id: req.params.id }
  );
  return ok(res, rows);
});
