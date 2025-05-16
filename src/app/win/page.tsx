"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";
import Confetti from 'react-confetti';

export default function WinPage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect after 8 seconds
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 8000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center relative overflow-hidden">
      <Confetti 
        width={typeof window !== 'undefined' ? window.innerWidth : 800}
        height={typeof window !== 'undefined' ? window.innerHeight : 600}
        recycle={false}
        numberOfPieces={500}
        colors={['#00C853', '#00A846', '#008E3B', '#00732F']}
      />
      
      <div className="fc24-card p-10 max-w-lg text-center z-10">
        <h1 className="fc24-heading mb-6 text-[rgb(0,200,83)]">
          YOU WON!
        </h1>
        
        <div className="mb-8">
          <Image 
            src="/trophy.png" 
            alt="Trophy" 
            width={180} 
            height={180} 
            className="mx-auto" 
          />
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
      </div>
    </div>
  );
} 