"use client";
import type { NextPage } from "next";
import { ConnectButton } from "thirdweb/react";
import { client } from "../lib/client";
import { generatePayload, isLoggedIn, login, logout } from "./connect-button/actions/auth";
import { appChain } from "../lib/chain";

const Home: NextPage = () => {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeContent: "center" }}>
      <ConnectButton
        client={client}
        accountAbstraction={{
          chain: appChain,
          sponsorGas: true,
        }}
        auth={{
          isLoggedIn: async (address) => {
            console.log("checking if logged in!", { address });
            return await isLoggedIn();
          },
          doLogin: async (params) => {
            console.log("logging in!");
            await login(params);
          },
          getLoginPayload: async ({ address }) => generatePayload({ address, chainId: 466 }),
          doLogout: async () => {
            console.log("logging out!");
            await logout();
          },
        }}
      />
    </div>
  );
};

export default Home;
