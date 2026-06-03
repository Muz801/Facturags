import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import api from '../api/client.js';
import { crc, fecha } from '../utils/format.js';
import { PageHeader, Loading } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';

const COLORS = ['#7c3aed', '#a855f7', '#0ea5e9', '#f59e0b', '#10b981'];

function Stat({ icon, label, valor, sub, color = 'var(--accent)' }) {
  const IconCmp = Icon[icon];
  return (
    <div className="card fade-up" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="flex items-center justify-between">
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)',
          color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCmp width={19} height={19} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{valor}</div>
      {sub && <div className="muted" style={{ fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data.data)).catch(() => {});
  }, []);

  if (!data) return <Loading texto="Cargando dashboard..." />;

  const dias = (data.ventas7dias || []).map((d) => ({
    dia: new Date(d.dia).toLocaleDateString('es-CR', { weekday: 'short' }),
    total: Number(d.total),
  }));
  const metodos = (data.porMetodoPago || []).map((m) => ({
    name: m.metodo_pago, value: Number(m.total),
  }));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Resumen de tu negocio en tiempo real" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <Stat icon="ventas" label="Ventas de hoy" valor={crc(data.ventasHoy.total)} sub={`${data.ventasHoy.cantidad} transacciones`} />
        <Stat icon="trending" label="Ventas del mes" valor={crc(data.ventasMes.total)} sub={`${data.ventasMes.cantidad} ventas`} />
        <Stat icon="gastos" label="Gastos del mes" valor={crc(data.gastosMes.total)} color="var(--danger)" />
        <Stat icon="box" label="Utilidad del mes" valor={crc(data.utilidadMes)}
          sub={data.utilidadMes >= 0 ? 'Positiva' : 'Negativa'}
          color={data.utilidadMes >= 0 ? 'var(--success)' : 'var(--danger)'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Ventas ultimos 7 dias */}
        <div className="card" style={{ padding: 20, gridColumn: 'span 1' }}>
          <h3 style={{ fontSize: 16, marginBottom: 18 }}>Ventas de los ultimos 7 dias</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dias} margin={{ left: -10, right: 6 }}>
              <defs>
                <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="dia" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false}
                tickFormatter={(v) => '₡' + (v / 1000) + 'k'} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }}
                formatter={(v) => [crc(v), 'Ventas']} />
              <Area type="monotone" dataKey="total" stroke="#7c3aed" strokeWidth={2.5} fill="url(#gv)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Metodos de pago */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 18 }}>Ventas por metodo de pago</h3>
          {metodos.length === 0 ? <p className="muted">Sin datos este mes</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={metodos} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {metodos.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }}
                  formatter={(v) => crc(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginTop: 10 }}>
            {metodos.map((m, i) => (
              <span key={i} className="badge" style={{ background: 'var(--accent-soft)', textTransform: 'capitalize' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                {m.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Top productos */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 18 }}>Productos mas vendidos (mes)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={(data.topProductos || []).map((p) => ({ nombre: p.nombre.split(' ').slice(0, 2).join(' '), unidades: Number(p.unidades) }))} margin={{ left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="nombre" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }} />
              <Bar dataKey="unidades" fill="#a855f7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stock bajo */}
        <div className="card" style={{ padding: 20 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 16 }}>Alertas de stock bajo</h3>
            {data.stockBajo.length > 0 && <span className="badge badge-warning"><Icon.alert width={13} height={13} />{data.stockBajo.length}</span>}
          </div>
          {data.stockBajo.length === 0 ? (
            <p className="muted">Todo el inventario esta en niveles saludables.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.stockBajo.map((p) => (
                <div key={p.id} className="flex items-center justify-between" style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--warning-bg)' }}>
                  <span style={{ fontSize: 14 }}>{p.nombre}</span>
                  <span className="badge badge-warning">{p.stock} / min {p.stock_minimo}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <div><div className="muted" style={{ fontSize: 12 }}>Productos</div><strong>{data.totales.productos}</strong></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Clientes</div><strong>{data.totales.clientes}</strong></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Valor inventario</div><strong>{crc(data.totales.valor_inventario)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}
