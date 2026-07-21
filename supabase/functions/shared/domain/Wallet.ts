/**
 * Domain Model
 *
 * TODO:
 * Implement domain model.
 */
/**
 * ------------------------------------------------------------------------
 * Wallet Entity
 * ------------------------------------------------------------------------
 */

export class Wallet {
  constructor(
    private readonly id: string,

    private readonly companyId: string,

    private readonly availableStamps: number,

    private readonly usedStamps: number,

    private readonly createdAt: Date,

    private readonly updatedAt: Date
  ) {}
}
