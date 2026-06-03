import QRCode from 'qrcode';
import { query, transaction } from '../config/db.js';
import { asyncHandler, ok, fail } from '../utils/http.js';
import {
  generarClave, generarConsecutivo, construirXML,
  obtenerToken, enviarAHacienda, cargarConfig,
} from '../services/facturaElectronica.js';
import { enviarComprobante } from '../services/mailer.js';

const TIPO_DOC = { factura_electronica: '01', tiquete_electronico: '04' };

// ---- Listado de ventas con filtros ----
export const listar = asyncHandler(async (req, res) => {
  const { desde, hasta, estado, tipo } = req.query;
  let sql = `
    SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS usuario_nombre
    FROM ventas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE 1=1
  `;
  const params = {};
  if (desde) { sql += ' AND v.fecha >= :desde'; params.desde = desde + ' 00:00:00'; }
  if (hasta) { sql += ' AND v.fecha <= :hasta'; params.hasta = hasta + ' 23:59:59'; }
  if (estado) { sql += ' AND v.estado = :estado'; params.estado = estado; }
  if (tipo) { sql += ' AND v.tipo_comprobante = :tipo'; params.tipo = tipo; }
  sql += ' ORDER BY v.fecha DESC, v.id DESC LIMIT 500';
  return ok(res, await query(sql, params));
});

export const obtener = asyncHandler(async (req, res) => {
  const venta = await query('SELECT * FROM ventas WHERE id = :id', { id: req.params.id });
  if (!venta[0]) return fail(res, 'Venta no encontrada', 404);
  const items = await query('SELECT * FROM venta_items WHERE venta_id = :id', { id: req.params.id });
  let cliente = null;
  if (venta[0].cliente_id) {
    const c = await query('SELECT * FROM clientes WHERE id = :id', { id: venta[0].cliente_id });
    cliente = c[0] || null;
  }
  return ok(res, { ...venta[0], items, cliente });
});

// ---- Crear venta (corazon del POS) ----
export const crear = asyncHandler(async (req, res) => {
  const {
    cliente_id, items, metodo_pago, descuento_global = 0,
    tipo_comprobante = 'ticket', condicion_venta = '01', notas = '',
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 'La venta debe tener al menos un producto');
  }

  // Calcula totales en el servidor (nunca confiar en el cliente)
  let subtotal = 0, impuesto = 0;
  const lineas = [];
  for (const it of items) {
    const prod = (await query('SELECT * FROM productos WHERE id = :id', { id: it.producto_id }))[0];
    if (!prod) return fail(res, `Producto ${it.producto_id} no existe`);
    const cantidad = Number(it.cantidad);
    const precio = it.precio_unit !== undefined ? Number(it.precio_unit) : Number(prod.precio_venta);
    const descLinea = Number(it.descuento || 0);
    const baseLinea = cantidad * precio - descLinea;
    const ivaMonto = baseLinea * (Number(prod.tarifa_iva) / 100);
    const totalLinea = baseLinea + ivaMonto;
    subtotal += cantidad * precio;
    impuesto += ivaMonto;
    lineas.push({
      producto_id: prod.id, nombre: prod.nombre, codigo_cabys: prod.codigo_cabys,
      cantidad, precio_unit: precio, descuento: descLinea, tarifa_iva: prod.tarifa_iva,
      unidad_medida: prod.unidad_medida, iva_monto: ivaMonto, total_linea: totalLinea,
      stock_actual: Number(prod.stock),
    });
  }
  const descuento = Number(descuento_global);
  const total = subtotal - descuento + impuesto;

  const ventaCreada = await transaction(async (conn) => {
    const numero = 'V-' + String(Date.now()).slice(-8);
    const [r] = await conn.execute(
      `INSERT INTO ventas
       (numero, cliente_id, usuario_id, subtotal, descuento, impuesto, total,
        metodo_pago, condicion_venta, tipo_comprobante, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, cliente_id || null, req.user.id, subtotal, descuento, impuesto, total,
        metodo_pago || 'efectivo', condicion_venta, tipo_comprobante, notas]
    );
    const ventaId = r.insertId;

    for (const l of lineas) {
      await conn.execute(
        `INSERT INTO venta_items
         (venta_id, producto_id, nombre, codigo_cabys, cantidad, precio_unit,
          descuento, tarifa_iva, iva_monto, total_linea)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ventaId, l.producto_id, l.nombre, l.codigo_cabys, l.cantidad, l.precio_unit,
          l.descuento, l.tarifa_iva, l.iva_monto, l.total_linea]
      );
      // Descuenta stock
      const nuevoStock = l.stock_actual - l.cantidad;
      await conn.execute('UPDATE productos SET stock = ? WHERE id = ?', [nuevoStock, l.producto_id]);
      await conn.execute(
        `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_resultante, referencia, usuario_id)
         VALUES (?, 'venta', ?, ?, ?, ?)`,
        [l.producto_id, -l.cantidad, nuevoStock, numero, req.user.id]
      );
    }
    return { id: ventaId, numero };
  });

  // Si es factura/tiquete electronico y la FE esta activa, intenta emitir
  let feResultado = null;
  if (tipo_comprobante === 'factura_electronica' || tipo_comprobante === 'tiquete_electronico') {
    feResultado = await emitirFE(ventaCreada.id, tipo_comprobante, { lineas, subtotal, descuento, impuesto, total, cliente_id, metodo_pago, condicion_venta });
  }

  const ventaFull = await query('SELECT * FROM ventas WHERE id = :id', { id: ventaCreada.id });
  return ok(res, { ...ventaFull[0], fe: feResultado }, 201);
});

