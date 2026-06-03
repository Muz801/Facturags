import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import Logo from './Logo.jsx';
import { Icon } from './Icons.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', exact: true },
  { to: '/pos', label: 'Punto de Venta', icon: 'pos' },
  { to: '/ventas', label: 'Ventas', icon: 'ventas' },
  { to: '/inventario', label: 'Inventario', icon: 'inventario' },
  { to: '/clientes', label: 'Clientes', icon: 'clientes' },
  { to: '/proveedores', label: 'Proveedores', icon: 'proveedores' },
  { to: '/compras', label: 'Compras', icon: 'compras' },
  { to: '/gastos', label: 'Gastos', icon: 'gastos' },
  { to: '/empleados', label: 'Empleados', icon: 'empleados', soloGerente: true },
  { to: '/reportes', label: 'Descargables', icon: 'reportes' },
  { to: '/configuracion', label: 'Configuracion', icon: 'config', soloGerente: true },
];

export default function Layout({ children }) {
  const { user, logout, esGerente } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  // colapsado = solo iconos (desktop). abierto = overlay (mobile).
  const [colapsado, setColapsado] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [esMobile, setEsMobile] = useState(window.innerWidth < 900);

  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth < 900;
      setEsMobile(m);
      if (!m) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const items = NAV.filter((n) => !n.soloGerente || esGerente);
  const anchoSidebar = colapsado && !esMobile ? 76 : 248;
  const sidebarVisible = esMobile ? mobileOpen : true;

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Overlay mobile */}
      {esMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <aside style={{
        position: esMobile ? 'fixed' : 'sticky', top: 0, left: 0, height: '100vh',
        width: esMobile ? 248 : anchoSidebar, zIndex: 50,
        transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 240ms ease, width 200ms ease',
        background: 'var(--sidebar-bg)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)', borderRight: '1px solid var(--glass-border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: colapsado && !esMobile ? '20px 0' : '20px 18px', display: 'flex', justifyContent: colapsado && !esMobile ? 'center' : 'flex-start' }}>
          <Logo size={32} withText={!colapsado || esMobile} />
        </div>

        <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          {items.map((item) => {
            const IconCmp = Icon[item.icon];
            return (
              <NavLink key={item.to} to={item.to} end={item.exact}
                onClick={() => esMobile && setMobileOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: colapsado && !esMobile ? '11px 0' : '11px 14px',
                  justifyContent: colapsado && !esMobile ? 'center' : 'flex-start',
                  borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: 14,
                  color: isActive ? 'var(--accent)' : 'var(--text-soft)',
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  transition: 'var(--transition)',
                })}
                title={colapsado ? item.label : ''}
              >
                <IconCmp />
                {(!colapsado || esMobile) && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Usuario / logout */}
        <div style={{ padding: 12, borderTop: '1px solid var(--glass-border)' }}>
          <button onClick={handleLogout} className="btn btn-outline btn-block"
            style={{ justifyContent: colapsado && !esMobile ? 'center' : 'flex-start' }}
            title="Cerrar sesion">
            <Icon.logout />
            {(!colapsado || esMobile) && <span>Cerrar sesion</span>}
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '14px 22px',
          background: 'var(--surface)', backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid var(--glass-border)',
        }}>
          <button className="btn btn-ghost btn-sm"
            onClick={() => esMobile ? setMobileOpen((o) => !o) : setColapsado((c) => !c)}
            title="Esconder menu" aria-label="Alternar menu">
            <Icon.menu />
          </button>

          <div className="flex items-center gap-sm">
            <button className="btn btn-ghost btn-sm" onClick={toggle} title="Cambiar tema" aria-label="Cambiar tema">
              {theme === 'light' ? <Icon.moon /> : <Icon.sun />}
            </button>
            <div className="flex items-center gap-sm" style={{ paddingLeft: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontFamily: 'var(--font-display)',
              }}>
                {(user?.nombre || '?').charAt(0).toUpperCase()}
              </div>
              {!esMobile && (
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.nombre}</div>
                  <div className="muted" style={{ fontSize: 12, textTransform: 'capitalize' }}>{user?.rol}</div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: esMobile ? '16px' : '26px 30px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
