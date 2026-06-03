import { query } from '../config/db.js';
import { asyncHandler, ok } from '../utils/http.js';

export const resumen = asyncHandler(async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const inicioMes = hoy.slice(0, 8) + '01';

  // Ventas de hoy
  const [ventasHoy] = await query(
    `SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS cantidad
     FROM ventas WHERE estado='completada' AND DATE(fecha) = :hoy`, { hoy }
  ) || [{}];

  // Ventas del mes
  const [ventasMes] = await query(
    `SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS cantidad
     FROM ventas WHERE estado='completada' AND DATE(fecha) >= :inicio`, { inicio: inicioMes }
  ) || [{}];

  // Gastos del mes
  const [gastosMes] = await query(
    `SELECT COALESCE(SUM(monto),0) AS total FROM gastos WHERE fecha >= :inicio`, { inicio: inicioMes }
  ) || [{}];

  // Productos con stock bajo
  const stockBajo = await query(
    `SELECT id, nombre, stock, stock_minimo FROM productos
     WHERE activo=1 AND stock <= stock_minimo ORDER BY stock ASC LIMIT 10`
  );

  // Total de productos y clientes activos
  const [totales] = await query(`
    SELECT
      (SELECT COUNT(*) FROM productos WHERE activo=1) AS productos,
      (SELECT COUNT(*) FROM clientes WHERE activo=1) AS clientes,
      (SELECT COALESCE(SUM(stock*precio_costo),0) FROM productos WHERE activo=1) AS valor_inventario
  `) || [{}];

  // Ventas de los ultimos 7 dias (para grafico)
  const ventas7dias = await query(`
    SELECT DATE(fecha) AS dia, COALESCE(SUM(total),0) AS total
    FROM ventas WHERE estado='completada' AND fecha >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(fecha) ORDER BY dia
  `);

  // Top 5 productos mas vendidos del mes
  const topProductos = await query(`
    SELECT vi.nombre, SUM(vi.cantidad) AS unidades, SUM(vi.total_linea) AS ingresos
    FROM venta_items vi
    JOIN ventas v ON v.id = vi.venta_id
    WHERE v.estado='completada' AND DATE(v.fecha) >= :inicio
    GROUP BY vi.nombre ORDER BY unidades DESC LIMIT 5
  `, { inicio: inicioMes });

  // Ventas por metodo de pago (mes)
  const porMetodoPago = await query(`
    SELECT metodo_pago, COALESCE(SUM(total),0) AS total, COUNT(*) AS cantidad
    FROM ventas WHERE estado='completada' AND DATE(fecha) >= :inicio
    GROUP BY metodo_pago
  `, { inicio: inicioMes });

  return ok(res, {
    ventasHoy: ventasHoy || { total: 0, cantidad: 0 },
    ventasMes: ventasMes || { total: 0, cantidad: 0 },
    gastosMes: gastosMes || { total: 0 },
    utilidadMes: Number(ventasMes?.total || 0) - Number(gastosMes?.total || 0),
    stockBajo,
    totales: totales || { productos: 0, clientes: 0, valor_inventario: 0 },
    ventas7dias,
    topProductos,
    porMetodoPago,
  });
});
