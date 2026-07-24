import config from '../config/index.js';
import { decrypt } from '../utils/crypto.js';
import { firmarXMLBase64 } from './firma.js';
import { fechaISOCostaRica } from '../utils/fechas.js';

// ============================================================
//  Transmision a Hacienda
//
//  Un solo camino para TODO lo que se envia (factura, tiquete,
//  nota, factura de compra y mensaje receptor):
//     firmar -> pedir token -> POST /recepcion
//
//  El estado que devuelve el POST es solo el acuse (202 = recibido).
//  El resultado real (aceptado/rechazado) se consulta despues con
//  consultarComprobante(), porque Hacienda valida en diferido.
// ============================================================

const ambienteDe = (cfg) =>
  config.hacienda[cfg.ambiente] || config.hacienda.sandbox;

/** Saca la llave .p12 y su PIN de la configuracion, descifrados. */
export function llaveDeConfig(cfg) {
  return {
    p12Base64: decrypt(cfg.llave_p12_base64),
    pin: decrypt(cfg.pin_llave_enc),
  };
}

/** Revisa que la config sirva para transmitir, y explica que falta si no. */
export function revisarConfig(cfg) {
  if (!cfg) return 'No hay configuracion de Hacienda. Completala en Configuracion > Factura Electronica.';
  if (!cfg.activa) return 'La facturacion electronica esta desactivada en Configuracion.';
  if (!cfg.llave_p12_base64) return 'Falta subir la llave criptografica (.p12).';
  if (!cfg.pin_llave_enc) return 'Falta el PIN de la llave criptografica.';
  if (!cfg.usuario_api || !cfg.password_api_enc) return 'Faltan el usuario y la clave del API de Hacienda.';
  return null;
}

/** Token OAuth del IDP de Hacienda (grant de password). */
export async function obtenerToken(cfg) {
  const amb = ambienteDe(cfg);
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: amb.clientId,
    username: cfg.usuario_api,
    password: decrypt(cfg.password_api_enc),
  });

  const resp = await fetch(amb.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) {
    throw new Error(`Hacienda rechazo las credenciales del API (${resp.status}). Revisa usuario y clave en Configuracion.`);
  }
  return (await resp.json()).access_token;
}

/**
 * Firma un XML y lo transmite a Hacienda.
 *
 * @param {object} p
 * @param {object} p.cfg      fila de config_hacienda
 * @param {string} p.xml      XML sin firmar
 * @param {string} p.clave    clave de 50 digitos del documento
 * @param {object} p.emisor   { tipoIdentificacion, numeroIdentificacion }
 * @param {object} [p.receptor]
 * @param {string} [p.consecutivoReceptor] solo para Mensaje Receptor
 * @param {Date|string} [p.fechaEmision]
 * @returns {Promise<{estado:string, httpStatus:number, respuesta:string, xmlFirmado:string}>}
 */
export async function transmitir({ cfg, xml, clave, emisor, receptor, consecutivoReceptor, fechaEmision }) {
  const xmlFirmado = await firmarXMLBase64(xml, llaveDeConfig(cfg));
  const token = await obtenerToken(cfg);
  const amb = ambienteDe(cfg);

  const payload = {
    clave,
    fecha: fechaISOCostaRica(fechaEmision),
    emisor,
    ...(receptor ? { receptor } : {}),
    ...(consecutivoReceptor ? { consecutivoReceptor } : {}),
    comprobanteXml: xmlFirmado,
  };

  const resp = await fetch(`${amb.recepcionUrl}recepcion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  const cuerpo = await resp.text();
  // 202 Accepted = Hacienda recibio el documento y lo va a validar
  return {
    estado: resp.status === 202 ? 'enviado' : 'error',
    httpStatus: resp.status,
    respuesta: cuerpo || `HTTP ${resp.status}`,
    xmlFirmado,
  };
}

/**
 * Consulta el resultado de la validacion.
 * @returns {Promise<{estado:string, indEstado:string, respuestaXml:string, crudo:object}>}
 */
export async function consultarComprobante({ cfg, clave, consecutivoReceptor }) {
  const amb = ambienteDe(cfg);
  const token = await obtenerToken(cfg);
  // Para el mensaje receptor la consulta lleva clave + consecutivo del receptor
  const ruta = consecutivoReceptor ? `${clave}-${consecutivoReceptor}` : clave;

  const resp = await fetch(`${amb.recepcionUrl}recepcion/${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    return { estado: 'error', indEstado: '', respuestaXml: '', crudo: { status: resp.status, body: await resp.text() } };
  }

  const data = await resp.json();
  const ind = String(data['ind-estado'] || data.indEstado || '').toLowerCase();
  const mapa = { aceptado: 'aceptado', rechazado: 'rechazado', recibido: 'enviado', procesando: 'enviado', error: 'error' };

  return {
    estado: mapa[ind] || 'enviado',
    indEstado: ind,
    // Hacienda devuelve el XML de respuesta en base64
    respuestaXml: data['respuesta-xml'] ? Buffer.from(data['respuesta-xml'], 'base64').toString('utf8') : '',
    crudo: data,
  };
}
