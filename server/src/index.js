import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import { testConnection } from './config/db.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: config.clientUrl === '*' ? true : config.clientUrl.split(','), credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Healthcheck (Render lo usa para saber si el server esta vivo)
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'FacturaPOS API', env: config.env }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await testConnection();
    console.log('✅ Conectado a MySQL');
  } catch (err) {
    console.error('⚠️  No se pudo conectar a MySQL:', err.message);
    console.error('   El servidor arrancara igual, pero revisa tu .env (DB_*).');
  }
  app.listen(config.port, () => {
    console.log(`🚀 FacturaPOS API en http://localhost:${config.port}`);
    console.log(`   Entorno: ${config.env}`);
  });
}

start();

export default app;
