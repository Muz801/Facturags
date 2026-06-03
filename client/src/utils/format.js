// Formato de moneda en colones costarricenses
export function crc(n) {
  return '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function crcExacto(n) {
  return '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fecha(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fechaHora(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('es-CR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'sinpe', label: 'SINPE Movil' },
  { value: 'transferencia', label: 'Transferencia' },
];

export const TIPOS_COMPROBANTE = [
  { value: 'ticket', label: 'Ticket (comprobante interno)' },
  { value: 'tiquete_electronico', label: 'Tiquete Electronico' },
  { value: 'factura_electronica', label: 'Factura Electronica' },
];

export const TIPOS_ID = [
  { value: '01', label: 'Cedula Fisica' },
  { value: '02', label: 'Cedula Juridica' },
  { value: '03', label: 'DIMEX' },
  { value: '04', label: 'NITE' },
];
