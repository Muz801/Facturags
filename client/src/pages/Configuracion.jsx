import { useEffect, useState, useRef } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { TIPOS_ID } from '../utils/format.js';
import { PageHeader, Loading } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';

const TABS = [
  { id: 'comercio', label: 'Datos del comercio' },
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'hacienda', label: 'Factura Electronica' },
];

// Revision previa: Hacienda rechaza el comprobante entero por un campo mal
// puesto y avisa en diferido. Mejor ver la lista antes de pasar a produccion.
function RevisionFiscal() {
  const [rev, setRev] = useState(null);
  const [abierto, setAbierto] = useState(false);

  const revisar = () => {
    setRev('cargando');
    api.get('/empresa/hacienda/revision')
      .then((r) => { setRev(r.data.data); setAbierto(true); })
      .catch(() => setRev(null));
  };

  const color = rev && rev !== 'cargando'
    ? (rev.listo_para_produccion ? 'var(--success, #16a34a)' : 'var(--danger)')
    : 'var(--border)';

  return (
    <div style={{ padding: 14, borderRadius: 'var(--radius-sm)', border: `1px solid ${color}`, marginBottom: 18 }}>
      <div className="flex items-center justify-between" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 600 }}>Revision antes de facturar</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Verifica cedula, ubicacion en codigos, actividad, llave y codigos CAByS.
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={revisar} disabled={rev === 'cargando'}>
          {rev === 'cargando' ? 'Revisando...' : 'Revisar ahora'}
        </button>
      </div>

      {abierto && rev && rev !== 'cargando' && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, color, marginBottom: 8 }}>
            {rev.listo_para_produccion
              ? 'Todo listo para facturar en produccion'
              : `${rev.graves} problema(s) que impiden facturar`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rev.hallazgos.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                <span style={{ color: h.grave ? 'var(--danger)' : '#d97706', fontWeight: 700 }}>
                  {h.grave ? '✗' : '!'}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{h.campo}</div>
                  <div>{h.mensaje}</div>
                  <div className="muted">{h.como_resolver}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Configuracion() {
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState('comercio');
  const [empresa, setEmpresa] = useState(null);
  const [hac, setHac] = useState(null);
  const fileRef = useRef();

  // credenciales nuevas (no se precargan por seguridad)
  const [cred, setCred] = useState({ usuario_api: '', password_api: '', pin_llave: '' });
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    api.get('/empresa').then((r) => setEmpresa(r.data.data || {}));
    api.get('/empresa/hacienda').then((r) => {
      setHac(r.data.data || {});
      if (r.data.data) setCred((c) => ({ ...c, usuario_api: r.data.data.usuario_api || '' }));
    }).catch(() => setHac({}));
  }, []);

  const guardarEmpresa = async () => {
    try { await api.put('/empresa', empresa); toast.success('Datos del comercio guardados'); }
    catch (err) { toast.error('Error al guardar'); }
  };

  const guardarHacienda = async () => {
    try {
      await api.put('/empresa/hacienda', {
        activa: hac.activa, ambiente: hac.ambiente,
        sucursal: hac.sucursal, terminal: hac.terminal,
        usuario_api: cred.usuario_api,
        ...(cred.password_api ? { password_api: cred.password_api } : {}),
        ...(cred.pin_llave ? { pin_llave: cred.pin_llave } : {}),
      });
      toast.success('Configuracion de Hacienda guardada');
      setCred((c) => ({ ...c, password_api: '', pin_llave: '' }));
      api.get('/empresa/hacienda').then((r) => setHac(r.data.data || {}));
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const subirLlave = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('llave', file);
      const { data } = await api.post('/empresa/hacienda/llave', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Llave .p12 guardada de forma cifrada');
      api.get('/empresa/hacienda').then((r) => setHac(r.data.data || {}));
    } catch (err) { toast.error('No se pudo subir la llave'); }
    finally { setSubiendo(false); }
  };

  if (!empresa || !hac) return <Loading />;
  const set = (campo, valor) => setEmpresa({ ...empresa, [campo]: valor });

  return (
    <div>
      <PageHeader title="Configuracion" subtitle="Personaliza tu sistema. Nada esta fijo en codigo." />

      <div className="flex gap-sm" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.id} className={`btn ${tab === t.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ---- Datos del comercio ---- */}
      {tab === 'comercio' && (
        <div className="card fade-up" style={{ padding: 24, maxWidth: 760 }}>
          <h3 style={{ marginBottom: 18 }}>Informacion del negocio</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field"><label>Nombre comercial</label><input className="input" value={empresa.nombre_comercial || ''} onChange={(e) => set('nombre_comercial', e.target.value)} /></div>
            <div className="field"><label>Razon social</label><input className="input" value={empresa.razon_social || ''} onChange={(e) => set('razon_social', e.target.value)} /></div>
            <div className="field">
              <label>Tipo de identificacion</label>
              <select className="select" value={empresa.tipo_identificacion || '02'} onChange={(e) => set('tipo_identificacion', e.target.value)}>
                {TIPOS_ID.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="field"><label>Cedula / identificacion</label><input className="input" value={empresa.identificacion || ''} onChange={(e) => set('identificacion', e.target.value)} /></div>
            <div className="field"><label>Telefono</label><input className="input" value={empresa.telefono || ''} onChange={(e) => set('telefono', e.target.value)} /></div>
            <div className="field"><label>Correo</label><input className="input" type="email" value={empresa.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
            <div className="field"><label>Provincia</label><input className="input" value={empresa.provincia || ''} onChange={(e) => set('provincia', e.target.value)} /></div>
            <div className="field"><label>Canton</label><input className="input" value={empresa.canton || ''} onChange={(e) => set('canton', e.target.value)} /></div>
            <div className="field"><label>Distrito</label><input className="input" value={empresa.distrito || ''} onChange={(e) => set('distrito', e.target.value)} /></div>
            <div className="field"><label>Barrio</label><input className="input" value={empresa.barrio || ''} onChange={(e) => set('barrio', e.target.value)} /></div>
            <div className="field" style={{ gridColumn: '1/-1' }}><label>Direccion exacta</label><input className="input" value={empresa.direccion_exacta || ''} onChange={(e) => set('direccion_exacta', e.target.value)} /></div>
            <div className="field"><label>Codigo de actividad economica</label><input className="input" value={empresa.codigo_actividad || ''} onChange={(e) => set('codigo_actividad', e.target.value)} /></div>
            <div className="field"><label>Moneda</label><input className="input" value={empresa.moneda || 'CRC'} disabled /></div>
            <div className="field" style={{ gridColumn: '1/-1' }}><label>Mensaje al pie de la factura</label><input className="input" value={empresa.mensaje_factura || ''} onChange={(e) => set('mensaje_factura', e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={guardarEmpresa}><Icon.check /> Guardar cambios</button></div>
        </div>
      )}

      {/* ---- Apariencia ---- */}
      {tab === 'apariencia' && (
        <div className="card fade-up" style={{ padding: 24, maxWidth: 560 }}>
          <h3 style={{ marginBottom: 6 }}>Tema de la aplicacion</h3>
          <p className="muted" style={{ marginBottom: 18 }}>Elige como se ve el sistema. Se guarda en este dispositivo.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {['light', 'dark'].map((t) => (
              <button key={t} onClick={() => setTheme(t)}
                className="card" style={{ padding: 18, cursor: 'pointer', textAlign: 'left', border: theme === t ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  {t === 'light' ? <Icon.sun /> : <Icon.moon />}
                  <strong>{t === 'light' ? 'Claro' : 'Oscuro'}</strong>
                  {theme === t && <span className="badge badge-accent" style={{ marginLeft: 'auto' }}>Activo</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ flex: 1, height: 30, borderRadius: 6, background: t === 'light' ? '#faf8ff' : '#0d0a18', border: '1px solid var(--border)' }} />
                  <span style={{ width: 30, height: 30, borderRadius: 6, background: t === 'light' ? '#7c3aed' : '#a855f7' }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- Factura electronica ---- */}
      {tab === 'hacienda' && (
        <div className="card fade-up" style={{ padding: 24, maxWidth: 720 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
            <h3>Factura Electronica (Hacienda v4.4)</h3>
            <label className="flex items-center gap-sm" style={{ cursor: 'pointer' }}>
              <span style={{ fontWeight: 600 }}>{hac.activa ? 'Activada' : 'Desactivada'}</span>
              <input type="checkbox" checked={!!hac.activa} onChange={(e) => setHac({ ...hac, activa: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
            </label>
          </div>
          <p className="muted" style={{ marginBottom: 20 }}>
            Cada negocio sube aqui su propia llave y credenciales. Todo se guarda cifrado. Mientras este desactivada, las ventas se registran como comprobantes internos.
          </p>

          <RevisionFiscal />


          {/* Ambiente */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 6 }}>
            <div className="field">
              <label>Ambiente</label>
              <select className="select" value={hac.ambiente || 'sandbox'} onChange={(e) => setHac({ ...hac, ambiente: e.target.value })}>
                <option value="simulacion">Simulacion local (sin Hacienda)</option>
                <option value="sandbox">Pruebas (Sandbox de Hacienda)</option>
                <option value="prod">Produccion</option>
              </select>
            </div>
            <div className="field"><label>Usuario de API (Hacienda)</label><input className="input" value={cred.usuario_api} onChange={(e) => setCred({ ...cred, usuario_api: e.target.value })} placeholder="cpf-01-..." /></div>
            <div className="field"><label>Contrasena de API {hac.tiene_password && <span className="badge badge-success" style={{ marginLeft: 6 }}>Guardada</span>}</label><input className="input" type="password" value={cred.password_api} onChange={(e) => setCred({ ...cred, password_api: e.target.value })} placeholder={hac.tiene_password ? '•••••• (sin cambios)' : 'Contrasena'} /></div>
            <div className="field"><label>Sucursal</label><input className="input" value={hac.sucursal || '001'} onChange={(e) => setHac({ ...hac, sucursal: e.target.value })} /></div>
            <div className="field"><label>Terminal</label><input className="input" value={hac.terminal || '00001'} onChange={(e) => setHac({ ...hac, terminal: e.target.value })} /></div>
          </div>

          {/* Llave .p12 */}
          <div style={{ padding: 16, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', marginBottom: 16 }}>
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="flex items-center gap-sm">
                <Icon.key />
                <div>
                  <div style={{ fontWeight: 600 }}>Llave criptografica (.p12)</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {hac.tiene_llave ? `Cargada: ${hac.llave_nombre || 'llave.p12'}` : 'Aun no has subido tu llave'}
                  </div>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".p12" style={{ display: 'none' }} onChange={subirLlave} />
              <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={subiendo}>
                {subiendo ? <span className="spinner" /> : <><Icon.key width={16} height={16} /> {hac.tiene_llave ? 'Reemplazar' : 'Subir'} llave</>}
              </button>
            </div>
            <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
              <label>PIN de la llave {hac.tiene_pin && <span className="badge badge-success" style={{ marginLeft: 6 }}>Guardado</span>}</label>
              <input className="input" type="password" value={cred.pin_llave} onChange={(e) => setCred({ ...cred, pin_llave: e.target.value })} placeholder={hac.tiene_pin ? '•••• (sin cambios)' : 'PIN del certificado'} />
            </div>
          </div>

          <div className="flex items-center gap-sm" style={{ padding: 12, borderRadius: 8, background: 'var(--warning-bg)', marginBottom: 16 }}>
            <Icon.alert width={18} height={18} />
            <span style={{ fontSize: 13, color: 'var(--warning)' }}>
              La firma digital del XML se completa en el servidor. Revisa la seccion "Firma digital" del README para activar el envio real a Hacienda.
            </span>
          </div>

          <button className="btn btn-primary" onClick={guardarHacienda}><Icon.check /> Guardar configuracion</button>
        </div>
      )}
    </div>
  );
}
