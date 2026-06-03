import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import config from '../src/config/index.js';

// Datos quemados realistas (un minisuper costarricense) para que las demos
// se vean llenas y funcionales: usuarios, categorias, productos, clientes,
// proveedores, ventas historicas, compras y gastos.

async function seed() {
  const conn = await mysql.createConnection({
    host: config.db.host, port: config.db.port, user: config.db.user,
    password: config.db.password, database: config.db.database, ssl: config.db.ssl,
    multipleStatements: true,
  });

  console.log('Limpiando datos previos...');
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  for (const t of ['venta_items', 'ventas', 'compra_items', 'compras', 'gastos',
    'movimientos_inventario', 'productos', 'categorias', 'clientes', 'proveedores',
    'usuarios', 'empresa', 'config_hacienda']) {
    await conn.query(`TRUNCATE TABLE ${t}`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS=1');

  // ---- Empresa (datos de ejemplo, EDITABLES desde la app) ----
  await conn.query(`INSERT INTO empresa
    (nombre_comercial, razon_social, tipo_identificacion, identificacion,
     provincia, canton, distrito, barrio, direccion_exacta, telefono, email,
     sitio_web, moneda, codigo_actividad, mensaje_factura, tema_default)
    VALUES
    ('MiniSuper La Esquina', 'Comercializadora La Esquina S.A.', '02', '3101234567',
     'San Jose', 'Central', 'Carmen', 'Otoya', '200m norte de la iglesia',
     '2222-3344', 'ventas@laesquina.cr', 'www.laesquina.cr', 'CRC', '471101',
     'Gracias por su compra. Vuelva pronto!', 'light')`);

  // ---- Config Hacienda (apagada por defecto, en sandbox) ----
  await conn.query(`INSERT INTO config_hacienda (activa, ambiente, sucursal, terminal) VALUES (0, 'sandbox', '001', '00001')`);

  // ---- Usuarios ----
  const passAdmin = await bcrypt.hash('admin123', 10);
  const passCajero = await bcrypt.hash('cajero123', 10);
  await conn.query(`INSERT INTO usuarios (nombre, email, password_hash, rol, telefono) VALUES
    ('Administrador', 'admin@laesquina.cr', ?, 'admin', '8888-1111'),
    ('Maria Gerente', 'gerente@laesquina.cr', ?, 'gerente', '8888-2222'),
    ('Carlos Cajero', 'cajero@laesquina.cr', ?, 'cajero', '8888-3333')`,
    [passAdmin, passAdmin, passCajero]);

  // ---- Categorias ----
  const cats = [
    ['Abarrotes', 'Productos de canasta basica', '#7c3aed'],
    ['Bebidas', 'Gaseosas, jugos y agua', '#0ea5e9'],
    ['Lacteos', 'Leche, queso, yogurt', '#f59e0b'],
    ['Limpieza', 'Articulos de aseo', '#10b981'],
    ['Snacks', 'Confites y boquitas', '#ec4899'],
    ['Panaderia', 'Pan y reposteria', '#ef4444'],
  ];
  for (const [n, d, c] of cats) {
    await conn.query('INSERT INTO categorias (nombre, descripcion, color) VALUES (?,?,?)', [n, d, c]);
  }

  // ---- Proveedores ----
  const provs = [
    ['Distribuidora Florida', '3101111111', '2200-0000', 'pedidos@florida.cr', 'Alajuela'],
    ['Dos Pinos', '3101222222', '2437-3000', 'ventas@dospinos.cr', 'Heredia'],
    ['Demasa', '3101333333', '2209-0000', 'info@demasa.cr', 'San Jose'],
    ['Pozuelo', '3101444444', '2436-9000', 'contacto@pozuelo.cr', 'San Jose'],
  ];
  for (const [n, id, t, e, dir] of provs) {
    await conn.query('INSERT INTO proveedores (nombre, identificacion, telefono, email, direccion) VALUES (?,?,?,?,?)', [n, id, t, e, dir]);
  }

  // ---- Productos ----
  // [sku, nombre, cat, prov, cabys, costo, venta, iva, stock, min, unidad]
  const prods = [
    ['ABA-001', 'Arroz Tio Pelon 1kg', 1, 1, '0112100000000', 750, 1100, 13, 80, 15, 'Unid'],
    ['ABA-002', 'Frijol Tierno 900g', 1, 1, '0113200000000', 900, 1350, 13, 60, 10, 'Unid'],
    ['ABA-003', 'Aceite Numar 750ml', 1, 1, '0150100000000', 1200, 1750, 13, 45, 10, 'Unid'],
    ['ABA-004', 'Azucar 2kg', 1, 1, '0118000000000', 1100, 1600, 13, 50, 12, 'Unid'],
    ['ABA-005', 'Sal Sol 1kg', 1, 3, '0149900000000', 350, 600, 13, 70, 20, 'Unid'],
    ['BEB-001', 'Coca Cola 1.5L', 2, 1, '1104000000000', 900, 1400, 13, 120, 24, 'Unid'],
    ['BEB-002', 'Agua Cristal 600ml', 2, 1, '1102000000000', 250, 500, 13, 200, 48, 'Unid'],
    ['BEB-003', 'Jugo Tropical 1L', 2, 1, '1103000000000', 700, 1100, 13, 60, 12, 'Unid'],
    ['BEB-004', 'Cerveza Imperial 350ml', 2, 1, '1101000000000', 650, 1050, 13, 90, 24, 'Unid'],
    ['LAC-001', 'Leche Dos Pinos 1L', 3, 2, '0401000000000', 850, 1250, 1, 70, 18, 'Unid'],
    ['LAC-002', 'Queso Turrialba 500g', 3, 2, '0406000000000', 1800, 2600, 1, 30, 8, 'Unid'],
    ['LAC-003', 'Yogurt Natural 1L', 3, 2, '0403000000000', 1100, 1650, 1, 40, 10, 'Unid'],
    ['LIM-001', 'Jabon en Polvo 1kg', 4, 1, '3402000000000', 1400, 2100, 13, 55, 12, 'Unid'],
    ['LIM-002', 'Cloro 1L', 4, 1, '3808000000000', 600, 1000, 13, 65, 15, 'Unid'],
    ['LIM-003', 'Papel Higienico x4', 4, 1, '4818000000000', 1200, 1800, 13, 80, 20, 'Paq'],
    ['SNK-001', 'Galletas Pozuelo', 5, 4, '1905000000000', 450, 750, 13, 100, 24, 'Unid'],
    ['SNK-002', 'Tortillas Chips 200g', 5, 4, '1905100000000', 800, 1250, 13, 70, 15, 'Unid'],
    ['SNK-003', 'Chocolate Tableta', 5, 4, '1806000000000', 600, 950, 13, 90, 20, 'Unid'],
    ['PAN-001', 'Pan Cuadrado Bimbo', 6, 1, '1905900000000', 900, 1350, 13, 40, 10, 'Unid'],
    ['PAN-002', 'Pan Dulce x6', 6, 1, '1905910000000', 700, 1100, 13, 35, 8, 'Paq'],
  ];
  for (const p of prods) {
    await conn.query(
      `INSERT INTO productos (sku, nombre, categoria_id, proveedor_id, codigo_cabys,
        precio_costo, precio_venta, tarifa_iva, stock, stock_minimo, unidad_medida)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`, p);
  }

  // ---- Clientes ----
  const clis = [
    ['Cliente Contado', '01', '', '', ''],
    ['Juan Perez Mora', '01', '108880777', 'juanperez@gmail.com', '8811-2233'],
    ['Soda Donde Tere', '02', '3101888999', 'soda.tere@gmail.com', '2233-4455'],
    ['Ana Rodriguez', '01', '205550333', 'ana.rod@hotmail.com', '8700-1100'],
    ['Restaurante El Buen Sabor', '02', '3102777666', 'compras@buensabor.cr', '2266-7788'],
  ];
  for (const [n, ti, id, e, t] of clis) {
    await conn.query('INSERT INTO clientes (nombre, tipo_identificacion, identificacion, email, telefono) VALUES (?,?,?,?,?)', [n, ti, id, e, t]);
  }

  // ---- Ventas historicas (ultimos 30 dias) ----
  console.log('Generando ventas historicas...');
  const productosDb = await conn.query('SELECT * FROM productos');
  const listaProd = productosDb[0];
  let ventaCount = 0;

  for (let d = 30; d >= 0; d--) {
    const numVentasDia = 3 + Math.floor(Math.random() * 10);
    for (let v = 0; v < numVentasDia; v++) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - d);
      fecha.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
      const fechaStr = fecha.toISOString().slice(0, 19).replace('T', ' ');

      const numItems = 1 + Math.floor(Math.random() * 5);
      let subtotal = 0, impuesto = 0;
      const lineas = [];
      for (let i = 0; i < numItems; i++) {
        const prod = listaProd[Math.floor(Math.random() * listaProd.length)];
        const cant = 1 + Math.floor(Math.random() * 4);
        const precio = Number(prod.precio_venta);
        const base = cant * precio;
        const iva = base * (Number(prod.tarifa_iva) / 100);
        subtotal += base; impuesto += iva;
        lineas.push({ prod, cant, precio, iva, total: base + iva });
      }
      const total = subtotal + impuesto;
      const metodos = ['efectivo', 'efectivo', 'tarjeta', 'sinpe'];
      const metodo = metodos[Math.floor(Math.random() * metodos.length)];
      const cajeroId = 2 + Math.floor(Math.random() * 2);
      const tipo = Math.random() > 0.7 ? 'tiquete_electronico' : 'ticket';
      const numero = 'V-' + String(100000 + ventaCount).slice(-8);

      const [r] = await conn.query(
        `INSERT INTO ventas (numero, cliente_id, usuario_id, fecha, subtotal, descuento,
          impuesto, total, metodo_pago, tipo_comprobante, estado)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'completada')`,
        [numero, 1 + Math.floor(Math.random() * 5), cajeroId, fechaStr, subtotal, impuesto, total, metodo, tipo]
      );
      for (const l of lineas) {
        await conn.query(
          `INSERT INTO venta_items (venta_id, producto_id, nombre, codigo_cabys, cantidad,
            precio_unit, tarifa_iva, iva_monto, total_linea)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [r.insertId, l.prod.id, l.prod.nombre, l.prod.codigo_cabys, l.cant, l.precio, l.prod.tarifa_iva, l.iva, l.total]
        );
      }
      ventaCount++;
    }
  }
  console.log(`  ${ventaCount} ventas creadas`);

  // ---- Compras ----
  for (let i = 0; i < 8; i++) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - Math.floor(Math.random() * 25));
    const prov = 1 + Math.floor(Math.random() * 4);
    const numItems = 2 + Math.floor(Math.random() * 4);
    let subtotal = 0;
    const items = [];
    for (let j = 0; j < numItems; j++) {
      const prod = listaProd[Math.floor(Math.random() * listaProd.length)];
      const cant = 20 + Math.floor(Math.random() * 30);
      const costo = Number(prod.precio_costo);
      subtotal += cant * costo;
      items.push({ prod, cant, costo });
    }
    const numero = 'C-' + String(200000 + i).slice(-8);
    const [r] = await conn.query(
      `INSERT INTO compras (numero, proveedor_id, usuario_id, fecha, subtotal, impuesto, total)
       VALUES (?, ?, 1, ?, ?, 0, ?)`,
      [numero, prov, fecha.toISOString().slice(0, 19).replace('T', ' '), subtotal, subtotal]
    );
    for (const it of items) {
      await conn.query(
        `INSERT INTO compra_items (compra_id, producto_id, nombre, cantidad, costo_unit, total_linea)
         VALUES (?,?,?,?,?,?)`,
        [r.insertId, it.prod.id, it.prod.nombre, it.cant, it.costo, it.cant * it.costo]
      );
    }
  }

  // ---- Gastos ----
  const gastosData = [
    ['Alquiler del local', 'Alquiler', 350000],
    ['Electricidad CNFL', 'Servicios', 85000],
    ['Agua AyA', 'Servicios', 22000],
    ['Internet y telefono', 'Servicios', 35000],
    ['Salario empleados', 'Planilla', 650000],
    ['Mantenimiento refrigeracion', 'Mantenimiento', 45000],
    ['Bolsas y empaques', 'Insumos', 28000],
  ];
  for (const [desc, cat, monto] of gastosData) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - Math.floor(Math.random() * 28));
    await conn.query(
      `INSERT INTO gastos (descripcion, categoria, monto, fecha, metodo_pago, usuario_id)
       VALUES (?, ?, ?, ?, 'transferencia', 1)`,
      [desc, cat, monto, fecha.toISOString().slice(0, 10)]
    );
  }

  console.log('\n✅ Seed completado.');
  console.log('\n  Usuarios de prueba:');
  console.log('  ┌─────────────────────────────────────────────┐');
  console.log('  │ admin@laesquina.cr     / admin123   (admin)  │');
  console.log('  │ gerente@laesquina.cr   / admin123   (gerente)│');
  console.log('  │ cajero@laesquina.cr    / cajero123  (cajero) │');
  console.log('  └─────────────────────────────────────────────┘\n');

  await conn.end();
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
