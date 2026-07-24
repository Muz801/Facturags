import fs from 'fs';
import path from 'path';
import forge from 'node-forge';

// ============================================================
//  Genera una llave criptografica .p12 AUTOFIRMADA de prueba.
//
//  Sirve para ejercitar la firma XAdES-EPES y el circuito completo
//  contra el simulador, mientras Hacienda entrega la llave real.
//
//  ⚠️  NO sirve para producción ni para el sandbox de Hacienda:
//      alla solo se acepta el certificado emitido por el MICITT.
//
//  Uso:  npm run llave:prueba
// ============================================================

const PIN = process.argv[2] || '1234';
const salida = path.resolve(process.argv[3] || 'llave-prueba.p12');

console.log('Generando par de llaves RSA de 2048 bits...');
const llaves = forge.pki.rsa.generateKeyPair(2048);

const cert = forge.pki.createCertificate();
cert.publicKey = llaves.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

const sujeto = [
  { name: 'commonName', value: 'LLAVE DE PRUEBA - NO VALIDA ANTE HACIENDA' },
  { name: 'organizationName', value: 'FacturaPOS Desarrollo' },
  { name: 'countryName', value: 'CR' },
];
cert.setSubject(sujeto);
cert.setIssuer(sujeto);
cert.sign(llaves.privateKey, forge.md.sha256.create());

const p12 = forge.pkcs12.toPkcs12Asn1(llaves.privateKey, [cert], PIN, {
  algorithm: '3des',
});
fs.writeFileSync(salida, Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));

console.log(`\n✅ Llave de prueba creada: ${salida}`);
console.log(`   PIN: ${PIN}`);
console.log('\n   Subila en Configuracion > Factura Electronica y usa el');
console.log('   ambiente "simulacion" para probar el circuito completo.');
console.log('\n   ⚠️  Es autofirmada: Hacienda la rechaza. Para produccion');
console.log('       hay que usar la llave que entrega el MICITT.');
