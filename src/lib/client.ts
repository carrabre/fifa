import { createThirdwebClient } from "thirdweb";

// Fallbacks: use placeholder values at build-time if env vars are missing.
const secretKey = process.env.THIRDWEB_SECRET_KEY;
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "placeholder_client_id";

export const client = createThirdwebClient(
  secretKey ? { secretKey } : { clientId }
);
