import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { crc, fecha } from '../utils/format.js';
import { PageHeader, Modal, Loading, EmptyState } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';

// Estado de la factura electronica de compra ante Hacienda.
// Solo aplica a proveedores que no facturan ellos mismos.
function EstadoFEC({ compra, onReintentar }) {
  if (!compra.requiere_fec) return <span className="muted" style={{ fontSize: 12 }}>El proveedor factura</span>;

  const colores = {
    aceptado: 'var(--success, #16a34a)',
    enviado: '#d97706',
    generado: '#d97706',
    pendiente: 'var(--text-soft)',
    rechazado: 'var(--danger)',
    error: 'var(--danger)',
  };
  const etiquetas = {
    aceptado: 'Aceptada',
    enviado: 'Enviada',
    generado: 'Generada',
    pendiente: 'Sin enviar',
    rechazado: 'Rechazada',
    error: 'Error',
  };
  const estado = compra.fe_estado || 'pendiente';
  const reintentable = ['pendiente', 'error', 'rechazado', 'generado'].includes(estado);

  return (
    <div className="flex gap-sm items-center">
      <span style={{ color: colores[estado], fontWeight: 600, fontSize: 13 }}>{etiquetas[estado] || estado}</span>
      {reintentable && (
        <button className="btn btn-ghost btn-sm" onClick={() => onReintentar(compra)} title={compra.fe_respuesta || ''}>
          Reenviar
        </button>
      )}
    </div>
  );
}

