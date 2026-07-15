import type {
  FacturamaApiError,
  FacturamaConfig,
  FacturamaEnvironment,
} from "./types";

const FACTURAMA_URLS: Record<FacturamaEnvironment, string> = {
  sandbox: "https://apisandbox.facturama.mx",
  production: "https://api.facturama.mx",
};

export class FacturamaClientError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "FacturamaClientError";
    this.status = status;
    this.details = details;
  }
}

export function getFacturamaConfig(): FacturamaConfig {
  const username = process.env.FACTURAMA_USERNAME;
  const password = process.env.FACTURAMA_PASSWORD;

  const environment: FacturamaEnvironment =
    process.env.FACTURAMA_ENV === "production"
      ? "production"
      : "sandbox";

  if (!username) {
    throw new Error("FACTURAMA_USERNAME is not configured");
  }

  if (!password) {
    throw new Error("FACTURAMA_PASSWORD is not configured");
  }

  return {
    username,
    password,
    environment,
    baseUrl: FACTURAMA_URLS[environment],
  };
}

function createBasicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(
    `${username}:${password}`,
  ).toString("base64")}`;
}

export async function facturamaRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const config = getFacturamaConfig();

  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  const response = await fetch(
    `${config.baseUrl}${normalizedPath}`,
    {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: createBasicAuth(
          config.username,
          config.password,
        ),
        ...options.headers,
      },
    },
  );

  if (!response.ok) {
    let details: FacturamaApiError | unknown;

    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    throw new FacturamaClientError(
      `Facturama API request failed with status ${response.status}`,
      response.status,
      details,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
