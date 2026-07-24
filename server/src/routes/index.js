import { Router } from 'express';
import multer from 'multer';

import { auth, requireRole } from '../middleware/auth.js';
import * as authCtrl from '../controllers/authController.js';
import * as empresaCtrl from '../controllers/empresaController.js';
import * as catCtrl from '../controllers/categoriaController.js';
import * as prodCtrl from '../controllers/productoController.js';
import { clientes, proveedores } from '../controllers/contactoController.js';
import * as userCtrl from '../controllers/usuarioController.js';
import * as gastoCtrl from '../controllers/gastoController.js';
import * as compraCtrl from '../controllers/compraController.js';
import * as ventaCtrl from '../controllers/ventaController.js';
import * as dashCtrl from '../controllers/dashboardController.js';
import * as repCtrl from '../controllers/reporteController.js';
import * as recibidosCtrl from '../controllers/comprobanteRecibidoController.js';

const router = Router();
// multer en memoria para la llave .p12 (max 1MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });
// Los XML de proveedores son mas pesados y pueden venir en lote dentro de un ZIP
const uploadXml = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 50 } });

// ---- Auth (publico) ----
router.post('/auth/login', authCtrl.login);

// A partir de aqui, todo requiere sesion
router.use(auth);

router.get('/auth/me', authCtrl.me);
router.post('/auth/cambiar-password', authCtrl.cambiarPassword);

// ---- Empresa y config Hacienda ----
router.get('/empresa', empresaCtrl.getEmpresa);
router.put('/empresa', requireRole('admin', 'gerente'), empresaCtrl.updateEmpresa);
router.get('/empresa/hacienda', requireRole('admin', 'gerente'), empresaCtrl.getConfigHacienda);
router.put('/empresa/hacienda', requireRole('admin', 'gerente'), empresaCtrl.updateConfigHacienda);
router.post('/empresa/hacienda/llave', requireRole('admin', 'gerente'), upload.single('llave'), empresaCtrl.subirLlave);
router.get('/empresa/hacienda/revision', requireRole('admin', 'gerente'), empresaCtrl.revisionFiscal);

// ---- Categorias ----
router.get('/categorias', catCtrl.listar);
router.post('/categorias', catCtrl.crear);
router.put('/categorias/:id', catCtrl.actualizar);
router.delete('/categorias/:id', catCtrl.eliminar);

// ---- Productos ----
router.get('/productos', prodCtrl.listar);
router.get('/productos/:id', prodCtrl.obtener);
router.post('/productos', prodCtrl.crear);
router.put('/productos/:id', prodCtrl.actualizar);
router.delete('/productos/:id', prodCtrl.eliminar);
router.post('/productos/:id/stock', prodCtrl.ajustarStock);
router.get('/productos/:id/movimientos', prodCtrl.movimientos);

// ---- Clientes ----
router.get('/clientes', clientes.listar);
router.get('/clientes/:id', clientes.obtener);
router.post('/clientes', clientes.crear);
router.put('/clientes/:id', clientes.actualizar);
router.delete('/clientes/:id', clientes.eliminar);

// ---- Proveedores ----
router.get('/proveedores', proveedores.listar);
router.get('/proveedores/:id', proveedores.obtener);
router.post('/proveedores', proveedores.crear);
router.put('/proveedores/:id', proveedores.actualizar);
router.delete('/proveedores/:id', proveedores.eliminar);

// ---- Empleados (solo admin) ----
router.get('/usuarios', requireRole('admin', 'gerente'), userCtrl.listar);
router.post('/usuarios', requireRole('admin'), userCtrl.crear);
router.put('/usuarios/:id', requireRole('admin'), userCtrl.actualizar);
router.delete('/usuarios/:id', requireRole('admin'), userCtrl.eliminar);

// ---- Gastos ----
router.get('/gastos', gastoCtrl.listar);
router.post('/gastos', gastoCtrl.crear);
router.put('/gastos/:id', gastoCtrl.actualizar);
router.delete('/gastos/:id', gastoCtrl.eliminar);

// ---- Compras ----
router.get('/compras', compraCtrl.listar);
router.get('/compras/:id', compraCtrl.obtener);
router.post('/compras', compraCtrl.crear);
router.post('/compras/:id/anular', compraCtrl.anular);
// Factura electronica de compra (proveedores de regimen simplificado / no inscritos)
router.post('/compras/:id/fec', requireRole('admin', 'gerente'), compraCtrl.reenviarFEC);
router.get('/compras/:id/fec/estado', compraCtrl.consultarFEC);
router.get('/compras/:id/xml', compraCtrl.descargarXml);

// ---- Buzon de comprobantes recibidos (compras y gastos que le facturan al negocio) ----
router.get('/recibidos', recibidosCtrl.listar);
router.get('/recibidos/resumen', recibidosCtrl.resumen);
router.get('/recibidos/:id', recibidosCtrl.obtener);
router.get('/recibidos/:id/xml', recibidosCtrl.descargarXml);
router.post('/recibidos', uploadXml.array('archivos', 50), recibidosCtrl.subir);
router.post('/recibidos/:id/responder', requireRole('admin', 'gerente'), recibidosCtrl.responder);
router.get('/recibidos/:id/estado', recibidosCtrl.consultarEstado);
router.post('/recibidos/:id/gasto', recibidosCtrl.registrarComoGasto);

// ---- Ventas (POS) ----
router.get('/ventas', ventaCtrl.listar);
router.get('/ventas/:id', ventaCtrl.obtener);
router.post('/ventas', ventaCtrl.crear);
router.post('/ventas/:id/anular', requireRole('admin', 'gerente'), ventaCtrl.anular);
router.get('/ventas/:id/qr', ventaCtrl.generarQR);
router.post('/ventas/:id/correo', ventaCtrl.enviarPorCorreo);
router.post('/ventas/:id/fe', requireRole('admin', 'gerente'), ventaCtrl.reenviarFE);
router.get('/ventas/:id/fe/estado', ventaCtrl.consultarEstadoFE);
router.get('/ventas/:id/xml', ventaCtrl.descargarXml);

// ---- Dashboard ----
router.get('/dashboard', dashCtrl.resumen);

// ---- Reportes descargables (CSV/Excel) ----
router.get('/reportes/ventas', repCtrl.ventas);
router.get('/reportes/inventario', repCtrl.inventario);
router.get('/reportes/gastos', repCtrl.gastos);
router.get('/reportes/compras', repCtrl.compras);
router.get('/reportes/iva', repCtrl.iva);
router.get('/reportes/libro-compras', repCtrl.libroCompras);
router.get('/reportes/iva-periodo', repCtrl.ivaPeriodo);

export default router;
