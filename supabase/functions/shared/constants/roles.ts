export const UserRole = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export type UserRole =
  typeof UserRole[keyof typeof UserRole];
