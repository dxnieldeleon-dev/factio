// Edge Function: validate-csd
// Validates CSD files stored in private Storage and registers them with Facturama.
//
// Uses node-forge (pure JS) instead of node:crypto to parse the certificate
// and decrypt the private key: many real SAT CSDs use legacy PKCS#8
// encryption algorithms (e.g. RC2-40-CBC, 3DES) that Deno's native crypto
// backend does not implement, while forge implements the ciphers itself.

import { encodeBase64 } from "jsr:@std/encoding/base64";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";
import { uploadCsd, updateCsd } from "../_shared/facturama/client.ts";
import { isFacturamaError, userFacingPacMessage } from "../_shared/facturama/errors.ts";

const allowedOrigin = Deno.env.get("APP_URL") ?? "https://factio.lovable.app";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CsdRequest = {
  company_id?: unknown;
  password?: unknown;
  cer_path?: unknown;
  key_path?: unknown;
};

type CsdValidation =
  | { ok: true; serialNumber: string; validFrom: string; validTo: string }
  | { ok: false; field: "cer" | "key" | "password"; error: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

function userClient(url: string, anonKey: string, token: string) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function isStoragePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !value.includes("..");
}

function uint8ToBinaryString(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return binary;
}

function validateCsd(
  certificate: Uint8Array,
  privateKey: Uint8Array,
  password: string,
): CsdValidation {
  let cert: forge.pki.Certificate;
  try {
    const certAsn1 = forge.asn1.fromDer(forge.util.createBuffer(uint8ToBinaryString(certificate)));
    cert = forge.pki.certificateFromAsn1(certAsn1);
  } catch {
    return { ok: false, field: "cer", error: "El archivo .cer no es un certificado X.509 válido." };
  }

  const validFrom = cert.validity.notBefore;
  const validTo = cert.validity.notAfter;
  const now = new Date();
  if (now < validFrom || now > validTo) {
    return { ok: false, field: "cer", error: "El CSD no se encuentra vigente." };
  }

  let privateKeyInfo: forge.asn1.Asn1 | null;
  try {
    const keyAsn1 = forge.asn1.fromDer(forge.util.createBuffer(uint8ToBinaryString(privateKey)));
    privateKeyInfo = forge.pki.decryptPrivateKeyInfo(keyAsn1, password);
  } catch {
    privateKeyInfo = null;
  }
  if (!privateKeyInfo) {
    return {
      ok: false,
      field: "password",
      error: "La contraseña de la llave privada es incorrecta, o el archivo .key no es válido.",
    };
  }

  let key: forge.pki.rsa.PrivateKey;
  try {
    key = forge.pki.privateKeyFromAsn1(privateKeyInfo) as forge.pki.rsa.PrivateKey;
  } catch {
    return { ok: false, field: "key", error: "No fue posible leer la llave privada .key." };
  }

  const certPublicKey = cert.publicKey as forge.pki.rsa.PublicKey;
  if (certPublicKey.n.toString(16) !== key.n.toString(16)) {
    return { ok: false, field: "key", error: "La llave privada no corresponde al certificado." };
  }

  return {
    ok: true,
    serialNumber: cert.serialNumber,
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "Método no permitido." }, 405);

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return json({ success: false, error: "No autenticado." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = authHeader.slice(7).trim();
  if (!url || !anonKey || !token) {
    return json({ success: false, error: "Configuración de autenticación incompleta." }, 500);
  }

  const auth = createClient(url, anonKey);
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return json({ success: false, error: "Sesión inválida." }, 401);

  let payload: CsdRequest;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: "Cuerpo de la petición inválido." }, 400);
  }
  if (
    typeof payload.company_id !== "string" ||
    !payload.company_id ||
    typeof payload.password !== "string" ||
    !payload.password
  ) {
    return json({ success: false, error: "company_id y password son obligatorios." }, 400);
  }

  const supabase = userClient(url, anonKey, token);
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, rfc, csd_cer_url, csd_key_url")
    .eq("id", payload.company_id)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (companyError || !company)
    return json({ success: false, error: "Empresa no encontrada." }, 404);

  const stagingPrefix = `${authData.user.id}/csd-staging/`;
  const requestedPaths =
    isStoragePath(payload.cer_path) && isStoragePath(payload.key_path)
      ? { cer: payload.cer_path, key: payload.key_path }
      : null;
  if (
    requestedPaths &&
    (!requestedPaths.cer.startsWith(stagingPrefix) || !requestedPaths.key.startsWith(stagingPrefix))
  ) {
    return json({ success: false, error: "Las rutas temporales del CSD no son válidas." }, 400);
  }

  const sourceCerPath = requestedPaths?.cer ?? company.csd_cer_url;
  const sourceKeyPath = requestedPaths?.key ?? company.csd_key_url;
  const removeStagedFiles = async () => {
    if (requestedPaths) {
      await supabase.storage.from("csd-files").remove([requestedPaths.cer, requestedPaths.key]);
    }
  };
  if (!sourceCerPath || !sourceKeyPath) {
    return json(
      { success: false, field: "cer", error: "Debes cargar ambos archivos del CSD." },
      400,
    );
  }

  const [cerDownload, keyDownload] = await Promise.all([
    supabase.storage.from("csd-files").download(sourceCerPath),
    supabase.storage.from("csd-files").download(sourceKeyPath),
  ]);
  if (cerDownload.error || keyDownload.error || !cerDownload.data || !keyDownload.data) {
    return json(
      { success: false, error: "No fue posible leer los archivos privados del CSD." },
      502,
    );
  }

  const [cerBytes, keyBytes] = await Promise.all([
    cerDownload.data.arrayBuffer().then((value) => new Uint8Array(value)),
    keyDownload.data.arrayBuffer().then((value) => new Uint8Array(value)),
  ]);
  const validation = validateCsd(cerBytes, keyBytes, payload.password);
  if (!validation.ok) {
    await supabase
      .from("companies")
      .update({ csd_status: "error", csd_last_error: validation.error })
      .eq("id", company.id);
    await removeStagedFiles();
    return json({ success: false, field: validation.field, error: validation.error });
  }

  const csdPayload = {
    Rfc: company.rfc.trim().toUpperCase(),
    Certificate: encodeBase64(cerBytes),
    PrivateKey: encodeBase64(keyBytes),
    PrivateKeyPassword: payload.password,
  };
  try {
    await uploadCsd(csdPayload);
  } catch (error) {
    // Facturama's create endpoint 400s if the RFC already has a CSD on file
    // (re-validating after a password typo, renewing an expired CSD, etc.
    // all hit this) — fall back to their update endpoint instead of failing.
    const alreadyExists =
      isFacturamaError(error) && error.message.includes("Ya existe un CSD asociado");
    if (alreadyExists) {
      try {
        await updateCsd(csdPayload);
      } catch (updateError) {
        const message = isFacturamaError(updateError)
          ? userFacingPacMessage(
              updateError,
              "Ocurrió un problema técnico al actualizar tu CSD. Intenta de nuevo en unos minutos.",
            )
          : "No fue posible actualizar tu CSD.";
        await supabase
          .from("companies")
          .update({ csd_status: "error", csd_last_error: message })
          .eq("id", company.id);
        await removeStagedFiles();
        return json({
          success: false,
          error: message,
          facturama_status: isFacturamaError(updateError) ? updateError.status : null,
          facturama_response: isFacturamaError(updateError) ? updateError.pacResponse : null,
        });
      }
    } else {
      const message = isFacturamaError(error)
        ? userFacingPacMessage(
            error,
            "Ocurrió un problema técnico al cargar tu CSD. Intenta de nuevo en unos minutos.",
          )
        : "No fue posible cargar tu CSD.";
      await supabase
        .from("companies")
        .update({ csd_status: "error", csd_last_error: message })
        .eq("id", company.id);
      await removeStagedFiles();
      return json({
        success: false,
        error: message,
        facturama_status: isFacturamaError(error) ? error.status : null,
        facturama_response: isFacturamaError(error) ? error.pacResponse : null,
      });
    }
  }

  const finalCerPath = `${authData.user.id}/${company.id}/cert.cer`;
  const finalKeyPath = `${authData.user.id}/${company.id}/key.key`;
  if (requestedPaths) {
    await supabase.storage.from("csd-files").remove([finalCerPath, finalKeyPath]);
    const [cerCopy, keyCopy] = await Promise.all([
      supabase.storage.from("csd-files").copy(sourceCerPath, finalCerPath),
      supabase.storage.from("csd-files").copy(sourceKeyPath, finalKeyPath),
    ]);
    if (cerCopy.error || keyCopy.error) {
      return json(
        {
          success: false,
          error: "El CSD fue registrado con el proveedor de timbrado, pero no pudo guardarse en Factio.",
        },
        502,
      );
    }
    await supabase.storage.from("csd-files").remove([sourceCerPath, sourceKeyPath]);
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({
      csd_cer_url: finalCerPath,
      csd_key_url: finalKeyPath,
      csd_serial_number: validation.serialNumber,
      csd_valid_from: validation.validFrom,
      csd_valid_to: validation.validTo,
      csd_status: "uploaded",
      csd_uploaded_at: new Date().toISOString(),
      csd_last_error: null,
      onboarding_completed: true,
    })
    .eq("id", company.id);
  if (updateError) {
    return json(
      {
        success: false,
        error: "El CSD fue registrado con el proveedor de timbrado, pero no se pudo actualizar la empresa.",
      },
      502,
    );
  }

  return json({
    success: true,
    serial_number: validation.serialNumber,
    valid_from: validation.validFrom,
    valid_to: validation.validTo,
  });
});
