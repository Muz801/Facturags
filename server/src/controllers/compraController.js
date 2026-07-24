import { query, transaction } from '../config/db.js';
import { asyncHandler, ok, fail } from '../utils/http.js';
import { generarClave, generarConsecutivo, cargarConfig, TIPO_DOC } from '../services/facturaElectronica.js';
import { construirXMLFacturaCompra, requiereFEC } from '../services/facturaCompra.js';
import { transmitir, consultarComprobante, revisarConfig } from '../services/haciendaEnvio.js';

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
  const { proveedor_id, items, notas, proveedor_condicion = 'inscrito', metodo_pago = 'efectivo' } = req.body;
  if (!Array.isArray(items) || items.length === 0) return fail(res, 'La compra debe tener al menos un item');

  const necesitaFEC = requiereFEC(proveedor_condicion);
  if (necesitaFEC && !proveedor_id) {
    return fail(res, 'Para emitir una factura electronica de compra hay que indicar el proveedor.');
  }

  const result = await transaction(async (conn) => {
    // El IVA de la compra se calcula por linea: es lo que despues se acredita
    let subtotal = 0;
    let impuesto = 0;
    const lineas = items.map((it) => {
      const cantidad = Number(it.cantidad);
      const costo = Number(it.costo_unit);
      const descuento = Number(it.descuento || 0);
      const base = cantidad * costo - descuento;
      const tarifa = it.tarifa_iva === undefined || it.tarifa_iva === null ? 13 : Number(it.tarifa_iva);
      const iva = redondear(base * (tarifa / 100));
      subtotal += base;
      impuesto += iva;
      return {
        ...it,
        cantidad,
        costo_unit: costo,
        descuento,
        tarifa_iva: tarifa,
        iva_monto: iva,
        total_linea: redondear(base + iva),
      };
    });
    subtotal = redondear(subtotal);
    impuesto = redondear(impuesto);
    const total = redondear(subtotal + impuesto);
    const numero = 'C-' + String(Date.now()).slice(-8);

    const [r] = await conn.execute(
      `INSERT INTO compras (numero, proveedor_id, usuario_id, subtotal, impuesto, total, notas,
                            proveedor_condicion, requiere_fec, fe_estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, proveedor_id || null, req.user.id, subtotal, impuesto, total, notas || '',
        proveedor_condicion, necesitaFEC ? 1 : 0, necesitaFEC ? 'pendiente' : '']
    );
    const compraId = r.insertId;

    for (const it of lineas) {
      await conn.execute(
        `INSERT INTO compra_items (compra_id, producto_id, nombre, cantidad, costo_unit, total_linea,
                                   codigo_cabys, unidad_medida, descuento, tarifa_iva, iva_monto)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [compraId, it.producto_id || null, it.nombre, it.cantidad, it.costo_unit, it.total_linea,
          it.codigo_cabys || '', it.unidad_medida || 'Unid', it.descuento, it.tarifa_iva, it.iva_monto]
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
    return { id: compraId, numero, subtotal, impuesto, total, requiere_fec: necesitaFEC };
  });

  // Si el proveedor no factura electronicamente, el negocio emite la FEC
  let fe = null;
  if (result.requiere_fec) {
    fe = await emitirFacturaCompra(result.id, { metodo_pago });
  }

  return ok(res, { ...result, fe }, 201);
});

