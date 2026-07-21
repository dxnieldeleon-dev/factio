/**
 * ------------------------------------------------------------------------
 * User Entity
 * ------------------------------------------------------------------------
 */

export class User {
  constructor(
    private readonly id: string,
    private readonly companyId: string,

    private readonly email: string,
    private readonly fullName: string,

    private readonly role: string,
    private readonly status: string,

    private readonly lastLoginAt: Date | null,

    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {}
}
