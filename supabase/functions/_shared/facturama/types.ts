export type FacturamaEnvironment = "sandbox" | "production";

export type FacturamaCfdiPayload = Record<string, unknown>;

export type FacturamaCfdiResponse = {
  Id?: string;
  id?: string;
  Uuid?: string;
  UUID?: string;
  uuid?: string;
  [key: string]: unknown;
};

export type FacturamaDocumentFormat = "xml" | "pdf";

export type FacturamaCsdPayload = {
  Rfc: string;
  Certificate: string;
  PrivateKey: string;
  PrivateKeyPassword: string;
};

export type FacturamaCancellationResponse = {
  Status?: string;
  Message?: string;
  Uuid?: string;
  RequestDate?: string;
  CancelationDate?: string;
  AcuseXmlBase64?: string;
  [key: string]: unknown;
};

export type FacturamaDocumentResponse = {
  Content?: string;
  content?: string;
  ContentEncoding?: string;
  contentEncoding?: string;
  [key: string]: unknown;
};

export type FacturamaConfig = {
  username: string;
  password: string;
  environment: FacturamaEnvironment;
  baseUrl: string;
};
