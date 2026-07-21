ts
import { ValueObject } from "./ValueObject";

/**
 * ============================================================================
 * FACTIO
 * RFC Value Object
 * ============================================================================
 *
 * Represents a Mexican Tax ID (RFC).
 *
 * Validation will be implemented in a future sprint.
 * ============================================================================
 */
export class RFC extends ValueObject<string> {
  constructor(value: string) {
    super(value);
  }
}
