import { create } from 'xmlbuilder2';
import { fechaISOCostaRica } from '../utils/fechas.js';

// ============================================================
//  Factura Electronica de Compra (tipo 08) - v4.4
//
//  La emite el COMPRADOR cuando le compra a alguien que no esta
//  obligado a facturar electronicamente: regimen simplificado,
//  no inscritos, no domiciliados y no contribuyentes.
//
//  Ojo con los papeles invertidos respecto a una factura normal:
//    Emisor   = el negocio (quien compra y emite el documento)
//    Receptor = el proveedor que vendio
// ============================================================

const NS = 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronicaCompra';

// Condicion del vendedor -> como se declara ante Hacienda
export const CONDICION_PROVEEDOR = {
  simplificado: { etiqueta: 'Regimen simplificado', tipo_id_default: '01' },
  no_domiciliado: { etiqueta: 'Extranjero no domiciliado', tipo_id_default: '05' },
  no_contribuyente: { etiqueta: 'No contribuyente', tipo_id_default: '01' },
};

/** Una compra necesita FEC salvo que el proveedor este inscrito y facture el mismo. */
export const requiereFEC = (condicion) => condicion && condicion !== 'inscrito';

export function construirXMLFacturaCompra({ empresa, proveedor, items, totales, clave, consecutivo, condicionVenta, metodoPago }) {
  const doc = create({ version: '1.0', encoding: 'UTF-8' }).ele('FacturaElectronicaCompra', { xmlns: NS });

  doc.ele('Clave').txt(clave).up();
  doc.ele('ProveedorSistemas').txt(soloDigitos(empresa.identificacion)).up();
  doc.ele('CodigoActividadEmisor').txt(empresa.codigo_actividad || '').up();
  doc.ele('NumeroConsecutivo').txt(consecutivo).up();
  doc.ele('FechaEmision').txt(fechaISOCostaRica()).up();

  // ---- Emisor: el negocio que compra ----
  const emisor = doc.ele('Emisor');
  emisor.ele('Nombre').txt(empresa.razon_social || empresa.nombre_comercial).up();
  const idEm = emisor.ele('Identificacion');
  idEm.ele('Tipo').txt(empresa.tipo_identificacion || '01').up();
  idEm.ele('Numero').txt(soloDigitos(empresa.identificacion)).up();
  idEm.up();
  if (empresa.nombre_comercial) emisor.ele('NombreComercial').txt(empresa.nombre_comercial).up();
  const ubEm = emisor.ele('Ubicacion');
  ubEm.ele('Provincia').txt(empresa.provincia || '1').up();
  ubEm.ele('Canton').txt(empresa.canton || '01').up();
  ubEm.ele('Distrito').txt(empresa.distrito || '01').up();
  if (empresa.barrio) ubEm.ele('Barrio').txt(empresa.barrio).up();
  ubEm.ele('OtrasSenas').txt(empresa.direccion_exacta || 'No indica').up();
  ubEm.up();
  emisor.ele('CorreoElectronico').txt(empresa.email || 'no-indica@correo.com').up();
  emisor.up();

  // ---- Receptor: el proveedor al que se le compro ----
  const receptor = doc.ele('Receptor');
  receptor.ele('Nombre').txt(proveedor.nombre).up();
  const idRe = receptor.ele('Identificacion');
  idRe.ele('Tipo').txt(proveedor.tipo_identificacion || '01').up();
  idRe.ele('Numero').txt(soloDigitos(proveedor.identificacion)).up();
  idRe.up();
  if (proveedor.email) receptor.ele('CorreoElectronico').txt(proveedor.email).up();
  receptor.up();

  doc.ele('CondicionVenta').txt(condicionVenta || '01').up();

  // ---- Lineas ----
  const detalle = doc.ele('DetalleServicio');
  items.forEach((it, i) => {
    const cantidad = Number(it.cantidad);
    const precio = Number(it.costo_unit);
    const descuento = Number(it.descuento || 0);
    const montoLinea = cantidad * precio;
    const subtotal = montoLinea - descuento;
    const iva = Number(it.iva_monto || 0);

    const linea = detalle.ele('LineaDetalle');
    linea.ele('NumeroLinea').txt(String(i + 1)).up();
    linea.ele('CodigoCABYS').txt(it.codigo_cabys || '').up();
    linea.ele('Cantidad').txt(String(cantidad)).up();
    linea.ele('UnidadMedida').txt(it.unidad_medida || 'Unid').up();
    linea.ele('Detalle').txt(it.nombre).up();
    linea.ele('PrecioUnitario').txt(precio.toFixed(5)).up();
    linea.ele('MontoTotal').txt(montoLinea.toFixed(5)).up();
    if (descuento > 0) {
      const d = linea.ele('Descuento');
      d.ele('MontoDescuento').txt(descuento.toFixed(5)).up();
      d.ele('CodigoDescuento').txt('01').up();
      d.up();
    }
    linea.ele('SubTotal').txt(subtotal.toFixed(5)).up();
    const imp = linea.ele('Impuesto');
    imp.ele('Codigo').txt('01').up(); // IVA
    imp.ele('CodigoTarifaIVA').txt(tarifaCodigo(it.tarifa_iva)).up();
    imp.ele('Tarifa').txt(Number(it.tarifa_iva || 0).toFixed(2)).up();
    imp.ele('Monto').txt(iva.toFixed(5)).up();
    imp.up();
    linea.ele('ImpuestoNeto').txt(iva.toFixed(5)).up();
    linea.ele('MontoTotalLinea').txt((subtotal + iva).toFixed(5)).up();
    linea.up();
  });
  detalle.up();

  // ---- Resumen ----
  const resumen = doc.ele('ResumenFactura');
  const cm = resumen.ele('CodigoTipoMoneda');
  cm.ele('CodigoMoneda').txt(empresa.moneda || 'CRC').up();
  cm.ele('TipoCambio').txt('1.00000').up();
  cm.up();
  resumen.ele('TotalMercanciasGravadas').txt(n(totales.gravado)).up();
  if (Number(totales.exento) > 0) resumen.ele('TotalMercanciasExentas').txt(n(totales.exento)).up();
  resumen.ele('TotalGravado').txt(n(totales.gravado)).up();
  resumen.ele('TotalExento').txt(n(totales.exento)).up();
  resumen.ele('TotalVenta').txt(n(Number(totales.gravado) + Number(totales.exento))).up();
  resumen.ele('TotalDescuentos').txt(n(totales.descuento)).up();
  resumen.ele('TotalVentaNeta').txt(n(totales.subtotal)).up();
  resumen.ele('TotalImpuesto').txt(n(totales.impuesto)).up();
  const mp = resumen.ele('MedioPago');
  mp.ele('TipoMedioPago').txt(medioPagoCodigo(metodoPago)).up();
  mp.ele('TotalMedioPago').txt(n(totales.total)).up();
  mp.up();
  resumen.ele('TotalComprobante').txt(n(totales.total)).up();
  resumen.up();

  return doc.end({ prettyPrint: true });
}

const n = (v) => Number(v || 0).toFixed(5);
const soloDigitos = (v) => String(v || '').replace(/\D/g, '');

function tarifaCodigo(tarifa) {
  const t = Number(tarifa);
  if (t === 13) return '08';
  if (t === 4) return '04';
  if (t === 2) return '03';
  if (t === 1) return '02';
  if (t === 0) return '01';
  return '08';
}

function medioPagoCodigo(metodo) {
  switch ((metodo || '').toLowerCase()) {
    case 'efectivo': return '01';
    case 'tarjeta': return '02';
    case 'cheque': return '03';
    case 'transferencia':
    case 'sinpe': return '04';
    default: return '01';
  }
}
