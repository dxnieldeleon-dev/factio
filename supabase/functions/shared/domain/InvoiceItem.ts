/**
 * Domain Model
 *
 * TODO:
 * Implement domain model.
 */
/**
 * ------------------------------------------------------------------------
 * Invoice Item Entity
 * ------------------------------------------------------------------------
 */

export class InvoiceItem {
  constructor(
    private readonly id: string,

    private readonly invoiceId: string,

    private readonly productId: string | null,

    private readonly description: string,

    private readonly quantity: number,

    private readonly unitPrice: number,

    private readonly discount: number,

    private readonly taxes: number,

    private readonly total: number
  ) {}
}
