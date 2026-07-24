import * as xmldom from '@xmldom/xmldom';
import xpath from 'xpath';
import * as xadesjs from 'xadesjs';
import { setNodeDependencies, Stringify } from 'xml-core';
import { Crypto } from '@peculiar/webcrypto';
import forge from 'node-forge';
import config from '../config/index.js';

// ============================================================
//  Firma digital XAdES-EPES para comprobantes electronicos CR
//
//  Hacienda exige que TODO comprobante (factura, tiquete, nota,
//  factura de compra y mensaje receptor) venga firmado con la
//  llave criptografica .p12 del obligado tributario.
//
//  Perfil que exige Hacienda:
//    - XAdES-EPES enveloped
//    - RSASSA-PKCS1-v1_5 con SHA-256
//    - SignaturePolicyIdentifier apuntando a la resolucion vigente
//    - SignerRole claimed = ObligadoTributario
// ============================================================

// xml-core necesita que le registremos el DOM de Node explicitamente.
setNodeDependencies({
  XMLSerializer: xmldom.XMLSerializer,
  DOMParser: xmldom.DOMParser,
  DOMImplementation: xmldom.DOMImplementation,
  xpath,
});

const crypto = new Crypto();
xadesjs.Application.setEngine('OpenSSL', crypto);

const ALG = {
  name: 'RSASSA-PKCS1-v1_5',
  hash: 'SHA-256',
  publicExponent: new Uint8Array([1, 0, 1]),
  modulusLength: 2048,
};

// Descompone el .p12 en certificado + llave privada + llave publica (base64 DER)
function abrirP12(p12Base64, pin) {
  let p12;
  try {
    const asn = forge.asn1.fromDer(forge.util.decode64(p12Base64));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn, true, pin);
  } catch {
    throw new Error('No se pudo abrir la llave criptografica: el archivo .p12 o el PIN son incorrectos.');
  }

  const bagsLlave = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ];
  const bagsCert = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  if (!bagsLlave.length || !bagsCert.length) {
    throw new Error('La llave criptografica no contiene certificado o llave privada validos.');
  }

  const llavePrivada = bagsLlave[0].key;
  const cert = bagsCert[0].cert;

  const pemPrivada = forge.pki.privateKeyInfoToPem(
    forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(llavePrivada))
  );
  const pemPublica = forge.pki.publicKeyToPem(
    forge.pki.setRsaPublicKey(llavePrivada.n, llavePrivada.e)
  );

  return {
    cert64: pemADer(forge.pki.certificateToPem(cert)),
    privada64: pemADer(pemPrivada),
    publica64: pemADer(pemPublica),
    expiraEn: cert.validity.notAfter,
    sujeto: cert.subject.attributes.map((a) => `${a.shortName}=${a.value}`).join(', '),
  };
}

const pemADer = (pem) => pem.replace(/-----(BEGIN|END)[\w\s]+-----/g, '').replace(/[\r\n]/g, '');

/**
 * Firma un XML con XAdES-EPES.
 * @param {string} xmlString  XML sin firmar
 * @param {{ p12Base64: string, pin: string }} llave
 * @returns {Promise<string>} XML firmado (string, no base64)
 */
export async function firmarXML(xmlString, { p12Base64, pin }) {
  if (!p12Base64) throw new Error('No hay llave criptografica cargada. Subela en Configuracion > Factura Electronica.');

  const { cert64, privada64, publica64 } = abrirP12(p12Base64, pin);

  const llavePublica = await crypto.subtle.importKey('spki', Buffer.from(publica64, 'base64'), ALG, true, ['verify']);
  const llavePrivada = await crypto.subtle.importKey('pkcs8', Buffer.from(privada64, 'base64'), ALG, false, ['sign']);

  const doc = xadesjs.Parse(xmlString);
  const firmado = new xadesjs.SignedXml();

  const firma = await firmado.Sign(ALG, llavePrivada, doc, {
    keyValue: llavePublica,
    references: [
      {
        id: `Reference-${randomId()}`,
        uri: '',
        hash: 'SHA-256',
        transforms: ['enveloped'],
      },
    ],
    signerRole: { claimed: ['ObligadoTributario'] },
    x509: [cert64],
    signingCertificate: cert64,
    policy: {
      hash: config.hacienda.politicaFirma.algoritmo,
      digestValue: config.hacienda.politicaFirma.digest,
      identifier: {
        qualifier: 'OIDAsURI',
        value: config.hacienda.politicaFirma.url,
      },
    },
  });

  doc.documentElement.appendChild(firma.GetXml());
  return Stringify(doc);
}

/** Firma y devuelve el XML en base64, que es como lo pide el API de Hacienda. */
export async function firmarXMLBase64(xmlString, llave) {
  const firmado = await firmarXML(xmlString, llave);
  return Buffer.from(firmado).toString('base64');
}

/**
 * Verifica que el .p12 y su PIN sirvan, y avisa si el certificado ya vencio.
 * Se usa al subir la llave en Configuracion para dar feedback inmediato.
 */
export function verificarLlave({ p12Base64, pin }) {
  const { expiraEn, sujeto } = abrirP12(p12Base64, pin);
  const diasRestantes = Math.floor((expiraEn - new Date()) / 86400000);
  return {
    valida: diasRestantes > 0,
    vencida: diasRestantes <= 0,
    porVencer: diasRestantes > 0 && diasRestantes <= 30,
    expira_en: expiraEn,
    dias_restantes: diasRestantes,
    sujeto,
  };
}

function randomId() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString('hex');
}
