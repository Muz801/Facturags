// ============================================================
//  Revision de datos antes de facturar de verdad
//
//  Hacienda rechaza el comprobante completo por un campo mal puesto,
//  y el rechazo llega en diferido. Sale mas barato revisar antes:
//  esta lista es la que hay que tener en verde para pasar a produccion.
// ============================================================

import { query } from '../config/db.js';
import { verificarLlave } from './firma.js';
import { llaveDeConfig } from './haciendaEnvio.js';

const problema = (grave, campo, mensaje, comoResolver) => ({ grave, campo, mensaje, como_resolver: comoResolver });

export async function revisarDatosFiscales() {
  const empresa = (await query('SELECT * FROM empresa ORDER BY id LIMIT 1'))[0];
  const cfg = (await query('SELECT * FROM config_hacienda ORDER BY id LIMIT 1'))[0];
  const hallazgos = [];

  // ---- Datos del negocio ----
  if (!empresa?.identificacion || !/^\d{9,12}$/.test(String(empresa.identificacion).replace(/\D/g, ''))) {
    hallazgos.push(problema(true, 'Cedula del negocio', 'La cedula esta vacia o no tiene el formato correcto.',
      'Configuracion > Datos del negocio. Solo numeros, sin guiones.'));
  }
  if (!empresa?.codigo_actividad || !/^\d{6}$/.test(empresa.codigo_actividad)) {
    hallazgos.push(problema(true, 'Actividad economica', 'Falta el codigo de actividad economica de 6 digitos.',
      'Es el que aparece en su perfil de contribuyente. Ej: 471101 para venta al detalle.'));
  }
  if (!empresa?.razon_social) {
    hallazgos.push(problema(true, 'Razon social', 'Falta la razon social registrada ante Hacienda.',
      'Configuracion > Datos del negocio.'));
  }
  if (!empresa?.email) {
    hallazgos.push(problema(true, 'Correo del negocio', 'Falta el correo: es obligatorio en el XML del emisor.',
      'Configuracion > Datos del negocio.'));
  }

  // La ubicacion en el XML va en CODIGOS numericos, no en nombres.
  // Este es el error mas comun al pasar a produccion.
  if (!/^\d$/.test(String(empresa?.provincia || ''))) {
    hallazgos.push(problema(true, 'Provincia', `La provincia debe ser el codigo numerico (1 al 7), no el nombre. Ahora dice "${empresa?.provincia || ''}".`,
      'San Jose=1, Alajuela=2, Cartago=3, Heredia=4, Guanacaste=5, Puntarenas=6, Limon=7.'));
  }
  if (!/^\d{2}$/.test(String(empresa?.canton || ''))) {
    hallazgos.push(problema(true, 'Canton', `El canton debe ser el codigo de 2 digitos, no el nombre. Ahora dice "${empresa?.canton || ''}".`,
      'Ver el catalogo de ubicaciones de Hacienda. Ej: Central de San Jose = 01.'));
  }
  if (!/^\d{2}$/.test(String(empresa?.distrito || ''))) {
    hallazgos.push(problema(true, 'Distrito', `El distrito debe ser el codigo de 2 digitos, no el nombre. Ahora dice "${empresa?.distrito || ''}".`,
      'Ver el catalogo de ubicaciones de Hacienda. Ej: Carmen = 01.'));
  }

  // ---- Configuracion de Hacienda ----
  if (!cfg) {
    hallazgos.push(problema(true, 'Configuracion', 'No hay configuracion de factura electronica.', 'Configuracion > Factura Electronica.'));
  } else {
    if (!cfg.usuario_api || !cfg.password_api_enc) {
      hallazgos.push(problema(true, 'Credenciales del API', 'Faltan el usuario y la clave del API de Hacienda.',
        'Se obtienen en ATV / TRIBU-CR, seccion de comprobantes electronicos.'));
    }
    if (!cfg.llave_p12_base64) {
      hallazgos.push(problema(true, 'Llave criptografica', 'No hay llave .p12 cargada.',
        'Es la que entrega el MICITT con la firma digital. Se sube en Configuracion.'));
    } else {
      try {
        const estado = verificarLlave(llaveDeConfig(cfg));
        if (estado.vencida) {
          hallazgos.push(problema(true, 'Llave criptografica', 'El certificado de la llave esta vencido.', 'Hay que renovarlo con el MICITT.'));
        } else if (estado.porVencer) {
          hallazgos.push(problema(false, 'Llave criptografica', `El certificado vence en ${estado.dias_restantes} dias.`, 'Conviene renovarlo antes de que caduque.'));
        }
        if (/PRUEBA|NO VALIDA/i.test(estado.sujeto || '')) {
          hallazgos.push(problema(true, 'Llave criptografica', 'La llave cargada es la de PRUEBA autofirmada.',
            'Sirve para el simulador. Para produccion hay que subir la llave real del MICITT.'));
        }
      } catch (err) {
        hallazgos.push(problema(true, 'Llave criptografica', err.message, 'Revise el archivo .p12 y su PIN.'));
      }
    }
    if (cfg.ambiente === 'simulacion') {
      hallazgos.push(problema(false, 'Ambiente', 'Esta en modo simulacion: no se le envia nada a Hacienda.',
        'Cambie a sandbox o produccion cuando tenga las credenciales.'));
    }
  }

  // ---- Productos ----
  const [sinCabys] = await query(
    `SELECT COUNT(*) AS n FROM productos WHERE activo = 1 AND (codigo_cabys IS NULL OR LENGTH(codigo_cabys) <> 13)`
  );
  if (sinCabys.n > 0) {
    hallazgos.push(problema(true, 'Codigos CAByS', `${sinCabys.n} producto(s) activo(s) sin codigo CAByS valido de 13 digitos.`,
      'Inventario > editar producto. El catalogo esta en el sitio del BCCR.'));
  }

  // ---- Comprobantes recibidos con el plazo encima ----
  const [pendientes] = await query(
    `SELECT COUNT(*) AS n FROM comprobantes_recibidos WHERE estado = 'pendiente' AND fecha_limite < CURDATE()`
  );
  if (pendientes.n > 0) {
    hallazgos.push(problema(false, 'Comprobantes recibidos', `${pendientes.n} comprobante(s) con el plazo vencido sin responder.`,
      'Ese IVA ya no se puede acreditar. Revise el buzon de Recibidos.'));
  }

  const graves = hallazgos.filter((h) => h.grave);
  return {
    listo_para_produccion: graves.length === 0,
    graves: graves.length,
    advertencias: hallazgos.length - graves.length,
    hallazgos,
  };
}
