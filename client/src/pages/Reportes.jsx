import { useState } from 'react';
import { descargarReporte } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { hoy } from '../utils/format.js';
import { PageHeader } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';

const REPORTES = [
  { id: 'ventas', titulo: 'Ventas', desc: 'Detalle de todas las ventas con IVA y clave de Hacienda', conFechas: true, icon: 'ventas' },
  { id: 'iva', titulo: 'Resumen de IVA (D-104)', desc: 'Base gravada e IVA cobrado por dia, para la declaracion', conFechas: true, icon: 'reportes' },
  { id: 'inventario', titulo: 'Inventario', desc: 'Existencias actuales, costos y valor del inventario', conFechas: false, icon: 'inventario' },
  { id: 'gastos', titulo: 'Gastos', desc: 'Egresos por categoria y metodo de pago', conFechas: true, icon: 'gastos' },
  { id: 'compras', titulo: 'Compras', desc: 'Compras a proveedores', conFechas: false, icon: 'compras' },
];

export default function Reportes() {
  const toast = useToast();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [bajando, setBajando] = useState('');

  const descargar = async (rep) => {
    setBajando(rep.id);
    try {
      let ruta = `/reportes/${rep.id}`;
      const qs = [];
      if (rep.conFechas && desde) qs.push(`desde=${desde}`);
      if (rep.conFechas && hasta) qs.push(`hasta=${hasta}`);
      if (qs.length) ruta += '?' + qs.join('&');
      await descargarReporte(ruta, `${rep.id}_${hoy()}.csv`);
      toast.success(`Reporte de ${rep.titulo.toLowerCase()} descargado`);
    } catch (err) {
      toast.error('No se pudo generar el reporte');
    } finally {
      setBajando('');
    }
  };

  return (
    <div>
      <PageHeader title="Descargables" subtitle="Reportes en formato Excel para tu contador" />

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="flex items-center gap-sm" style={{ marginBottom: 12 }}>
          <Icon.reportes width={18} height={18} />
          <strong>Rango de fechas</strong>
          <span className="muted" style={{ fontSize: 13 }}>(aplica a ventas, IVA y gastos)</span>
        </div>
        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0 }}><label>Desde</label><input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
          <div className="field" style={{ margin: 0 }}><label>Hasta</label><input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
          <button className="btn btn-outline" style={{ alignSelf: 'flex-end' }} onClick={() => { setDesde(''); setHasta(''); }}>Todo el historial</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {REPORTES.map((rep) => {
          const IconCmp = Icon[rep.icon];
          return (
            <div key={rep.id} className="card fade-up" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCmp width={22} height={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, marginBottom: 4 }}>{rep.titulo}</h3>
                <p className="muted" style={{ fontSize: 13 }}>{rep.desc}</p>
              </div>
              <button className="btn btn-primary btn-block" disabled={bajando === rep.id} onClick={() => descargar(rep)}>
                {bajando === rep.id ? <span className="spinner" /> : <><Icon.download /> Descargar Excel</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
