import mysql from 'mysql2/promise';
import config from './index.js';

// Pool de conexiones reutilizables. mysql2 maneja el pooling internamente.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  dateStrings: true,
});

// Helper para queries sencillas: query(sql, params) -> rows
export async function query(sql, params = {}) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Helper para transacciones. Recibe una funcion que recibe la conexion.
export async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
}

export default pool;
