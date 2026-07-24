-- ============================================================
--  FacturaPOS - Esquema de base de datos MySQL
--  Moneda: Colones de Costa Rica (CRC). Factura electronica v4.4.
--  NADA de informacion del comercio esta quemada: todo vive en la tabla `empresa`.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ---- Datos del comercio (editables desde la app, NO quemados) ----
DROP TABLE IF EXISTS empresa;
CREATE TABLE empresa (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre_comercial   VARCHAR(160) NOT NULL DEFAULT 'Mi Negocio',
  razon_social       VARCHAR(160) NOT NULL DEFAULT '',
  -- Identificacion fiscal
  tipo_identificacion VARCHAR(2) NOT NULL DEFAULT '01', -- 01 fisica, 02 juridica, 03 DIMEX, 04 NITE
  identificacion     VARCHAR(20) NOT NULL DEFAULT '',
  -- Ubicacion (esto es lo que antes tenias que editar en codigo)
  provincia          VARCHAR(60) DEFAULT '',
  canton             VARCHAR(60) DEFAULT '',
  distrito           VARCHAR(60) DEFAULT '',
  barrio             VARCHAR(80) DEFAULT '',
  direccion_exacta   VARCHAR(255) DEFAULT '',
  -- Contacto
  telefono           VARCHAR(30) DEFAULT '',
  email              VARCHAR(120) DEFAULT '',
  sitio_web          VARCHAR(120) DEFAULT '',
  -- Marca
  logo_url           TEXT,
  moneda             VARCHAR(3) NOT NULL DEFAULT 'CRC',
  -- Codigo de actividad economica (CIIU / Hacienda)
  codigo_actividad   VARCHAR(10) DEFAULT '',
  -- Texto libre que sale al pie de la factura
  mensaje_factura    VARCHAR(255) DEFAULT 'Gracias por su compra',
  -- Preferencia de tema por defecto del negocio
  tema_default       VARCHAR(10) NOT NULL DEFAULT 'light', -- light | dark
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Configuracion de Factura Electronica (secretos cifrados con AES) ----
DROP TABLE IF EXISTS config_hacienda;
CREATE TABLE config_hacienda (
  id INT PRIMARY KEY AUTO_INCREMENT,
  activa            TINYINT(1) NOT NULL DEFAULT 0,         -- FE encendida/apagada
  ambiente          VARCHAR(10) NOT NULL DEFAULT 'sandbox', -- sandbox | prod
  usuario_api       VARCHAR(160) DEFAULT '',                -- usuario de Hacienda (texto plano, no tan sensible)
  password_api_enc  TEXT,                                   -- contrasena de API (CIFRADA)
  pin_llave_enc     TEXT,                                   -- PIN del .p12 (CIFRADO)
  llave_p12_base64  LONGTEXT,                               -- archivo .p12 en base64 (CIFRADO)
  llave_nombre      VARCHAR(160) DEFAULT '',                -- nombre del archivo subido
  -- Consecutivos de Hacienda
  sucursal          VARCHAR(3) NOT NULL DEFAULT '001',
  terminal          VARCHAR(5) NOT NULL DEFAULT '00001',
  consecutivo_fe    INT NOT NULL DEFAULT 1,                 -- proximo consecutivo factura electronica
  consecutivo_te    INT NOT NULL DEFAULT 1,                 -- proximo consecutivo tiquete electronico
  consecutivo_nc    INT NOT NULL DEFAULT 1,                 -- proximo consecutivo nota credito
  consecutivo_nd    INT NOT NULL DEFAULT 1,                 -- nota de debito
  consecutivo_fec   INT NOT NULL DEFAULT 1,                 -- factura electronica de compra (tipo 08)
  consecutivo_mr    INT NOT NULL DEFAULT 1,                 -- mensaje receptor (tipos 05/06/07)
  consecutivo_rep   INT NOT NULL DEFAULT 1,                 -- recibo electronico de pago (tipo 10)
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Usuarios / Empleados ----
DROP TABLE IF EXISTS usuarios;
CREATE TABLE usuarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre        VARCHAR(120) NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(20) NOT NULL DEFAULT 'cajero', -- admin | gerente | cajero
  telefono      VARCHAR(30) DEFAULT '',
  activo        TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_acceso TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Categorias de inventario (editables, se pueden crear nuevas) ----
DROP TABLE IF EXISTS categorias;
CREATE TABLE categorias (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre      VARCHAR(120) NOT NULL,
  descripcion VARCHAR(255) DEFAULT '',
  color       VARCHAR(20) DEFAULT '#7c3aed',
  activa      TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Proveedores ----
DROP TABLE IF EXISTS proveedores;
CREATE TABLE proveedores (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre         VARCHAR(160) NOT NULL,
  identificacion VARCHAR(20) DEFAULT '',
  telefono       VARCHAR(30) DEFAULT '',
  email          VARCHAR(120) DEFAULT '',
  direccion      VARCHAR(255) DEFAULT '',
  notas          VARCHAR(255) DEFAULT '',
  activo         TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Productos (editables) ----
DROP TABLE IF EXISTS productos;
CREATE TABLE productos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sku            VARCHAR(60) DEFAULT '',
  codigo_barras  VARCHAR(60) DEFAULT '',
  nombre         VARCHAR(180) NOT NULL,
  descripcion    VARCHAR(255) DEFAULT '',
  categoria_id   INT,
  proveedor_id   INT,
  -- Codigo CAByS (obligatorio para factura electronica v4.4)
  codigo_cabys   VARCHAR(13) DEFAULT '',
  -- Precios en colones
  precio_costo   DECIMAL(12,2) NOT NULL DEFAULT 0,
  precio_venta   DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- IVA: 13% estandar, pero configurable por producto (0, 1, 2, 4, 13)
  tarifa_iva     DECIMAL(5,2) NOT NULL DEFAULT 13.00,
  -- Inventario
  stock          DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock_minimo   DECIMAL(12,2) NOT NULL DEFAULT 5,
  unidad_medida  VARCHAR(10) NOT NULL DEFAULT 'Unid',
  imagen_url     TEXT,
  activo         TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL,
  INDEX idx_nombre (nombre),
  INDEX idx_categoria (categoria_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Clientes ----
DROP TABLE IF EXISTS clientes;
CREATE TABLE clientes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre              VARCHAR(160) NOT NULL,
  tipo_identificacion VARCHAR(2) DEFAULT '01',
  identificacion      VARCHAR(20) DEFAULT '',
  email               VARCHAR(120) DEFAULT '',
  telefono            VARCHAR(30) DEFAULT '',
  direccion           VARCHAR(255) DEFAULT '',
  -- Codigo de actividad economica del receptor (requerido en v4.4 para FE)
  codigo_actividad    VARCHAR(10) DEFAULT '',
  notas               VARCHAR(255) DEFAULT '',
  activo              TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cliente_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Ventas (cabecera) ----
DROP TABLE IF EXISTS ventas;
CREATE TABLE ventas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  numero          VARCHAR(30) NOT NULL,         -- numero interno legible (ej: V-000123)
  cliente_id      INT,
  usuario_id      INT,
  fecha           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
  descuento       DECIMAL(12,2) NOT NULL DEFAULT 0,
  impuesto        DECIMAL(12,2) NOT NULL DEFAULT 0,
  total           DECIMAL(12,2) NOT NULL DEFAULT 0,
  metodo_pago     VARCHAR(20) NOT NULL DEFAULT 'efectivo', -- efectivo | tarjeta | sinpe | transferencia
  condicion_venta VARCHAR(2) NOT NULL DEFAULT '01',        -- 01 contado, 02 credito
  -- Tipo de comprobante
  tipo_comprobante VARCHAR(20) NOT NULL DEFAULT 'ticket',  -- ticket | tiquete_electronico | factura_electronica
  estado          VARCHAR(20) NOT NULL DEFAULT 'completada', -- completada | anulada
  -- Datos de factura electronica (si aplica)
  fe_clave        VARCHAR(54) DEFAULT '',
  fe_consecutivo  VARCHAR(20) DEFAULT '',
  fe_estado       VARCHAR(20) DEFAULT '',  -- pendiente | aceptado | rechazado | error
  fe_xml          LONGTEXT,
  fe_respuesta    LONGTEXT,
  notas           VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_venta_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Lineas de venta ----
DROP TABLE IF EXISTS venta_items;
CREATE TABLE venta_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  venta_id      INT NOT NULL,
  producto_id   INT,
  nombre        VARCHAR(180) NOT NULL,   -- copia del nombre al momento de la venta
  codigo_cabys  VARCHAR(13) DEFAULT '',
  cantidad      DECIMAL(12,2) NOT NULL DEFAULT 1,
  precio_unit   DECIMAL(12,2) NOT NULL DEFAULT 0,
  descuento     DECIMAL(12,2) NOT NULL DEFAULT 0,
  tarifa_iva    DECIMAL(5,2) NOT NULL DEFAULT 13.00,
  iva_monto     DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_linea   DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Compras (entrada de inventario) ----
DROP TABLE IF EXISTS compras;
CREATE TABLE compras (
  id INT PRIMARY KEY AUTO_INCREMENT,
  numero        VARCHAR(30) NOT NULL,
  proveedor_id  INT,
  usuario_id    INT,
  fecha         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0,
  impuesto      DECIMAL(12,2) NOT NULL DEFAULT 0,
  total         DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado        VARCHAR(20) NOT NULL DEFAULT 'recibida', -- recibida | pendiente | anulada
  notas         VARCHAR(255) DEFAULT '',
  -- Condicion del proveedor: define si el negocio tiene que emitir la
  -- factura electronica de compra (tipo 08) por esta compra.
  proveedor_condicion VARCHAR(20) NOT NULL DEFAULT 'inscrito', -- inscrito | simplificado | no_domiciliado | no_contribuyente
  requiere_fec  TINYINT(1) NOT NULL DEFAULT 0,
  comprobante_recibido_id INT NULL,
  -- Factura electronica de compra emitida por el negocio
  fe_clave      VARCHAR(50) DEFAULT '',
  fe_consecutivo VARCHAR(20) DEFAULT '',
  fe_estado     VARCHAR(20) DEFAULT '',  -- pendiente | generado | enviado | aceptado | rechazado | error
  fe_xml        LONGTEXT,
  fe_respuesta  LONGTEXT,
  fe_enviado_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_compra_fe_estado (fe_estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS compra_items;
CREATE TABLE compra_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  compra_id    INT NOT NULL,
  producto_id  INT,
  nombre       VARCHAR(180) NOT NULL,
  cantidad     DECIMAL(12,2) NOT NULL DEFAULT 1,
  costo_unit   DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_linea  DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Datos que exige el XML v4.4 y el calculo del IVA acreditable
  codigo_cabys  VARCHAR(13) DEFAULT '',
  unidad_medida VARCHAR(15) NOT NULL DEFAULT 'Unid',
  descuento     DECIMAL(12,2) NOT NULL DEFAULT 0,
  tarifa_iva    DECIMAL(5,2) NOT NULL DEFAULT 13.00,
  iva_monto     DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Gastos ----
DROP TABLE IF EXISTS gastos;
CREATE TABLE gastos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  descripcion  VARCHAR(200) NOT NULL,
  categoria    VARCHAR(60) NOT NULL DEFAULT 'General', -- alquiler, servicios, planilla, etc.
  monto        DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha        DATE NOT NULL,
  metodo_pago  VARCHAR(20) NOT NULL DEFAULT 'efectivo',
  proveedor_id INT,
  usuario_id   INT,
  notas        VARCHAR(255) DEFAULT '',
  -- Respaldo fiscal: sin comprobante electronico aceptado no hay credito de IVA
  comprobante_recibido_id INT NULL,
  subtotal     DECIMAL(12,2) NOT NULL DEFAULT 0,
  iva_monto    DECIMAL(12,2) NOT NULL DEFAULT 0,
  iva_acreditable TINYINT(1) NOT NULL DEFAULT 0,
  codigo_cabys VARCHAR(13) DEFAULT '',
  clave_comprobante VARCHAR(50) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_gasto_fecha (fecha),
  INDEX idx_gasto_comprobante (comprobante_recibido_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Buzon de comprobantes recibidos ----
-- Las facturas que le hacen AL negocio. Cada una hay que responderla ante
-- Hacienda con un Mensaje Receptor antes del 8vo dia habil del mes siguiente.
DROP TABLE IF EXISTS comprobantes_recibidos;
CREATE TABLE comprobantes_recibidos (
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
  -- Respuesta del receptor
  estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- pendiente | aceptado | aceptado_parcial | rechazado
  mensaje           TINYINT NULL,          -- 1 acepta, 2 acepta parcial, 3 rechaza
  detalle_mensaje   VARCHAR(160) DEFAULT '',
  monto_iva_acreditar DECIMAL(14,5) NOT NULL DEFAULT 0,
  consecutivo_receptor VARCHAR(20) DEFAULT '',
  mr_xml            LONGTEXT,
  mr_estado         VARCHAR(20) DEFAULT '',
  mr_respuesta      LONGTEXT,
  mr_enviado_at     DATETIME NULL,
  fecha_limite      DATE NULL,
  -- Trazabilidad
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

-- ---- Movimientos de inventario (auditoria de stock) ----
DROP TABLE IF EXISTS movimientos_inventario;
CREATE TABLE movimientos_inventario (
  id INT PRIMARY KEY AUTO_INCREMENT,
  producto_id  INT NOT NULL,
  tipo         VARCHAR(20) NOT NULL, -- venta | compra | ajuste | merma
  cantidad     DECIMAL(12,2) NOT NULL,  -- positivo entra, negativo sale
  stock_resultante DECIMAL(12,2) NOT NULL DEFAULT 0,
  referencia   VARCHAR(60) DEFAULT '',
  usuario_id   INT,
  fecha        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
