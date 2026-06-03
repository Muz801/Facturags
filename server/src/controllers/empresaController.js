import { query } from '../config/db.js';
import { asyncHandler, ok, fail } from '../utils/http.js';
import { encrypt } from '../utils/crypto.js';

// ---- Datos del comercio (editables, NADA quemado) ----
export const getEmpresa = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM empresa ORDER BY id LIMIT 1');
  return ok(res, rows[0] || null);
});

export const updateEmpresa = asyncHandler(async (req, res) => {
  const campos = [
    'nombre_comercial', 'razon_social', 'tipo_identificacion', 'identificacion',
    'provincia', 'canton', 'distrito', 'barrio', 'direccion_exacta',
    'telefono', 'email', 'sitio_web', 'logo_url', 'moneda',
    'codigo_actividad', 'mensaje_factura', 'tema_default',
  ];
  const data = {};
  campos.forEach((c) => { if (req.body[c] !== undefined) data[c] = req.body[c]; });
  if (Object.keys(data).length === 0) return fail(res, 'Nada que actualizar');

  const existing = await query('SELECT id FROM empresa ORDER BY id LIMIT 1');
  if (existing[0]) {
    const setClause = Object.keys(data).map((k) => `${k} = :${k}`).join(', ');
    await query(`UPDATE empresa SET ${setClause} WHERE id = :id`, { ...data, id: existing[0].id });
  } else {
    const cols = Object.keys(data).join(', ');
    const vals = Object.keys(data).map((k) => `:${k}`).join(', ');
    await query(`INSERT INTO empresa (${cols}) VALUES (${vals})`, data);
  }
  const rows = await query('SELECT * FROM empresa ORDER BY id LIMIT 1');
  return ok(res, rows[0]);
});

// ---- Config de Factura Electronica ----
// Devuelve la config SIN exponer los secretos (solo si estan configurados o no).
export const getConfigHacienda = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM config_hacienda ORDER BY id LIMIT 1');
  const c = rows[0];
  if (!c) return ok(res, null);
  return ok(res, {
    id: c.id,
    activa: !!c.activa,
    ambiente: c.ambiente,
    usuario_api: c.usuario_api,
    sucursal: c.sucursal,
    terminal: c.terminal,
    consecutivo_fe: c.consecutivo_fe,
    consecutivo_te: c.consecutivo_te,
    consecutivo_nc: c.consecutivo_nc,
    llave_nombre: c.llave_nombre,
    // Indicadores de si los secretos ya estan guardados (sin revelarlos)
    tiene_password: !!c.password_api_enc,
    tiene_pin: !!c.pin_llave_enc,
    tiene_llave: !!c.llave_p12_base64,
  });
});

export const updateConfigHacienda = asyncHandler(async (req, res) => {
  const { activa, ambiente, usuario_api, password_api, pin_llave, sucursal, terminal } = req.body;

  const existing = await query('SELECT id FROM config_hacienda ORDER BY id LIMIT 1');
  const data = {};
  if (activa !== undefined) data.activa = activa ? 1 : 0;
  if (ambiente !== undefined) data.ambiente = ambiente;
  if (usuario_api !== undefined) data.usuario_api = usuario_api;
  if (sucursal !== undefined) data.sucursal = sucursal;
  if (terminal !== undefined) data.terminal = terminal;
  // Secretos: solo se actualizan si vienen con valor (cifrados)
  if (password_api) data.password_api_enc = encrypt(password_api);
  if (pin_llave) data.pin_llave_enc = encrypt(pin_llave);

  if (existing[0]) {
    if (Object.keys(data).length === 0) return fail(res, 'Nada que actualizar');
    const setClause = Object.keys(data).map((k) => `${k} = :${k}`).join(', ');
    await query(`UPDATE config_hacienda SET ${setClause} WHERE id = :id`, { ...data, id: existing[0].id });
  } else {
    const cols = Object.keys(data).join(', ');
    const vals = Object.keys(data).map((k) => `:${k}`).join(', ');
    await query(`INSERT INTO config_hacienda (${cols}) VALUES (${vals})`, data);
  }
  return ok(res, { mensaje: 'Configuracion de Hacienda actualizada' });
});

// ---- Subir la llave .p12 (multer la deja en req.file) ----
export const subirLlave = asyncHandler(async (req, res) => {
  if (!req.file) return fail(res, 'No se recibio ningun archivo .p12');
  const base64 = req.file.buffer.toString('base64');
  const cifrada = encrypt(base64);

  const existing = await query('SELECT id FROM config_hacienda ORDER BY id LIMIT 1');
  if (existing[0]) {
    await query(
      'UPDATE config_hacienda SET llave_p12_base64 = :llave, llave_nombre = :nombre WHERE id = :id',
      { llave: cifrada, nombre: req.file.originalname, id: existing[0].id }
    );
  } else {
    await query(
      'INSERT INTO config_hacienda (llave_p12_base64, llave_nombre) VALUES (:llave, :nombre)',
      { llave: cifrada, nombre: req.file.originalname }
    );
  }
  return ok(res, { mensaje: 'Llave criptografica guardada de forma cifrada', nombre: req.file.originalname });
});
