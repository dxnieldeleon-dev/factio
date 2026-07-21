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

    private readonly role: UserRole,
    private readonly status: UserStatus,

    private readonly lastLoginAt: Date | null,

    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {}
}
