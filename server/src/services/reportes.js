// Genera reportes en formato CSV compatibles con Excel (incluye BOM UTF-8
// para que las tildes y el simbolo de colon se vean bien al abrir en Excel).
// Los contadores pueden abrir estos archivos directamente o importarlos.

const BOM = '\uFEFF';

function escapeCsv(value) {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// rows: array de objetos. columns: [{ key, label }]
export function toCsv(columns, rows) {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsv(row[c.key])).join(','))
    .join('\n');
  return BOM + header + '\n' + body;
}

export function colones(n) {
  return Number(n || 0).toFixed(2);
}
