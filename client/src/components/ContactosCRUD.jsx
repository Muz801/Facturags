import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { TIPOS_ID } from '../utils/format.js';
import { PageHeader, Modal, Loading, EmptyState } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';

// Componente generico para administrar clientes o proveedores.
export default function ContactosCRUD({ tipo }) {
  const toast = useToast();
  const esCliente = tipo === 'clientes';
  const recurso = esCliente ? 'clientes' : 'proveedores';
  const titulo = esCliente ? 'Clientes' : 'Proveedores';
  const subt = esCliente ? 'Tu cartera de clientes' : 'Tus proveedores y distribuidores';

  const [lista, setLista] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});

  const cargar = () => {
    const params = busqueda ? { q: busqueda } : {};
    api.get(`/${recurso}`, { params }).then((r) => setLista(r.data.data));
  };
  useEffect(cargar, [busqueda, recurso]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(esCliente
      ? { nombre: '', tipo_identificacion: '01', identificacion: '', email: '', telefono: '', codigo_actividad: '' }
      : { nombre: '', identificacion: '', email: '', telefono: '', direccion: '' });
    setModal(true);
  };
  const abrirEditar = (item) => { setEditando(item.id); setForm({ ...item }); setModal(true); };

  const guardar = async () => {
    if (!form.nombre) { toast.error('El nombre es requerido'); return; }
    try {
      if (editando) await api.put(`/${recurso}/${editando}`, form);
      else await api.post(`/${recurso}`, form);
      toast.success('Guardado'); setModal(false); cargar();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const eliminar = async (item) => {
    if (!confirm(`Eliminar ${item.nombre}?`)) return;
    await api.delete(`/${recurso}/${item.id}`);
    toast.success('Eliminado'); cargar();
  };

  return (
    <div>
      <PageHeader title={titulo} subtitle={subt}>
        <button className="btn btn-primary" onClick={abrirNuevo}><Icon.plus /> Nuevo</button>
      </PageHeader>

      <div className="card" style={{ padding: 14, marginBottom: 16, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 26, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Icon.search width={18} height={18} /></span>
        <input className="input" style={{ paddingLeft: 38 }} placeholder={`Buscar ${titulo.toLowerCase()}...`} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {!lista ? <Loading /> : lista.length === 0 ? (
        <EmptyState icon={esCliente ? 'clientes' : 'proveedores'} titulo={`Sin ${titulo.toLowerCase()}`} texto="Agrega el primero con el boton de arriba." />
      ) : (
        <div className="card table-wrap">
          <table className="data">
            <thead><tr><th>Nombre</th><th>Identificacion</th><th>Telefono</th><th>Correo</th><th></th></tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td className="muted">{c.identificacion || '—'}</td>
                  <td className="muted">{c.telefono || '—'}</td>
                  <td className="muted">{c.email || '—'}</td>
                  <td>
                    <div className="flex gap-sm" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(c)}><Icon.edit width={15} height={15} /></button>
                      <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => eliminar(c)}><Icon.trash width={15} height={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? `Editar ${titulo.slice(0, -1).toLowerCase()}` : `Nuevo ${titulo.slice(0, -1).toLowerCase()}`}>
        <div className="field"><label>Nombre *</label><input className="input" value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
        {esCliente && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Tipo de identificacion</label>
              <select className="select" value={form.tipo_identificacion || '01'} onChange={(e) => setForm({ ...form, tipo_identificacion: e.target.value })}>
                {TIPOS_ID.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="field"><label>Numero de identificacion</label><input className="input" value={form.identificacion || ''} onChange={(e) => setForm({ ...form, identificacion: e.target.value })} /></div>
          </div>
        )}
        {!esCliente && (
          <div className="field"><label>Cedula juridica</label><input className="input" value={form.identificacion || ''} onChange={(e) => setForm({ ...form, identificacion: e.target.value })} /></div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label>Telefono</label><input className="input" value={form.telefono || ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
          <div className="field"><label>Correo</label><input className="input" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        {esCliente && (
          <div className="field"><label>Codigo de actividad economica (para factura electronica)</label><input className="input" value={form.codigo_actividad || ''} onChange={(e) => setForm({ ...form, codigo_actividad: e.target.value })} /></div>
        )}
        {!esCliente && (
          <div className="field"><label>Direccion</label><input className="input" value={form.direccion || ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></div>
        )}
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar}>Guardar</button>
        </div>
      </Modal>
    </div>
  );
}
