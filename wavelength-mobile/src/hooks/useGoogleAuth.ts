/**
 * useGoogleAuth
 *
 * Wraps expo-auth-session's Google provider.  Call `promptAsync()` to open
 * the Google sign-in browser tab; the returned `response` will contain the
 * access token on success.
 *
 * Required env vars (set in .env / eas.json):
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID   — Web client ID from Google Cloud Console
 *
 * Google Cloud Console setup:
 *   1. Create a project at console.cloud.google.com
 *   2. APIs & Services → Credentials → Create OAuth client ID
 *   3. Application type: Web application
 *   4. Authorized redirect URIs — add ALL of these:
 *        https://auth.expo.io/@cboudreaus-organization/wavelength
 *        wavelength://
 *   5. Copy the Web client ID into EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
 */
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

// Required: completes the auth session if the app was opened via the redirect URI
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export function useGoogleAuth() {
  // If the Google client ID isn't configured, return a no-op so the app
  // doesn't crash — the Google Sign-In button will simply be hidden.
  const [request, response, promptAsync] = Google.useAuthRequest(
    GOOGLE_CLIENT_ID
      ? { webClientId: GOOGLE_CLIENT_ID }
      : null as any
  );

  const isAvailable = !!GOOGLE_CLIENT_ID;

  return { request, response, promptAsync, isAvailable } as const;
}
