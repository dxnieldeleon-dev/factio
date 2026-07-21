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
    private readonly id: string,
    private readonly companyId: string,

    private readonly rfc: string,
    private readonly name: string,

    private readonly taxRegime: string,
    private readonly postalCode: string,
    private readonly cfdiUse: string,

    private readonly email: string | null,

    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {}
}
