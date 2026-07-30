# ADR-002

## PAC Abstraction

Estado: Aceptado (parcial — ver limitaciones)

## Contexto

Factio timbra CFDI a través de un PAC (Proveedor Autorizado de Certificación).
El proveedor elegido es Facturama. Cabía preguntarse qué tanto aislar el
código de negocio del proveedor específico, para poder cambiar de PAC o
soportar varios sin reescribir todo el flujo de timbrado.

## Decisión

Se aisló **el protocolo de comunicación** con Facturama en un módulo
compartido, `supabase/functions/_shared/facturama/`:

- `client.ts`: autenticación Basic, manejo de respuesta/errores HTTP, y las
  operaciones concretas (`createCfdi`, `cancelCfdi`, `uploadCsd`, `getCfdi`,
  `downloadCfdi`) más helpers para extraer el Id/UUID de la respuesta.
- `errors.ts`: `FacturamaError` normaliza cualquier fallo HTTP/de red del PAC
  a un solo tipo con `status` y `pacResponse`, para que el código que llama
  no tenga que conocer la forma de los errores de Facturama.
- `types.ts`: tipos de las respuestas de Facturama.

Todas las Edge Functions que hablan con el PAC (`facturama-create-cfdi`,
`facturama-cancel-cfdi`, `validate-csd`, `facturama-reconcile-cfdi`) importan
únicamente estas funciones — ninguna hace `fetch` directo a la API de
Facturama ni conoce sus URLs base o su esquema de autenticación.

## Qué NO se abstrajo (limitación intencional, no descuido)

El **payload del CFDI** (`FacturamaCfdiPayload` en
`facturama-create-cfdi/index.ts`) usa directamente los nombres de campo de
Facturama (`Issuer`, `Receiver`, `CfdiType`, `TaxObject`, etc.), construidos
a partir del modelo interno de Factio (`invoices`, `companies`, `clients`).
No existe una interfaz `PacProvider` genérica con un método `stamp(cfdi:
FactioCfdi): StampResult` que Facturama implemente entre varias opciones.

Esto significa: cambiar de PAC hoy implica reescribir `buildCfdiPayload` y
los tres call sites que arman/leen el payload — no solo apuntar el cliente
a otra URL.

## Por qué esta decisión

- Factio tiene un solo PAC en producción. Construir una abstracción
  multi-PAC sin un segundo proveedor real para validarla es diseñar a
  ciegas — el costo de mantenerla (y el riesgo de que la interfaz "genérica"
  en realidad solo describa las particularidades de Facturama) supera el
  beneficio actual.
- Aislar el protocolo HTTP y los errores sí paga dividendos ya: permite
  probar/mockear la comunicación con Facturama, y centraliza el manejo de
  sandbox vs. producción (`FACTURAMA_ENV`) en un solo lugar.

## Revisar esta decisión cuando

- Se necesite soportar un segundo PAC (multi-PAC real, no hipotético).
- El payload del CFDI cambie por una razón distinta a "Facturama lo pide
  así" (p. ej. soportar CFDI de Egreso) — es una buena oportunidad para
  extraer una interfaz basada en necesidades reales, no anticipadas.
