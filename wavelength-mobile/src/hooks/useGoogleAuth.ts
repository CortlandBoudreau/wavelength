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

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    // scopes default to openid + profile + email — that's all we need
  });

  return { request, response, promptAsync } as const;
}
