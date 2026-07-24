import { useEffect, useState } from 'react';
import api, { descargarReporte } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { crc, fechaHora, hoy } from '../utils/format.js';
import { PageHeader, Modal, Loading, EmptyState } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import ComprobanteView from '../components/ComprobanteView.jsx';

const TIPO_LABEL = { ticket: 'Ticket', tiquete_electronico: 'Tiquete E.', factura_electronica: 'Factura E.' };

// Estado del comprobante ante Hacienda. Solo aplica a factura/tiquete electronico.
const FE_COLOR = { aceptado: 'var(--success, #16a34a)', enviado: '#d97706', generado: '#d97706', rechazado: 'var(--danger)', error: 'var(--danger)' };
const FE_LABEL = { aceptado: 'Aceptada', enviado: 'Enviada', generado: 'Sin enviar', rechazado: 'Rechazada', error: 'Error', inactiva: 'FE apagada' };

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

  const esElectronica = (v) => v.tipo_comprobante === 'factura_electronica' || v.tipo_comprobante === 'tiquete_electronico';

  const descargarXml = async (v) => {
    try { await descargarReporte(`/ventas/${v.id}/xml`, `${v.fe_clave || v.numero}.xml`); }
    catch { toast.error('Esta venta no tiene XML generado'); }
  };

  const reenviar = async (v) => {
    try {
      const { data } = await api.post(`/ventas/${v.id}/fe`);
      if (data.data.estado === 'enviado') toast.success('Enviada a Hacienda');
      else toast.error(data.data.respuesta || `Quedo en estado ${data.data.estado}`);
      cargar();
    } catch (err) { toast.error(err.response?.data?.message || 'No se pudo enviar'); }
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
            <thead><tr><th>Numero</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th className="text-right">Total</th><th className="text-center">Estado</th><th>Hacienda</th><th></th></tr></thead>
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
                    {esElectronica(v)
                      ? <span style={{ color: FE_COLOR[v.fe_estado] || 'var(--text-soft)', fontWeight: 600, fontSize: 13 }}>
                          {FE_LABEL[v.fe_estado] || v.fe_estado || '—'}
                        </span>
                      : <span className="muted" style={{ fontSize: 12 }}>No aplica</span>}
                  </td>
                  <td>
                    <div className="flex gap-sm" style={{ justifyContent: 'flex-end' }}>
                      {esElectronica(v) && v.fe_xml && (
                        <button className="btn btn-ghost btn-sm" onClick={() => descargarXml(v)} title="Descargar XML"><Icon.download width={15} height={15} /></button>
                      )}
                      {esGerente && esElectronica(v) && ['generado', 'error', 'rechazado'].includes(v.fe_estado) && (
                        <button className="btn btn-ghost btn-sm" onClick={() => reenviar(v)} title="Reintentar envio a Hacienda">Reenviar</button>
                      )}
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
