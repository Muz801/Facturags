import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import config from '../src/config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  // Conecta sin especificar database para poder crearla
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    ssl: config.db.ssl,
    multipleStatements: true,
  });

  console.log(`Creando base de datos "${config.db.database}" si no existe...`);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${config.db.database}\``);

  const schema = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
  console.log('Ejecutando schema.sql...');
  await conn.query(schema);

  console.log('✅ Migracion completada. Tablas creadas.');
  await conn.end();
}

migrate().catch((err) => {
  console.error('❌ Error en migracion:', err.message);
  process.exit(1);
});