// ---- Emision de Factura/Tiquete Electronico ----
async function emitirFE(ventaId, tipo, datos) {
  const cfg = await cargarConfig();
  if (!cfg || !cfg.activa) {
    await query('UPDATE ventas SET fe_estado = :e WHERE id = :id', { e: 'inactiva', id: ventaId });
    return { estado: 'inactiva', mensaje: 'La facturacion electronica no esta activada en Configuracion' };
  }

  const empresa = (await query('SELECT * FROM empresa ORDER BY id LIMIT 1'))[0];
  let cliente = null;
  if (datos.cliente_id) {
    cliente = (await query('SELECT * FROM clientes WHERE id = :id', { id: datos.cliente_id }))[0];
  }

  // Consecutivo y clave
  const campo = tipo === 'factura_electronica' ? 'consecutivo_fe' : 'consecutivo_te';
  const numero = cfg[campo];
  const consecutivo = generarConsecutivo({
    sucursal: cfg.sucursal, terminal: cfg.terminal,
    tipoDoc: TIPO_DOC[tipo], numero,
  });
  const clave = generarClave({ cedula: empresa.identificacion, consecutivo });

  const xml = construirXML({
    empresa, cliente, items: datos.lineas,
    totales: { subtotal: datos.subtotal, descuento: datos.descuento, impuesto: datos.impuesto, total: datos.total },
    clave, consecutivo, tipo,
    condicionVenta: datos.condicion_venta, metodoPago: datos.metodo_pago,
  });

  // Incrementa el consecutivo
  await query(`UPDATE config_hacienda SET ${campo} = ${campo} + 1 WHERE id = :id`, { id: cfg.id });

  // Guarda XML y clave en la venta
  await query(
    'UPDATE ventas SET fe_clave = :clave, fe_consecutivo = :cons, fe_xml = :xml, fe_estado = :est WHERE id = :id',
    { clave, cons: consecutivo, xml, est: 'generado', id: ventaId }
  );

  // ====================================================================
  //  PUNTO DE FIRMA DIGITAL (XAdES-EPES con la llave .p12)
  //  En SANDBOX puedes quedarte aqui: ya tienes XML + clave + consecutivo,
  //  suficiente para generar el PDF y hacer demos completas.
  //  Para enviar a Hacienda de verdad, firma el XML con la llave .p12
  //  (ver README, seccion "Firma digital") y luego descomenta el envio:
  // ====================================================================
  /*
  try {
    const xmlFirmado = await firmarXML(xml, cfg);  // implementar con node-xades o microservicio
    const token = await obtenerToken(cfg);
    const resp = await enviarAHacienda({
      cfg, token, clave,
      fechaEmision: new Date().toISOString(),
      emisor: { tipoIdentificacion: empresa.tipo_identificacion, numeroIdentificacion: empresa.identificacion },
      receptor: cliente ? { tipoIdentificacion: cliente.tipo_identificacion, numeroIdentificacion: cliente.identificacion } : undefined,
      xmlFirmadoBase64: Buffer.from(xmlFirmado).toString('base64'),
    });
    const estado = resp.status === 202 ? 'enviado' : 'error';
    await query('UPDATE ventas SET fe_estado = :est, fe_respuesta = :resp WHERE id = :id',
      { est: estado, resp: resp.body, id: ventaId });
    return { estado, clave, consecutivo, respuesta: resp.body };
  } catch (err) {
    await query('UPDATE ventas SET fe_estado = :est, fe_respuesta = :resp WHERE id = :id',
      { est: 'error', resp: err.message, id: ventaId });
    return { estado: 'error', clave, consecutivo, mensaje: err.message };
  }
  */

  return {
    estado: 'generado',
    clave, consecutivo,
    mensaje: 'XML v4.4 generado correctamente (modo demo/sandbox sin firma). Listo para PDF.',
    ambiente: cfg.ambiente,
  };
}

