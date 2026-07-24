// ============================================================
//  Fechas para Hacienda
//
//  Los comprobantes exigen ISO 8601 CON offset de zona horaria.
//  Un "2026-07-23T20:15:00.000Z" es rechazado: hay que mandar
//  "2026-07-23T14:15:00-06:00". Costa Rica es UTC-6 todo el año
//  (no aplica horario de verano), asi que el offset es fijo.
// ============================================================

const OFFSET_CR_MIN = -6 * 60;

// "2026-07-15 09:30:00" / "2026-07-15T09:30:00" sin zona horaria.
// MySQL devuelve las DATETIME asi, y ya vienen en hora de Costa Rica.
const SIN_ZONA = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)/;

/**
 * Convierte una fecha a ISO 8601 con el offset de Costa Rica.
 *
 * Si recibe un texto sin zona horaria se asume que YA esta en hora de
 * Costa Rica y solo se le pega el offset: asi la FechaEmisionDoc del
 * Mensaje Receptor sale identica a la del comprobante original, que es
 * lo que compara Hacienda.
 *
 * @param {Date|string|number} [fecha] por defecto, ahora
 */
export function fechaISOCostaRica(fecha = new Date()) {
  if (typeof fecha === 'string') {
    const m = fecha.match(SIN_ZONA);
    if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(fecha.trim())) {
      const hora = m[2].length === 5 ? `${m[2]}:00` : m[2];
      return `${m[1]}T${hora}-06:00`;
    }
  }

  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return fechaISOCostaRica(new Date());

  // Corremos el reloj 6 horas hacia atras y luego leemos los campos en UTC:
  // asi obtenemos la hora de pared de Costa Rica sin depender del TZ del servidor.
  const local = new Date(d.getTime() + OFFSET_CR_MIN * 60000);

  const p = (n) => String(n).padStart(2, '0');
  return (
    `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}-06:00`
  );
}

/** Partes de la fecha en hora de Costa Rica, para armar la clave numerica. */
export function partesFechaCR(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const local = new Date(d.getTime() + OFFSET_CR_MIN * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return {
    dd: p(local.getUTCDate()),
    mm: p(local.getUTCMonth() + 1),
    yy: String(local.getUTCFullYear()).slice(-2),
  };
}
