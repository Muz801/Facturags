import AdmZip from 'adm-zip';
import { query } from '../config/db.js';
import { asyncHandler, ok, fail } from '../utils/http.js';
import {
  parsearComprobante,
  calcularFechaLimite,
  diasParaVencer,
  NOMBRE_TIPO,
} from '../services/comprobanteRecibido.js';
import {
  construirMensajeReceptor,
  generarConsecutivoReceptor,
  ESTADO_POR_MENSAJE,
} from '../services/mensajeReceptor.js';
import { transmitir, consultarComprobante, revisarConfig } from '../services/haciendaEnvio.js';
import { cargarConfig } from '../services/facturaElectronica.js';

// ============================================================
//  Buzon de comprobantes recibidos
//
//  Aqui entran las facturas que le hacen AL negocio. Cada una hay
//  que responderla ante Hacienda con un Mensaje Receptor antes del
//  8vo dia habil del mes siguiente, o se pierde el credito de IVA.
// ============================================================

const conPlazo = (r) => {
  const dias = diasParaVencer(r.fecha_limite);
  return {
    ...r,
    tipo_nombre: NOMBRE_TIPO[r.tipo_documento] || 'Comprobante',
    dias_para_vencer: dias,
    vencido: r.estado === 'pendiente' && dias !== null && dias < 0,
    urgente: r.estado === 'pendiente' && dias !== null && dias >= 0 && dias <= 3,
  };
};

// ---- Listado con filtros ----
export const listar = asyncHandler(async (req, res) => {
  const { estado, desde, hasta } = req.query;
  const rows = await query(
    `SELECT r.id, r.clave, r.tipo_documento, r.numero_consecutivo,
            r.emisor_nombre, r.emisor_identificacion, r.fecha_emision,
            r.moneda, r.total_gravado, r.total_exento, r.total_impuesto, r.total_comprobante,
            r.estado, r.mensaje, r.detalle_mensaje, r.monto_iva_acreditar,
            r.consecutivo_receptor, r.mr_estado, r.mr_enviado_at, r.fecha_limite,
            r.archivo_nombre, r.compra_id, r.gasto_id, r.created_at
       FROM comprobantes_recibidos r
      WHERE (:estado IS NULL OR r.estado = :estado)
        AND (:desde IS NULL OR r.fecha_emision >= :desde)
        AND (:hasta IS NULL OR r.fecha_emision <= :hasta)
      ORDER BY r.fecha_emision DESC, r.id DESC`,
    {
      estado: estado || null,
      desde: desde ? `${desde} 00:00:00` : null,
      hasta: hasta ? `${hasta} 23:59:59` : null,
    }
  );
  return ok(res, rows.map(conPlazo));
});

// ---- Resumen para el tablero: cuantos pendientes, cuantos por vencer ----
export const resumen = asyncHandler(async (req, res) => {
  // Ojo: el IVA que cuenta es el ACREDITADO, no el del comprobante.
  // En una aceptacion parcial solo se acredita una parte.
  const rows = await query(
    `SELECT estado, COUNT(*) AS cantidad,
            COALESCE(SUM(monto_iva_acreditar),0) AS iva,
            COALESCE(SUM(total_impuesto),0) AS iva_facturado
       FROM comprobantes_recibidos GROUP BY estado`
  );
  const pendientes = await query(
    `SELECT fecha_limite FROM comprobantes_recibidos WHERE estado = 'pendiente'`
  );

  let porVencer = 0;
  let vencidos = 0;
  for (const p of pendientes) {
    const d = diasParaVencer(p.fecha_limite);
    if (d === null) continue;
    if (d < 0) vencidos++;
    else if (d <= 3) porVencer++;
  }

  const porEstado = Object.fromEntries(
    rows.map((r) => [r.estado, { cantidad: r.cantidad, iva: Number(r.iva), iva_facturado: Number(r.iva_facturado) }])
  );
  return ok(res, {
    por_estado: porEstado,
    pendientes: porEstado.pendiente?.cantidad || 0,
    por_vencer: porVencer,
    vencidos,
  });
});

export const obtener = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM comprobantes_recibidos WHERE id = :id', { id: req.params.id });
  if (!rows[0]) return fail(res, 'Comprobante no encontrado', 404);
  return ok(res, conPlazo(rows[0]));
});

export const descargarXml = asyncHandler(async (req, res) => {
  const rows = await query('SELECT clave, xml_original FROM comprobantes_recibidos WHERE id = :id', {
    id: req.params.id,
  });
  if (!rows[0]) return fail(res, 'Comprobante no encontrado', 404);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${rows[0].clave}.xml"`);
  return res.send(rows[0].xml_original);
});

