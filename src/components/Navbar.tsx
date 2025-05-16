"use client";
import { useActiveAccount } from "thirdweb/react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isLoggedIn } from "../app/connect-button/actions/auth";
import Image from "next/image";
import { ConnectButton } from "thirdweb/react";
import { client } from "../lib/client";
import { generatePayload, login, logout } from "../app/connect-button/actions/auth";
import { appChain } from "../lib/chain";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const account = useActiveAccount();
  const [authenticated, setAuthenticated] = useState(false);
  
  useEffect(() => {
    async function checkAuth() {
      if (account) {
        const result = await isLoggedIn();
        setAuthenticated(result);
      } else {
        setAuthenticated(false);
      }
    }
    
    checkAuth();
  }, [account]);
  
  const isActive = (path: string) => {
    return pathname === path;
  };
  
  return (
    <nav className="border-b border-white/10 text-white relative z-20">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <div className="flex items-center">
              <Image
                src="/founders-logo.svg"
                alt="Founders Inc Logo"
                width={150}
                height={40} 
                className="mr-2"
              />
              <div className="h-6 w-px bg-white/20 mx-3 hidden md:block"></div>
              <div className="hidden md:block font-bold uppercase text-sm tracking-wider">
                FIFA Tracker
              </div>
            </div>
          </Link>
          
          {authenticated && (
            <div className="hidden md:flex space-x-6 items-center">
              <Link 
                href="/dashboard" 
                className={`uppercase text-sm font-medium tracking-wide py-2 ${
                  isActive('/dashboard') 
                    ? 'border-b-2 border-white text-white' 
                    : 'text-white/70 hover:text-white/90 transition-colors duration-200'
                }`}
              >
                Dashboard
              </Link>
              <Link 
                href="/create-match" 
                className={`uppercase text-sm font-medium tracking-wide py-2 ${
                  isActive('/create-match') 
                    ? 'border-b-2 border-white text-white' 
                    : 'text-white/70 hover:text-white/90 transition-colors duration-200'
                }`}
              >
                New Match
              </Link>
              <Link 
                href="/matches" 
                className={`uppercase text-sm font-medium tracking-wide py-2 ${
                  isActive('/matches') 
                    ? 'border-b-2 border-white text-white' 
                    : 'text-white/70 hover:text-white/90 transition-colors duration-200'
                }`}
              >
                History
              </Link>
              <Link 
                href="/leaderboard" 
                className={`uppercase text-sm font-medium tracking-wide py-2 ${
                  isActive('/leaderboard') 
                    ? 'border-b-2 border-white text-white' 
                    : 'text-white/70 hover:text-white/90 transition-colors duration-200'
                }`}
              >
                Leaderboard
              </Link>
              <Link 
                href="/profile" 
                className={`uppercase text-sm font-medium tracking-wide py-2 ${
                  isActive('/profile') 
                    ? 'border-b-2 border-white text-white' 
                    : 'text-white/70 hover:text-white/90 transition-colors duration-200'
                }`}
              >
                Profile
              </Link>
            </div>
          )}
          
          <div className="flex items-center tw-connect-wallet">
            <ConnectButton
              client={client}
              accountAbstraction={{
                chain: appChain,
                sponsorGas: true,
              }}
              auth={{
                isLoggedIn: async (address) => {
                  const result = await isLoggedIn();
                  setAuthenticated(result);
                  return result;
                },
                doLogin: async (params) => {
                  await login(params);
                  setAuthenticated(true);
                  
                  // Once logged in, redirect to dashboard if not already there
                  if (window.location.pathname === '/') {
                    setTimeout(() => {
                      router.push("/dashboard");
                    }, 500);
                  }
                },
                getLoginPayload: async ({ address }) => generatePayload({ address, chainId: 466 }),
                doLogout: async () => {
                  await logout();
                  setAuthenticated(false);
                  router.push("/");
                },
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
} 