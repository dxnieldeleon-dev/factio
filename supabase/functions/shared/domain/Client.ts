/**
 * Domain Model
 *
 * TODO:
 * Implement domain model.
 */
/**
 * ------------------------------------------------------------------------
 * Client Entity
 * ------------------------------------------------------------------------
 */

export class Client {
  constructor(
    private readonly id: UUID,
    private readonly companyId: UUID,

    private readonly rfc: RFC,
    private readonly name: string,

    private readonly taxRegime: string,
    private readonly postalCode: string,
    private readonly cfdiUse: string,

    private readonly email: Email | null,

    private readonly createdAt: Date,
    private readonly updatedAt: Date
    ts
import {
  UUID,
  RFC,
  Email,
} from "../value-objects";
  ) {}
}
