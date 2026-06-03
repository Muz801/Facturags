import { query } from '../config/db.js';
import { asyncHandler, ok, fail } from '../utils/http.js';

// Genera un par listar/crear/actualizar/eliminar para una tabla simple
function crud(tabla, campos, requerido = 'nombre') {
  return {
    listar: asyncHandler(async (req, res) => {
      const { q } = req.query;
      let sql = `SELECT * FROM ${tabla} WHERE activo = 1`;
      const params = {};
      if (q) { sql += ` AND nombre LIKE :q`; params.q = `%${q}%`; }
      sql += ' ORDER BY nombre';
      return ok(res, await query(sql, params));
    }),
    obtener: asyncHandler(async (req, res) => {
      const rows = await query(`SELECT * FROM ${tabla} WHERE id = :id`, { id: req.params.id });
      if (!rows[0]) return fail(res, 'No encontrado', 404);
      return ok(res, rows[0]);
    }),
    crear: asyncHandler(async (req, res) => {
      if (!req.body[requerido]) return fail(res, `El campo ${requerido} es requerido`);
      const data = {};
      campos.forEach((c) => { data[c] = req.body[c] ?? ''; });
      const cols = campos.join(', ');
      const vals = campos.map((c) => `:${c}`).join(', ');
      const r = await query(`INSERT INTO ${tabla} (${cols}) VALUES (${vals})`, data);
      const rows = await query(`SELECT * FROM ${tabla} WHERE id = :id`, { id: r.insertId });
      return ok(res, rows[0], 201);
    }),
    actualizar: asyncHandler(async (req, res) => {
      const { id } = req.params;
      const data = { id };
      const sets = [];
      campos.forEach((c) => {
        if (req.body[c] !== undefined) { data[c] = req.body[c]; sets.push(`${c} = :${c}`); }
      });
      if (sets.length === 0) return fail(res, 'Nada que actualizar');
      await query(`UPDATE ${tabla} SET ${sets.join(', ')} WHERE id = :id`, data);
      const rows = await query(`SELECT * FROM ${tabla} WHERE id = :id`, { id });
      return ok(res, rows[0]);
    }),
    eliminar: asyncHandler(async (req, res) => {
      await query(`UPDATE ${tabla} SET activo = 0 WHERE id = :id`, { id: req.params.id });
      return ok(res, { mensaje: 'Eliminado' });
    }),
  };
}

export const clientes = crud('clientes', [
  'nombre', 'tipo_identificacion', 'identificacion', 'email', 'telefono',
  'direccion', 'codigo_actividad', 'notas',
]);

export const proveedores = crud('proveedores', [
  'nombre', 'identificacion', 'telefono', 'email', 'direccion', 'notas',
]);
