// Logo de FacturaPOS: recibo con un rayo morado degradado.
// Se adapta al tema y puede mostrarse solo el icono o con el texto.

export default function Logo({ size = 36, withText = true, mono = false }) {
  const gradFrom = '#7c3aed';
  const gradTo = '#a855f7';
  const gid = 'fp-bolt-' + Math.random().toString(36).slice(2, 7);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor={gradFrom} />
            <stop offset="1" stopColor={gradTo} />
          </linearGradient>
        </defs>
        <path
          d="M20 12h24a2 2 0 0 1 2 2v38l-5-3-5 3-5-3-5 3-5-3-5 3V14a2 2 0 0 1 2-2z"
          fill={mono ? 'currentColor' : 'var(--surface-solid)'}
          stroke="var(--glass-border)"
          strokeWidth="1"
        />
        <rect x="24" y="20" width="16" height="2.5" rx="1.25" fill="var(--purple-300)" opacity="0.8" />
        <rect x="24" y="26" width="12" height="2.5" rx="1.25" fill="var(--purple-300)" opacity="0.5" />
        <path
          d="M37 28l-12 14h7l-2 10 12-15h-7l2-9z"
          fill={mono ? 'currentColor' : `url(#${gid})`}
          stroke="var(--surface-solid)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {withText && (
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size * 0.5,
          letterSpacing: '-0.02em', color: 'var(--text)',
        }}>
          Factura<span style={{ color: 'var(--accent)' }}>POS</span>
        </span>
      )}
    </div>
  );
}
