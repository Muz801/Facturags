import { useEffect, useState } from "react";
import api from "../api/client.js";
import { useToast } from "../context/ToastContext.jsx";
import { crc, fecha, hoy, METODOS_PAGO } from "../utils/format.js";
import { PageHeader, Modal, Loading, EmptyState } from "../components/UI.jsx";
import { Icon } from "../components/Icons.jsx";

const CATEGORIAS_GASTO = [
  "Alquiler",
  "Servicios",
  "Planilla",
  "Mantenimiento",
  "Insumos",
  "Transporte",
  "Impuestos",
  "General",
];

export default function Gastos() {
  const toast = useToast();
  const [gastos, setGastos] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});

  const cargar = () => {
    api.get("/gastos").then((r) => setGastos(r.data.data));
  };
  useEffect(cargar, []);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({
      descripcion: "",
      categoria: "General",
      monto: "",
      fecha: hoy(),
      metodo_pago: "efectivo",
    });
    setModal(true);
  };
  const abrirEditar = (g) => {
    setEditando(g.id);
    setForm({ ...g, fecha: g.fecha?.slice(0, 10) });
    setModal(true);
  };

  const guardar = async () => {
    if (!form.descripcion || !form.monto) {
      toast.error("Descripcion y monto requeridos");
      return;
    }
    try {
      if (editando) await api.put(`/gastos/${editando}`, form);
      else await api.post("/gastos", form);
      toast.success("Gasto guardado");
      setModal(false);
      cargar();
    } catch (err) {
      toast.error("Error al guardar");
    }
  };

  const eliminar = async (g) => {
    if (!confirm("Eliminar este gasto?")) return;
    await api.delete(`/gastos/${g.id}`);
    toast.success("Eliminado");
    cargar();
  };

  const totalMes = (gastos || []).reduce((s, g) => s + Number(g.monto), 0);

  return (
    <div>
      <PageHeader title="Gastos" subtitle="Registro de egresos del negocio">
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Icon.plus /> Nuevo gasto
        </button>
      </PageHeader>

      {gastos && gastos.length > 0 && (
        <div
          className="card"
          style={{
            padding: 18,
            marginBottom: 16,
            display: "inline-flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span className="muted" style={{ fontSize: 13 }}>
            Total registrado
          </span>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--danger)",
            }}
          >
            {crc(totalMes)}
          </span>
        </div>
      )}

      {!gastos ? (
        <Loading />
      ) : gastos.length === 0 ? (
        <EmptyState
          icon="gastos"
          titulo="Sin gastos"
          texto="Registra tu primer gasto."
        />
      ) : (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripcion</th>
                <th>Categoria</th>
                <th>Pago</th>
                <th>Respaldo</th>
                <th className="text-right">IVA acred.</th>
                <th className="text-right">Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <tr key={g.id}>
                  <td className="muted">{fecha(g.fecha)}</td>
                  <td style={{ fontWeight: 600 }}>{g.descripcion}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                      }}
                    >
                      {g.categoria}
                    </span>
                  </td>
                  <td className="muted" style={{ textTransform: "capitalize" }}>
                    {g.metodo_pago}
                  </td>
                  {/* Un gasto sin comprobante electronico no da derecho a
                      credito de IVA: hay que verlo de un vistazo. */}
                  <td>
                    {g.comprobante_recibido_id ? (
                      <span
                        style={{ color: "var(--success, #16a34a)", fontSize: 13, fontWeight: 600 }}
                        title={g.clave_comprobante}
                      >
                        Comprobante electronico
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: 13 }}>
                        Sin comprobante
                      </span>
                    )}
                  </td>
                  <td className="text-right mono">
                    {Number(g.iva_monto) > 0 ? crc(g.iva_monto) : <span className="muted">—</span>}
                  </td>
                  <td className="text-right mono" style={{ fontWeight: 600 }}>
                    {crc(g.monto)}
                  </td>
                  <td>
                    <div
                      className="flex gap-sm"
                      style={{ justifyContent: "flex-end" }}
                    >
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => abrirEditar(g)}
                      >
                        <Icon.edit width={15} height={15} />
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ color: "var(--danger)" }}
                        onClick={() => eliminar(g)}
                      >
                        <Icon.trash width={15} height={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editando ? "Editar gasto" : "Nuevo gasto"}
      >
        <div className="field">
          <label>Descripcion *</label>
          <input
            className="input"
            value={form.descripcion || ""}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div className="field">
            <label>Categoria</label>
            <select
              className="select"
              value={form.categoria || "General"}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Monto (₡) *</label>
            <input
              className="input"
              type="number"
              value={form.monto || ""}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Fecha</label>
            <input
              className="input"
              type="date"
              value={form.fecha || ""}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Metodo de pago</label>
            <select
              className="select"
              value={form.metodo_pago || "efectivo"}
              onChange={(e) =>
                setForm({ ...form, metodo_pago: e.target.value })
              }
            >
              {METODOS_PAGO.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div
          className="flex gap-sm"
          style={{ justifyContent: "flex-end", marginTop: 8 }}
        >
          <button className="btn btn-outline" onClick={() => setModal(false)}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={guardar}>
            Guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}
