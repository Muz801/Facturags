import crypto from 'crypto';
import config from '../config/index.js';

// Cifrado simetrico AES-256-GCM para proteger los secretos de Hacienda
// (PIN de la llave .p12, contrasena de API, y la llave en si).
// La clave viene de ENCRYPTION_KEY (32 caracteres exactos).

const ALGO = 'aes-256-gcm';
const KEY = Buffer.from(config.encryptionKey, 'utf8');

export function encrypt(plainText) {
  if (plainText == null || plainText === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainText), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // formato: iv:tag:datos (todo en base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(payload) {
  if (!payload) return '';
  try {
    const [ivB64, tagB64, dataB64] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    return '';
  }
}
