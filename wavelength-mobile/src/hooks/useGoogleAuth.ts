/**
 * useGoogleAuth
 *
 * Wraps expo-auth-session's Google provider.  Call `promptAsync()` to open
 * the Google sign-in browser tab; the returned `response` will contain the
 * access token on success.
 *
 * Required env vars (set in .env / eas.json):
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID      — Web client ID from Google Cloud Console
 *   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID  — Android client ID from Google Cloud Console
 */
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

// Required: completes the auth session if the app was opened via the redirect URI
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export function useGoogleAuth() {
  // Always pass a config object — expo-auth-session crashes if given null.
  // When unconfigured we pass dummy IDs; isAvailable=false hides the button
  // so promptAsync is never actually called.
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId:     GOOGLE_WEB_CLIENT_ID     ?? 'unconfigured',
    androidClientId: GOOGLE_ANDROID_CLIENT_ID ?? 'unconfigured',
  });

  const isAvailable = !!(GOOGLE_WEB_CLIENT_ID && GOOGLE_ANDROID_CLIENT_ID);

  return { request, response, promptAsync, isAvailable } as const;
}
