import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { GOOGLE_CONFIG } from "../config/googleConfig";

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  try {
    const { webClientId, redirectUri } = GOOGLE_CONFIG;

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${webClientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=openid%20email%20profile`;

    const result = await AuthSession.startAsync({ authUrl });

    if (result.type === "success" && result.params.access_token) {
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        {
          headers: { Authorization: `Bearer ${result.params.access_token}` },
        }
      );
      const userInfo = await userInfoResponse.json();
      return userInfo;
    } else {
      console.log("Login cancelado ou falhou:", result);
      return null;
    }
  } catch (error) {
    console.error("Erro no login com Google:", error);
    return null;
  }
}