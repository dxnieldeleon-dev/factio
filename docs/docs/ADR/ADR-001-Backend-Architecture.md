# ADR-001

## Backend Architecture

Estado: Aceptado (en producción)

## Contexto

Factio necesitaba un backend para orquestar el timbrado CFDI, el cobro de
suscripciones y el saldo de timbres, sin operar infraestructura de servidor
propia.

## Decisión

- **Backend-first sobre Supabase Edge Functions (Deno)**, no un servidor
  Node/Express dedicado. Cada capacidad expuesta al cliente es una función
  independiente en `supabase/functions/<nombre>/index.ts` (p. ej.
  `facturama-create-cfdi`, `facturama-cancel-cfdi`, `validate-csd`,
  `facturama-reconcile-cfdi`, `create-checkout-session`, `stripe-webhook`).
- **Las invariantes de negocio se hacen cumplir en PostgreSQL, no en las
  Edge Functions.** Cambios de estado que deben ser atómicos o que protegen
  dinero real (timbrar, cancelar, otorgar/consumir timbres) están
  implementados como funciones `SECURITY DEFINER` en SQL
  (`claim_cfdi_stamp`, `finalize_cfdi_stamp`, `release_cfdi_stamp_claim`,
  `finalize_cfdi_cancellation`, `finalize_cfdi_stamp_reconciliation`,
  `release_cfdi_stamp_reconciliation`) que verifican `auth.uid()` y usan
  `FOR UPDATE` para evitar condiciones de carrera. La Edge Function
  orquesta llamadas externas (Facturama, Storage) pero delega el commit del
  estado a estas funciones.
- **Row Level Security como límite de autorización por defecto** en toda
  tabla con datos de usuario, además del filtro explícito en cada consulta.
  Es una defensa en profundidad: ni un bug en la Edge Function ni un cliente
  malicioso con la anon key deberían poder leer o escribir datos de otra
  empresa.
- **El webhook de Stripe usa la service role key** (no JWT de usuario) y es
  la única vía autorizada para escribir `subscriptions`/otorgar timbres vía
  `stamp_transactions`; el resto de roles tiene `INSERT`/`UPDATE`/`DELETE`
  revocado en esas tablas.

## Por qué

- Evita mantener y desplegar un servidor propio; Supabase da autenticación,
  Postgres, Storage y funciones serverless en una sola plataforma.
- Poner las invariantes en la base de datos (no en el código de la Edge
  Function) significa que se cumplen sin importar quién llame: la propia
  API REST de Supabase, un script de soporte, u otra Edge Function futura.
  Ya evitó al menos un bug real: un descuento doble de timbre causado por
  tener la misma invariante expresada dos veces (una en la Edge Function,
  otra en un trigger) — ver CHANGELOG.
- Facturar es una operación con efecto legal (un CFDI timbrado no se puede
  deshacer limpiamente). Modelar el timbrado como una máquina de estados
  explícita en la base de datos (`stamping_status`: ready → processing →
  completed | reconciliation_required) permite razonar sobre qué pasos son
  seguros de reintentar y cuáles no.

## Consecuencias

- Cualquier cambio a una invariante de negocio requiere una migración SQL,
  no solo un cambio de TypeScript — es más lento pero más difícil de violar
  por accidente.
- Depender de la plataforma de Supabase (Edge Functions + Postgres +
  Storage) es una atadura consciente: no hay capa de abstracción de
  infraestructura.
