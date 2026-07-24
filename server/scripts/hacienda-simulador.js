import express from 'express';

// ============================================================
//  Simulador del API de Hacienda
//
//  Imita el comportamiento del ambiente de pruebas de Hacienda
//  (token + recepcion + consulta) para poder correr el circuito
//  completo -firmar, transmitir, consultar- SIN credenciales
//  reales y sin mandarle nada a Hacienda.
//
//  Uso:
//    1. npm run simulador
//    2. En Configuracion > Factura Electronica, ambiente "simulacion"
//
//  IMPORTANTE: esto NO valida contra los esquemas oficiales de
//  Hacienda. Sirve para probar la aplicacion, no para certificar.
// ============================================================

const app = express();
app.use(express.json({ limit: '15mb' }));

const PUERTO = process.env.SIM_PORT || 4100;

// Lo recibido queda en memoria para poder consultarlo despues
const recibidos = new Map();

// Un comprobante de cada N se rechaza, para poder probar ese camino
const RECHAZAR_CADA = Number(process.env.SIM_RECHAZAR_CADA || 0);
let contador = 0;

app.post('/token', (req, res) => {
  res.json({
    access_token: 'token-de-simulacion',
    expires_in: 300,
    refresh_token: 'refresh-de-simulacion',
    token_type: 'bearer',
  });
});

app.post('/recepcion', (req, res) => {
  const { clave, consecutivoReceptor, comprobanteXml, emisor } = req.body || {};

  if (!clave || !/^\d{50}$/.test(clave)) {
    return res.status(400).json({ 'ind-estado': 'error', mensaje: 'La clave debe tener 50 digitos.' });
  }
  if (!comprobanteXml) {
    return res.status(400).json({ 'ind-estado': 'error', mensaje: 'Falta comprobanteXml.' });
  }

  const xml = Buffer.from(comprobanteXml, 'base64').toString('utf8');
  // Hacienda rechaza de una lo que venga sin firmar
  if (!/<(\w+:)?Signature[\s>]/.test(xml)) {
    return res.status(400).json({ 'ind-estado': 'error', mensaje: 'El comprobante no viene firmado.' });
  }

  contador++;
  const rechazar = RECHAZAR_CADA > 0 && contador % RECHAZAR_CADA === 0;
  const id = consecutivoReceptor ? `${clave}-${consecutivoReceptor}` : clave;

  recibidos.set(id, {
    clave,
    consecutivoReceptor,
    emisor,
    estado: rechazar ? 'rechazado' : 'aceptado',
    xml,
    recibidoEn: new Date().toISOString(),
  });

  const tipo = raizDe(xml);
  console.log(`  ← ${tipo}  clave ${clave.slice(-10)}  ${consecutivoReceptor ? `MR ${consecutivoReceptor}` : ''} → ${rechazar ? 'RECHAZADO' : 'aceptado'}`);

  // Hacienda responde 202: recibido, la validacion es en diferido
  res.status(202).location(`/recepcion/${id}`).send();
});

app.get('/recepcion/:id', (req, res) => {
  const doc = recibidos.get(req.params.id);
  if (!doc) return res.status(404).json({ mensaje: 'Comprobante no encontrado en el simulador.' });

  const respuestaXml = `<?xml version="1.0" encoding="UTF-8"?>
<MensajeHacienda xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeHacienda">
  <Clave>${doc.clave}</Clave>
  <Mensaje>${doc.estado === 'aceptado' ? '1' : '3'}</Mensaje>
  <DetalleMensaje>${doc.estado === 'aceptado' ? 'Comprobante aceptado (simulacion)' : 'Comprobante rechazado (simulacion)'}</DetalleMensaje>
</MensajeHacienda>`;

  res.json({
    clave: doc.clave,
    fecha: doc.recibidoEn,
    'ind-estado': doc.estado,
    'respuesta-xml': Buffer.from(respuestaXml).toString('base64'),
  });
});

const raizDe = (xml) => (xml.match(/<([A-Za-z]+)\s+xmlns/) || [, 'Documento'])[1];

app.listen(PUERTO, () => {
  console.log(`🧪 Simulador de Hacienda escuchando en http://localhost:${PUERTO}`);
  console.log('   Ambiente a seleccionar en la app: "simulacion"');
  if (RECHAZAR_CADA > 0) console.log(`   Rechazando 1 de cada ${RECHAZAR_CADA} comprobantes`);
});