// ---- Anular venta (devuelve stock) ----
export const anular = asyncHandler(async (req, res) => {
  await transaction(async (conn) => {
    const [v] = await conn.execute('SELECT * FROM ventas WHERE id = ?', [req.params.id]);
    if (!v[0]) throw Object.assign(new Error('Venta no encontrada'), { status: 404 });
    if (v[0].estado === 'anulada') throw Object.assign(new Error('La venta ya esta anulada'), { status: 400 });
    const [items] = await conn.execute('SELECT * FROM venta_items WHERE venta_id = ?', [req.params.id]);
    for (const it of items) {
      if (it.producto_id) {
        const [prod] = await conn.execute('SELECT stock FROM productos WHERE id = ?', [it.producto_id]);
        const nuevoStock = Number(prod[0].stock) + Number(it.cantidad);
        await conn.execute('UPDATE productos SET stock = ? WHERE id = ?', [nuevoStock, it.producto_id]);
        await conn.execute(
          `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_resultante, referencia, usuario_id)
           VALUES (?, 'ajuste', ?, ?, 'Anulacion venta', ?)`,
          [it.producto_id, it.cantidad, nuevoStock, req.user.id]
        );
      }
    }
    await conn.execute('UPDATE ventas SET estado = "anulada" WHERE id = ?', [req.params.id]);
  });
  return ok(res, { mensaje: 'Venta anulada y stock devuelto' });
});

// ---- Generar QR del comprobante ----
export const generarQR = asyncHandler(async (req, res) => {
  const venta = (await query('SELECT * FROM ventas WHERE id = :id', { id: req.params.id }))[0];
  if (!venta) return fail(res, 'Venta no encontrada', 404);
  const empresa = (await query('SELECT * FROM empresa ORDER BY id LIMIT 1'))[0];
  // El QR contiene un enlace al comprobante (o la clave de Hacienda si existe)
  const contenido = venta.fe_clave
    ? `https://www.hacienda.go.cr/consultas/comprobante?clave=${venta.fe_clave}`
    : `${process.env.CLIENT_URL || ''}/comprobante/${venta.id}`;
  const dataUrl = await QRCode.toDataURL(contenido, { width: 300, margin: 1 });
  return ok(res, { qr: dataUrl, contenido, numero: venta.numero, comercio: empresa?.nombre_comercial });
});

// ---- Enviar comprobante por correo (ticket normal, NO la FE) ----
export const enviarPorCorreo = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const venta = (await query('SELECT * FROM ventas WHERE id = :id', { id: req.params.id }))[0];
  if (!venta) return fail(res, 'Venta no encontrada', 404);
  const items = await query('SELECT * FROM venta_items WHERE venta_id = :id', { id: req.params.id });
  const empresa = (await query('SELECT * FROM empresa ORDER BY id LIMIT 1'))[0];

  let destino = email;
  if (!destino && venta.cliente_id) {
    const c = (await query('SELECT email FROM clientes WHERE id = :id', { id: venta.cliente_id }))[0];
    destino = c?.email;
  }
  if (!destino) return fail(res, 'No hay correo de destino');

  const link = `${process.env.CLIENT_URL || ''}/comprobante/${venta.id}`;
  const qrDataUrl = await QRCode.toDataURL(link, { width: 220, margin: 1 });

  const filas = items.map((it) =>
    `<tr><td>${it.nombre}</td><td style="text-align:center">${it.cantidad}</td>
     <td style="text-align:right">₡${Number(it.total_linea).toLocaleString('es-CR')}</td></tr>`
  ).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1e1233">
      <h2 style="color:#7c3aed">${empresa?.nombre_comercial || 'Comprobante'}</h2>
      <p>Comprobante <strong>${venta.numero}</strong> · ${new Date(venta.fecha).toLocaleString('es-CR')}</p>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid #ddd"><th align="left">Producto</th><th>Cant</th><th align="right">Total</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p style="text-align:right;font-size:18px"><strong>Total: ₡${Number(venta.total).toLocaleString('es-CR')}</strong></p>
      <p style="text-align:center"><img src="cid:qrcomprobante" alt="QR" width="180"/></p>
      <p style="text-align:center"><a href="${link}" style="color:#7c3aed">Ver comprobante en linea</a></p>
      <p style="text-align:center;color:#888;font-size:12px">${empresa?.mensaje_factura || ''}</p>
    </div>`;

  const resultado = await enviarComprobante({
    to: destino,
    asunto: `Comprobante ${venta.numero} - ${empresa?.nombre_comercial || ''}`,
    html, qrDataUrl,
  });
  return ok(res, resultado);
});
