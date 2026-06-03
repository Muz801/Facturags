import { query, transaction } from '../config/db.js';
import { asyncHandler, ok, fail } from '../utils/http.js';

export const listar = asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT c.*, p.nombre AS proveedor_nombre, u.nombre AS usuario_nombre,
           (SELECT COUNT(*) FROM compra_items ci WHERE ci.compra_id = c.id) AS num_items
    FROM compras c
    LEFT JOIN proveedores p ON p.id = c.proveedor_id
    LEFT JOIN usuarios u ON u.id = c.usuario_id
    ORDER BY c.fecha DESC, c.id DESC
  `);
  return ok(res, rows);
});

export const obtener = asyncHandler(async (req, res) => {
  const compra = await query('SELECT * FROM compras WHERE id = :id', { id: req.params.id });
  if (!compra[0]) return fail(res, 'Compra no encontrada', 404);
  const items = await query('SELECT * FROM compra_items WHERE compra_id = :id', { id: req.params.id });
  return ok(res, { ...compra[0], items });
});

export const crear = asyncHandler(async (req, res) => {
  const { proveedor_id, items, notas } = req.body;
  if (!Array.isArray(items) || items.length === 0) return fail(res, 'La compra debe tener al menos un item');

  const result = await transaction(async (conn) => {
    let subtotal = 0;
    items.forEach((it) => { subtotal += Number(it.cantidad) * Number(it.costo_unit); });
    const impuesto = 0; // compras: el IVA soportado se puede manejar aparte
    const total = subtotal + impuesto;
    const numero = 'C-' + String(Date.now()).slice(-8);

    const [r] = await conn.execute(
      `INSERT INTO compras (numero, proveedor_id, usuario_id, subtotal, impuesto, total, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [numero, proveedor_id || null, req.user.id, subtotal, impuesto, total, notas || '']
    );
    const compraId = r.insertId;

    for (const it of items) {
      const totalLinea = Number(it.cantidad) * Number(it.costo_unit);
      await conn.execute(
        `INSERT INTO compra_items (compra_id, producto_id, nombre, cantidad, costo_unit, total_linea)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [compraId, it.producto_id || null, it.nombre, it.cantidad, it.costo_unit, totalLinea]
      );
      // Sube el stock del producto
      if (it.producto_id) {
        const [prod] = await conn.execute('SELECT stock FROM productos WHERE id = ?', [it.producto_id]);
        const nuevoStock = Number(prod[0].stock) + Number(it.cantidad);
        await conn.execute(
          'UPDATE productos SET stock = ?, precio_costo = ? WHERE id = ?',
          [nuevoStock, it.costo_unit, it.producto_id]
        );
        await conn.execute(
          `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_resultante, referencia, usuario_id)
           VALUES (?, 'compra', ?, ?, ?, ?)`,
          [it.producto_id, it.cantidad, nuevoStock, numero, req.user.id]
        );
      }
    }
    return { id: compraId, numero, total };
  });

  return ok(res, result, 201);
});

export const anular = asyncHandler(async (req, res) => {
  await query('UPDATE compras SET estado = "anulada" WHERE id = :id', { id: req.params.id });
  return ok(res, { mensaje: 'Compra anulada' });
});
