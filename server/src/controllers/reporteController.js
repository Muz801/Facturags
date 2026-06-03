import { query } from '../config/db.js';
import { asyncHandler } from '../utils/http.js';
import { toCsv, colones } from '../services/reportes.js';

function enviarCsv(res, nombre, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.csv"`);
  res.send(csv);
}

// ---- Reporte de ventas ----
export const ventas = asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query;
  const rows = await query(`
    SELECT v.numero, v.fecha, c.nombre AS cliente, u.nombre AS cajero,
           v.tipo_comprobante, v.metodo_pago, v.subtotal, v.descuento,
           v.impuesto, v.total, v.estado, v.fe_clave
    FROM ventas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE (:desde IS NULL OR v.fecha >= :desde)
      AND (:hasta IS NULL OR v.fecha <= :hasta)
    ORDER BY v.fecha DESC
  `, { desde: desde ? desde + ' 00:00:00' : null, hasta: hasta ? hasta + ' 23:59:59' : null });

  const csv = toCsv([
    { key: 'numero', label: 'Numero' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'cajero', label: 'Cajero' },
    { key: 'tipo_comprobante', label: 'Tipo' },
    { key: 'metodo_pago', label: 'Metodo de pago' },
    { key: 'subtotal', label: 'Subtotal (CRC)' },
    { key: 'descuento', label: 'Descuento (CRC)' },
    { key: 'impuesto', label: 'IVA (CRC)' },
    { key: 'total', label: 'Total (CRC)' },
    { key: 'estado', label: 'Estado' },
    { key: 'fe_clave', label: 'Clave Hacienda' },
  ], rows.map((r) => ({ ...r, subtotal: colones(r.subtotal), descuento: colones(r.descuento), impuesto: colones(r.impuesto), total: colones(r.total) })));
  enviarCsv(res, `ventas_${desde || 'inicio'}_${hasta || 'hoy'}`, csv);
});

// ---- Reporte de inventario ----
export const inventario = asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT p.sku, p.nombre, c.nombre AS categoria, p.codigo_cabys,
           p.stock, p.stock_minimo, p.unidad_medida,
           p.precio_costo, p.precio_venta, p.tarifa_iva,
           (p.stock * p.precio_costo) AS valor_costo
    FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.activo = 1 ORDER BY c.nombre, p.nombre
  `);
  const csv = toCsv([
    { key: 'sku', label: 'SKU' },
    { key: 'nombre', label: 'Producto' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'codigo_cabys', label: 'Codigo CAByS' },
    { key: 'stock', label: 'Existencias' },
    { key: 'stock_minimo', label: 'Stock minimo' },
    { key: 'unidad_medida', label: 'Unidad' },
    { key: 'precio_costo', label: 'Costo (CRC)' },
    { key: 'precio_venta', label: 'Precio venta (CRC)' },
    { key: 'tarifa_iva', label: 'IVA %' },
    { key: 'valor_costo', label: 'Valor en inventario (CRC)' },
  ], rows.map((r) => ({ ...r, precio_costo: colones(r.precio_costo), precio_venta: colones(r.precio_venta), valor_costo: colones(r.valor_costo) })));
  enviarCsv(res, 'inventario', csv);
});

// ---- Reporte de gastos ----
export const gastos = asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query;
  const rows = await query(`
    SELECT g.fecha, g.descripcion, g.categoria, g.metodo_pago, g.monto,
           p.nombre AS proveedor, u.nombre AS registrado_por
    FROM gastos g
    LEFT JOIN proveedores p ON p.id = g.proveedor_id
    LEFT JOIN usuarios u ON u.id = g.usuario_id
    WHERE (:desde IS NULL OR g.fecha >= :desde) AND (:hasta IS NULL OR g.fecha <= :hasta)
    ORDER BY g.fecha DESC
  `, { desde: desde || null, hasta: hasta || null });
  const csv = toCsv([
    { key: 'fecha', label: 'Fecha' },
    { key: 'descripcion', label: 'Descripcion' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'metodo_pago', label: 'Metodo de pago' },
    { key: 'proveedor', label: 'Proveedor' },
    { key: 'monto', label: 'Monto (CRC)' },
    { key: 'registrado_por', label: 'Registrado por' },
  ], rows.map((r) => ({ ...r, monto: colones(r.monto) })));
  enviarCsv(res, `gastos_${desde || 'inicio'}_${hasta || 'hoy'}`, csv);
});

// ---- Reporte de compras ----
export const compras = asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT c.numero, c.fecha, p.nombre AS proveedor, c.subtotal, c.impuesto, c.total, c.estado
    FROM compras c LEFT JOIN proveedores p ON p.id = c.proveedor_id
    ORDER BY c.fecha DESC
  `);
  const csv = toCsv([
    { key: 'numero', label: 'Numero' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'proveedor', label: 'Proveedor' },
    { key: 'subtotal', label: 'Subtotal (CRC)' },
    { key: 'impuesto', label: 'IVA (CRC)' },
    { key: 'total', label: 'Total (CRC)' },
    { key: 'estado', label: 'Estado' },
  ], rows.map((r) => ({ ...r, subtotal: colones(r.subtotal), impuesto: colones(r.impuesto), total: colones(r.total) })));
  enviarCsv(res, 'compras', csv);
});

// ---- Reporte resumen de IVA (para contadores / D-104) ----
export const iva = asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query;
  const rows = await query(`
    SELECT DATE(v.fecha) AS dia,
           SUM(v.subtotal - v.descuento) AS base_gravada,
           SUM(v.impuesto) AS iva_cobrado,
           SUM(v.total) AS total_facturado,
           COUNT(*) AS facturas
    FROM ventas v
    WHERE v.estado='completada'
      AND (:desde IS NULL OR v.fecha >= :desde) AND (:hasta IS NULL OR v.fecha <= :hasta)
    GROUP BY DATE(v.fecha) ORDER BY dia
  `, { desde: desde ? desde + ' 00:00:00' : null, hasta: hasta ? hasta + ' 23:59:59' : null });
  const csv = toCsv([
    { key: 'dia', label: 'Fecha' },
    { key: 'facturas', label: 'Cantidad facturas' },
    { key: 'base_gravada', label: 'Base gravada (CRC)' },
    { key: 'iva_cobrado', label: 'IVA cobrado (CRC)' },
    { key: 'total_facturado', label: 'Total facturado (CRC)' },
  ], rows.map((r) => ({ ...r, base_gravada: colones(r.base_gravada), iva_cobrado: colones(r.iva_cobrado), total_facturado: colones(r.total_facturado) })));
  enviarCsv(res, `resumen_iva_${desde || 'inicio'}_${hasta || 'hoy'}`, csv);
});
