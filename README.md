# FacturaPOS

**Punto de venta + facturación electrónica para Costa Rica (v4.4).**
Sistema multi-negocio listo para revender: cada comercio configura sus propios datos, su marca, su correo y su llave de Hacienda **desde la aplicación**, sin tocar el código.

Construido con **React (Create React App)** (frontend) y **Express + MySQL** (backend). Moneda en **colones (CRC)**. Diseño limpio con acento morado, tema claro/oscuro y menú lateral colapsable. Mobile friendly.

---

## Contenido

1. [Qué incluye](#qué-incluye)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Requisitos](#requisitos)
4. [Instalación local paso a paso](#instalación-local-paso-a-paso)
5. [Credenciales de demostración](#credenciales-de-demostración)
6. [Despliegue (Netlify + Render)](#despliegue-netlify--render)
7. [Cómo configurar la Factura Electrónica](#cómo-configurar-la-factura-electrónica)
8. [Firma digital (paso pendiente para envío real)](#firma-digital)
9. [Vender el sistema a varios negocios](#vender-el-sistema-a-varios-negocios)
10. [Preguntas frecuentes](#preguntas-frecuentes)

---

## Qué incluye

- **Punto de venta (POS):** catálogo por categorías, carrito, cobro, cálculo de IVA, vuelto, y comprobante con QR.
- **Inventario:** productos y categorías editables, crear categorías nuevas al vuelo, ajuste de stock con historial de movimientos, alertas de stock bajo.
- **Ventas:** historial con filtros, detalle, anulación con devolución de stock, reimpresión.
- **Compras:** entrada de mercadería que sube el stock automáticamente, con IVA soportado por línea y emisión de **factura electrónica de compra** cuando el proveedor no factura.
- **Gastos:** registro de egresos por categoría, con su respaldo electrónico y el IVA acreditable.
- **Comprobantes recibidos:** buzón de las facturas de proveedores, con aceptación / aceptación parcial / rechazo ante Hacienda (**Mensaje Receptor**) y control del plazo de 8 días hábiles.
- **Clientes y proveedores:** CRUD completo.
- **Empleados:** usuarios con roles (admin / gerente / cajero).
- **Dashboard:** ventas del día y del mes, utilidad, gráficos, top de productos, métodos de pago, stock bajo.
- **Descargables:** reportes en Excel/CSV (ventas, inventario, gastos, compras, resumen de IVA, **libro de compras** e **IVA del período**).
- **Comprobantes por correo:** envío del ticket con QR y enlace.
- **Factura electrónica v4.4:** clave, consecutivo, XML, **firma XAdES-EPES** y transmisión a Hacienda; configuración por negocio desde Ajustes; ambientes simulación / sandbox / producción.
- **Configuración total en la app:** datos del comercio, apariencia (tema) y credenciales de Hacienda. Nada está fijo en el código.

---

## Estructura del proyecto

```
facturapos/
├── client/                 # Frontend React (Create React App)
│   ├── public/             # index.html, favicon, _redirects
│   └── src/
│       ├── api/            # cliente axios
│       ├── components/     # Layout, Logo, Modal, comprobante, etc.
│       ├── context/        # Auth, Theme, Toast
│       ├── pages/          # Dashboard, POS, Inventario, ...
│       ├── styles/         # sistema de diseño (global.css)
│       └── utils/          # formato de colones y fechas
├── server/                 # Backend Express + MySQL
│   ├── scripts/            # migrate.js (crea tablas) y seed.js (datos demo)
│   └── src/
│       ├── config/         # configuración y pool MySQL
│       ├── controllers/    # lógica de cada recurso
│       ├── db/             # schema.sql
│       ├── middleware/     # auth (JWT) y manejo de errores
│       ├── routes/         # definición de la API
│       ├── services/       # factura electrónica, correo, reportes
│       └── utils/          # cifrado AES, helpers HTTP
├── netlify.toml            # deploy del frontend
├── render.yaml             # deploy del backend
└── README.md
```

---

## Requisitos

- **Node.js 18 o superior**
- **MySQL 8** (local con XAMPP/MySQL, o un servicio en la nube como Railway, PlanetScale o Aiven)

---

## Instalación local paso a paso

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
```

Edita `server/.env` con los datos de tu MySQL. Lo mínimo:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_clave
DB_NAME=facturapos
JWT_SECRET=una_clave_larga_y_aleatoria
ENCRYPTION_KEY=clave_de_32_caracteres_exactos!!
```

> `ENCRYPTION_KEY` **debe tener exactamente 32 caracteres**. Se usa para cifrar las credenciales de Hacienda.

Crea las tablas y carga los datos de demostración:

```bash
npm run migrate   # crea la base de datos y las tablas
npm run seed      # carga datos de ejemplo (un minisúper)
```

Arranca el servidor:

```bash
npm run dev       # http://localhost:4000
```

### 2. Frontend

En otra terminal:

```bash
cd client
npm install
cp .env.example .env   # opcional en local; el proxy ya apunta al backend
npm start              # http://localhost:3000
```

Abre **http://localhost:3000** e inicia sesión con las credenciales de demo.

> En desarrollo, el `proxy` definido en `client/package.json` reenvía automáticamente las llamadas `/api` al backend en el puerto 4000. No necesitas configurar nada más.

---

## Credenciales de demostración

Tras correr `npm run seed`:

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Administrador | `admin@laesquina.cr` | `admin123` |
| Gerente | `gerente@laesquina.cr` | `admin123` |
| Cajero | `cajero@laesquina.cr` | `cajero123` |

Los datos incluyen 20 productos, 6 categorías, clientes, proveedores, ~30 días de ventas, compras y gastos, para que las demos en vivo se vean completas.

---

## Despliegue (Netlify + Render)

### Base de datos

Crea una base MySQL en un proveedor (Railway, PlanetScale, Aiven, etc.) y guarda host, usuario, contraseña y nombre. Si exige SSL, usarás `DB_SSL=true`.

### Backend en Render

1. Sube el repositorio a GitHub.
2. En Render: **New > Blueprint** y selecciona el repo (usa el `render.yaml` incluido), o **New > Web Service** con *Root Directory* = `server`, *Build* = `npm install`, *Start* = `npm start`.
3. En **Environment**, define las variables del `.env` (DB_*, `JWT_SECRET`, `ENCRYPTION_KEY`, `CLIENT_URL`, SMTP_* y los endpoints de Hacienda, que ya vienen en el `render.yaml`).
4. Una vez desplegado, corre la migración y el seed una sola vez. Puedes hacerlo desde la **Shell** de Render:
   ```bash
   npm run migrate
   npm run seed
   ```
5. Anota la URL pública, por ejemplo `https://facturapos-api.onrender.com`.

### Frontend en Netlify

1. En Netlify: **Add new site > Import** y selecciona el repo.
2. *Base directory* = `client`, *Build command* = `npm run build`, *Publish directory* = `client/build` (el `netlify.toml` ya lo define).
3. En **Site settings > Environment variables**, agrega:
   ```
   REACT_APP_API_URL = https://facturapos-api.onrender.com/api
   ```
4. Vuelve a desplegar. Copia la URL de Netlify y ponla como `CLIENT_URL` en Render (para que el CORS funcione).

---

## Cómo configurar la Factura Electrónica

Todo se hace **dentro de la app**, en **Configuración → Factura Electrónica**. Cada negocio usa su propia llave; las credenciales se guardan cifradas en la base de datos.

### Paso 1 — Obtener la llave y las credenciales en Hacienda (ATV)

1. Ingresa al portal **ATV** de Hacienda con la cédula del contribuyente.
2. Descarga el **certificado de firma digital (.p12)** y anota su **PIN**.
3. Genera el **usuario y contraseña de API** (las credenciales del receptor de comprobantes). Son distintas de las del portal.

### Paso 2 — Completar el código CAByS y la actividad económica

- En **Configuración → Datos del comercio**, llena el **código de actividad económica**.
- En cada producto (**Inventario**), agrega su **código CAByS** (13 dígitos). Es obligatorio en la v4.4.

### Paso 3 — Cargar todo en la app

En **Configuración → Factura Electronica**:

1. Elige el **ambiente**: *Pruebas (Sandbox)* para validar, o *Producción* para emitir de verdad.
2. Ingresa el **usuario y la contraseña de API**.
3. Sube la **llave .p12** y escribe su **PIN**.
4. Ajusta **sucursal** y **terminal** si aplica (por defecto `001` / `00001`).
5. Activa el interruptor **"Factura electrónica"** y guarda.

A partir de ahí, en el POS puedes elegir el tipo de comprobante: *Ticket* (interno), *Tiquete electrónico* o *Factura electrónica*.

> Mientras la factura electrónica esté **desactivada**, las ventas se registran como **comprobantes internos** (tickets con QR), que es justo lo que se envía por correo al cliente.

---

## Firma digital

La firma **XAdES-EPES** está implementada en `server/src/services/firma.js` (basada en `xadesjs` + `node-forge`). Firma con la llave `.p12` del contribuyente y aplica el perfil que exige Hacienda:

- Enveloped, RSASSA-PKCS1-v1_5 con SHA-256
- `SignerRole` declarado como `ObligadoTributario`
- `SignaturePolicyIdentifier` apuntando a la resolución vigente

La política de firma es **configurable por variable de entorno** (`HACIENDA_POLITICA_FIRMA_URL`, `_ALG`, `_DIGEST`), porque Hacienda valida el digest contra el documento oficial y ese valor cambia cuando publican una resolución nueva. **Confirmá los valores contra el anexo técnico v4.4 vigente antes de pasar a producción.**

Todo lo que se transmite pasa por el mismo camino (`server/src/services/haciendaEnvio.js`): firmar → pedir token → `POST /recepcion`. Aplica a facturas, tiquetes, notas, facturas de compra y mensajes receptor.

---

## Compras y gastos ante Hacienda

Reportar lo que se **compra** es tan obligatorio como reportar lo que se vende, y son dos mecanismos distintos:

### 1. Buzón de comprobantes recibidos (Mensaje Receptor)

Cuando un proveedor inscrito factura, manda su XML. El negocio debe responderle a Hacienda con un **Mensaje Receptor**: aceptación (1), aceptación parcial (2) o rechazo (3).

- Los XML entran por **Recibidos → Subir XML o ZIP** (uno, varios, o un ZIP completo).
- El sistema valida que el comprobante venga a nombre del negocio, que no esté repetido y que traiga firma.
- El plazo es hasta el **8vo día hábil del mes siguiente** al de la emisión. La columna *Plazo* lo muestra en semáforo y las filas vencidas salen en rojo.
- **Si el plazo vence, ese IVA ya no se puede acreditar** y no hay forma de recuperarlo.

### 2. Factura Electrónica de Compra (tipo 08)

Cuando el proveedor **no** está obligado a facturar electrónicamente (régimen simplificado, no inscritos, no domiciliados, no contribuyentes), el comprobante lo emite el propio negocio.

En **Compras → Nueva compra** se elige la *condición del proveedor*. Si no es "inscrito", al guardar se genera la factura de compra, se firma y se transmite. Ojo con los papeles invertidos: el emisor es el negocio y el receptor es el proveedor.

### Reportes que salen de esto

- **Libro de compras** — cada comprobante recibido con su respuesta, consecutivo receptor y estado en Hacienda.
- **IVA del período** — IVA repercutido contra IVA soportado, contando **solo** lo efectivamente aceptado. Incluye una línea de aviso con el IVA que se está dejando sin acreditar.

---

## Probar sin credenciales de Hacienda

Para ejercitar el circuito completo antes de tener la llave real y el usuario de sandbox:

```bash
cd server
npm run llave:prueba      # genera un .p12 autofirmado (PIN 1234)
npm run simulador         # levanta un Hacienda falso en el puerto 4100
```

Luego, en **Configuración → Factura Electrónica**: subí la llave de prueba, poné el PIN, y elegí el ambiente **"Simulación local"**.

Con eso el sistema firma de verdad, transmite de verdad y consulta el estado de verdad — solo que contra el simulador. Sirve para validar la aplicación de punta a punta.

> ⚠️ La llave de prueba es autofirmada: **Hacienda la rechaza**. Para producción hay que usar la que entrega el MICITT. El simulador **no valida contra los esquemas XSD oficiales**: sirve para probar la aplicación, no para certificar el XML.

### Revisión antes de producción

**Configuración → Factura Electrónica → Revisar ahora** corre una lista de verificación y dice qué falta: cédula, código de actividad, ubicación en **códigos numéricos** (el error más común: Hacienda quiere `1`/`01`/`01`, no "San José"/"Central"/"Carmen"), vigencia del certificado, y productos sin CAByS válido.

---

## Vender el sistema a varios negocios

El sistema es **multi-negocio por instalación**: cada cliente tuyo recibe su propia copia (su backend + su base de datos + su frontend). Para dar de alta un negocio nuevo:

1. Despliega una instancia (Render + Netlify + una base MySQL nueva), o corre otra copia local.
2. Corre `npm run migrate`. Si quieres datos de ejemplo para entrenar al cliente, corre también `npm run seed`; si no, omítelo para empezar en blanco.
3. Entra como administrador y, en **Configuración**, cambia los **datos del comercio**, sube el **logo** (campo `logo_url`), elige el **tema** y, cuando el negocio esté listo, carga la **llave de Hacienda**.
4. Crea los **usuarios** reales del negocio en **Empleados** y borra o cambia las cuentas de demo.

Como nada del comercio está quemado en el código, la misma base sirve para cualquier negocio sin recompilar.

---

## Preguntas frecuentes

**¿Puedo usarlo sin factura electrónica?**
Sí. Déjala desactivada y trabaja con tickets internos + envío por correo con QR. Actívala cuando el negocio la necesite.

**¿Los reportes abren en Excel?**
Sí, son CSV con codificación UTF-8 (con BOM) que Excel abre directamente con tildes y el símbolo de colón correctos.

**¿Dónde se guardan el PIN y la contraseña de Hacienda?**
Cifrados con AES-256-GCM en la base de datos. Nunca se devuelven al frontend; solo se indica si ya están configurados.

**¿El correo necesita configuración?**
Para envíos reales, define `SMTP_*` en el `.env`. Si lo dejas vacío, el sistema simula el envío y lo registra en consola (útil para demos).

**¿Funciona en celular?**
Sí. El menú lateral se colapsa y la interfaz se adapta a pantallas pequeñas.

---

Hecho para comercios de Costa Rica. 🇨🇷
