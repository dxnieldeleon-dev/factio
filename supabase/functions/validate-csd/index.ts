// Edge Function: validate-csd
// Recibe archivos .cer (base64) y .key (base64) más la contraseña de la llave privada,
// intenta desencriptarla y verifica que el par coincida. NUNCA guarda la contraseña.
import { createPrivateKey, createPublicKey, X509Certificate } from "node:crypto";
import { Buffer } from "node:buffer";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ valid: false, reason: "Método no permitido." }, 405);

  let payload: { cer_base64?: string; key_base64?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ valid: false, reason: "Cuerpo de la petición inválido." }, 400);
  }

  const { cer_base64, key_base64, password } = payload ?? {};
  if (!cer_base64) return json({ valid: false, field: "cer", reason: "Falta el archivo .cer." }, 400);
  if (!key_base64) return json({ valid: false, field: "key", reason: "Falta el archivo .key." }, 400);
  if (!password) return json({ valid: false, field: "password", reason: "Escribe la contraseña de la llave privada." }, 400);

  let cerDer: Buffer;
  let keyDer: Buffer;
  try {
    cerDer = Buffer.from(cer_base64, "base64");
    keyDer = Buffer.from(key_base64, "base64");
  } catch {
    return json({ valid: false, reason: "No pudimos leer los archivos enviados." }, 400);
  }

  // 1) Parse .cer (X.509 DER)
  let cert: X509Certificate;
  try {
    cert = new X509Certificate(cerDer);
  } catch {
    return json({
      valid: false,
      field: "cer",
      reason: "El archivo .cer no es un certificado X.509 válido. Verifica que sea el archivo correcto del SAT.",
    });
  }

  const notBefore = new Date(cert.validFrom);
  const notAfter = new Date(cert.validTo);
  const now = new Date();
  if (now < notBefore) {
    return json({
      valid: false,
      field: "cer",
      reason: `El certificado aún no es vigente (inicia el ${notBefore.toISOString().slice(0, 10)}).`,
    });
  }
  if (now > notAfter) {
    return json({
      valid: false,
      field: "cer",
      reason: `El certificado venció el ${notAfter.toISOString().slice(0, 10)}. Solicita uno nuevo al SAT.`,
    });
  }

  // 2) Desencriptar llave privada (PKCS#8 DER encriptada)
  let privKey;
  try {
    privKey = createPrivateKey({ key: keyDer, format: "der", type: "pkcs8", passphrase: password });
  } catch (err) {
    const msg = String((err as Error)?.message ?? err).toLowerCase();
    if (/bad decrypt|passphrase|password|decryption|unable to load|wrong tag/i.test(msg)) {
      return json({
        valid: false,
        field: "password",
        reason: "La contraseña de la llave privada es incorrecta.",
      });
    }
    return json({
      valid: false,
      field: "key",
      reason: "No pudimos leer la llave privada (.key). Verifica que sea el archivo correcto del SAT en formato PKCS#8.",
    });
  }

  // 3) Verificar que la llave corresponde al certificado
  try {
    const certPub = cert.publicKey.export({ format: "der", type: "spki" }) as Buffer;
    const keyPub = createPublicKey(privKey).export({ format: "der", type: "spki" }) as Buffer;
    if (!certPub.equals(keyPub)) {
      return json({
        valid: false,
        field: "key",
        reason: "La llave privada no corresponde al certificado. Asegúrate de que .cer y .key sean del mismo CSD.",
      });
    }
  } catch {
    return json({
      valid: false,
      field: "key",
      reason: "No pudimos comparar la llave privada con el certificado.",
    });
  }

  // 4) OK — devolver metadata pública (nunca la contraseña)
  return json({
    valid: true,
    serial_number: cert.serialNumber,
    subject: cert.subject,
    issuer: cert.issuer,
    valid_from: notBefore.toISOString(),
    valid_to: notAfter.toISOString(),
  });
});
