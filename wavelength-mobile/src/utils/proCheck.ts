import type { User } from "../api/auth";

/**
 * Returns true if the user has an active paid subscription.
 * - "lifetime" never expires
 * - "pro" / "trial" are active until subscription_expires_at (null = permanent)
 */
export function isProUser(user: User | null): boolean {
  if (!user) return false;
  const { subscription_tier, subscription_expires_at } = user;
  if (subscription_tier === "lifetime") return true;
  if (subscription_tier === "pro" || subscription_tier === "trial") {
    if (!subscription_expires_at) return true;
    return new Date(subscription_expires_at) > new Date();
  }
  return false;
}
