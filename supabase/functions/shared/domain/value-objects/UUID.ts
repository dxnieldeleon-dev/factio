import { ValueObject } from "./ValueObject";

/**
 * ============================================================================
 * FACTIO
 * UUID Value Object
 * ============================================================================
 */

export class UUID extends ValueObject<string> {
  constructor(value: string) {
    super(value);
  }
}
