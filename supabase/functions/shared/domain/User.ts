/**
 * ------------------------------------------------------------------------
 * User Entity
 * ------------------------------------------------------------------------
 */

export class User {
  constructor(
    private readonly id: UUID,
    private readonly companyId: UUID,

    private readonly email: Email,
    private readonly fullName: string,

    private readonly role: UserRole,
    private readonly status: UserStatus,

    private readonly lastLoginAt: Date | null,

    private readonly createdAt: Date,
    private readonly updatedAt: Date
    ts
import {
  UUID,
  Email,
} from "../value-objects";
  ) {}
}
