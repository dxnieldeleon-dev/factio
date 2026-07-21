/**
 * Domain Model
 *
 * TODO:
 * Implement domain model.
 */
/**
 * ------------------------------------------------------------------------
 * Invoice Entity
 * ------------------------------------------------------------------------
 */

export class Invoice {
  constructor(
    private readonly id: string,

    private readonly companyId: string,

    private readonly clientId: string,

    private readonly subtotal: number,

    private readonly taxes: number,

    private readonly total: number,

    private readonly status: string,

    private readonly uuid: string | null,

    private readonly issuedAt: Date | null,

    private readonly createdAt: Date,

    private readonly updatedAt: Date
  ) {}
}
