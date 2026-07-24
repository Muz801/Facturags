import { create } from 'xmlbuilder2';
import { fechaISOCostaRica } from '../utils/fechas.js';

// ============================================================
//  Mensaje Receptor v4.4
//
//  Es la respuesta formal del negocio ante Hacienda por cada
//  comprobante que le facturan. Sin este mensaje el IVA soportado
//  NO es acreditable y el gasto queda expuesto en una fiscalizacion.
//
//  Mensaje:  1 = aceptado
//            2 = aceptado parcialmente
//            3 = rechazado
// ============================================================

const NS = 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeReceptor';

// Tipo de documento dentro del consecutivo del receptor
const TIPO_POR_MENSAJE = {
  1: '05', // confirmacion de aceptacion
  2: '06', // confirmacion de aceptacion parcial
  3: '07', // rechazo
};

export const ESTADO_POR_MENSAJE = {
  1: 'aceptado',
  2: 'aceptado_parcial',
  3: 'rechazado',
};

/**
 * Consecutivo del receptor: 20 posiciones.
 * sucursal(3) + terminal(5) + tipoDoc(2) + numero(10)
 */
export function generarConsecutivoReceptor({ sucursal, terminal, mensaje, numero }) {
  return (
    String(sucursal).padStart(3, '0') +
    String(terminal).padStart(5, '0') +
    TIPO_POR_MENSAJE[mensaje] +
    String(numero).padStart(10, '0')
  );
}

/**
 * Construye el XML del Mensaje Receptor.
 *
 * @param {object} p
 * @param {object} p.comprobante  fila de comprobantes_recibidos
 * @param {object} p.empresa      datos del negocio (receptor)
 * @param {1|2|3} p.mensaje
 * @param {string} p.detalle      motivo, obligatorio si es parcial o rechazo
 * @param {number} p.montoIvaAcreditar
 * @param {string} p.consecutivoReceptor
 */
export function construirMensajeReceptor({
  comprobante,
  empresa,
  mensaje,
  detalle,
  montoIvaAcreditar,
  consecutivoReceptor,
}) {
  const doc = create({ version: '1.0', encoding: 'UTF-8' }).ele('MensajeReceptor', { xmlns: NS });

  doc.ele('Clave').txt(comprobante.clave).up();
  doc.ele('NumeroCedulaEmisor').txt(soloDigitos(comprobante.emisor_identificacion)).up();
  doc.ele('FechaEmisionDoc').txt(fechaISOCostaRica(comprobante.fecha_emision)).up();
  doc.ele('Mensaje').txt(String(mensaje)).up();

  // Obligatorio cuando se rechaza o se acepta parcialmente: hay que decir por que
  if (detalle) doc.ele('DetalleMensaje').txt(String(detalle).slice(0, 160)).up();

  doc.ele('MontoTotalImpuesto').txt(monto(comprobante.total_impuesto)).up();
  doc.ele('CodigoActividad').txt(empresa.codigo_actividad || '').up();

  // Cuanto del IVA soportado se acredita el negocio
  doc.ele('MontoTotalImpuestoAcreditar').txt(monto(montoIvaAcreditar)).up();

  doc.ele('TotalFactura').txt(monto(comprobante.total_comprobante)).up();
  doc.ele('NumeroCedulaReceptor').txt(soloDigitos(empresa.identificacion)).up();
  doc.ele('NumeroConsecutivoReceptor').txt(consecutivoReceptor).up();

  // Hacienda rechaza el mensaje si viene con la declaracion <?xml ... ?>
  return doc.end({ prettyPrint: false, headless: true });
}

const soloDigitos = (v) => String(v || '').replace(/\D/g, '');
const monto = (v) => Number(v || 0).toFixed(5);
