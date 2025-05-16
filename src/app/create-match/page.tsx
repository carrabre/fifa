"use client";
import { useActiveAccount } from "thirdweb/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isLoggedIn } from "../connect-button/actions/auth";
import { createMatch, getAllUsersWithNames, User } from "../../lib/supabase";
import { setupSupabaseTables } from "../../lib/setup-supabase";
import Image from "next/image";

// Ensure route is treated as dynamic at build time so that server action auth checks succeed.
export const dynamic = "force-dynamic";

export default function CreateMatch() {
  const router = useRouter();
  const account = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [opponentAddress, setOpponentAddress] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [playerTeam, setPlayerTeam] = useState("");
  const [opponentTeam, setOpponentTeam] = useState("");
  const [availableOpponents, setAvailableOpponents] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [matchId, setMatchId] = useState<number | null>(null);

  useEffect(() => {
    async function checkAuth() {
      if (!account) {
        router.push("/");
        return;
      }

      const authenticated = await isLoggedIn();
      if (!authenticated) {
        router.push("/");
        return;
      }

      try {
        // Setup Supabase tables if they don't exist
        await setupSupabaseTables();
        
        // Load available opponents
        const usersWithNames = await getAllUsersWithNames();
        // Filter out the current user
        const opponents = usersWithNames.filter(user => user.wallet_address !== account.address);
        setAvailableOpponents(opponents);
      } catch (err) {
        console.error("Error loading opponents:", err);
        // Don't worry if this fails, we'll still allow manual input
      }

      setLoading(false);
    }

    checkAuth();
  }, [account, router]);

  // Create a direct opponent if the input looks like an address
  useEffect(() => {
    // Check if manualAddress appears to be a valid Ethereum address
    const isValidEthAddress = /^0x[a-fA-F0-9]{40}$/i.test(manualAddress);
    
    if (isValidEthAddress && !availableOpponents.some(user => user.wallet_address === manualAddress)) {
      // Add to available opponents with a default display name
      const displayName = `${manualAddress.slice(0, 6)}...${manualAddress.slice(-4)}`;
      const newOpponent: User = {
        wallet_address: manualAddress,
        display_name: displayName
      };
      setAvailableOpponents(prev => [...prev, newOpponent]);
    }
  }, [manualAddress, availableOpponents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    // Determine which opponent address to use
    const finalOpponentAddress = opponentAddress || manualAddress;

    // Validate opponent address
    if (!finalOpponentAddress || finalOpponentAddress.length < 10) {
      setError("Please select or enter a valid opponent address");
      setSubmitting(false);
      return;
    }

    // Validate scores
    if (playerScore < 0 || opponentScore < 0) {
      setError("Scores cannot be negative");
      setSubmitting(false);
      return;
    }

    try {
      console.log("Creating match with:", {
        player1: account!.address,
        player2: finalOpponentAddress,
        player1_score: playerScore,
        player2_score: opponentScore,
        player1_team: playerTeam,
        player2_team: opponentTeam
      });

      // Create the match record
      const match = await createMatch({
        player1: account!.address,
        player2: finalOpponentAddress,
        player1_score: playerScore,
        player2_score: opponentScore,
        player1_team: playerTeam,
        player2_team: opponentTeam
      });

      console.log("Match created:", match);
      
      // Store the match ID
      if (match.id) {
        setMatchId(match.id);
      }

      // Show success and reset form
      setSuccess(true);
      
      // Navigate to select winner page after a short delay
      setTimeout(() => {
        router.push(`/match-result?id=${match.id}`);
      }, 1500);

    } catch (err) {
      console.error("Error submitting match:", err);
      setError("Failed to submit match. Please try again.");
    } finally {
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

  return (
    <div className="min-h-[80vh]">
      <div className="mb-8">
        <h1 className="fc24-heading mb-2">CREATE MATCH</h1>
        <div className="h-1 w-24 bg-[rgb(var(--accent-color))]"></div>
      </div>
    
      <div className="max-w-lg mx-auto">
        <div className="fc24-card p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center mb-4">
              <span className="h-5 w-1 bg-[rgb(var(--accent-color))] mr-3"></span>
              Match Details
            </h2>
            <p className="text-white/60 text-sm uppercase tracking-wider">Record your FC24 match results</p>
          </div>

          {error && (
            <div className="bg-[rgba(255,69,58,0.1)] border border-[rgba(255,69,58,0.3)] text-[rgb(255,69,58)] p-3 mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-[rgba(0,200,83,0.1)] border border-[rgba(0,200,83,0.3)] text-[rgb(0,200,83)] p-3 mb-6">
              Match recorded successfully! Redirecting to select winner...
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-white/70 uppercase text-xs tracking-wider mb-2" htmlFor="opponent">
                Select Opponent
              </label>

              
              {/* Dropdown selection */}
              <select
                id="opponent"
                value={opponentAddress}
                onChange={(e) => setOpponentAddress(e.target.value)}
                className="select"
              >
                <option value="">Select an existing opponent</option>
                {availableOpponents.map((opponent) => (
                  <option key={opponent.wallet_address} value={opponent.wallet_address}>
                    {opponent.display_name || `${opponent.wallet_address.slice(0, 6)}...${opponent.wallet_address.slice(-4)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-white/70 uppercase text-xs tracking-wider mb-2" htmlFor="playerTeam">
                  Your Team
                </label>
                <input
                  id="playerTeam"
                  type="text"
                  value={playerTeam}
                  onChange={(e) => setPlayerTeam(e.target.value)}
                  placeholder="e.g. Real Madrid"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-white/70 uppercase text-xs tracking-wider mb-2" htmlFor="opponentTeam">
                  Opponent Team
                </label>
                <input
                  id="opponentTeam"
                  type="text"
                  value={opponentTeam}
                  onChange={(e) => setOpponentTeam(e.target.value)}
                  placeholder="e.g. Barcelona"
                  className="input"
                />
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between mb-4">
                <span className="text-white/70 uppercase text-xs tracking-wider">Match Score</span>
              </div>
              <div className="flex items-center justify-center space-x-6 bg-black/20 p-6">
                <div className="text-center">
                  <p className="text-white uppercase text-xs tracking-wider mb-3">You</p>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={playerScore}
                    onChange={(e) => setPlayerScore(parseInt(e.target.value) || 0)}
                    className="w-20 bg-black/30 border border-white/10 rounded-sm py-3 px-3 text-white text-center focus:outline-none focus:border-[rgb(var(--accent-color))]"
                  />
                </div>

                <div className="text-3xl font-bold text-white">-</div>

                <div className="text-center">
                  <p className="text-white uppercase text-xs tracking-wider mb-3">Opponent</p>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(parseInt(e.target.value) || 0)}
                    className="w-20 bg-black/30 border border-white/10 rounded-sm py-3 px-3 text-white text-center focus:outline-none focus:border-[rgb(var(--accent-color))]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="ea-button-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || success}
                className={`ea-button ${
                  (submitting || success) ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {submitting ? "Submitting..." : "Record Match"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 