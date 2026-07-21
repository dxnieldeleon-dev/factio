ts
import { ValueObject } from "./ValueObject";

/**
 * ============================================================================
 * FACTIO
 * Email Value Object
 * ============================================================================
 *
 * Represents an email address within the domain.
 *
 * Validation will be implemented in a future sprint.
 * ============================================================================
 */

export class Email extends ValueObject<string> {
  constructor(value: string) {
    super(value);
  }
}
