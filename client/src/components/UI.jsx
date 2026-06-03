import { Icon } from './Icons.jsx';

export function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(13,10,24,0.55)',
        backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card fade-up"
        style={{ width: '100%', maxWidth: width, background: 'var(--surface-solid)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center justify-between" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 18 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar"><Icon.close /></button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 26, letterSpacing: '-0.02em' }}>{title}</h1>
        {subtitle && <p className="muted" style={{ marginTop: 4 }}>{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>{children}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'box', titulo, texto }) {
  const IconCmp = Icon[icon] || Icon.box;
  return (
    <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
        <IconCmp width={42} height={42} />
      </div>
      <h3 style={{ marginBottom: 6 }}>{titulo}</h3>
      {texto && <p className="muted">{texto}</p>}
    </div>
  );
}

export function Loading({ texto = 'Cargando...' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 60, color: 'var(--text-muted)' }}>
      <div className="spinner" />
      <span>{texto}</span>
    </div>
  );
}
