export type FacturamaEnvironment = "sandbox" | "production";

export interface FacturamaConfig {
  username: string;
  password: string;
  environment: FacturamaEnvironment;
  baseUrl: string;
}

export interface FacturamaApiError {
  Message?: string;
  ModelState?: Record<string, string[]>;
}

export interface FacturamaConnectionResult {
  ok: boolean;
  environment: FacturamaEnvironment;
  baseUrl: string;
  message: string;
  status?: number;
}
