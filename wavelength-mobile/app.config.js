const IS_STAGING = process.env.APP_ENV === "staging";

/**
 * Dynamic Expo config.
 *
 * APP_ENV=staging   → staging build  (bundle: com.cortland.wavelength.staging, orange icon)
 * APP_ENV=<other>   → production build (bundle: com.cortland.wavelength, white icon)
 *
 * EAS build profiles set APP_ENV automatically via eas.json env blocks.
 * For local dev, APP_ENV is unset — falls through to production defaults,
 * but EXPO_PUBLIC_API_URL in .env points to localhost.
 */
export default {
  expo: {
    name: IS_STAGING ? "WaveLength Staging" : "WaveLength",
    slug: "wavelength",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        // Orange background on staging so it's visually distinct on the device
        backgroundColor: IS_STAGING ? "#f97316" : "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: IS_STAGING ? "com.cortland.wavelength.staging" : "com.cortland.wavelength",
      versionCode: 4,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: IS_STAGING ? "#f97316" : "#4A9EDB",
          sounds: [],
        },
      ],
    ],
    extra: {
      appEnv: process.env.APP_ENV ?? "production",
      eas: {
        projectId: "219740ff-6159-46f3-ac10-2dd86de9830a",
      },
    },
    owner: "cboudreaus-organization",
  },
};
