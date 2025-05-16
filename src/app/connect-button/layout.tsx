"use client";
import { ThirdwebProvider } from "thirdweb/react";

const TW_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "placeholder_client_id";

export default function ThirdwebProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThirdwebProvider clientId={TW_CLIENT_ID}><div style={{minHeight: "100vh", display: "grid", placeContent: "center"}}>{children}</div></ThirdwebProvider>;
}
