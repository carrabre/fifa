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
import { useTheme } from "../hooks/useTheme";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const account = useActiveAccount();
  const { theme, toggleTheme } = useTheme();
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
          
          <div className="flex items-center space-x-4 tw-connect-wallet">
            {/* Theme toggle button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none"
            >
              {theme === "dark" ? (
                // Sun icon (outline)
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-yellow-400"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                // Moon icon (outline)
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-yellow-500"
                >
                  <path d="M21 12.79A9 9 0 0111.21 3 7 7 0 1021 12.79z" />
                </svg>
              )}
            </button>
            <ConnectButton
              client={client}
              accountAbstraction={{
                chain: appChain,
                sponsorGas: true,
              }}
              auth={{
                isLoggedIn: async (address: string) => {
                  const result = await isLoggedIn();
                  setAuthenticated(result);
                  return result;
                },
                doLogin: async (params: any) => {
                  await login(params);
                  setAuthenticated(true);
                  
                  // Once logged in, redirect to dashboard if not already there
                  if (window.location.pathname === '/') {
                    setTimeout(() => {
                      router.push("/dashboard");
                    }, 500);
                  }
                },
                getLoginPayload: async ({ address }: { address: string }) => generatePayload({ address, chainId: 466 }),
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