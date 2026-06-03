import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { crc, fecha } from '../utils/format.js';
import { PageHeader, Modal, Loading, EmptyState } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';

export default function Compras() {
  const toast = useToast();
  const [compras, setCompras] = useState(null);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [modal, setModal] = useState(false);
  const [proveedorId, setProveedorId] = useState('');
  const [items, setItems] = useState([]);
  const [detalle, setDetalle] = useState(null);

  const cargar = () => {
    api.get('/compras').then((r) => setCompras(r.data.data));
    api.get('/productos').then((r) => setProductos(r.data.data));
    api.get('/proveedores').then((r) => setProveedores(r.data.data));
  };
  useEffect(cargar, []);

  const abrirNueva = () => { setProveedorId(''); setItems([{ producto_id: '', nombre: '', cantidad: 1, costo_unit: 0 }]); setModal(true); };

  const setItem = (i, campo, valor) => {
    setItems((arr) => arr.map((it, idx) => {
      if (idx !== i) return it;
      const nuevo = { ...it, [campo]: valor };
      if (campo === 'producto_id') {
        const p = productos.find((x) => x.id === Number(valor));
        if (p) { nuevo.nombre = p.nombre; nuevo.costo_unit = Number(p.precio_costo); }
      }
      return nuevo;
    }));
  };
  const agregarLinea = () => setItems((a) => [...a, { producto_id: '', nombre: '', cantidad: 1, costo_unit: 0 }]);
  const quitarLinea = (i) => setItems((a) => a.filter((_, idx) => idx !== i));

  const total = items.reduce((s, it) => s + Number(it.cantidad) * Number(it.costo_unit), 0);

  const guardar = async () => {
    const validos = items.filter((it) => it.producto_id && it.cantidad > 0);
    if (validos.length === 0) { toast.error('Agrega al menos un producto'); return; }
    try {
      await api.post('/compras', { proveedor_id: proveedorId || null, items: validos });
      toast.success('Compra registrada, stock actualizado'); setModal(false); cargar();
    } catch (err) { toast.error('Error al registrar compra'); }
  };

  const verDetalle = async (c) => { const { data } = await api.get(`/compras/${c.id}`); setDetalle(data.data); };

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
            <thead><tr><th>Numero</th><th>Fecha</th><th>Proveedor</th><th className="text-center">Items</th><th className="text-right">Total</th><th></th></tr></thead>
            <tbody>
              {compras.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.numero}</td>
                  <td className="muted">{fecha(c.fecha)}</td>
                  <td>{c.proveedor_nombre || <span className="muted">—</span>}</td>
                  <td className="text-center">{c.num_items}</td>
                  <td className="text-right mono" style={{ fontWeight: 600 }}>{crc(c.total)}</td>
                  <td className="text-right"><button className="btn btn-ghost btn-sm" onClick={() => verDetalle(c)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nueva compra */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva compra" width={680}>
        <div className="field">
          <label>Proveedor</label>
          <select className="select" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)' }}>Productos</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0' }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <select className="select" value={it.producto_id} onChange={(e) => setItem(i, 'producto_id', e.target.value)}>
                <option value="">Producto...</option>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input className="input" type="number" placeholder="Cant" value={it.cantidad} onChange={(e) => setItem(i, 'cantidad', e.target.value)} />
              <input className="input" type="number" placeholder="Costo" value={it.costo_unit} onChange={(e) => setItem(i, 'costo_unit', e.target.value)} />
              <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => quitarLinea(i)}><Icon.trash width={15} height={15} /></button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={agregarLinea}><Icon.plus width={15} height={15} /> Agregar linea</button>
        <div className="flex justify-between items-center" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Total: {crc(total)}</span>
          <div className="flex gap-sm">
            <button className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar}>Registrar compra</button>
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
