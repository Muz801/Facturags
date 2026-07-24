import { useCallback, useEffect, useRef, useState } from 'react';
import api, { descargarReporte } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { crc, fecha, fechaHora } from '../utils/format.js';
import { PageHeader, Modal, Loading, EmptyState } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';

// ============================================================
//  Buzon de comprobantes recibidos
//
//  Cada factura que le hacen al negocio hay que responderla ante
//  Hacienda antes del 8vo dia habil del mes siguiente. Si el plazo
//  se vence, ese IVA ya no se puede acreditar: por eso la columna
//  de plazo manda el color de toda la fila.
// ============================================================

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'aceptado', label: 'Aceptados' },
  { value: 'aceptado_parcial', label: 'Aceptados parcial' },
  { value: 'rechazado', label: 'Rechazados' },
];

const ETIQUETA_ESTADO = {
  pendiente: 'Sin responder',
  aceptado: 'Aceptado',
  aceptado_parcial: 'Aceptado parcial',
  rechazado: 'Rechazado',
};

function Semaforo({ c }) {
  if (c.estado !== 'pendiente') {
    const color = c.estado === 'rechazado' ? 'var(--text-soft)' : 'var(--success, #16a34a)';
    return <span style={{ color, fontWeight: 600 }}>{ETIQUETA_ESTADO[c.estado]}</span>;
  }
  if (c.vencido) {
    return (
      <span style={{ color: 'var(--danger)', fontWeight: 700 }} title="El plazo vencio: ese IVA ya no se puede acreditar">
        Plazo vencido
      </span>
    );
  }
  const color = c.urgente ? 'var(--danger)' : c.dias_para_vencer <= 7 ? '#d97706' : 'var(--text-soft)';
  return (
    <span style={{ color, fontWeight: c.urgente ? 700 : 500 }} title={`Vence el ${c.fecha_limite}`}>
      {c.dias_para_vencer === 0 ? 'Vence hoy' : `${c.dias_para_vencer} dias`}
    </span>
  );
}

