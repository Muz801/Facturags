import nodemailer from 'nodemailer';
import config from '../config/index.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.smtp.host) return null; // modo demo: no hay SMTP configurado
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.password },
  });
  return transporter;
}

// Envia el comprobante (ticket normal, NO la factura electronica) por correo.
// Incluye un QR opcional como adjunto inline y un enlace al comprobante.
export async function enviarComprobante({ to, asunto, html, qrDataUrl, pdfBuffer }) {
  const t = getTransporter();
  const attachments = [];
  if (qrDataUrl) {
    attachments.push({
      filename: 'qr.png',
      content: qrDataUrl.split('base64,')[1],
      encoding: 'base64',
      cid: 'qrcomprobante',
    });
  }
  if (pdfBuffer) {
    attachments.push({ filename: 'comprobante.pdf', content: pdfBuffer });
  }

  // Modo demo: si no hay SMTP, no falla; registra en consola y devuelve simulado.
  if (!t) {
    console.log('\n========= [CORREO SIMULADO - MODO DEMO] =========');
    console.log('Para:', to);
    console.log('Asunto:', asunto);
    console.log('(Configura SMTP en .env para envios reales)');
    console.log('=================================================\n');
    return { simulado: true, to, asunto };
  }

  const info = await t.sendMail({
    from: config.smtp.from,
    to,
    subject: asunto,
    html,
    attachments,
  });
  return { simulado: false, messageId: info.messageId };
}
