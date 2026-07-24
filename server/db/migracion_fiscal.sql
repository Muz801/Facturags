-- ============================================================
--  FacturaPOS - Migracion fiscal de compras y gastos
--
--  Para correr en phpMyAdmin de Hostinger (MariaDB).
--
--  - NO borra datos. Solo agrega una tabla y columnas.
--  - Idempotente: se puede correr varias veces sin error, gracias
--    a "IF NOT EXISTS" (soportado por MariaDB).
--
--  Uso en phpMyAdmin (Hostinger):
--    1. Panel izquierdo: seleccione su base (u980768685_empresa)
--    2. Pestana "SQL"
--    3. Pegue TODO este archivo y presione "Continuar"
-- ============================================================

-- ---- 1. Tabla nueva: buzon de comprobantes recibidos ----
CREATE TABLE IF NOT EXISTS comprobantes_recibidos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  clave                 VARCHAR(50) NOT NULL,
  tipo_documento        VARCHAR(2)  NOT NULL DEFAULT '01',
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
  estado                VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  mensaje               TINYINT NULL,
  detalle_mensaje       VARCHAR(160) DEFAULT '',
  monto_iva_acreditar   DECIMAL(14,5) NOT NULL DEFAULT 0,
  consecutivo_receptor  VARCHAR(20) DEFAULT '',
  mr_xml                LONGTEXT,
  mr_estado             VARCHAR(20) DEFAULT '',
  mr_respuesta          LONGTEXT,
  mr_enviado_at         DATETIME NULL,
  fecha_limite          DATE NULL,
  xml_original          LONGTEXT NOT NULL,
  archivo_nombre        VARCHAR(200) DEFAULT '',
  compra_id             INT NULL,
  gasto_id              INT NULL,
  usuario_id            INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_clave (clave),
  INDEX idx_recibido_estado (estado),
  INDEX idx_recibido_fecha (fecha_emision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- 2. Columnas nuevas en compras ----
ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS proveedor_condicion VARCHAR(20) NOT NULL DEFAULT 'inscrito',
  ADD COLUMN IF NOT EXISTS requiere_fec        TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comprobante_recibido_id INT NULL,
  ADD COLUMN IF NOT EXISTS fe_clave       VARCHAR(50) DEFAULT '',
  ADD COLUMN IF NOT EXISTS fe_consecutivo VARCHAR(20) DEFAULT '',
  ADD COLUMN IF NOT EXISTS fe_estado      VARCHAR(20) DEFAULT '',
  ADD COLUMN IF NOT EXISTS fe_xml         LONGTEXT,
  ADD COLUMN IF NOT EXISTS fe_respuesta   LONGTEXT,
  ADD COLUMN IF NOT EXISTS fe_enviado_at  DATETIME NULL,
  ADD INDEX IF NOT EXISTS idx_compra_fe_estado (fe_estado);

-- ---- 3. Columnas nuevas en compra_items (lo que exige el XML v4.4) ----
ALTER TABLE compra_items
  ADD COLUMN IF NOT EXISTS codigo_cabys  VARCHAR(13) DEFAULT '',
  ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(15) NOT NULL DEFAULT 'Unid',
  ADD COLUMN IF NOT EXISTS descuento     DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tarifa_iva    DECIMAL(5,2) NOT NULL DEFAULT 13.00,
  ADD COLUMN IF NOT EXISTS iva_monto     DECIMAL(12,2) NOT NULL DEFAULT 0;

-- ---- 4. Columnas nuevas en gastos (respaldo fiscal) ----
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS comprobante_recibido_id INT NULL,
  ADD COLUMN IF NOT EXISTS subtotal       DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_monto      DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_acreditable TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_cabys   VARCHAR(13) DEFAULT '',
  ADD COLUMN IF NOT EXISTS clave_comprobante VARCHAR(50) DEFAULT '',
  ADD INDEX IF NOT EXISTS idx_gasto_comprobante (comprobante_recibido_id);

-- ---- 5. Consecutivos que faltaban en config_hacienda ----
ALTER TABLE config_hacienda
  ADD COLUMN IF NOT EXISTS consecutivo_nd  INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS consecutivo_fec INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS consecutivo_mr  INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS consecutivo_rep INT NOT NULL DEFAULT 1;

-- ---- 6. Marca de tiempo del envio de la factura de venta ----
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS fe_enviado_at DATETIME NULL;

-- ---- 7. Verificacion ----
-- NOTA: en hosting compartido (Hostinger) el usuario no tiene permiso para
-- consultar information_schema, asi que NO se incluye una consulta automatica
-- aqui (daria el error #1044). Para verificar, en phpMyAdmin:
--   - Confirme que en el panel izquierdo aparece la tabla "comprobantes_recibidos"
--   - O corra estas consultas, que si funcionan con permisos normales:
--       SHOW COLUMNS FROM compras;          -- debe incluir proveedor_condicion, fe_estado, etc.
--       SHOW COLUMNS FROM config_hacienda;  -- debe incluir consecutivo_mr, consecutivo_fec, etc.
