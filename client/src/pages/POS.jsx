import { useEffect, useState, useMemo } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { crc, METODOS_PAGO, TIPOS_COMPROBANTE } from '../utils/format.js';
import { Modal } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import ComprobanteView from '../components/ComprobanteView.jsx';

export default function POS() {
  const toast = useToast();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [catActiva, setCatActiva] = useState(null);
  const [carrito, setCarrito] = useState([]);

  const [clienteId, setClienteId] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [tipoComp, setTipoComp] = useState('ticket');
  const [cobrando, setCobrando] = useState(false);
  const [ventaFinal, setVentaFinal] = useState(null);
  const [efectivoRecibido, setEfectivoRecibido] = useState('');

  const cargar = () => {
    api.get('/productos').then((r) => setProductos(r.data.data));
    api.get('/categorias').then((r) => setCategorias(r.data.data));
    api.get('/clientes').then((r) => setClientes(r.data.data));
  };
  useEffect(cargar, []);

  const filtrados = useMemo(() => productos.filter((p) => {
    const okCat = !catActiva || p.categoria_id === catActiva;
    const okBusq = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.sku || '').toLowerCase().includes(busqueda.toLowerCase());
    return okCat && okBusq;
  }), [productos, catActiva, busqueda]);

  const agregar = (prod) => {
    if (prod.stock <= 0) { toast.error('Sin existencias de ' + prod.nombre); return; }
    setCarrito((c) => {
      const existe = c.find((i) => i.id === prod.id);
      if (existe) {
        if (existe.cantidad >= prod.stock) { toast.error('No hay mas stock'); return c; }
        return c.map((i) => i.id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...c, { id: prod.id, nombre: prod.nombre, precio_venta: Number(prod.precio_venta), tarifa_iva: Number(prod.tarifa_iva), cantidad: 1, stock: prod.stock }];
    });
  };

  const cambiarCantidad = (id, delta) => {
    setCarrito((c) => c.map((i) => {
      if (i.id !== id) return i;
      const nueva = i.cantidad + delta;
      if (nueva <= 0) return null;
      if (nueva > i.stock) { toast.error('Stock maximo alcanzado'); return i; }
      return { ...i, cantidad: nueva };
    }).filter(Boolean));
  };

  const quitar = (id) => setCarrito((c) => c.filter((i) => i.id !== id));

  const totales = useMemo(() => {
    let subtotal = 0, impuesto = 0;
    carrito.forEach((i) => {
      const base = i.cantidad * i.precio_venta;
      subtotal += base;
      impuesto += base * (i.tarifa_iva / 100);
    });
    return { subtotal, impuesto, total: subtotal + impuesto };
  }, [carrito]);

  const cambio = efectivoRecibido ? Number(efectivoRecibido) - totales.total : 0;

  const cobrar = async () => {
    if (carrito.length === 0) return;
    if ((tipoComp === 'factura_electronica') && !clienteId) {
      toast.error('La factura electronica requiere seleccionar un cliente');
      return;
    }
    setCobrando(true);
    try {
      const { data } = await api.post('/ventas', {
        cliente_id: clienteId || null,
        items: carrito.map((i) => ({ producto_id: i.id, cantidad: i.cantidad })),
        metodo_pago: metodoPago,
        tipo_comprobante: tipoComp,
      });
      const venta = data.data;
      // Trae el detalle completo para el comprobante
      const full = await api.get(`/ventas/${venta.id}`);
      setVentaFinal(full.data.data);
      if (venta.fe?.estado === 'generado') {
        toast.success(`Comprobante electronico generado (${venta.fe.ambiente})`);
      } else if (venta.fe?.estado === 'inactiva') {
        toast.info('Venta registrada. La factura electronica esta desactivada.');
      } else {
        toast.success('Venta completada');
      }
      setCarrito([]); setClienteId(''); setEfectivoRecibido('');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al procesar la venta');
    } finally {
      setCobrando(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 380px)', gap: 18, alignItems: 'start' }}>
      {/* Catalogo */}
      <div>
        <div className="card" style={{ padding: 14, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Icon.search width={18} height={18} /></span>
            <input className="input" style={{ paddingLeft: 38 }} placeholder="Buscar producto o SKU..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
          <button className={`btn btn-sm ${!catActiva ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCatActiva(null)}>Todas</button>
          {categorias.map((c) => (
            <button key={c.id} className={`btn btn-sm ${catActiva === c.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCatActiva(c.id)}>{c.nombre}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {filtrados.map((p) => (
            <button key={p.id} onClick={() => agregar(p)} className="card fade-up"
              style={{ padding: 14, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--glass-border)', background: 'var(--surface)', opacity: p.stock <= 0 ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.categoria_color || 'var(--accent)' }} />
                <span className="badge" style={{ background: p.stock <= p.stock_minimo ? 'var(--warning-bg)' : 'var(--accent-soft)', color: p.stock <= p.stock_minimo ? 'var(--warning)' : 'var(--accent)', fontSize: 11 }}>{Number(p.stock)}</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, marginBottom: 6, minHeight: 36 }}>{p.nombre}</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{crc(p.precio_venta)}</div>
            </button>
          ))}
          {filtrados.length === 0 && <p className="muted" style={{ gridColumn: '1/-1', padding: 30, textAlign: 'center' }}>No se encontraron productos</p>}
        </div>
      </div>

      {/* Carrito */}
      <div className="card" style={{ padding: 0, position: 'sticky', top: 88, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 110px)' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-sm"><Icon.cart /><h3 style={{ fontSize: 17 }}>Venta actual</h3></div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {carrito.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: 30 }}>Toca un producto para agregarlo</p>
          ) : carrito.map((i) => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{i.nombre}</div>
                <div className="muted" style={{ fontSize: 13 }}>{crc(i.precio_venta)} c/u</div>
              </div>
              <div className="flex items-center gap-sm">
                <button className="btn btn-ghost btn-sm" style={{ padding: '4px 9px' }} onClick={() => cambiarCantidad(i.id, -1)}>−</button>
                <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 600 }}>{i.cantidad}</span>
                <button className="btn btn-ghost btn-sm" style={{ padding: '4px 9px' }} onClick={() => cambiarCantidad(i.id, 1)}>+</button>
              </div>
              <button className="btn btn-sm" style={{ padding: 5, color: 'var(--danger)' }} onClick={() => quitar(i.id)}><Icon.trash width={15} height={15} /></button>
            </div>
          ))}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div className="flex justify-between" style={{ fontSize: 14, marginBottom: 4 }}><span className="muted">Subtotal</span><span className="mono">{crc(totales.subtotal)}</span></div>
          <div className="flex justify-between" style={{ fontSize: 14, marginBottom: 10 }}><span className="muted">IVA</span><span className="mono">{crc(totales.impuesto)}</span></div>
          <div className="flex justify-between" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}><span>Total</span><span className="mono" style={{ color: 'var(--accent)' }}>{crc(totales.total)}</span></div>

          <select className="select" style={{ marginBottom: 8 }} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Cliente: Contado / sin identificar</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <select className="select" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              {METODOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select className="select" value={tipoComp} onChange={(e) => setTipoComp(e.target.value)}>
              {TIPOS_COMPROBANTE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {metodoPago === 'efectivo' && carrito.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <input className="input" type="number" placeholder="Efectivo recibido"
                value={efectivoRecibido} onChange={(e) => setEfectivoRecibido(e.target.value)} />
              {efectivoRecibido && cambio >= 0 && (
                <div className="flex justify-between" style={{ marginTop: 6, fontSize: 14 }}>
                  <span className="muted">Cambio</span><span className="mono" style={{ fontWeight: 600 }}>{crc(cambio)}</span>
                </div>
              )}
            </div>
          )}
          <button className="btn btn-primary btn-block" disabled={carrito.length === 0 || cobrando} onClick={cobrar} style={{ padding: 14, fontSize: 15 }}>
            {cobrando ? <span className="spinner" /> : `Cobrar ${crc(totales.total)}`}
          </button>
        </div>
      </div>

      {/* Comprobante final */}
      <Modal open={!!ventaFinal} onClose={() => setVentaFinal(null)} title="Comprobante" width={420}>
        {ventaFinal && <ComprobanteView venta={ventaFinal} onClose={() => setVentaFinal(null)} />}
      </Modal>
    </div>
  );
}
