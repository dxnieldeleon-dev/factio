/**
 * ------------------------------------------------------------------------
 * Company Entity
 * ------------------------------------------------------------------------
 * Represents a company (issuer) within Factio.
 * This entity belongs to the Domain Layer and must not depend on
 * Supabase, Stripe, Facturama or any external service.
 * ------------------------------------------------------------------------
 */

export class Company {
  constructor(
    private readonly id: string,
    private readonly ownerId: string,

    private readonly rfc: string,
    private readonly legalName: string,
    private readonly tradeName: string,
    private readonly taxRegime: string,
    private readonly postalCode: string,

    private readonly email: string,
    private readonly phone: string,

    private readonly isActive: boolean,
    private readonly csdStatus: CompanyCsdStatus

    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ts
import {
  UUID,
  RFC,
} from "../value-objects";
  ) {}
}