// ---- Subida de XML sueltos o un ZIP con varios ----
export const subir = asyncHandler(async (req, res) => {
  if (!req.files?.length) return fail(res, 'No se recibio ningun archivo.');

  const empresa = (await query('SELECT identificacion FROM empresa ORDER BY id LIMIT 1'))[0];
  const cedulaNegocio = String(empresa?.identificacion || '').replace(/\D/g, '');

  const archivos = [];
  for (const f of req.files) {
    if (/\.zip$/i.test(f.originalname)) {
      try {
        for (const entrada of new AdmZip(f.buffer).getEntries()) {
          if (entrada.isDirectory || !/\.xml$/i.test(entrada.entryName)) continue;
          archivos.push({ nombre: entrada.entryName.split('/').pop(), contenido: entrada.getData().toString('utf8') });
        }
      } catch {
        archivos.push({ nombre: f.originalname, error: 'No se pudo abrir el ZIP.' });
      }
    } else {
      archivos.push({ nombre: f.originalname, contenido: f.buffer.toString('utf8') });
    }
  }

  const resultados = [];
  for (const a of archivos) {
    if (a.error) {
      resultados.push({ archivo: a.nombre, ok: false, motivo: a.error });
      continue;
    }
    try {
      const datos = parsearComprobante(a.contenido);

      // Un comprobante emitido por el propio negocio no va al buzon de recibidos
      if (cedulaNegocio && datos.emisor_identificacion.replace(/\D/g, '') === cedulaNegocio) {
        resultados.push({ archivo: a.nombre, ok: false, motivo: 'Es un comprobante emitido por el negocio, no uno recibido.' });
        continue;
      }
      // Y uno dirigido a otra cedula tampoco: seria responder por un tercero
      if (cedulaNegocio && datos.receptor_identificacion && datos.receptor_identificacion.replace(/\D/g, '') !== cedulaNegocio) {
        resultados.push({
          archivo: a.nombre,
          ok: false,
          motivo: `El comprobante esta a nombre de ${datos.receptor_identificacion}, no del negocio.`,
        });
        continue;
      }

      const yaExiste = await query('SELECT id FROM comprobantes_recibidos WHERE clave = :clave', { clave: datos.clave });
      if (yaExiste.length) {
        resultados.push({ archivo: a.nombre, ok: false, motivo: 'Ya estaba en el buzon.', id: yaExiste[0].id });
        continue;
      }

      const r = await query(
        `INSERT INTO comprobantes_recibidos
           (clave, tipo_documento, numero_consecutivo, emisor_nombre, emisor_identificacion, emisor_email,
            receptor_identificacion, fecha_emision, moneda, tipo_cambio,
            total_gravado, total_exento, total_descuentos, total_impuesto, total_comprobante,
            fecha_limite, xml_original, archivo_nombre, usuario_id)
         VALUES (:clave, :tipo, :consec, :emNombre, :emId, :emEmail,
                 :reId, :fecha, :moneda, :tc,
                 :gravado, :exento, :desc, :impuesto, :total,
                 :limite, :xml, :archivo, :usuario)`,
        {
          clave: datos.clave,
          tipo: datos.tipo_documento,
          consec: datos.numero_consecutivo,
          emNombre: datos.emisor_nombre,
          emId: datos.emisor_identificacion,
          emEmail: datos.emisor_email,
          reId: datos.receptor_identificacion,
          fecha: datos.fecha_emision,
          moneda: datos.moneda,
          tc: datos.tipo_cambio,
          gravado: datos.total_gravado,
          exento: datos.total_exento,
          desc: datos.total_descuentos,
          impuesto: datos.total_impuesto,
          total: datos.total_comprobante,
          limite: calcularFechaLimite(datos.fecha_emision),
          xml: a.contenido,
          archivo: a.nombre.slice(0, 200),
          usuario: req.user.id,
        }
      );

      resultados.push({
        archivo: a.nombre,
        ok: true,
        id: r.insertId,
        clave: datos.clave,
        emisor: datos.emisor_nombre,
        total: datos.total_comprobante,
        sin_firma: !datos.firmado,
        sin_receptor: datos.sin_receptor,
      });
    } catch (err) {
      resultados.push({ archivo: a.nombre, ok: false, motivo: err.message });
    }
  }

  const importados = resultados.filter((r) => r.ok).length;
  return ok(res, { importados, total: resultados.length, resultados }, importados ? 201 : 200);
});

