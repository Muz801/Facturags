import { XMLParser } from 'fast-xml-parser';
import { fechaISOCostaRica } from '../utils/fechas.js';

// ============================================================
//  Lectura de comprobantes electronicos que RECIBE el negocio
//
//  Cuando un proveedor factura, manda el XML firmado por correo.
//  Este modulo lo interpreta para poder mostrarlo en el buzon y
//  responderlo con un Mensaje Receptor ante Hacienda.
// ============================================================

// Nombre de la raiz del XML -> codigo de tipo de documento de Hacienda
const RAIZ_A_TIPO = {
  FacturaElectronica: '01',
  NotaDebitoElectronica: '02',
  NotaCreditoElectronica: '03',
  TiqueteElectronico: '04',
  FacturaElectronicaCompra: '08',
  FacturaElectronicaExportacion: '09',
  ReciboElectronicoPago: '10',
};

export const NOMBRE_TIPO = {
  '01': 'Factura electronica',
  '02': 'Nota de debito',
  '03': 'Nota de credito',
  '04': 'Tiquete electronico',
  '08': 'Factura electronica de compra',
  '09': 'Factura de exportacion',
  '10': 'Recibo electronico de pago',
};

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false, // todo como string: las claves de 50 digitos no caben en un Number
  trimValues: true,
});

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Interpreta el XML de un comprobante recibido.
 * @param {string} xml contenido del archivo .xml del proveedor
 * @returns {object} datos normalizados listos para guardar en comprobantes_recibidos
 */
export function parsearComprobante(xml) {
  let arbol;
  try {
    arbol = parser.parse(xml);
  } catch {
    throw new Error('El archivo no es un XML valido.');
  }

  // La raiz es el unico nodo de primer nivel que no sea la declaracion
  const raiz = Object.keys(arbol).find((k) => RAIZ_A_TIPO[k]);
  if (!raiz) {
    throw new Error(
      'El XML no es un comprobante electronico de Hacienda (no se reconoce la raiz del documento).'
    );
  }

  const doc = arbol[raiz];
  const resumen = doc.ResumenFactura || {};
  const emisor = doc.Emisor || {};
  const receptor = doc.Receptor || {};

  const clave = String(doc.Clave || '').trim();
  if (!/^\d{50}$/.test(clave)) {
    throw new Error('El comprobante no trae una clave numerica valida de 50 digitos.');
  }

  // El XML del proveedor viene firmado: si no trae firma, no es valido ante Hacienda
  const firmado = /<(\w+:)?Signature[\s>]/.test(xml);

  return {
    clave,
    tipo_documento: RAIZ_A_TIPO[raiz],
    numero_consecutivo: String(doc.NumeroConsecutivo || '').trim(),
    emisor_nombre: String(emisor.Nombre || '').slice(0, 160),
    emisor_identificacion: String(emisor.Identificacion?.Numero || '').trim(),
    emisor_email: String(emisor.CorreoElectronico || '').slice(0, 120),
    receptor_identificacion: String(receptor.Identificacion?.Numero || '').trim(),
    fecha_emision: aFechaMySQL(doc.FechaEmision),
    moneda: String(resumen.CodigoTipoMoneda?.CodigoMoneda || 'CRC'),
    tipo_cambio: num(resumen.CodigoTipoMoneda?.TipoCambio) || 1,
    total_gravado: num(resumen.TotalGravado),
    total_exento: num(resumen.TotalExento),
    total_descuentos: num(resumen.TotalDescuentos),
    total_impuesto: num(resumen.TotalImpuesto),
    total_comprobante: num(resumen.TotalComprobante),
    firmado,
    lineas: normalizarLineas(doc.DetalleServicio?.LineaDetalle),
  };
}

function normalizarLineas(lineas) {
  if (!lineas) return [];
  const arr = Array.isArray(lineas) ? lineas : [lineas];
  return arr.map((l) => ({
    nombre: String(l.Detalle || '').slice(0, 180),
    codigo_cabys: String(l.CodigoCABYS || ''),
    cantidad: num(l.Cantidad),
    unidad_medida: String(l.UnidadMedida || 'Unid'),
    costo_unit: num(l.PrecioUnitario),
    descuento: num(l.Descuento?.MontoDescuento),
    iva_monto: num(l.Impuesto?.Monto),
    tarifa_iva: num(l.Impuesto?.Tarifa),
    total_linea: num(l.MontoTotalLinea),
  }));
}

// Hacienda manda la fecha en ISO8601 con zona horaria (2026-07-23T14:05:00-06:00).
// La guardamos en hora de Costa Rica, no en UTC: la columna DATETIME no lleva
// zona, y al re-emitirla en el Mensaje Receptor tiene que salir igualita a la
// del comprobante original o Hacienda la rechaza.
function aFechaMySQL(iso) {
  if (!iso) return null;
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return null;
  return fechaISOCostaRica(d).slice(0, 19).replace('T', ' ');
}

// ---- Plazo para responder ----
// El plazo corre hasta el 8vo dia habil del mes siguiente al de la emision.
// Feriados de ley de Costa Rica (fijos). Los movibles se ajustan por año en la lista.
const FERIADOS_CR = [
  '01-01', // Año Nuevo
  '04-11', // Juan Santamaria
  '05-01', // Dia del Trabajador
  '07-25', // Anexion del Partido de Nicoya
  '08-02', // Virgen de los Angeles
  '08-15', // Dia de la Madre
  '09-15', // Independencia
  '12-25', // Navidad
];

const esHabil = (d) => {
  const dia = d.getDay();
  if (dia === 0 || dia === 6) return false;
  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return !FERIADOS_CR.includes(mmdd);
};

/**
 * Calcula la fecha limite para enviar el Mensaje Receptor:
 * 8vo dia habil del mes siguiente al de la fecha de emision.
 * Pasado ese dia se pierde el credito de IVA de ese comprobante.
 */
export function calcularFechaLimite(fechaEmision) {
  const base = fechaEmision ? new Date(fechaEmision) : new Date();
  if (Number.isNaN(base.getTime())) return null;

  const cursor = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  let habiles = 0;
  while (habiles < 8) {
    if (esHabil(cursor)) habiles++;
    if (habiles < 8) cursor.setDate(cursor.getDate() + 1);
  }
  return cursor.toISOString().slice(0, 10);
}

/** Dias que faltan para vencer el plazo. Negativo = ya vencio. */
export function diasParaVencer(fechaLimite) {
  if (!fechaLimite) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(`${String(fechaLimite).slice(0, 10)}T00:00:00`);
  return Math.round((limite - hoy) / 86400000);
}
