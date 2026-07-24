import mysql from 'mysql2/promise';
import config from '../src/config/index.js';

// ============================================================
//  Migracion ADITIVA: modulo fiscal de compras y gastos.
//
//  A diferencia de migrate.js (que recrea el esquema y borra todo),
//  esta migracion agrega tablas y columnas sin tocar los datos
//  existentes. Es idempotente: se puede correr las veces que sea.
//
//  Uso:  npm run migrate:fiscal
// ============================================================

const TABLA_RECIBIDOS = `
CREATE TABLE IF NOT EXISTS comprobantes_recibidos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  -- Datos leidos del XML del proveedor
  clave                 VARCHAR(50) NOT NULL,
  tipo_documento        VARCHAR(2)  NOT NULL DEFAULT '01', -- 01 FE, 02 ND, 03 NC, 04 TE, 08 FEC, 09 FEE
  numero_consecutivo    VARCHAR(20) DEFAULT '',
  emisor_nombre         VARCHAR(160) DEFAULT '',
  emisor_identificacion VARCHAR(20)  DEFAULT '',
  emisor_email          VARCHAR(120) DEFAULT '',
  receptor_identificacion VARCHAR(20) DEFAULT '',
  fecha_emision         DATETIME NULL,
  moneda                VARCHAR(3) NOT NULL DEFAULT 'CRC',
  tipo_cambio           DECIMAL(14,5) NOT NULL DEFAULT 1,
  total_gravado         DECIMAL(14,5) NOT NULL DEFAULT 0,
  total_exento          DECIMAL(14,5) NOT NULL DEFAULT 0,
  total_descuentos      DECIMAL(14,5) NOT NULL DEFAULT 0,
  total_impuesto        DECIMAL(14,5) NOT NULL DEFAULT 0,
  total_comprobante     DECIMAL(14,5) NOT NULL DEFAULT 0,

  -- Respuesta del receptor (Mensaje Receptor ante Hacienda)
  estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- pendiente | aceptado | aceptado_parcial | rechazado
  mensaje           TINYINT NULL,          -- 1 acepta, 2 acepta parcial, 3 rechaza
  detalle_mensaje   VARCHAR(160) DEFAULT '',
  monto_iva_acreditar DECIMAL(14,5) NOT NULL DEFAULT 0, -- IVA que el negocio se acredita
  consecutivo_receptor VARCHAR(20) DEFAULT '',
  mr_xml            LONGTEXT,
  mr_estado         VARCHAR(20) DEFAULT '',  -- pendiente | enviado | aceptado | rechazado | error
  mr_respuesta      LONGTEXT,
  mr_enviado_at     DATETIME NULL,
  fecha_limite      DATE NULL,               -- 8vo dia habil del mes siguiente

  -- Trazabilidad y enlaces
  xml_original      LONGTEXT NOT NULL,
  archivo_nombre    VARCHAR(200) DEFAULT '',
  compra_id         INT NULL,
  gasto_id          INT NULL,
  usuario_id        INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_clave (clave),
  INDEX idx_recibido_estado (estado),
  INDEX idx_recibido_fecha (fecha_emision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

// Columnas nuevas: [tabla, columna, definicion]
const COLUMNAS = [
  // ---- Compras: datos fiscales y factura electronica de compra ----
  ['compras', 'proveedor_condicion', "VARCHAR(20) NOT NULL DEFAULT 'inscrito'"], // inscrito | simplificado | no_domiciliado | no_contribuyente
  ['compras', 'requiere_fec', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ['compras', 'comprobante_recibido_id', 'INT NULL'],
  ['compras', 'fe_clave', "VARCHAR(50) DEFAULT ''"],
  ['compras', 'fe_consecutivo', "VARCHAR(20) DEFAULT ''"],
  ['compras', 'fe_estado', "VARCHAR(20) DEFAULT ''"], // pendiente | enviado | aceptado | rechazado | error
  ['compras', 'fe_xml', 'LONGTEXT'],
  ['compras', 'fe_respuesta', 'LONGTEXT'],
  ['compras', 'fe_enviado_at', 'DATETIME NULL'],

  // ---- Lineas de compra: lo que exige el XML v4.4 ----
  ['compra_items', 'codigo_cabys', "VARCHAR(13) DEFAULT ''"],
  ['compra_items', 'unidad_medida', "VARCHAR(15) NOT NULL DEFAULT 'Unid'"],
  ['compra_items', 'descuento', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
  ['compra_items', 'tarifa_iva', 'DECIMAL(5,2) NOT NULL DEFAULT 13.00'],
  ['compra_items', 'iva_monto', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],

  // ---- Gastos: respaldo fiscal ----
  ['gastos', 'comprobante_recibido_id', 'INT NULL'],
  ['gastos', 'subtotal', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
  ['gastos', 'iva_monto', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
  ['gastos', 'iva_acreditable', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ['gastos', 'codigo_cabys', "VARCHAR(13) DEFAULT ''"],
  ['gastos', 'clave_comprobante', "VARCHAR(50) DEFAULT ''"],

  // ---- Consecutivos que faltaban ----
  ['config_hacienda', 'consecutivo_nd', 'INT NOT NULL DEFAULT 1'],
  ['config_hacienda', 'consecutivo_fec', 'INT NOT NULL DEFAULT 1'], // factura electronica de compra
  ['config_hacienda', 'consecutivo_mr', 'INT NOT NULL DEFAULT 1'],  // mensaje receptor
  ['config_hacienda', 'consecutivo_rep', 'INT NOT NULL DEFAULT 1'], // recibo electronico de pago
];

const INDICES = [
  ['compras', 'idx_compra_fe_estado', '(fe_estado)'],
  ['gastos', 'idx_gasto_comprobante', '(comprobante_recibido_id)'],
];

async function existeColumna(conn, tabla, columna) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.db.database, tabla, columna]
  );
  return rows.length > 0;
}

async function existeIndice(conn, tabla, indice) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [config.db.database, tabla, indice]
  );
  return rows.length > 0;
}

async function migrar() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    ssl: config.db.ssl,
    multipleStatements: true,
  });

  console.log('Creando tabla comprobantes_recibidos...');
  await conn.query(TABLA_RECIBIDOS);

  let agregadas = 0;
  for (const [tabla, columna, definicion] of COLUMNAS) {
    if (await existeColumna(conn, tabla, columna)) continue;
    await conn.query(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${columna}\` ${definicion}`);
    console.log(`  + ${tabla}.${columna}`);
    agregadas++;
  }

  for (const [tabla, indice, cols] of INDICES) {
    if (await existeIndice(conn, tabla, indice)) continue;
    await conn.query(`ALTER TABLE \`${tabla}\` ADD INDEX \`${indice}\` ${cols}`);
    console.log(`  + indice ${tabla}.${indice}`);
  }

  console.log(`\n✅ Migracion fiscal lista. Columnas agregadas: ${agregadas}`);
  await conn.end();
}

migrar().catch((err) => {
  console.error('❌ Error en la migracion fiscal:', err.message);
  process.exit(1);
});
