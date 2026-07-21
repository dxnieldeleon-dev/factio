/**
 * Invoice lifecycle.
 */
export const InvoiceStatus = {
  DRAFT: "draft",
  PROCESSING: "processing",
  ISSUED: "issued",
  CANCELLED: "cancelled",
  ERROR: "error",
} as const;

export type InvoiceStatus =
  typeof InvoiceStatus[keyof typeof InvoiceStatus];