// ---- Emision de la Factura Electronica de Compra (tipo 08) ----
async function emitirFacturaCompra(compraId, { metodo_pago } = {}) {
  const cfg = await cargarConfig();
  const problema = revisarConfig(cfg);
  if (problema) {
    await query('UPDATE compras SET fe_estado = :e, fe_respuesta = :r WHERE id = :id', {
      e: 'pendiente', r: problema, id: compraId,
    });
    return { estado: 'pendiente', mensaje: problema };
  }

  const compra = (await query('SELECT * FROM compras WHERE id = :id', { id: compraId }))[0];
  const items = await query('SELECT * FROM compra_items WHERE compra_id = :id', { id: compraId });
  const empresa = (await query('SELECT * FROM empresa ORDER BY id LIMIT 1'))[0];
  const proveedor = (await query('SELECT * FROM proveedores WHERE id = :id', { id: compra.proveedor_id }))[0];

  if (!proveedor?.identificacion) {
    const msg = 'El proveedor no tiene cedula registrada y la factura de compra la exige.';
    await query('UPDATE compras SET fe_estado = :e, fe_respuesta = :r WHERE id = :id', { e: 'error', r: msg, id: compraId });
    return { estado: 'error', mensaje: msg };
  }

  const consecutivo = generarConsecutivo({
    sucursal: cfg.sucursal,
    terminal: cfg.terminal,
    tipoDoc: TIPO_DOC.factura_compra,
    numero: cfg.consecutivo_fec,
  });
  const clave = generarClave({ cedula: empresa.identificacion, consecutivo });

  const gravado = items.filter((i) => Number(i.tarifa_iva) > 0)
    .reduce((s, i) => s + (Number(i.cantidad) * Number(i.costo_unit) - Number(i.descuento || 0)), 0);
  const exento = items.filter((i) => Number(i.tarifa_iva) === 0)
    .reduce((s, i) => s + (Number(i.cantidad) * Number(i.costo_unit) - Number(i.descuento || 0)), 0);

  const xml = construirXMLFacturaCompra({
    empresa,
    proveedor,
    items,
    totales: {
      gravado,
      exento,
      descuento: items.reduce((s, i) => s + Number(i.descuento || 0), 0),
      subtotal: compra.subtotal,
      impuesto: compra.impuesto,
      total: compra.total,
    },
    clave,
    consecutivo,
    metodoPago: metodo_pago,
  });

  await query('UPDATE config_hacienda SET consecutivo_fec = consecutivo_fec + 1 WHERE id = :id', { id: cfg.id });
  await query(
    'UPDATE compras SET fe_clave = :clave, fe_consecutivo = :cons, fe_xml = :xml, fe_estado = :est WHERE id = :id',
    { clave, cons: consecutivo, xml, est: 'generado', id: compraId }
  );

  try {
    const r = await transmitir({
      cfg,
      xml,
      clave,
      emisor: {
        tipoIdentificacion: empresa.tipo_identificacion || '01',
        numeroIdentificacion: String(empresa.identificacion).replace(/\D/g, ''),
      },
      receptor: {
        tipoIdentificacion: proveedor.tipo_identificacion || '01',
        numeroIdentificacion: String(proveedor.identificacion).replace(/\D/g, ''),
      },
    });
    await query('UPDATE compras SET fe_estado = :est, fe_respuesta = :resp, fe_enviado_at = NOW() WHERE id = :id', {
      est: r.estado, resp: r.respuesta, id: compraId,
    });
    return { estado: r.estado, clave, consecutivo, http_status: r.httpStatus, respuesta: r.respuesta };
  } catch (err) {
    await query('UPDATE compras SET fe_estado = :est, fe_respuesta = :resp WHERE id = :id', {
      est: 'error', resp: err.message, id: compraId,
    });
    return { estado: 'error', clave, consecutivo, mensaje: err.message };
  }
}

// ---- Reintentar el envio de una FEC que quedo pendiente o con error ----
export const reenviarFEC = asyncHandler(async (req, res) => {
  const compra = (await query('SELECT * FROM compras WHERE id = :id', { id: req.params.id }))[0];
  if (!compra) return fail(res, 'Compra no encontrada', 404);
  if (!compra.requiere_fec) return fail(res, 'Esta compra no requiere factura electronica de compra.');
  if (compra.fe_estado === 'aceptado') return fail(res, 'Esta factura de compra ya fue aceptada por Hacienda.');

  const r = await emitirFacturaCompra(compra.id, { metodo_pago: req.body?.metodo_pago });
  return ok(res, r);
});

// ---- Consultar en Hacienda como quedo la FEC ----
export const consultarFEC = asyncHandler(async (req, res) => {
  const compra = (await query('SELECT * FROM compras WHERE id = :id', { id: req.params.id }))[0];
  if (!compra) return fail(res, 'Compra no encontrada', 404);
  if (!compra.fe_clave) return fail(res, 'Esta compra no tiene una factura electronica de compra emitida.');

  const cfg = await cargarConfig();
  const problema = revisarConfig(cfg);
  if (problema) return fail(res, problema, 409);

  const r = await consultarComprobante({ cfg, clave: compra.fe_clave });
  await query('UPDATE compras SET fe_estado = :est, fe_respuesta = :resp WHERE id = :id', {
    est: r.estado, resp: r.respuestaXml || JSON.stringify(r.crudo), id: compra.id,
  });
  return ok(res, { fe_estado: r.estado, ind_estado: r.indEstado, respuesta: r.respuestaXml });
});

export const descargarXml = asyncHandler(async (req, res) => {
  const rows = await query('SELECT fe_clave, fe_xml FROM compras WHERE id = :id', { id: req.params.id });
  if (!rows[0]?.fe_xml) return fail(res, 'Esta compra no tiene XML generado.', 404);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${rows[0].fe_clave}.xml"`);
  return res.send(rows[0].fe_xml);
});

export const anular = asyncHandler(async (req, res) => {
  await query('UPDATE compras SET estado = "anulada" WHERE id = :id', { id: req.params.id });
  return ok(res, { mensaje: 'Compra anulada' });
});

const redondear = (n) => Math.round(Number(n) * 100) / 100;
