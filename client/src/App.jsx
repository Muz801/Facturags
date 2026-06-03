import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import POS from './pages/POS.jsx';
import Ventas from './pages/Ventas.jsx';
import Inventario from './pages/Inventario.jsx';
import Clientes from './pages/Clientes.jsx';
import Proveedores from './pages/Proveedores.jsx';
import Compras from './pages/Compras.jsx';
import Gastos from './pages/Gastos.jsx';
import Empleados from './pages/Empleados.jsx';
import Reportes from './pages/Reportes.jsx';
import Configuracion from './pages/Configuracion.jsx';
import Comprobante from './pages/Comprobante.jsx';

function Privada({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/comprobante/:id" element={<Comprobante />} />
      <Route
        path="/*"
        element={
          <Privada>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/ventas" element={<Ventas />} />
                <Route path="/inventario" element={<Inventario />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/proveedores" element={<Proveedores />} />
                <Route path="/compras" element={<Compras />} />
                <Route path="/gastos" element={<Gastos />} />
                <Route path="/empleados" element={<Empleados />} />
                <Route path="/reportes" element={<Reportes />} />
                <Route path="/configuracion" element={<Configuracion />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </Privada>
        }
      />
    </Routes>
  );
}
