"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";

export default function DrawPage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect after 10 seconds
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 10000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center relative overflow-hidden">
      <div className="fc24-card p-10 max-w-lg text-center z-10">
        <div className="mb-6">
          <Image 
            src="/handshake.png" 
            alt="Handshake" 
            width={150} 
            height={150} 
            className="mx-auto" 
          />
        </div>
        
        <h1 className="fc24-heading mb-6 text-[rgb(255,214,10)]">
          DRAW
        </h1>
        
        <div className="bg-[rgba(255,214,10,0.1)] border border-[rgba(255,214,10,0.3)] text-[rgb(255,214,10)] p-3 mb-6 inline-block uppercase tracking-wider text-sm font-medium">
          Match Ended in a Tie
        </div>
        
        <p className="text-xl text-white mb-8">
          A fierce battle with no clear winner. Both players showed great skill!
        </p>
        
        <div className="mb-6">
          <span className="text-[rgb(255,214,10)] text-4xl">★★</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => router.push("/dashboard")}
            className="ea-button-secondary"
          >
            Dashboard
          </button>
          
          <button 
            onClick={() => router.push("/create-match")}
            className="ea-button"
          >
            New Match
          </button>
        </div>
        
        <p className="text-white/40 mt-8 text-xs uppercase tracking-wider">
          Redirecting to dashboard in a few seconds...
        </p>
      </div>
    </div>
  );
} 