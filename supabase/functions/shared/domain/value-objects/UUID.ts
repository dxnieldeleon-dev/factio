# Sprint 3 - Paso 2

## Archivo

```
supabase/functions/shared/domain/value-objects/UUID.ts
```

Reemplaza todo el contenido por el siguiente:

```ts
/**
 * ============================================================================
 * FACTIO
 * UUID Value Object
 * ============================================================================
 *
 * Represents the unique identifier of a Domain Entity.
 *
 * This class belongs to the Domain Layer.
 * It must not depend on external frameworks or services.
 * ============================================================================
 */

export class UUID {
  constructor(
    private readonly value: string,
  ) {}

  /**
   * Returns the UUID value.
   */
  public getValue(): string {
    return this.value;
  }

  /**
   * String representation.
   */
  public toString(): string {
    return this.value;
  }

  /**
   * Equality comparison.
   */
  public equals(other: UUID): boolean {
    return this.value === other.value;
  }
}
```

---

## Después abre

```
supabase/functions/shared/domain/value-objects/index.ts
```

Y agrega:

```ts
export * from "./UUID";
```

---

## Cuando termines

No modifiques ninguna entidad todavía.

Primero comprobaremos que el proyecto compile correctamente.

Después pasaremos a crear `RFC.ts`.
