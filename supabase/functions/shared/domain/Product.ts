/**
 * Domain Model
 *
 * TODO:
 * Implement domain model.
 */
/**
 * ------------------------------------------------------------------------
 * Product Entity
 * ------------------------------------------------------------------------
 */

export class Product {
  constructor(
    private readonly id: string,
    private readonly companyId: string,

    private readonly code: string,

    private readonly description: string,

    private readonly unitCode: string,
    private readonly productCode: string,

    private readonly unitPrice: number,

    private readonly taxRate: number,

    private readonly isActive: boolean,

    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {}
}