// ---- Responder ante Hacienda (Mensaje Receptor) ----
export const responder = asyncHandler(async (req, res) => {
  const { mensaje, detalle, monto_iva_acreditar } = req.body;
  const codigo = Number(mensaje);
  if (![1, 2, 3].includes(codigo)) {
    return fail(res, 'El mensaje debe ser 1 (acepta), 2 (acepta parcial) o 3 (rechaza).');
  }
  if ((codigo === 2 || codigo === 3) && !String(detalle || '').trim()) {
    return fail(res, 'Al aceptar parcialmente o rechazar hay que indicar el motivo.');
  }

  const comprobante = (await query('SELECT * FROM comprobantes_recibidos WHERE id = :id', { id: req.params.id }))[0];
  if (!comprobante) return fail(res, 'Comprobante no encontrado', 404);
  if (comprobante.mr_estado === 'aceptado') {
    return fail(res, 'Este comprobante ya fue respondido y Hacienda acepto ese mensaje.');
  }
  // Se puede rectificar una respuesta que Hacienda todavia no confirmo, pero
  // no por accidente: hay que pedirlo explicitamente.
  if (comprobante.estado !== 'pendiente' && !req.body.reemplazar) {
    return fail(
      res,
      `Este comprobante ya se respondio como "${comprobante.estado}". Para rectificar hay que confirmarlo explicitamente.`,
      409,
      { requiere_confirmacion: true, estado_actual: comprobante.estado }
    );
  }

  // Un comprobante que no identifica receptor (tipico del tiquete) no respalda
  // credito de IVA: responderlo seria acreditarse algo que no corresponde.
  if (!comprobante.receptor_identificacion && codigo !== 3) {
    return fail(
      res,
      'Este comprobante no identifica al receptor, asi que no da derecho a credito de IVA. ' +
      'Pidale al proveedor una factura electronica a nombre del negocio.',
      409
    );
  }

  const cfg = await cargarConfig();
  const problema = revisarConfig(cfg);
  if (problema) return fail(res, problema, 409);

  const empresa = (await query('SELECT * FROM empresa ORDER BY id LIMIT 1'))[0];

  // Si rechaza, no se acredita nada. Si acepta del todo, el IVA completo.
  const ivaAcreditar =
    codigo === 3 ? 0 : codigo === 1 ? Number(comprobante.total_impuesto) : Number(monto_iva_acreditar || 0);
  if (codigo === 2 && (ivaAcreditar <= 0 || ivaAcreditar > Number(comprobante.total_impuesto))) {
    return fail(res, 'El IVA a acreditar debe ser mayor a cero y no puede pasar del IVA del comprobante.');
  }

  const consecutivoReceptor = generarConsecutivoReceptor({
    sucursal: cfg.sucursal,
    terminal: cfg.terminal,
    mensaje: codigo,
    numero: cfg.consecutivo_mr,
  });

  const xml = construirMensajeReceptor({
    comprobante,
    empresa,
    mensaje: codigo,
    detalle,
    montoIvaAcreditar: ivaAcreditar,
    consecutivoReceptor,
  });

  // El consecutivo se consume aunque el envio falle: no se puede repetir
  await query('UPDATE config_hacienda SET consecutivo_mr = consecutivo_mr + 1 WHERE id = :id', { id: cfg.id });

  let resultado;
  try {
    resultado = await transmitir({
      cfg,
      xml,
      clave: comprobante.clave,
      fechaEmision: comprobante.fecha_emision,
      emisor: {
        tipoIdentificacion: tipoIdPorLongitud(comprobante.emisor_identificacion),
        numeroIdentificacion: String(comprobante.emisor_identificacion).replace(/\D/g, ''),
      },
      receptor: {
        tipoIdentificacion: empresa.tipo_identificacion || '01',
        numeroIdentificacion: String(empresa.identificacion).replace(/\D/g, ''),
      },
      consecutivoReceptor,
    });
  } catch (err) {
    await query(
      `UPDATE comprobantes_recibidos
          SET mr_xml = :xml, consecutivo_receptor = :cons, mr_estado = 'error', mr_respuesta = :resp
        WHERE id = :id`,
      { xml, cons: consecutivoReceptor, resp: err.message, id: comprobante.id }
    );
    return fail(res, `No se pudo enviar a Hacienda: ${err.message}`, 502);
  }

  // Guarda el Mensaje Receptor FIRMADO: es el que tiene valor ante Hacienda
  const mrFirmado = Buffer.from(resultado.xmlFirmado, 'base64').toString('utf8');
  await query(
    `UPDATE comprobantes_recibidos
        SET estado = :estado, mensaje = :mensaje, detalle_mensaje = :detalle,
            monto_iva_acreditar = :iva, consecutivo_receptor = :cons,
            mr_xml = :xml, mr_estado = :mrEstado, mr_respuesta = :resp, mr_enviado_at = NOW()
      WHERE id = :id`,
    {
      estado: ESTADO_POR_MENSAJE[codigo],
      mensaje: codigo,
      detalle: String(detalle || '').slice(0, 160),
      iva: ivaAcreditar,
      cons: consecutivoReceptor,
      xml: mrFirmado,
      mrEstado: resultado.estado,
      resp: resultado.respuesta,
      id: comprobante.id,
    }
  );

  return ok(res, {
    estado: ESTADO_POR_MENSAJE[codigo],
    mr_estado: resultado.estado,
    consecutivo_receptor: consecutivoReceptor,
    http_status: resultado.httpStatus,
    respuesta: resultado.respuesta,
  });
});

