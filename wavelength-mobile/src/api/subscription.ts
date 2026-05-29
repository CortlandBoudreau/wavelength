import client from "./client";

export interface SubscriptionStatus {
  tier: "free" | "trial" | "pro" | "lifetime";
  active: boolean;
  expiresAt: string | null;
  label: string;
}

export const getSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
  const { data } = await client.get<SubscriptionStatus>("/subscription/status");
  return data;
};

export const redeemCode = async (code: string): Promise<SubscriptionStatus & { message: string }> => {
  const { data } = await client.post("/subscription/redeem", { code });
  return data;
};

/** Called from the app after a successful RevenueCat purchase to sync the DB. */
export const syncRevenueCatPurchase = async (
  activeSubscriptions: string[],
  expiresAt: string | null
): Promise<SubscriptionStatus> => {
  const { data } = await client.post<SubscriptionStatus>("/subscription/revenuecat-sync", {
    activeSubscriptions,
    expiresAt,
  });
  return data;
};
