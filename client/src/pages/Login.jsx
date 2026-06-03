import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Logo from '../components/Logo.jsx';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo iniciar sesion');
    } finally {
      setCargando(false);
    }
  };

  const usarDemo = (correo, clave) => { setEmail(correo); setPassword(clave); };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr', placeItems: 'center', padding: 20 }}>
      <div className="card fade-up" style={{
        width: '100%', maxWidth: 920, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)',
        overflow: 'hidden', background: 'var(--surface-solid)', boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {/* Panel de marca */}
          <div style={{
            padding: '48px 40px', position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(150deg, var(--purple-700), var(--purple-900))',
            color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 420,
          }}>
            <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(168,85,247,0.5), transparent 70%)', top: -80, right: -80 }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ filter: 'brightness(0) invert(1)' }}><Logo size={40} /></div>
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ fontSize: 30, lineHeight: 1.15, marginBottom: 14 }}>
                Punto de venta y facturacion electronica para Costa Rica
              </h2>
              <p style={{ opacity: 0.85, fontSize: 15 }}>
                Inventario, ventas, gastos y comprobantes electronicos v4.4 en colones, en un solo lugar.
              </p>
            </div>
          </div>

          {/* Formulario */}
          <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 style={{ fontSize: 24, marginBottom: 6 }}>Bienvenido de vuelta</h1>
            <p className="muted" style={{ marginBottom: 26 }}>Ingresa tus credenciales para continuar</p>

            <form onSubmit={submit}>
              <div className="field">
                <label>Correo electronico</label>
                <input className="input" type="email" value={email} required
                  onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.cr" />
              </div>
              <div className="field">
                <label>Contrasena</label>
                <input className="input" type="password" value={password} required
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button className="btn btn-primary btn-block" disabled={cargando} style={{ marginTop: 8 }}>
                {cargando ? <span className="spinner" /> : 'Iniciar sesion'}
              </button>
            </form>

            <div style={{ marginTop: 26, padding: 16, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cuentas de demostracion
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => usarDemo('admin@laesquina.cr', 'admin123')}>
                  Admin · admin@laesquina.cr
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => usarDemo('cajero@laesquina.cr', 'cajero123')}>
                  Cajero · cajero@laesquina.cr
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
