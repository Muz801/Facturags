import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client.js';
import { crcExacto, fechaHora } from '../utils/format.js';
import Logo from '../components/Logo.jsx';
import { Loading } from '../components/UI.jsx';

// Vista publica del comprobante (se abre desde el enlace/QR del correo).
// No requiere sesion para los datos basicos del ticket.
export default function Comprobante() {
  const { id } = useParams();
  const [venta, setVenta] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/ventas/${id}`).then((r) => setVenta(r.data.data)).catch(() => setError(true));
    api.get('/empresa').then((r) => setEmpresa(r.data.data)).catch(() => {});
  }, [id]);

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <h2>Comprobante no disponible</h2>
        <p className="muted" style={{ marginTop: 8 }}>Inicia sesion para ver este comprobante.</p>
      </div>
    </div>
  );

  if (!venta) return <Loading />;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card fade-up" style={{ padding: 28, maxWidth: 380, width: '100%', background: 'var(--surface-solid)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}><Logo size={34} /></div>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h3>{empresa?.nombre_comercial}</h3>
          <p className="muted" style={{ fontSize: 13 }}>{venta.numero} · {fechaHora(venta.fecha)}</p>
        </div>
        <table style={{ width: '100%', fontSize: 14 }}>
          <tbody>
            {(venta.items || []).map((it) => (
              <tr key={it.id}>
                <td style={{ padding: '4px 0' }}>{it.cantidad} × {it.nombre}</td>
                <td style={{ textAlign: 'right' }}>{crcExacto(it.total_linea)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />
        <div className="flex justify-between" style={{ fontSize: 20, fontWeight: 700 }}>
          <span>Total</span><span style={{ color: 'var(--accent)' }}>{crcExacto(venta.total)}</span>
        </div>
        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 16 }}>{empresa?.mensaje_factura}</p>
      </div>
    </div>
  );
}
