import { defineChain } from "thirdweb";

export const appChain = defineChain({
  id: 466,
  rpc: "https://rpc.appchain.xyz/http",
  name: "AppChain",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
}); 