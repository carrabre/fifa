"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { isLoggedIn } from "./connect-button/actions/auth";
import Image from "next/image";

// This is now just a redirect to dashboard or a simplified landing page
export default function Home() {
  const router = useRouter();
  const account = useActiveAccount();
  const [checking, setChecking] = useState(true);
  
  useEffect(() => {
    // Immediately redirect if we have an account
    async function checkAuth() {
      setChecking(true);
      
      try {
        if (account) {
          console.log("Account detected, checking auth status...");
          const authenticated = await isLoggedIn();
          if (authenticated) {
            console.log("User is authenticated, redirecting to dashboard");
            router.replace("/dashboard");
            return;
          }
        }
      } catch (err) {
        console.error("Error checking authentication:", err);
      } finally {
        setChecking(false);
      }
    }
    
    checkAuth();
  }, [account, router]);
  
  // Show loading state while checking auth
  if (checking && account) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/70">Checking credentials...</p>
        </div>
      </div>
    );
  }
  
  // Show a simple landing page
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
          
          <p className="text-blue-100 mb-4">
            Click the Connect button in the top right corner to get started
          </p>
          
          <button
            onClick={() => router.push("/dashboard")}
            className="bg-[#0078d4] hover:bg-[#0063b1] text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Go to Dashboard
          </button>
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
}
