import { useEffect, useState } from "react";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { fechaHora } from "../utils/format.js";
import { PageHeader, Modal, Loading, EmptyState } from "../components/UI.jsx";
import { Icon } from "../components/Icons.jsx";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "cajero", label: "Cajero" },
];

export default function Empleados() {
  const { esAdmin } = useAuth();
  const toast = useToast();
  const [lista, setLista] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});

  const cargar = () => {
    api.get("/usuarios").then((r) => setLista(r.data.data));
  };
  useEffect(cargar, []);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({
      nombre: "",
      email: "",
      password: "",
      rol: "cajero",
      telefono: "",
    });
    setModal(true);
  };
  const abrirEditar = (u) => {
    setEditando(u.id);
    setForm({ ...u, password: "" });
    setModal(true);
  };

  const guardar = async () => {
    if (!form.nombre || !form.email) {
      toast.error("Nombre y correo requeridos");
      return;
    }
    if (!editando && !form.password) {
      toast.error("La contrasena es requerida");
      return;
    }
    try {
      if (editando) await api.put(`/usuarios/${editando}`, form);
      else await api.post("/usuarios", form);
      toast.success("Empleado guardado");
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || "Error");
    }
  };

  const desactivar = async (u) => {
    if (!confirm(`Desactivar a ${u.nombre}?`)) return;
    try {
      await api.delete(`/usuarios/${u.id}`);
      toast.success("Empleado desactivado");
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || "Error");
    }
  };

  const colorRol = {
    admin: "var(--danger)",
    gerente: "var(--accent)",
    cajero: "var(--info)",
  };

  return (
    <div>
      <PageHeader title="Empleados" subtitle="Usuarios con acceso al sistema">
        {esAdmin && (
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Icon.plus /> Nuevo empleado
          </button>
        )}
      </PageHeader>

      {!lista ? (
        <Loading />
      ) : lista.length === 0 ? (
        <EmptyState icon="empleados" titulo="Sin empleados" />
      ) : (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Ultimo acceso</th>
                <th className="text-center">Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                  <td className="muted">{u.email}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: "var(--accent-soft)",
                        color: colorRol[u.rol],
                        textTransform: "capitalize",
                      }}
                    >
                      {u.rol}
                    </span>
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    {u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : "Nunca"}
                  </td>
                  <td className="text-center">
                    {u.activo ? (
                      <span className="badge badge-success">Activo</span>
                    ) : (
                      <span className="badge badge-danger">Inactivo</span>
                    )}
                  </td>
                  <td>
                    {esAdmin && (
                      <div
                        className="flex gap-sm"
                        style={{ justifyContent: "flex-end" }}
                      >
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => abrirEditar(u)}
                        >
                          <Icon.edit width={15} height={15} />
                        </button>
                        {u.activo && (
                          <button
                            className="btn btn-sm"
                            style={{ color: "var(--danger)" }}
                            onClick={() => desactivar(u)}
                          >
                            <Icon.trash width={15} height={15} />
                          </button>
                        )}
                      </div>
                    )}
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
        title={editando ? "Editar empleado" : "Nuevo empleado"}
      >
        <div className="field">
          <label>Nombre *</label>
          <input
            className="input"
            value={form.nombre || ""}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Correo *</label>
          <input
            className="input"
            type="email"
            value={form.email || ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div className="field">
            <label>Rol</label>
            <select
              className="select"
              value={form.rol || "cajero"}
              onChange={(e) => setForm({ ...form, rol: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Telefono</label>
            <input
              className="input"
              value={form.telefono || ""}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>
            {editando
              ? "Nueva contrasena (dejar vacio para no cambiar)"
              : "Contrasena *"}
          </label>
          <input
            className="input"
            type="password"
            value={form.password || ""}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
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
