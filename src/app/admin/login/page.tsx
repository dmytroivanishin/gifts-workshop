import { enabledOAuthProviders } from "@/utils/oauth/registry";
import { LoginClient } from "./LoginClient";

// Decided on the server: a sign-in icon appears only when that provider's settings are present
export default function AdminLoginPage() {
  return <LoginClient enabledProviders={enabledOAuthProviders()} />;
}
