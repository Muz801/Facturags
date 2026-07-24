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

// ---- Libro de compras: los comprobantes recibidos y como se respondieron ----
// Es el respaldo del IVA soportado. Un comprobante sin Mensaje Receptor
// aceptado NO da derecho a credito, por eso va la columna de estado.
export const libroCompras = asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query;
  const rows = await query(`
    SELECT r.fecha_emision, r.emisor_identificacion, r.emisor_nombre,
           r.tipo_documento, r.numero_consecutivo, r.clave,
           r.total_gravado, r.total_exento, r.total_impuesto, r.total_comprobante,
           r.estado, r.monto_iva_acreditar, r.consecutivo_receptor,
           r.mr_estado, r.fecha_limite
      FROM comprobantes_recibidos r
     WHERE (:desde IS NULL OR r.fecha_emision >= :desde)
       AND (:hasta IS NULL OR r.fecha_emision <= :hasta)
     ORDER BY r.fecha_emision
  `, { desde: desde ? desde + ' 00:00:00' : null, hasta: hasta ? hasta + ' 23:59:59' : null });

  const csv = toCsv([
    { key: 'fecha_emision', label: 'Fecha emision' },
    { key: 'emisor_identificacion', label: 'Cedula proveedor' },
    { key: 'emisor_nombre', label: 'Proveedor' },
    { key: 'tipo_documento', label: 'Tipo doc' },
    { key: 'numero_consecutivo', label: 'Consecutivo' },
    { key: 'clave', label: 'Clave Hacienda' },
    { key: 'total_gravado', label: 'Gravado (CRC)' },
    { key: 'total_exento', label: 'Exento (CRC)' },
    { key: 'total_impuesto', label: 'IVA facturado (CRC)' },
    { key: 'total_comprobante', label: 'Total (CRC)' },
    { key: 'estado', label: 'Respuesta' },
    { key: 'monto_iva_acreditar', label: 'IVA acreditado (CRC)' },
    { key: 'consecutivo_receptor', label: 'Consecutivo receptor' },
    { key: 'mr_estado', label: 'Estado en Hacienda' },
    { key: 'fecha_limite', label: 'Fecha limite' },
  ], rows.map((r) => ({
    ...r,
    total_gravado: colones(r.total_gravado),
    total_exento: colones(r.total_exento),
    total_impuesto: colones(r.total_impuesto),
    total_comprobante: colones(r.total_comprobante),
    monto_iva_acreditar: colones(r.monto_iva_acreditar),
  })));
  enviarCsv(res, `libro_compras_${desde || 'inicio'}_${hasta || 'hoy'}`, csv);
});

// ---- IVA del periodo: repercutido contra soportado ----
// Es el numero que se lleva a la declaracion. Solo suma el IVA de
// comprobantes efectivamente aceptados ante Hacienda.
export const ivaPeriodo = asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query;
  const rango = {
    desde: desde ? desde + ' 00:00:00' : null,
    hasta: hasta ? hasta + ' 23:59:59' : null,
  };

  const [ventas] = await query(`
    SELECT COALESCE(SUM(v.subtotal - v.descuento),0) AS base, COALESCE(SUM(v.impuesto),0) AS iva,
           COUNT(*) AS documentos
      FROM ventas v
     WHERE v.estado='completada'
       AND (:desde IS NULL OR v.fecha >= :desde) AND (:hasta IS NULL OR v.fecha <= :hasta)
  `, rango);

  const [recibidos] = await query(`
    SELECT COALESCE(SUM(monto_iva_acreditar),0) AS iva_acreditable,
           COALESCE(SUM(total_impuesto),0) AS iva_facturado,
           COUNT(*) AS documentos,
           SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS sin_responder
      FROM comprobantes_recibidos
     WHERE (:desde IS NULL OR fecha_emision >= :desde) AND (:hasta IS NULL OR fecha_emision <= :hasta)
  `, rango);

  // Las compras con factura electronica de compra tambien dan credito
  const [fec] = await query(`
    SELECT COALESCE(SUM(impuesto),0) AS iva, COUNT(*) AS documentos
      FROM compras
     WHERE requiere_fec = 1 AND estado <> 'anulada' AND fe_estado IN ('enviado','aceptado')
       AND (:desde IS NULL OR fecha >= :desde) AND (:hasta IS NULL OR fecha <= :hasta)
  `, rango);

  const soportado = Number(recibidos.iva_acreditable) + Number(fec.iva);
  const filas = [
    { concepto: 'IVA repercutido (ventas)', documentos: ventas.documentos, monto: colones(ventas.iva) },
    { concepto: 'IVA soportado - comprobantes de proveedores aceptados', documentos: recibidos.documentos, monto: colones(recibidos.iva_acreditable) },
    { concepto: 'IVA soportado - facturas electronicas de compra', documentos: fec.documentos, monto: colones(fec.iva) },
    { concepto: 'Total IVA soportado acreditable', documentos: '', monto: colones(soportado) },
    { concepto: 'Diferencia a pagar (o a favor si es negativa)', documentos: '', monto: colones(Number(ventas.iva) - soportado) },
    { concepto: '', documentos: '', monto: '' },
    { concepto: 'REVISAR: IVA facturado por proveedores que NO se esta acreditando', documentos: '', monto: colones(Number(recibidos.iva_facturado) - Number(recibidos.iva_acreditable)) },
    { concepto: 'REVISAR: comprobantes recibidos sin responder a Hacienda', documentos: recibidos.sin_responder, monto: '' },
  ];

  const csv = toCsv([
    { key: 'concepto', label: 'Concepto' },
    { key: 'documentos', label: 'Documentos' },
    { key: 'monto', label: 'Monto (CRC)' },
  ], filas);
  enviarCsv(res, `iva_periodo_${desde || 'inicio'}_${hasta || 'hoy'}`, csv);
});
