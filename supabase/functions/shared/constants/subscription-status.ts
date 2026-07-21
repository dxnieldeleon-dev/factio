export const SubscriptionStatus = {
  TRIAL: "trial",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;

export type SubscriptionStatus =
  typeof SubscriptionStatus[keyof typeof SubscriptionStatus];
