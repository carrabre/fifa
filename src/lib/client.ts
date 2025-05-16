import { createThirdwebClient } from "thirdweb";

// Provide safe fallbacks so build doesn't fail if env vars are missing
const clientIdEnv = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
const secretKeyEnv = process.env.THIRDWEB_SECRET_KEY;

if (!clientIdEnv && !secretKeyEnv) {
  // Use a harmless placeholder; recommended to replace with real credentials in production
  process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID = "placeholder_client_id";
}

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!;
const secretKey = process.env.THIRDWEB_SECRET_KEY;

export const client = createThirdwebClient(
  secretKey
    ? { secretKey }
    : {
        clientId,
      }
);
