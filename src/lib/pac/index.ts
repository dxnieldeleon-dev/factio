/**
 * Servicio PAC (Proveedor Autorizado de Certificación).
 *
 * Esta es la capa de abstracción para integrar cualquier PAC (Facturama,
 * SW Sapien, Finkok, etc.). La implementación real debe vivir en server
 * functions (createServerFn) usando las credenciales del PAC como secret.
 *
 * Por ahora exponemos un stub local que simula el timbrado para que el
 * resto de la app funcione end-to-end. NO usar en producción.
 */

export interface PacInvoicePayload {
  series: string;
  folio: number;
  issuerRfc: string;
  receiverRfc: string;
  receiverName: string;
  receiverTaxRegime: string;
  receiverCfdiUse: string;
  receiverPostalCode: string;
  paymentForm: string;
  paymentMethod: string;
  currency: string;
  items: Array<{
    satKey: string;
    satUnit: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    ivaRate: number;
  }>;
}

export interface PacStampResult {
  ok: true;
  uuid: string;
  xmlUrl: string;
  pdfUrl: string;
  stampedAt: string;
}

export interface PacErrorResult {
  ok: false;
  code: string;
  message: string;
}

export interface PacService {
  validateRfc(rfc: string): Promise<{ valid: boolean; legalName?: string; taxRegime?: string }>;
  stamp(payload: PacInvoicePayload): Promise<PacStampResult | PacErrorResult>;
  cancel(uuid: string, reason: string): Promise<{ ok: boolean; message?: string }>;
}

/**
 * Implementación stub. Reemplazar por un cliente real de PAC en server
 * functions (createServerFn) leyendo el secret PAC_API_KEY desde process.env.
 */
export const pac: PacService = {
  async validateRfc(rfc: string) {
    await delay(200);
    return { valid: /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i.test(rfc.trim()) };
  },
  async stamp(payload) {
    await delay(800);
    return {
      ok: true,
      uuid: cryptoUUID(),
      xmlUrl: `data:application/xml;charset=utf-8,${encodeURIComponent(mockXml(payload))}`,
      pdfUrl: "",
      stampedAt: new Date().toISOString(),
    };
  },
  async cancel(_uuid, _reason) {
    await delay(500);
    return { ok: true };
  },
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function cryptoUUID() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().toUpperCase();
  return "XXXXXXXX-XXXX-4XXX-YXXX-XXXXXXXXXXXX".replace(/[XY]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "X" ? r : (r & 0x3) | 0x8).toString(16).toUpperCase();
  });
}

function mockXml(p: PacInvoicePayload) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Mock CFDI 4.0 — emisor:${p.issuerRfc} receptor:${p.receiverRfc} folio:${p.series}-${p.folio} -->`;
}
