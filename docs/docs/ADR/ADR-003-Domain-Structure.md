# ADR-003

## Domain Structure

Estado: Aceptado (reemplaza el diseño original — ver "Falso inicio")

## Contexto

El historial de commits del repositorio muestra un intento temprano de
organizar el backend siguiendo Domain-Driven Design clásico: entidades con
comportamiento (`Invoice`, `Company`, `Wallet`, `Subscription`, ...),
value objects (`RFC`, `UUID`, `Email`) y carpetas reservadas para
`validators/`, `errors/`, `logger/`, `database/`, `auth/`, `types/`,
`utils/` bajo `supabase/functions/shared/`.

## Falso inicio: `supabase/functions/shared/`

Ese directorio sigue en el repositorio, pero **ningún Edge Function
desplegado lo importa** (verificado: cero referencias a `shared/domain`,
`shared/constants`, `shared/validators`, etc. desde fuera de esa misma
carpeta). Las clases de dominio son literalmente stubs:

```ts
// supabase/functions/shared/domain/Invoice.ts
/**
 * TODO:
 * Implement domain model.
 */
export class Invoice {
  constructor(
    private readonly id: string,
    // ...solo campos, sin comportamiento
  ) {}
}
```

La mayoría de las subcarpetas (`auth/`, `database/`, `errors/`, `logger/`,
`pac/`, `types/`, `utils/`, `validators/`) contienen únicamente un
`README.md` con el nombre de la carpeta — nunca se llegó a implementar nada
en ellas.

**Decisión**: no tratar `shared/` como la arquitectura vigente ni construir
sobre ella. Es deuda documentada, candidata a eliminarse en una limpieza
futura (igual que ya se retiraron otros restos de intentos anteriores:
`src/lib/pac`, el simulador de PAC, y `src/lib/facturama`, un cliente de
Facturama para un backend en TanStack Start Server Functions que se
abandonó a favor de Edge Functions).

## Estructura real

- **Backend**: sin capa de dominio separada. Cada Edge Function contiene su
  propia validación y mapeo inline (ver `buildCfdiPayload` en
  `facturama-create-cfdi/index.ts` como ejemplo representativo: valida,
  normaliza y arma el payload en el mismo archivo que lo usa). El único
  código compartido real es `_shared/facturama/` (cliente HTTP del PAC,
  ver ADR-002) porque es el único caso con más de un consumidor.
- **Invariantes de negocio**: viven en PostgreSQL como funciones
  `SECURITY DEFINER`, no como métodos de una clase de dominio (ver ADR-001).
  El "modelo de dominio" ejecutable de Factio son las tablas, sus
  `CHECK`/RLS, y estas funciones — no clases TypeScript.
- **Frontend**: rutas basadas en archivos (`src/routes`, TanStack Router;
  ver `src/routes/README.md`), con lógica de UI específica de una sección
  agrupada en `src/features/<área>/` (hoy solo `src/features/profile/`:
  formularios de perfil fiscal y CSD). Utilidades transversales en
  `src/lib/` (formato, catálogos SAT, validación fiscal, manejo de errores
  de Edge Functions).

## Por qué

Diseñar el modelo de dominio por adelantado (clases + value objects) antes
de tener las reglas de negocio reales resultó en abstracciones que nunca se
conectaron al sistema real. La organización que sí sobrevivió — lógica
inline por Edge Function, invariantes en SQL — surgió de resolver problemas
concretos (timbrado idempotente, wallet de timbres, reconciliación) y
resultó más simple de mantener que la capa de dominio planeada.
