"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { getCurrentAddress, isLoggedIn } from "../connect-button/actions/auth";
import { getUserByWallet, getMatchById, updateMatchWinner, Match, getUserInfo } from "../../lib/supabase";
import Image from "next/image";

function MatchResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [currentUserAddress, setCurrentUserAddress] = useState<string | null>(null);
  const [player1Name, setPlayer1Name] = useState<string | null>(null);
  const [player2Name, setPlayer2Name] = useState<string | null>(null);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuthAndLoadMatch() {
      // Check authentication
      const authenticated = await isLoggedIn();
      if (!authenticated) {
        router.push("/");
        return;
      }
      
      // Get current user address
      const address = await getCurrentAddress();
      setCurrentUserAddress(address);
      
      // Check match ID
      if (!matchId) {
        setError("No match ID provided");
        setLoading(false);
        return;
      }
      
      try {
        // Load match details
        const matchData = await getMatchById(parseInt(matchId));
        if (!matchData) {
          setError("Match not found");
          setLoading(false);
          return;
        }
        
        setMatch(matchData);
        
        // Load player names
        const player1Data = await getUserByWallet(matchData.player1);
        if (player1Data) {
          setPlayer1Name(player1Data.display_name);
        } else {
          const player1Info = await getUserInfo(matchData.player1);
          setPlayer1Name(player1Info.username || `${matchData.player1.slice(0, 6)}...${matchData.player1.slice(-4)}`);
        }
        
        const player2Data = await getUserByWallet(matchData.player2);
        if (player2Data) {
          setPlayer2Name(player2Data.display_name);
        } else {
          const player2Info = await getUserInfo(matchData.player2);
          setPlayer2Name(player2Info.username || `${matchData.player2.slice(0, 6)}...${matchData.player2.slice(-4)}`);
        }
        
        // Pre-select winner based on scores
        if (matchData.player1_score > matchData.player2_score) {
          setSelectedWinner(matchData.player1);
        } else if (matchData.player1_score < matchData.player2_score) {
          setSelectedWinner(matchData.player2);
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error loading match:", err);
        setError("Failed to load match details");
        setLoading(false);
      }
    }

    checkAuthAndLoadMatch();
  }, [matchId, router]);

  const handleSelectWinner = async (winner: string) => {
    setSelectedWinner(winner);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    
    if (!match?.id || !selectedWinner) {
      setError("Please select a winner");
      setSubmitting(false);
      return;
    }
    
    try {
      await updateMatchWinner(match.id, selectedWinner);
      setSuccess(true);
      
      // Redirect to appropriate win/loss/draw page
      setTimeout(() => {
        if (match.player1_score === match.player2_score && selectedWinner === 'draw') {
          router.push("/draw");
        } else if (currentUserAddress === selectedWinner) {
          router.push("/win");
        } else {
          router.push("/loss");
        }
      }, 1500);
    } catch (err) {
      console.error("Error updating match winner:", err);
      setError("Failed to update match winner");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error && !match) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="fc24-card p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-4 uppercase tracking-wider">Error</h1>
          <div className="bg-[rgba(255,69,58,0.1)] border border-[rgba(255,69,58,0.3)] text-[rgb(255,69,58)] p-4 mb-6">
            {error}
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="ea-button"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh]">
      <div className="mb-8">
        <h1 className="fc24-heading mb-2">MATCH RESULTS</h1>
        <div className="h-1 w-24 bg-[rgb(var(--accent-color))]"></div>
      </div>
    
      <div className="max-w-lg mx-auto">
        <div className="fc24-card p-8">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center mb-6">
              <span className="h-5 w-1 bg-[rgb(var(--accent-color))] mr-3"></span>
              Final Score
            </h2>
            
            <div className="flex items-center justify-center bg-black/20 py-8 px-4 border border-white/5">
              <div className="text-center">
                <p className="text-white uppercase text-sm tracking-wider mb-3">{player1Name || 'Player 1'}</p>
                <div className="text-4xl font-black text-white mb-2">{match?.player1_score}</div>
                <p className="text-white/50 text-xs uppercase">{match?.player1_team}</p>
              </div>
              
              <div className="text-xl font-bold text-white mx-8 uppercase tracking-wider">vs</div>
              
              <div className="text-center">
                <p className="text-white uppercase text-sm tracking-wider mb-3">{player2Name || 'Player 2'}</p>
                <div className="text-4xl font-black text-white mb-2">{match?.player2_score}</div>
                <p className="text-white/50 text-xs uppercase">{match?.player2_team}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-[rgba(255,69,58,0.1)] border border-[rgba(255,69,58,0.3)] text-[rgb(255,69,58)] p-3 mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-[rgba(0,200,83,0.1)] border border-[rgba(0,200,83,0.3)] text-[rgb(0,200,83)] p-3 mb-6">
              Match winner recorded! Redirecting...
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center mb-6">
                <span className="h-5 w-1 bg-[rgb(var(--accent-color))] mr-3"></span>
                Select Winner
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleSelectWinner(match?.player1 || '')}
                  className={`py-6 px-4 transition-colors duration-200 border ${
                    selectedWinner === match?.player1
                      ? 'border-[rgb(0,200,83)] bg-[rgba(0,200,83,0.1)]'
                      : 'border-white/5 bg-black/20 hover:bg-black/30'
                  }`}
                >
                  <div className="text-center">
                    <p className="text-white font-bold mb-2 uppercase tracking-wider">{player1Name || 'Player 1'}</p>
                    <p className="text-white/50 text-xs uppercase">{match?.player1_team}</p>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleSelectWinner(match?.player2 || '')}
                  className={`py-6 px-4 transition-colors duration-200 border ${
                    selectedWinner === match?.player2
                      ? 'border-[rgb(0,200,83)] bg-[rgba(0,200,83,0.1)]'
                      : 'border-white/5 bg-black/20 hover:bg-black/30'
                  }`}
                >
                  <div className="text-center">
                    <p className="text-white font-bold mb-2 uppercase tracking-wider">{player2Name || 'Player 2'}</p>
                    <p className="text-white/50 text-xs uppercase">{match?.player2_team}</p>
                  </div>
                </button>
              </div>

              {match?.player1_score === match?.player2_score && (
                <button
                  type="button"
                  onClick={() => handleSelectWinner('draw')}
                  className={`mt-4 w-full py-6 px-4 transition-colors duration-200 border ${
                    selectedWinner === 'draw'
                      ? 'border-[rgb(255,214,10)] bg-[rgba(255,214,10,0.1)]'
                      : 'border-white/5 bg-black/20 hover:bg-black/30'
                  }`}
                >
                  <div className="text-center">
                    <p className="text-white font-bold mb-2 uppercase tracking-wider">Declare Draw</p>
                    <p className="text-white/50 text-xs uppercase">No winner - match ended in a tie</p>
                  </div>
                </button>
              )}
              
              <div className="text-center mt-6 text-white/70 uppercase text-sm tracking-wider">
                {selectedWinner === match?.player1 && (
                  <p>{player1Name || 'Player 1'} selected as winner</p>
                )}
                {selectedWinner === match?.player2 && (
                  <p>{player2Name || 'Player 2'} selected as winner</p>
                )}
                {selectedWinner === 'draw' && (
                  <p className="text-[rgb(255,214,10)]">Match declared as a draw</p>
                )}
                {!selectedWinner && match?.player1_score === match?.player2_score && (
                  <p className="text-[rgb(255,214,10)]">The match is tied. Select a winner or declare a draw.</p>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="ea-button-secondary"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={!selectedWinner || submitting || success}
                className={`ea-button ${
                  (!selectedWinner || submitting || success) ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {submitting ? "Submitting..." : "Confirm Winner"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Export a wrapper component with Suspense to satisfy Next.js CSR bailout rules
export default function MatchResultPage() {
  return (
    <Suspense>
      <MatchResultContent />
    </Suspense>
  );
} 