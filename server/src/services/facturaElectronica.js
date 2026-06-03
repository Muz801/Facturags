import { create } from 'xmlbuilder2';
import config from '../config/index.js';
import { query } from '../config/db.js';
import { decrypt } from '../utils/crypto.js';

// ============================================================
//  Servicio de Factura Electronica Costa Rica v4.4
//
//  IMPORTANTE sobre el alcance de este modulo:
//  - Genera la CLAVE numerica de 50 digitos segun el formato de Hacienda.
//  - Genera el CONSECUTIVO de 20 posiciones.
//  - Construye el XML v4.4 (FacturaElectronica / TiqueteElectronico).
//  - Obtiene el token OAuth del IDP de Hacienda y envia a Recepcion.
//
//  La FIRMA DIGITAL XAdES-EPES con la llave .p12 es el unico paso que
//  requiere una libreria de firma especifica (ver README, seccion "Firma").
//  Dejamos el punto de integracion claramente marcado mas abajo.
//  En SANDBOX puedes generar y validar el XML y el PDF sin firmar realmente,
//  para hacer demos completas hasta el XML/PDF.
// ============================================================

// Tipos de documento (codigo de 2 digitos dentro de la clave)
const TIPO_DOC = {
  factura_electronica: '01',
  nota_debito: '02',
  nota_credito: '03',
  tiquete_electronico: '04',
};

// ---- Clave numerica de 50 digitos ----
// Estructura: pais(3) + dia(2) mes(2) anio(2) + cedula(12) + consecutivo(20)
//             + situacion(1) + codigoSeguridad(8)
export function generarClave({ cedula, consecutivo, situacion = '1' }) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const pais = '506';
  const ced = String(cedula || '').replace(/\D/g, '').padStart(12, '0').slice(-12);
  const cons = String(consecutivo).padStart(20, '0');
  const codigoSeguridad = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  return `${pais}${dd}${mm}${yy}${ced}${cons}${situacion}${codigoSeguridad}`;
}

// ---- Consecutivo de 20 posiciones ----
// sucursal(3) + terminal(5) + tipoDoc(2) + numero(10)
export function generarConsecutivo({ sucursal, terminal, tipoDoc, numero }) {
  const suc = String(sucursal).padStart(3, '0');
  const term = String(terminal).padStart(5, '0');
  const num = String(numero).padStart(10, '0');
  return `${suc}${term}${tipoDoc}${num}`;
}