export default function Compras() {
  const toast = useToast();
  const [compras, setCompras] = useState(null);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [modal, setModal] = useState(false);
  const [proveedorId, setProveedorId] = useState('');
  const [condicion, setCondicion] = useState('inscrito');
  const [items, setItems] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = () => {
    api.get('/compras').then((r) => setCompras(r.data.data));
    api.get('/productos').then((r) => setProductos(r.data.data));
    api.get('/proveedores').then((r) => setProveedores(r.data.data));
  };
  useEffect(cargar, []);

  const LINEA_VACIA = { producto_id: '', nombre: '', cantidad: 1, costo_unit: 0, tarifa_iva: 13 };

  const abrirNueva = () => {
    setProveedorId(''); setCondicion('inscrito'); setItems([{ ...LINEA_VACIA }]); setModal(true);
  };

  const setItem = (i, campo, valor) => {
    setItems((arr) => arr.map((it, idx) => {
      if (idx !== i) return it;
      const nuevo = { ...it, [campo]: valor };
      if (campo === 'producto_id') {
        const p = productos.find((x) => x.id === Number(valor));
        if (p) {
          nuevo.nombre = p.nombre;
          nuevo.costo_unit = Number(p.precio_costo);
          nuevo.tarifa_iva = Number(p.tarifa_iva);
          nuevo.codigo_cabys = p.codigo_cabys;
          nuevo.unidad_medida = p.unidad_medida;
        }
      }
      return nuevo;
    }));
  };
  const agregarLinea = () => setItems((a) => [...a, { ...LINEA_VACIA }]);
  const quitarLinea = (i) => setItems((a) => a.filter((_, idx) => idx !== i));

  // El IVA de la compra es lo que despues se acredita: se calcula por linea
  const subtotal = items.reduce((s, it) => s + Number(it.cantidad) * Number(it.costo_unit), 0);
  const iva = items.reduce(
    (s, it) => s + (Number(it.cantidad) * Number(it.costo_unit) * Number(it.tarifa_iva ?? 13)) / 100,
    0
  );
  const total = subtotal + iva;
  const emiteFEC = condicion !== 'inscrito';

  const guardar = async () => {
    const validos = items.filter((it) => it.producto_id && it.cantidad > 0);
    if (validos.length === 0) { toast.error('Agrega al menos un producto'); return; }
    if (emiteFEC && !proveedorId) {
      toast.error('Para la factura de compra hay que indicar el proveedor');
      return;
    }
    setGuardando(true);
    try {
      const { data } = await api.post('/compras', {
        proveedor_id: proveedorId || null,
        proveedor_condicion: condicion,
        items: validos,
      });
      const fe = data.data.fe;
      if (fe?.estado === 'enviado') {
        toast.success(`Compra registrada. Factura de compra enviada a Hacienda (${fe.consecutivo})`);
      } else if (fe) {
        toast.error(`Compra registrada, pero la factura de compra quedo ${fe.estado}: ${fe.mensaje || ''}`);
      } else {
        toast.success('Compra registrada, stock actualizado');
      }
      setModal(false); cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al registrar compra');
    } finally {
      setGuardando(false);
    }
  };

  const verDetalle = async (c) => { const { data } = await api.get(`/compras/${c.id}`); setDetalle(data.data); };

  const reintentarFEC = async (c) => {
    try {
      const { data } = await api.post(`/compras/${c.id}/fec`, {});
      if (data.data.estado === 'enviado') toast.success('Factura de compra enviada a Hacienda');
      else toast.error(data.data.mensaje || `Quedo en estado ${data.data.estado}`);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo reenviar');
    }
  };

  return (
    <div>
      <PageHeader title="Compras" subtitle="Entradas de inventario a proveedores">
        <button className="btn btn-primary" onClick={abrirNueva}><Icon.plus /> Nueva compra</button>
      </PageHeader>

      {!compras ? <Loading /> : compras.length === 0 ? (
        <EmptyState icon="compras" titulo="Sin compras" texto="Registra una compra para aumentar tu inventario." />
      ) : (
        <div className="card table-wrap">
          <table className="data">
            <thead><tr><th>Numero</th><th>Fecha</th><th>Proveedor</th><th className="text-center">Items</th><th className="text-right">IVA</th><th className="text-right">Total</th><th>Hacienda</th><th></th></tr></thead>
            <tbody>
              {compras.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.numero}</td>
                  <td className="muted">{fecha(c.fecha)}</td>
                  <td>{c.proveedor_nombre || <span className="muted">—</span>}</td>
                  <td className="text-center">{c.num_items}</td>
                  <td className="text-right mono">{crc(c.impuesto)}</td>
                  <td className="text-right mono" style={{ fontWeight: 600 }}>{crc(c.total)}</td>
                  <td><EstadoFEC compra={c} onReintentar={reintentarFEC} /></td>
                  <td className="text-right"><button className="btn btn-ghost btn-sm" onClick={() => verDetalle(c)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nueva compra */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva compra" width={720}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>Proveedor</label>
            <select className="select" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Condicion del proveedor</label>
            <select className="select" value={condicion} onChange={(e) => setCondicion(e.target.value)}>
              <option value="inscrito">Inscrito (el factura electronicamente)</option>
              <option value="simplificado">Regimen simplificado</option>
              <option value="no_contribuyente">No contribuyente</option>
              <option value="no_domiciliado">Extranjero no domiciliado</option>
            </select>
          </div>
        </div>

        {emiteFEC && (
          <div
            className="card"
            style={{ padding: 10, marginBottom: 12, borderLeft: '3px solid var(--primary, #7c3aed)' }}
          >
            <div style={{ fontSize: 13 }}>
              Como este proveedor no factura electronicamente, al guardar el negocio va a
              emitir una <strong>factura electronica de compra</strong> y la manda a Hacienda.
            </div>
          </div>
        )}

        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)' }}>Productos</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0' }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <select className="select" value={it.producto_id} onChange={(e) => setItem(i, 'producto_id', e.target.value)}>
                <option value="">Producto...</option>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input className="input" type="number" placeholder="Cant" value={it.cantidad} onChange={(e) => setItem(i, 'cantidad', e.target.value)} />
              <input className="input" type="number" placeholder="Costo" value={it.costo_unit} onChange={(e) => setItem(i, 'costo_unit', e.target.value)} />
              <select className="select" value={it.tarifa_iva ?? 13} onChange={(e) => setItem(i, 'tarifa_iva', Number(e.target.value))} title="IVA soportado">
                <option value={13}>IVA 13%</option>
                <option value={4}>IVA 4%</option>
                <option value={2}>IVA 2%</option>
                <option value={1}>IVA 1%</option>
                <option value={0}>Exento</option>
              </select>
              <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => quitarLinea(i)}><Icon.trash width={15} height={15} /></button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={agregarLinea}><Icon.plus width={15} height={15} /> Agregar linea</button>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div className="flex justify-between" style={{ fontSize: 14 }}>
            <span className="muted">Subtotal</span><span className="mono">{crc(subtotal)}</span>
          </div>
          <div className="flex justify-between" style={{ fontSize: 14, marginTop: 4 }}>
            <span className="muted">IVA soportado (acreditable)</span><span className="mono">{crc(iva)}</span>
          </div>
          <div className="flex justify-between items-center" style={{ marginTop: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>Total: {crc(total)}</span>
            <div className="flex gap-sm">
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardando} onClick={guardar}>
                {guardando ? 'Guardando...' : emiteFEC ? 'Registrar y facturar' : 'Registrar compra'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal detalle */}
      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={`Compra ${detalle?.numero || ''}`}>
        {detalle && (
          <div>
            <p className="muted" style={{ marginBottom: 12 }}>{fecha(detalle.fecha)}</p>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Producto</th><th className="text-center">Cant</th><th className="text-right">Costo</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {detalle.items.map((it) => (
                  <tr key={it.id}><td>{it.nombre}</td><td className="text-center">{Number(it.cantidad)}</td><td className="text-right mono">{crc(it.costo_unit)}</td><td className="text-right mono">{crc(it.total_linea)}</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', marginTop: 12, fontSize: 18, fontWeight: 700 }}>Total: {crc(detalle.total)}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
