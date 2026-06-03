import dotenv from 'dotenv';
dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'facturapos',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Clave AES-256. Debe ser de 32 bytes. Si no llega bien, se rellena/recorta.
  encryptionKey: (process.env.ENCRYPTION_KEY || 'dev_key_32_chars_padded_000000000')
    .padEnd(32, '0')
    .slice(0, 32),

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'FacturaPOS <no-reply@facturapos.local>',
  },

  hacienda: {
    sandbox: {
      tokenUrl: process.env.HACIENDA_SANDBOX_TOKEN_URL,
      recepcionUrl: process.env.HACIENDA_SANDBOX_RECEPCION_URL,
      clientId: process.env.HACIENDA_SANDBOX_CLIENT_ID || 'api-stag',
    },
    prod: {
      tokenUrl: process.env.HACIENDA_PROD_TOKEN_URL,
      recepcionUrl: process.env.HACIENDA_PROD_RECEPCION_URL,
      clientId: process.env.HACIENDA_PROD_CLIENT_ID || 'api-prod',
    },
  },
};

export default config;
