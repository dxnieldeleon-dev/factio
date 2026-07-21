/**
 * Domain Model
 *
 * TODO:
 * Implement domain model.
 */
/**
 * ------------------------------------------------------------------------
 * Subscription Entity
 * ------------------------------------------------------------------------
 */

export class Subscription {
  constructor(
    private readonly id: string,

    private readonly companyId: string,

    private readonly stripeCustomerId: string,

    private readonly stripeSubscriptionId: string,

    private readonly plan: string,

    private readonly status: string,

    private readonly startedAt: Date,

    private readonly expiresAt: Date | null,

    private readonly createdAt: Date,

    private readonly updatedAt: Date
  ) {}
}