// ---- Construccion del XML v4.4 ----
export function construirXML({ empresa, cliente, items, totales, clave, consecutivo, tipo, condicionVenta, metodoPago }) {
  const ahora = new Date().toISOString();
  const esTiquete = tipo === 'tiquete_electronico';
  const rootName = esTiquete ? 'TiqueteElectronico' : 'FacturaElectronica';
  const ns = esTiquete
    ? 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico'
    : 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica';

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele(rootName, { xmlns: ns });

  doc.ele('Clave').txt(clave).up();
  doc.ele('ProveedorSistemas').txt(empresa.identificacion || '').up();
  doc.ele('CodigoActividadEmisor').txt(empresa.codigo_actividad || '000000').up();
  doc.ele('NumeroConsecutivo').txt(consecutivo).up();
  doc.ele('FechaEmision').txt(ahora).up();

  // Emisor (el negocio)
  const emisor = doc.ele('Emisor');
  emisor.ele('Nombre').txt(empresa.razon_social || empresa.nombre_comercial).up();
  const idEm = emisor.ele('Identificacion');
  idEm.ele('Tipo').txt(empresa.tipo_identificacion || '01').up();
  idEm.ele('Numero').txt(String(empresa.identificacion || '').replace(/\D/g, '')).up();
  idEm.up();
  emisor.ele('NombreComercial').txt(empresa.nombre_comercial || '').up();
  const ubEm = emisor.ele('Ubicacion');
  ubEm.ele('Provincia').txt(empresa.provincia || '1').up();
  ubEm.ele('Canton').txt(empresa.canton || '01').up();
  ubEm.ele('Distrito').txt(empresa.distrito || '01').up();
  if (empresa.barrio) ubEm.ele('Barrio').txt(empresa.barrio).up();
  ubEm.ele('OtrasSenas').txt(empresa.direccion_exacta || 'No indica').up();
  ubEm.up();
  emisor.ele('CorreoElectronico').txt(empresa.email || 'no-indica@correo.com').up();
  emisor.up();

  // Receptor (el cliente) - opcional en tiquete
  if (!esTiquete && cliente && cliente.identificacion) {
    const receptor = doc.ele('Receptor');
    receptor.ele('Nombre').txt(cliente.nombre).up();
    const idRe = receptor.ele('Identificacion');
    idRe.ele('Tipo').txt(cliente.tipo_identificacion || '01').up();
    idRe.ele('Numero').txt(String(cliente.identificacion).replace(/\D/g, '')).up();
    idRe.up();
    if (cliente.email) receptor.ele('CorreoElectronico').txt(cliente.email).up();
    receptor.up();
  }

  doc.ele('CondicionVenta').txt(condicionVenta || '01').up();

  // Detalle de lineas
  const detalle = doc.ele('DetalleServicio');
  items.forEach((it, i) => {
    const linea = detalle.ele('LineaDetalle');
    linea.ele('NumeroLinea').txt(String(i + 1)).up();
    linea.ele('CodigoCABYS').txt(it.codigo_cabys || '0000000000000').up();
    linea.ele('Cantidad').txt(String(it.cantidad)).up();
    linea.ele('UnidadMedida').txt(it.unidad_medida || 'Unid').up();
    linea.ele('Detalle').txt(it.nombre).up();
    linea.ele('PrecioUnitario').txt(String(it.precio_unit)).up();
    const montoLinea = Number(it.cantidad) * Number(it.precio_unit);
    linea.ele('MontoTotal').txt(montoLinea.toFixed(2)).up();
    if (Number(it.descuento) > 0) {
      const desc = linea.ele('Descuento');
      desc.ele('MontoDescuento').txt(Number(it.descuento).toFixed(2)).up();
      desc.up();
    }
    const subtotalLinea = montoLinea - Number(it.descuento || 0);
    linea.ele('SubTotal').txt(subtotalLinea.toFixed(2)).up();
    // Impuesto
    const imp = linea.ele('Impuesto');
    imp.ele('Codigo').txt('01').up(); // 01 = IVA
    imp.ele('CodigoTarifaIVA').txt(tarifaCodigo(it.tarifa_iva)).up();
    imp.ele('Tarifa').txt(Number(it.tarifa_iva).toFixed(2)).up();
    imp.ele('Monto').txt(Number(it.iva_monto).toFixed(2)).up();
    imp.up();
    linea.ele('ImpuestoNeto').txt(Number(it.iva_monto).toFixed(2)).up();
    linea.ele('MontoTotalLinea').txt(Number(it.total_linea).toFixed(2)).up();
    linea.up();
  });
  detalle.up();

  // Resumen de la factura
  const resumen = doc.ele('ResumenFactura');
  const cm = resumen.ele('CodigoTipoMoneda');
  cm.ele('CodigoMoneda').txt(empresa.moneda || 'CRC').up();
  cm.ele('TipoCambio').txt('1.00000').up();
  cm.up();
  resumen.ele('TotalServGravados').txt(Number(totales.subtotal).toFixed(2)).up();
  resumen.ele('TotalGravado').txt(Number(totales.subtotal).toFixed(2)).up();
  resumen.ele('TotalVenta').txt(Number(totales.subtotal).toFixed(2)).up();
  resumen.ele('TotalDescuentos').txt(Number(totales.descuento).toFixed(2)).up();
  resumen.ele('TotalVentaNeta').txt((Number(totales.subtotal) - Number(totales.descuento)).toFixed(2)).up();
  resumen.ele('TotalImpuesto').txt(Number(totales.impuesto).toFixed(2)).up();
  // Medio de pago v4.4
  const mp = resumen.ele('MedioPago');
  mp.ele('TipoMedioPago').txt(medioPagoCodigo(metodoPago)).up();
  mp.ele('TotalMedioPago').txt(Number(totales.total).toFixed(2)).up();
  mp.up();
  resumen.ele('TotalComprobante').txt(Number(totales.total).toFixed(2)).up();
  resumen.up();

  return doc.end({ prettyPrint: true });
}

// Mapea la tarifa de IVA al codigo de Hacienda
function tarifaCodigo(tarifa) {
  const t = Number(tarifa);
  if (t === 13) return '08';
  if (t === 4) return '04';
  if (t === 2) return '03';
  if (t === 1) return '02';
  if (t === 0) return '01';
  return '08';
}

// Mapea metodo de pago interno al codigo de Hacienda v4.4
function medioPagoCodigo(metodo) {
  switch ((metodo || '').toLowerCase()) {
    case 'efectivo': return '01';
    case 'tarjeta': return '02';
    case 'transferencia': return '04';
    case 'sinpe': return '04';
    default: return '01';
  }
}

// ---- Token OAuth de Hacienda (password grant) ----
export async function obtenerToken(cfg) {
  const amb = cfg.ambiente === 'prod' ? config.hacienda.prod : config.hacienda.sandbox;
  const password = decrypt(cfg.password_api_enc);

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: amb.clientId,
    username: cfg.usuario_api,
    password,
  });

  const resp = await fetch(amb.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`No se pudo autenticar con Hacienda: ${resp.status} ${txt}`);
  }
  const data = await resp.json();
  return data.access_token;
}

// ---- Envio del comprobante a Recepcion ----
export async function enviarAHacienda({ cfg, token, clave, fechaEmision, emisor, receptor, xmlFirmadoBase64 }) {
  const amb = cfg.ambiente === 'prod' ? config.hacienda.prod : config.hacienda.sandbox;
  const payload = {
    clave,
    fecha: fechaEmision,
    emisor,
    ...(receptor ? { receptor } : {}),
    comprobanteXml: xmlFirmadoBase64,
  };
  const resp = await fetch(`${amb.recepcionUrl}recepcion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return { status: resp.status, location: resp.headers.get('location'), body: await resp.text() };
}

// ---- Consulta de estado en Hacienda ----
export async function consultarEstado({ cfg, token, clave }) {
  const amb = cfg.ambiente === 'prod' ? config.hacienda.prod : config.hacienda.sandbox;
  const resp = await fetch(`${amb.recepcionUrl}recepcion/${clave}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.json();
}

// Carga la config de Hacienda desde BD (fila unica)
export async function cargarConfig() {
  const rows = await query('SELECT * FROM config_hacienda ORDER BY id LIMIT 1');
  return rows[0] || null;
}
