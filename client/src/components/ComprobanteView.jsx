import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { crc, crcExacto, fechaHora } from '../utils/format.js';
import { Icon } from './Icons.jsx';

// Vista de comprobante tipo ticket. Sirve para imprimir, mostrar QR y enviar por correo.
export default function ComprobanteView({ venta, onClose, empresa: empresaProp }) {
  const toast = useToast();
  const [qr, setQr] = useState(null);
  const [empresa, setEmpresa] = useState(empresaProp || null);
  const [email, setEmail] = useState(venta.cliente?.email || '');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get(`/ventas/${venta.id}/qr`).then((r) => setQr(r.data.data.qr)).catch(() => {});
    if (!empresaProp) api.get('/empresa').then((r) => setEmpresa(r.data.data)).catch(() => {});
  }, [venta.id]);

  const imprimir = () => {
    const contenido = document.getElementById('ticket-imprimible').innerHTML;
    const w = window.open('', '_blank', 'width=380,height=640');
    w.document.write(`<html><head><title>Comprobante ${venta.numero}</title>
      <style>body{font-family:'Courier New',monospace;font-size:12px;padding:16px;color:#000}
      table{width:100%;border-collapse:collapse}td{padding:2px 0}
      .r{text-align:right}.c{text-align:center}.b{font-weight:bold}
      hr{border:none;border-top:1px dashed #999;margin:8px 0}img{max-width:140px}</style>
      </head><body>${contenido}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
  };

  const enviarCorreo = async () => {
    if (!email) { toast.error('Ingresa un correo'); return; }
    setEnviando(true);
    try {
      const { data } = await api.post(`/ventas/${venta.id}/correo`, { email });
      if (data.data.simulado) toast.info('Correo simulado (configura SMTP para envios reales)');
      else toast.success('Comprobante enviado a ' + email);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo enviar');
    } finally {
      setEnviando(false);
    }
  };

  const etiquetaTipo = {
    ticket: 'COMPROBANTE INTERNO',
    tiquete_electronico: 'TIQUETE ELECTRONICO',
    factura_electronica: 'FACTURA ELECTRONICA',
  }[venta.tipo_comprobante] || 'COMPROBANTE';

  return (
    <div>
      <div id="ticket-imprimible" style={{
        fontFamily: "'Courier New', monospace", fontSize: 13, background: '#fff', color: '#000',
        padding: 18, borderRadius: 10, border: '1px solid var(--border)', maxWidth: 320, margin: '0 auto',
      }}>
        <div className="c" style={{ textAlign: 'center' }}>
          <div className="b" style={{ fontWeight: 700, fontSize: 15 }}>{empresa?.nombre_comercial || 'Mi Negocio'}</div>
          {empresa?.razon_social && <div style={{ fontSize: 11 }}>{empresa.razon_social}</div>}
          {empresa?.identificacion && <div style={{ fontSize: 11 }}>Ced: {empresa.identificacion}</div>}
          {empresa?.telefono && <div style={{ fontSize: 11 }}>Tel: {empresa.telefono}</div>}
          <div style={{ fontSize: 11, marginTop: 4, fontWeight: 700 }}>{etiquetaTipo}</div>
        </div>
        <hr style={{ border: 'none', borderTop: '1px dashed #999', margin: '8px 0' }} />
        <div style={{ fontSize: 11 }}>
          <div>No: {venta.numero}</div>
          <div>Fecha: {fechaHora(venta.fecha)}</div>
          {venta.cliente?.nombre && <div>Cliente: {venta.cliente.nombre}</div>}
          {venta.fe_clave && <div style={{ wordBreak: 'break-all' }}>Clave: {venta.fe_clave}</div>}
        </div>
        <hr style={{ border: 'none', borderTop: '1px dashed #999', margin: '8px 0' }} />
        <table style={{ width: '100%' }}>
          <tbody>
            {(venta.items || []).map((it) => (
              <tr key={it.id}>
                <td style={{ verticalAlign: 'top' }}>
                  {it.cantidad} x {it.nombre}<br />
                  <span style={{ fontSize: 10 }}>{crcExacto(it.precio_unit)}</span>
                </td>
                <td className="r" style={{ textAlign: 'right', verticalAlign: 'top' }}>{crcExacto(it.total_linea)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr style={{ border: 'none', borderTop: '1px dashed #999', margin: '8px 0' }} />
        <table style={{ width: '100%' }}>
          <tbody>
            <tr><td>Subtotal</td><td className="r" style={{ textAlign: 'right' }}>{crcExacto(venta.subtotal)}</td></tr>
            {Number(venta.descuento) > 0 && <tr><td>Descuento</td><td className="r" style={{ textAlign: 'right' }}>-{crcExacto(venta.descuento)}</td></tr>}
            <tr><td>IVA</td><td className="r" style={{ textAlign: 'right' }}>{crcExacto(venta.impuesto)}</td></tr>
            <tr className="b" style={{ fontWeight: 700, fontSize: 15 }}><td>TOTAL</td><td className="r" style={{ textAlign: 'right' }}>{crcExacto(venta.total)}</td></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 11, marginTop: 6, textTransform: 'capitalize' }}>Pago: {venta.metodo_pago}</div>
        {qr && <div className="c" style={{ textAlign: 'center', marginTop: 10 }}><img src={qr} alt="QR" style={{ maxWidth: 130 }} /></div>}
        <div className="c" style={{ textAlign: 'center', fontSize: 11, marginTop: 8 }}>{empresa?.mensaje_factura || 'Gracias por su compra'}</div>
      </div>

      {/* Acciones (no se imprimen) */}
      <div style={{ marginTop: 16 }}>
        <div className="flex gap-sm" style={{ marginBottom: 10 }}>
          <button className="btn btn-ghost btn-block" onClick={imprimir}><Icon.print /> Imprimir</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" type="email" placeholder="correo@cliente.cr" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary" onClick={enviarCorreo} disabled={enviando} style={{ flexShrink: 0 }}>
            {enviando ? <span className="spinner" /> : <><Icon.mail /> Enviar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