export default function Recibidos() {
  const toast = useToast();
  const inputArchivo = useRef(null);
  const [lista, setLista] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [resultadoSubida, setResultadoSubida] = useState(null);
  const [responder, setResponder] = useState(null); // { comprobante, mensaje }
  const [detalle, setDetalle] = useState('');
  const [ivaParcial, setIvaParcial] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    api.get('/recibidos', { params: filtro ? { estado: filtro } : {} }).then((r) => setLista(r.data.data));
    api.get('/recibidos/resumen').then((r) => setResumen(r.data.data));
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  const subir = async (archivos) => {
    if (!archivos?.length) return;
    const form = new FormData();
    for (const a of archivos) form.append('archivos', a);
    setSubiendo(true);
    try {
      const { data } = await api.post('/recibidos', form);
      setResultadoSubida(data.data);
      if (data.data.importados > 0) toast.success(`${data.data.importados} comprobante(s) importado(s)`);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudieron subir los archivos');
    } finally {
      setSubiendo(false);
      if (inputArchivo.current) inputArchivo.current.value = '';
    }
  };

  const abrirRespuesta = (comprobante, mensaje) => {
    setResponder({ comprobante, mensaje });
    setDetalle('');
    setIvaParcial(mensaje === 2 ? String(Number(comprobante.total_impuesto)) : '');
  };

  const confirmarRespuesta = async () => {
    const { comprobante, mensaje } = responder;
    setEnviando(true);
    try {
      const { data } = await api.post(`/recibidos/${comprobante.id}/responder`, {
        mensaje,
        detalle,
        monto_iva_acreditar: mensaje === 2 ? Number(ivaParcial) : undefined,
      });
      toast.success(
        data.data.mr_estado === 'enviado'
          ? `Mensaje enviado a Hacienda (consecutivo ${data.data.consecutivo_receptor})`
          : `Respuesta registrada: ${data.data.mr_estado}`
      );
      setResponder(null);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo enviar el mensaje a Hacienda');
    } finally {
      setEnviando(false);
    }
  };

  const consultar = async (c) => {
    try {
      const { data } = await api.get(`/recibidos/${c.id}/estado`);
      toast.success(`Hacienda responde: ${data.data.ind_estado || data.data.mr_estado}`);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo consultar');
    }
  };

  const descargarXml = async (c) => {
    try {
      await descargarReporte(`/recibidos/${c.id}/xml`, `${c.clave}.xml`);
    } catch {
      toast.error('No se pudo descargar el XML');
    }
  };

  const registrarGasto = async (c) => {
    try {
      await api.post(`/recibidos/${c.id}/gasto`, {});
      toast.success('Gasto registrado con su respaldo electronico');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo registrar el gasto');
    }
  };

  return (
    <div>
      <PageHeader
        title="Comprobantes recibidos"
        subtitle="Facturas de proveedores que hay que aceptar o rechazar ante Hacienda"
      >
        <input
          ref={inputArchivo}
          type="file"
          accept=".xml,.zip"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => subir(e.target.files)}
        />
        <button className="btn btn-primary" disabled={subiendo} onClick={() => inputArchivo.current?.click()}>
          <Icon.plus /> {subiendo ? 'Importando...' : 'Subir XML o ZIP'}
        </button>
      </PageHeader>

      {/* Tarjetas de control del plazo */}
      {resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Tarjeta titulo="Sin responder" valor={resumen.pendientes} />
          <Tarjeta titulo="Vencen en 3 dias o menos" valor={resumen.por_vencer} color={resumen.por_vencer ? 'var(--danger)' : undefined} />
          <Tarjeta titulo="Con plazo vencido" valor={resumen.vencidos} color={resumen.vencidos ? 'var(--danger)' : undefined} />
          <Tarjeta
            titulo="IVA aceptado del periodo"
            valor={crc(
              (resumen.por_estado?.aceptado?.iva || 0) + (resumen.por_estado?.aceptado_parcial?.iva || 0)
            )}
          />
        </div>
      )}

      <div className="flex gap-sm" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            className={`btn btn-sm ${filtro === e.value ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFiltro(e.value)}
          >
            {e.label}
          </button>
        ))}
      </div>

      {!lista ? (
        <Loading />
      ) : lista.length === 0 ? (
        <EmptyState
          icon="box"
          titulo="Buzon vacio"
          texto="Suba los XML que le mandan sus proveedores por correo. Puede arrastrar varios o un ZIP completo."
        />
      ) : (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Documento</th>
                <th>Fecha</th>
                <th className="text-right">Total</th>
                <th className="text-right">IVA</th>
                <th>Plazo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} style={c.vencido ? { background: 'rgba(220,38,38,0.06)' } : undefined}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.emisor_nombre}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{c.emisor_identificacion}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{c.tipo_nombre}</div>
                    <div className="muted mono" style={{ fontSize: 11 }}>{c.numero_consecutivo}</div>
                  </td>
                  <td className="muted">{fecha(c.fecha_emision)}</td>
                  <td className="text-right mono" style={{ fontWeight: 600 }}>{crc(c.total_comprobante)}</td>
                  <td className="text-right mono">{crc(c.total_impuesto)}</td>
                  <td><Semaforo c={c} /></td>
                  <td className="text-right">
                    {/* En columna: asi la tabla no se desborda en pantallas angostas */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}>
                      {c.estado === 'pendiente' ? (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => abrirRespuesta(c, 1)}>Aceptar</button>
                          <button className="btn btn-sm btn-outline" onClick={() => abrirRespuesta(c, 2)}>Parcial</button>
                          <button className="btn btn-sm btn-outline" style={{ color: 'var(--danger)' }} onClick={() => abrirRespuesta(c, 3)}>
                            Rechazar
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => consultar(c)} title="Consultar el estado en Hacienda">
                            Ver estado
                          </button>
                          {!c.gasto_id && c.estado !== 'rechazado' && (
                            <button className="btn btn-ghost btn-sm" onClick={() => registrarGasto(c)}>
                              Registrar gasto
                            </button>
                          )}
                          {c.gasto_id && <span className="muted" style={{ fontSize: 12 }}>Gasto #{c.gasto_id}</span>}
                        </>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => descargarXml(c)}
                        title="Descargar el XML original del proveedor"
                      >
                        <Icon.download width={14} height={14} /> XML
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resultado de la importacion */}
      <Modal open={!!resultadoSubida} onClose={() => setResultadoSubida(null)} title="Resultado de la importacion" width={600}>
        {resultadoSubida && (
          <div>
            <p style={{ marginBottom: 12 }}>
              Se importaron <strong>{resultadoSubida.importados}</strong> de {resultadoSubida.total} archivo(s).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {resultadoSubida.resultados.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                  <span style={{ color: r.ok ? 'var(--success, #16a34a)' : 'var(--danger)', fontWeight: 700 }}>
                    {r.ok ? '✓' : '✗'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.archivo}</div>
                    <div className="muted">
                      {r.ok ? `${r.emisor} — ${crc(r.total)}` : r.motivo}
                      {r.sin_firma && ' (ojo: el XML no trae firma digital)'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmacion de respuesta a Hacienda */}
      <Modal
        open={!!responder}
        onClose={() => setResponder(null)}
        title={
          responder?.mensaje === 1 ? 'Aceptar comprobante'
            : responder?.mensaje === 2 ? 'Aceptar parcialmente'
              : 'Rechazar comprobante'
        }
        width={560}
      >
        {responder && (
          <div>
            <div className="card" style={{ padding: 12, marginBottom: 14 }}>
              <div style={{ fontWeight: 600 }}>{responder.comprobante.emisor_nombre}</div>
              <div className="muted mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>
                {responder.comprobante.clave}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 18 }}>
                <span>Total: <strong>{crc(responder.comprobante.total_comprobante)}</strong></span>
                <span>IVA: <strong>{crc(responder.comprobante.total_impuesto)}</strong></span>
              </div>
            </div>

            {responder.mensaje === 1 && (
              <p className="muted" style={{ marginBottom: 12 }}>
                Se le informa a Hacienda que el comprobante es correcto y se acredita el IVA completo
                de {crc(responder.comprobante.total_impuesto)}.
              </p>
            )}

            {responder.mensaje === 2 && (
              <div className="field">
                <label>IVA que si se acredita</label>
                <input
                  className="input"
                  type="number"
                  value={ivaParcial}
                  onChange={(e) => setIvaParcial(e.target.value)}
                  max={Number(responder.comprobante.total_impuesto)}
                />
                <small className="muted">
                  Maximo {crc(responder.comprobante.total_impuesto)}. Por la diferencia el proveedor
                  debe emitir una nota de credito.
                </small>
              </div>
            )}

            {responder.mensaje !== 1 && (
              <div className="field">
                <label>Motivo {responder.mensaje === 3 ? '(por que se rechaza)' : '(que parte esta mal)'}</label>
                <input
                  className="input"
                  value={detalle}
                  maxLength={160}
                  placeholder={responder.mensaje === 3 ? 'Ej: no corresponde a una compra del negocio' : 'Ej: cobraron una linea de mas'}
                  onChange={(e) => setDetalle(e.target.value)}
                />
              </div>
            )}

            <div className="flex justify-between items-center" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Se firma y se envia a Hacienda
              </span>
              <div className="flex gap-sm">
                <button className="btn btn-outline" onClick={() => setResponder(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={enviando} onClick={confirmarRespuesta}>
                  {enviando ? 'Enviando...' : 'Enviar a Hacienda'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Tarjeta({ titulo, valor, color }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="muted" style={{ fontSize: 12 }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'inherit' }}>{valor}</div>
    </div>
  );
}