// ---- Consultar en Hacienda como quedo el mensaje enviado ----
export const consultarEstado = asyncHandler(async (req, res) => {
  const c = (await query('SELECT * FROM comprobantes_recibidos WHERE id = :id', { id: req.params.id }))[0];
  if (!c) return fail(res, 'Comprobante no encontrado', 404);
  if (!c.consecutivo_receptor) return fail(res, 'Todavia no se ha enviado un mensaje receptor para este comprobante.');

  const cfg = await cargarConfig();
  const problema = revisarConfig(cfg);
  if (problema) return fail(res, problema, 409);

  const r = await consultarComprobante({
    cfg,
    clave: c.clave,
    consecutivoReceptor: c.consecutivo_receptor,
  });

  await query('UPDATE comprobantes_recibidos SET mr_estado = :est, mr_respuesta = :resp WHERE id = :id', {
    est: r.estado,
    resp: r.respuestaXml || JSON.stringify(r.crudo),
    id: c.id,
  });

  return ok(res, { mr_estado: r.estado, ind_estado: r.indEstado, respuesta: r.respuestaXml });
});

// ---- Convertir un comprobante aceptado en gasto ----
export const registrarComoGasto = asyncHandler(async (req, res) => {
  const { categoria, descripcion } = req.body;
  const c = (await query('SELECT * FROM comprobantes_recibidos WHERE id = :id', { id: req.params.id }))[0];
  if (!c) return fail(res, 'Comprobante no encontrado', 404);
  if (c.gasto_id) return fail(res, 'Este comprobante ya se registro como gasto.');
  if (c.estado === 'rechazado') return fail(res, 'Un comprobante rechazado no se puede registrar como gasto.');

  // Busca el proveedor por cedula; si no existe lo crea con lo que trae el XML
  let proveedor = (
    await query('SELECT id FROM proveedores WHERE REPLACE(identificacion, "-", "") = :ced LIMIT 1', {
      ced: String(c.emisor_identificacion).replace(/\D/g, ''),
    })
  )[0];
  if (!proveedor) {
    const nuevo = await query(
      'INSERT INTO proveedores (nombre, identificacion, email) VALUES (:n, :i, :e)',
      { n: c.emisor_nombre || 'Proveedor', i: c.emisor_identificacion, e: c.emisor_email || '' }
    );
    proveedor = { id: nuevo.insertId };
  }

  const subtotal = Number(c.total_comprobante) - Number(c.total_impuesto);
  const g = await query(
    `INSERT INTO gastos (descripcion, categoria, monto, fecha, metodo_pago, proveedor_id, usuario_id,
                         comprobante_recibido_id, subtotal, iva_monto, iva_acreditable, clave_comprobante, notas)
     VALUES (:desc, :cat, :monto, :fecha, 'transferencia', :prov, :user,
             :comp, :sub, :iva, :acred, :clave, :notas)`,
    {
      desc: (descripcion || `${c.emisor_nombre} - ${c.numero_consecutivo}`).slice(0, 200),
      cat: categoria || 'General',
      monto: c.total_comprobante,
      fecha: String(c.fecha_emision).slice(0, 10),
      prov: proveedor.id,
      user: req.user.id,
      comp: c.id,
      sub: subtotal,
      iva: c.monto_iva_acreditar,
      acred: c.estado === 'pendiente' ? 0 : 1,
      clave: c.clave,
      notas: `Respaldado por comprobante electronico ${c.clave}`,
    }
  );

  await query('UPDATE comprobantes_recibidos SET gasto_id = :g WHERE id = :id', { g: g.insertId, id: c.id });
  return ok(res, { gasto_id: g.insertId }, 201);
});

// El tipo de identificacion se deduce del largo cuando el XML no lo trae
function tipoIdPorLongitud(identificacion) {
  const n = String(identificacion || '').replace(/\D/g, '');
  if (n.length === 9) return '01'; // fisica
  if (n.length === 10) return '02'; // juridica
  if (n.length === 11 || n.length === 12) return '03'; // DIMEX
  return '01';
}
