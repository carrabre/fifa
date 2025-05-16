"use client";
import type { NextPage } from "next";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { client } from "../lib/client";
import { generatePayload, isLoggedIn, login, logout } from "./connect-button/actions/auth";
import { appChain } from "../lib/chain";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

const LoginPage: NextPage = () => {
  const router = useRouter();
  const account = useActiveAccount();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      if (account) {
        const result = await isLoggedIn();
        setIsAuthenticated(result);
        
        // If authenticated, redirect to dashboard
        if (result) {
          router.push("/dashboard");
        }
      } else {
        setIsAuthenticated(false);
      }
    }

    checkAuth();
  }, [account, router]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <div className="w-full max-w-3xl mx-auto text-center">
        <div className="mb-6">
          <Image 
            src="/fifa-logo.png" 
            alt="FIFA Logo" 
            width={120} 
            height={120} 
            className="mx-auto" 
            unoptimized
          />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-white">
          FIFA Match Tracker
        </h1>
        
        <p className="text-xl text-blue-100 mb-8">
          Track your FIFA matches, compete with friends, and climb the leaderboard!
        </p>
        
        <div className="bg-white/10 backdrop-blur-sm p-8 rounded-xl shadow-xl mb-8">
          <h2 className="text-2xl font-bold mb-6 text-blue-200">
            Connect your wallet to start tracking
          </h2>
          
          <div className="flex justify-center mb-6">
            <ConnectButton
              client={client}
              accountAbstraction={{
                chain: appChain,
                sponsorGas: true,
              }}
              auth={{
                isLoggedIn: async (address: string) => {
                  console.log("checking if logged in!", { address });
                  const result = await isLoggedIn();
                  setIsAuthenticated(result);
                  return result;
                },
                doLogin: async (params: any) => {
                  console.log("logging in!");
                  await login(params);
                  setIsAuthenticated(true);
                  
                  // Once logged in, redirect to dashboard
                  setTimeout(() => {
                    router.push("/dashboard");
                  }, 500);
                },
                getLoginPayload: async ({ address }: { address: string }) => generatePayload({ address, chainId: 466 }),
                doLogout: async () => {
                  console.log("logging out!");
                  await logout();
                  setIsAuthenticated(false);
                },
              }}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="bg-white/5 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-2 text-blue-200">Track Matches</h3>
            <p className="text-blue-100">Record your FIFA match results and keep track of your performance</p>
          </div>
          <div className="bg-white/5 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-2 text-blue-200">View Stats</h3>
            <p className="text-blue-100">Analyze your win/loss record and other important match statistics</p>
          </div>
          <div className="bg-white/5 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-2 text-blue-200">Compete</h3>
            <p className="text-blue-100">Climb the leaderboard and become the top FIFA player</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 