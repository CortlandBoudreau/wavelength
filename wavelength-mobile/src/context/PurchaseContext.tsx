import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import { Platform } from "react-native";

const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

interface PurchaseContextType {
  offerings: PurchasesOfferings | null;
  customerInfo: CustomerInfo | null;
  loading: boolean;
  purchasing: boolean;
  purchasePackage: (pkg: PurchasesPackage) => Promise<CustomerInfo>;
  restorePurchases: () => Promise<CustomerInfo>;
  identifyUser: (userId: string) => Promise<void>;
  logOutRevenueCat: () => Promise<void>;
}

const PurchaseContext = createContext<PurchaseContextType | null>(null);

export function PurchaseProvider({ children }: { children: React.ReactNode }) {
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!ANDROID_KEY) {
      console.warn("[RevenueCat] EXPO_PUBLIC_REVENUECAT_ANDROID_KEY is not set.");
      setLoading(false);
      return;
    }

    if (Platform.OS === "android") {
      Purchases.configure({ apiKey: ANDROID_KEY });
    }

    (async () => {
      try {
        const infoResult = await Purchases.getCustomerInfo();
        setCustomerInfo(infoResult);
      } catch (e: any) {
        console.warn("[RevenueCat] getCustomerInfo error:", e?.message ?? e);
      }

      try {
        const offeringsResult = await Purchases.getOfferings();
        setOfferings(offeringsResult);
      } catch (e: any) {
        // Expected if no products are configured in RevenueCat yet
        console.warn("[RevenueCat] getOfferings:", e?.underlyingErrorMessage ?? e?.message ?? e);
      } finally {
        setLoading(false);
      }
    })();

    // Listen for subscription status changes (e.g. renewal in background)
    Purchases.addCustomerInfoUpdateListener((info) => setCustomerInfo(info));
  }, []);

  const identifyUser = useCallback(async (userId: string) => {
    try {
      const { customerInfo: info } = await Purchases.logIn(userId);
      setCustomerInfo(info);
      // Refresh offerings scoped to this user
      const fresh = await Purchases.getOfferings();
      setOfferings(fresh);
    } catch (e) {
      console.warn("[RevenueCat] logIn error:", e);
    }
  }, []);

  const logOutRevenueCat = useCallback(async () => {
    try {
      const appUserId = customerInfo?.originalAppUserId;
      const isIdentified = appUserId && !appUserId.startsWith("$RCAnonymousID:");
      if (isIdentified) {
        await Purchases.logOut();
      }
      setCustomerInfo(null);
    } catch (e) {
      console.warn("[RevenueCat] logOut error:", e);
    }
  }, [customerInfo]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<CustomerInfo> => {
    setPurchasing(true);
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return info;
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<CustomerInfo> => {
    setPurchasing(true);
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return info;
    } finally {
      setPurchasing(false);
    }
  }, []);

  return (
    <PurchaseContext.Provider value={{
      offerings,
      customerInfo,
      loading,
      purchasing,
      purchasePackage,
      restorePurchases,
      identifyUser,
      logOutRevenueCat,
    }}>
      {children}
    </PurchaseContext.Provider>
  );
}

export function usePurchase(): PurchaseContextType {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error("usePurchase must be used within PurchaseProvider");
  return ctx;
}
