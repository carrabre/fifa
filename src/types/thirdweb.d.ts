declare module "thirdweb/auth" {
  export const createAuth: any;
  export type GenerateLoginPayloadParams = any;
  export type VerifyLoginPayloadParams = any;
}

declare module "thirdweb/wallets" {
  export const privateKeyToAccount: any;
}

declare module "thirdweb/react" {
  export const ThirdwebProvider: any;
  export const ConnectButton: any;
  export function useActiveAccount(): any;
}

declare module "thirdweb" {
  export const createThirdwebClient: any;
  export const defineChain: any;
} 