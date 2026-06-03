import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { crc, fechaHora, hoy } from '../utils/format.js';
import { PageHeader, Modal, Loading, EmptyState } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import ComprobanteView from '../components/ComprobanteView.jsx';

const TIPO_LABEL = { ticket: 'Ticket', tiquete_electronico: 'Tiquete E.', factura_electronica: 'Factura E.' };

export default function Ventas() {
  const { esGerente } = useAuth();
  const toast = useToast();
  const [ventas, setVentas] = useState(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [detalle, setDetalle] = useState(null);

  const cargar = () => {
    const params = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    api.get('/ventas', { params }).then((r) => setVentas(r.data.data));
  };
  useEffect(cargar, [desde, hasta]);

  const verDetalle = async (v) => {
    const { data } = await api.get(`/ventas/${v.id}`);
    setDetalle(data.data);
  };

  const anular = async (v) => {
    if (!confirm(`Anular la venta ${v.numero}? Se devolvera el stock.`)) return;
    try {
      await api.post(`/ventas/${v.id}/anular`);
      toast.success('Venta anulada'); cargar();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  return (
    <div>
      <PageHeader title="Ventas" subtitle="Historial de transacciones" />

      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0 }}><label>Desde</label><input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div className="field" style={{ margin: 0 }}><label>Hasta</label><input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <button className="btn btn-outline" onClick={() => { setDesde(''); setHasta(''); }}>Limpiar</button>
      </div>

      {!ventas ? <Loading /> : ventas.length === 0 ? (
        <EmptyState icon="ventas" titulo="Sin ventas" texto="Aun no hay ventas en este periodo." />
      ) : (
        <div className="card table-wrap">
          <table className="data">
            <thead><tr><th>Numero</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th className="text-right">Total</th><th className="text-center">Estado</th><th></th></tr></thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.numero}</td>
                  <td className="muted" style={{ fontSize: 13 }}>{fechaHora(v.fecha)}</td>
                  <td>{v.cliente_nombre || <span className="muted">Contado</span>}</td>
                  <td><span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{TIPO_LABEL[v.tipo_comprobante]}</span></td>
                  <td className="text-right mono" style={{ fontWeight: 600 }}>{crc(v.total)}</td>
                  <td className="text-center">
                    {v.estado === 'anulada'
                      ? <span className="badge badge-danger">Anulada</span>
                      : <span className="badge badge-success">Completada</span>}
                  </td>
                  <td>
                    <div className="flex gap-sm" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(v)} title="Ver"><Icon.print width={15} height={15} /></button>
                      {esGerente && v.estado !== 'anulada' && (
                        <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => anular(v)} title="Anular"><Icon.close width={15} height={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!detalle} onClose={() => setDetalle(null)} title="Detalle de venta" width={420}>
        {detalle && <ComprobanteView venta={detalle} onClose={() => setDetalle(null)} />}
      </Modal>
    </div>
  );
}
