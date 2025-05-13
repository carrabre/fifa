"use client";
import type { NextPage } from "next";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { client } from "../lib/client";
import { generatePayload, isLoggedIn, login, logout } from "./connect-button/actions/auth";
import { appChain } from "../lib/chain";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const Home: NextPage = () => {
  const router = useRouter();
  const account = useActiveAccount();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      if (account) {
        const result = await isLoggedIn();
        setIsAuthenticated(result);
      } else {
        setIsAuthenticated(false);
      }
    }

    checkAuth();
  }, [account]);

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
            const result = await isLoggedIn();
            setIsAuthenticated(result);
            return result;
          },
          doLogin: async (params) => {
            console.log("logging in!");
            await login(params);
            setIsAuthenticated(true);
          },
          getLoginPayload: async ({ address }) => generatePayload({ address, chainId: 466 }),
          doLogout: async () => {
            console.log("logging out!");
            await logout();
            setIsAuthenticated(false);
          },
        }}
      />

      {isAuthenticated && (
        <div className="mt-4 text-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
