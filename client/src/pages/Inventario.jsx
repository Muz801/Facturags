import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { crc } from '../utils/format.js';
import { PageHeader, Modal, Loading, EmptyState } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';

const IVA_OPCIONES = [13, 4, 2, 1, 0];

export default function Inventario() {
  const toast = useToast();
  const [productos, setProductos] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCat, setFiltroCat] = useState('');
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  const [modalProd, setModalProd] = useState(false);
  const [modalCat, setModalCat] = useState(false);
  const [modalStock, setModalStock] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [catForm, setCatForm] = useState({ nombre: '', color: '#7c3aed' });
  const [stockForm, setStockForm] = useState({ cantidad: '', tipo: 'ajuste', motivo: '' });

  const cargar = () => {
    const params = {};
    if (busqueda) params.q = busqueda;
    if (filtroCat) params.categoria = filtroCat;
    if (soloStockBajo) params.stockBajo = 'true';
    api.get('/productos', { params }).then((r) => setProductos(r.data.data));
    api.get('/categorias').then((r) => setCategorias(r.data.data));
  };
  useEffect(cargar, [busqueda, filtroCat, soloStockBajo]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ nombre: '', sku: '', codigo_cabys: '', categoria_id: '', precio_costo: '', precio_venta: '', tarifa_iva: 13, stock: 0, stock_minimo: 5, unidad_medida: 'Unid' });
    setModalProd(true);
  };
  const abrirEditar = (p) => {
    setEditando(p.id);
    setForm({ ...p, categoria_id: p.categoria_id || '' });
    setModalProd(true);
  };

  const guardarProd = async () => {
    if (!form.nombre) { toast.error('El nombre es requerido'); return; }
    try {
      const payload = { ...form, categoria_id: form.categoria_id || null };
      if (editando) await api.put(`/productos/${editando}`, payload);
      else await api.post('/productos', payload);
      toast.success(editando ? 'Producto actualizado' : 'Producto creado');
      setModalProd(false); cargar();
    } catch (err) { toast.error(err.response?.data?.message || 'Error al guardar'); }
  };

  const eliminarProd = async (p) => {
    if (!confirm(`Eliminar ${p.nombre}?`)) return;
    await api.delete(`/productos/${p.id}`);
    toast.success('Producto eliminado'); cargar();
  };

  const guardarCat = async () => {
    if (!catForm.nombre) { toast.error('Nombre requerido'); return; }
    try {
      await api.post('/categorias', catForm);
      toast.success('Categoria creada');
      setCatForm({ nombre: '', color: '#7c3aed' });
      api.get('/categorias').then((r) => setCategorias(r.data.data));
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const eliminarCat = async (id) => {
    if (!confirm('Eliminar esta categoria?')) return;
    await api.delete(`/categorias/${id}`);
    api.get('/categorias').then((r) => setCategorias(r.data.data));
  };

  const abrirStock = (p) => { setEditando(p); setStockForm({ cantidad: '', tipo: 'ajuste', motivo: '' }); setModalStock(true); };
  const guardarStock = async () => {
    const cant = Number(stockForm.cantidad);
    if (!cant) { toast.error('Cantidad invalida'); return; }
    try {
      await api.post(`/productos/${editando.id}/stock`, stockForm);
      toast.success('Stock ajustado'); setModalStock(false); cargar();
    } catch (err) { toast.error('Error al ajustar'); }
  };

  return (
    <div>
      <PageHeader title="Inventario" subtitle="Productos, existencias y categorias">
        <button className="btn btn-outline" onClick={() => setModalCat(true)}><Icon.inventario /> Categorias</button>
        <button className="btn btn-primary" onClick={abrirNuevo}><Icon.plus /> Nuevo producto</button>
      </PageHeader>

      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Icon.search width={18} height={18} /></span>
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <select className="select" style={{ width: 'auto' }} value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)}>
          <option value="">Todas las categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button className={`btn ${soloStockBajo ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSoloStockBajo((s) => !s)}>
          <Icon.alert width={16} height={16} /> Stock bajo
        </button>
      </div>

      {!productos ? <Loading /> : productos.length === 0 ? (
        <EmptyState icon="inventario" titulo="Sin productos" texto="Crea tu primer producto para empezar." />
      ) : (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Producto</th><th>Categoria</th><th className="text-right">Costo</th>
                <th className="text-right">Precio</th><th className="text-center">IVA</th>
                <th className="text-center">Stock</th><th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                    {p.sku && <div className="muted" style={{ fontSize: 12 }}>{p.sku}</div>}
                  </td>
                  <td>{p.categoria_nombre ? <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{p.categoria_nombre}</span> : <span className="muted">—</span>}</td>
                  <td className="text-right mono">{crc(p.precio_costo)}</td>
                  <td className="text-right mono" style={{ fontWeight: 600 }}>{crc(p.precio_venta)}</td>
                  <td className="text-center">{Number(p.tarifa_iva)}%</td>
                  <td className="text-center">
                    <button onClick={() => abrirStock(p)} className="badge" style={{ cursor: 'pointer', background: Number(p.stock) <= Number(p.stock_minimo) ? 'var(--warning-bg)' : 'var(--success-bg)', color: Number(p.stock) <= Number(p.stock_minimo) ? 'var(--warning)' : 'var(--success)' }}>
                      {Number(p.stock)} {p.unidad_medida}
                    </button>
                  </td>
                  <td>
                    <div className="flex gap-sm" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)} title="Editar"><Icon.edit width={15} height={15} /></button>
                      <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarProd(p)} title="Eliminar"><Icon.trash width={15} height={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal producto */}
      <Modal open={modalProd} onClose={() => setModalProd(false)} title={editando ? 'Editar producto' : 'Nuevo producto'} width={600}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field" style={{ gridColumn: '1/-1' }}>
            <label>Nombre *</label>
            <input className="input" value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="field"><label>SKU</label><input className="input" value={form.sku || ''} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
          <div className="field"><label>Codigo CAByS (factura electronica)</label><input className="input" value={form.codigo_cabys || ''} onChange={(e) => setForm({ ...form, codigo_cabys: e.target.value })} placeholder="13 digitos" /></div>
          <div className="field">
            <label>Categoria</label>
            <select className="select" value={form.categoria_id || ''} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
              <option value="">Sin categoria</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="field"><label>Unidad de medida</label><input className="input" value={form.unidad_medida || ''} onChange={(e) => setForm({ ...form, unidad_medida: e.target.value })} /></div>
          <div className="field"><label>Precio de costo (₡)</label><input className="input" type="number" value={form.precio_costo ?? ''} onChange={(e) => setForm({ ...form, precio_costo: e.target.value })} /></div>
          <div className="field"><label>Precio de venta (₡)</label><input className="input" type="number" value={form.precio_venta ?? ''} onChange={(e) => setForm({ ...form, precio_venta: e.target.value })} /></div>
          <div className="field">
            <label>Tarifa de IVA</label>
            <select className="select" value={form.tarifa_iva ?? 13} onChange={(e) => setForm({ ...form, tarifa_iva: Number(e.target.value) })}>
              {IVA_OPCIONES.map((t) => <option key={t} value={t}>{t}%</option>)}
            </select>
          </div>
          <div className="field"><label>Stock minimo</label><input className="input" type="number" value={form.stock_minimo ?? 5} onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })} /></div>
          {!editando && <div className="field"><label>Stock inicial</label><input className="input" type="number" value={form.stock ?? 0} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>}
        </div>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button className="btn btn-outline" onClick={() => setModalProd(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardarProd}>Guardar</button>
        </div>
      </Modal>

      {/* Modal categorias */}
      <Modal open={modalCat} onClose={() => setModalCat(false)} title="Categorias">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="input" placeholder="Nueva categoria" value={catForm.nombre} onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })} />
          <input type="color" value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} style={{ width: 46, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }} />
          <button className="btn btn-primary" onClick={guardarCat} style={{ flexShrink: 0 }}><Icon.plus /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {categorias.map((c) => (
            <div key={c.id} className="flex items-center justify-between" style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)' }}>
              <span className="flex items-center gap-sm"><span style={{ width: 12, height: 12, borderRadius: '50%', background: c.color }} />{c.nombre}</span>
              <span className="flex items-center gap-sm">
                <span className="muted" style={{ fontSize: 12 }}>{c.total_productos} prod.</span>
                <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminarCat(c.id)}><Icon.trash width={14} height={14} /></button>
              </span>
            </div>
          ))}
        </div>
      </Modal>

      {/* Modal ajuste de stock */}
      <Modal open={modalStock} onClose={() => setModalStock(false)} title={`Ajustar stock: ${editando?.nombre || ''}`} width={420}>
        <p className="muted" style={{ marginBottom: 14 }}>Stock actual: <strong>{Number(editando?.stock || 0)}</strong>. Usa positivo para sumar, negativo para restar.</p>
        <div className="field"><label>Cantidad (+/−)</label><input className="input" type="number" value={stockForm.cantidad} onChange={(e) => setStockForm({ ...stockForm, cantidad: e.target.value })} /></div>
        <div className="field">
          <label>Tipo</label>
          <select className="select" value={stockForm.tipo} onChange={(e) => setStockForm({ ...stockForm, tipo: e.target.value })}>
            <option value="ajuste">Ajuste</option><option value="merma">Merma</option><option value="compra">Entrada</option>
          </select>
        </div>
        <div className="field"><label>Motivo</label><input className="input" value={stockForm.motivo} onChange={(e) => setStockForm({ ...stockForm, motivo: e.target.value })} /></div>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={() => setModalStock(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardarStock}>Aplicar</button>
        </div>
      </Modal>
    </div>
  );
}
