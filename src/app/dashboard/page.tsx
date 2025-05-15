"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { isLoggedIn } from "../connect-button/actions/auth";
import { getPlayerStats, getMatches, Match, PlayerStats, getUserByWallet, updatePlayerStats, deleteMatch } from "../../lib/supabase";
import Image from "next/image";
import { setupSupabaseTables } from '../../lib/setup-supabase';

export default function Dashboard() {
  const router = useRouter();
  const account = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUserData = async () => {
    if (!account) {
      return;
    }
    
    try {
      // Setup Supabase tables if they don't exist
      await setupSupabaseTables();
      
      // Always fetch fresh user profile data
      const userProfile = await getUserByWallet(account.address);
      console.log('User profile retrieved:', userProfile);
      
      if (userProfile) {
        setDisplayName(userProfile.display_name);
        console.log('Setting display name to:', userProfile.display_name);
      } else {
        // Reset display name if no profile found
        setDisplayName(null);
      }
      
      // Get player stats
      const stats = await getPlayerStats(account.address);
      setPlayerStats(stats);

      // If stats show 0 total games, create an initial player_stats record
      if (stats.total_games === 0) {
        console.log("Initializing player stats in database...");
        try {
          // Call updatePlayerStats with a dummy match to ensure the stats are created
          await updatePlayerStats({
            player1: account.address,
            player2: account.address,
            player1_score: 0,
            player2_score: 0
          });
          
          // Get the stats again
          const refreshedStats = await getPlayerStats(account.address);
          setPlayerStats(refreshedStats);
        } catch (error) {
          console.error("Error initializing player stats:", error);
        }
      }

      // Get recent matches
      const matches = await getMatches();
      // Filter matches where this player participated
      const userMatches = matches.filter(match => 
        match.player1 === account.address || match.player2 === account.address
      );
      // Take only the 5 most recent ones
      setRecentMatches(userMatches.slice(0, 5));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

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

      await loadUserData();
    }

    checkAuth();
  }, [account, router]);

  // Add effect to refresh data when component is focused
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleFocus = () => {
        if (account) {
          loadUserData();
        }
      };
      
      window.addEventListener('focus', handleFocus);
      return () => {
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [account]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // Calculate win percentage
  const winPercentage = playerStats?.total_games ? 
    Math.round((playerStats.wins / playerStats.total_games) * 100) : 0;

  const confirmDelete = (matchId: number) => {
    setMatchToDelete(matchId);
    setShowDeleteModal(true);
  };

  const cancelDelete = () => {
    setMatchToDelete(null);
    setShowDeleteModal(false);
  };

  const handleDeleteMatch = async () => {
    if (!matchToDelete) return;
    
    try {
      setDeleting(true);
      const success = await deleteMatch(matchToDelete);
      
      if (success) {
        // Close modal
        setShowDeleteModal(false);
        setMatchToDelete(null);
        
        // Refresh data to show updated matches and stats immediately
        await loadUserData();
        
        // Force a complete page refresh after a delay
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        console.error("Failed to delete match");
      }
    } catch (error) {
      console.error("Error deleting match:", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-[80vh]">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="fi-heading mb-2">DASHBOARD</h1>
          <div className="h-1 w-24 bg-[rgb(var(--accent-color))]"></div>
        </div>
        <button 
          onClick={loadUserData} 
          className="ea-button-secondary flex items-center"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="animate-spin inline-block h-4 w-4 border-b-2 border-white rounded-full mr-2"></span>
              Refreshing...
            </>
          ) : 'Refresh'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Player Profile Card */}
        <div className="fi-card p-6">
          <div className="text-center mb-6">
            <div className="w-24 h-24 mx-auto bg-[rgba(var(--accent-color),0.1)] rounded-full flex items-center justify-center mb-4 border-4 border-[rgba(var(--accent-color),0.2)]">
              <span className="text-3xl font-black">
                {displayName ? displayName.charAt(0).toUpperCase() : account?.address ? account.address.substring(0, 2) : "?"}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">
              {displayName || (account?.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : "Unknown Player")}
            </h2>
            <p className="text-white/60 mt-1 uppercase text-sm">FIFA Player</p>
            <button
              onClick={() => router.push("/profile")}
              className="mt-3 bg-white/5 hover:bg-white/10 text-white/90 px-4 py-2 rounded-sm text-xs uppercase tracking-wider transition-colors duration-200"
            >
              Edit Profile
            </button>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-black/20 mb-3">
            <span className="text-white/70 uppercase text-xs tracking-wider">Total Games</span>
            <span className="font-bold text-white">{playerStats?.total_games || 0}</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[rgba(0,200,83,0.1)] p-3 text-center">
              <div className="text-[rgb(0,200,83)] text-xs uppercase tracking-wider">Wins</div>
              <div className="font-bold text-xl text-white">{playerStats?.wins || 0}</div>
            </div>
            <div className="bg-[rgba(255,69,58,0.1)] p-3 text-center">
              <div className="text-[rgb(255,69,58)] text-xs uppercase tracking-wider">Losses</div>
              <div className="font-bold text-xl text-white">{playerStats?.losses || 0}</div>
            </div>
            <div className="bg-[rgba(255,214,10,0.1)] p-3 text-center">
              <div className="text-[rgb(255,214,10)] text-xs uppercase tracking-wider">Draws</div>
              <div className="font-bold text-xl text-white">{playerStats?.draws || 0}</div>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-white/70 uppercase text-xs tracking-wider">Win Rate</span>
              <span className="text-white">{winPercentage}%</span>
            </div>
            <div className="w-full bg-black/30 h-1.5">
              <div 
                className="bg-[rgb(var(--accent-color))] h-1.5" 
                style={{ width: `${winPercentage}%` }}
              ></div>
            </div>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-black/20 mb-3">
            <span className="text-white/70 uppercase text-xs tracking-wider">Goals Scored</span>
            <span className="font-bold text-white">{playerStats?.goals_for || 0}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-black/20">
            <span className="text-white/70 uppercase text-xs tracking-wider">Goals Conceded</span>
            <span className="font-bold text-white">{playerStats?.goals_against || 0}</span>
          </div>
        </div>
        
        {/* Recent Matches and Actions */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Actions */}
          <div className="fi-card p-6">
            <h2 className="text-xl font-bold mb-6 text-white uppercase tracking-wider flex items-center">
              <span className="h-5 w-1 bg-[rgb(var(--accent-color))] mr-3"></span>
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={() => router.push("/create-match")}
                className="ea-button"
              >
                New Match
              </button>
              
              <button 
                onClick={() => router.push("/matches")}
                className="ea-button-secondary"
              >
                History
              </button>
              
              <button 
                onClick={() => router.push("/profile")}
                className="ea-button-secondary"
              >
                Profile
              </button>
            </div>
            
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={() => router.push("/leaderboard")}
                className="ea-button-secondary"
              >
                Leaderboard
              </button>
            </div>
          </div>
          
          {/* Recent Matches */}
          <div className="fi-card p-6">
            <h2 className="text-xl font-bold mb-6 text-white uppercase tracking-wider flex items-center">
              <span className="h-5 w-1 bg-[rgb(var(--accent-color))] mr-3"></span>
              Recent Matches
            </h2>
            
            {recentMatches.length > 0 ? (
              <div className="space-y-3">
                {recentMatches.map((match) => {
                  const isPlayer1 = match.player1 === account?.address;
                  const playerScore = isPlayer1 ? match.player1_score : match.player2_score;
                  const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;
                  const opponentAddress = isPlayer1 ? match.player2 : match.player1;
                  
                  // Determine if it was a win, loss or draw
                  let resultClass = "bg-[rgba(255,214,10,0.2)] text-[rgb(255,214,10)]"; // draw
                  let resultText = "DRAW";
                  
                  if (playerScore > opponentScore) {
                    resultClass = "bg-[rgba(0,200,83,0.2)] text-[rgb(0,200,83)]";
                    resultText = "WIN";
                  } else if (playerScore < opponentScore) {
                    resultClass = "bg-[rgba(255,69,58,0.2)] text-[rgb(255,69,58)]";
                    resultText = "LOSS";
                  }
                  
                  return (
                    <div key={match.id} className="bg-black/20 border border-white/5 p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <div className={`px-2 py-1 rounded-sm ${resultClass} font-medium text-xs uppercase tracking-wider`}>
                            {resultText}
                          </div>
                          <span className="text-white text-lg font-bold">
                            {playerScore} - {opponentScore}
                          </span>
                        </div>
                        <div className="text-xs text-white/70 uppercase tracking-wider">
                          vs {opponentAddress.slice(0, 6)}...{opponentAddress.slice(-4)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-white/40">
                          {match.created_at ? new Date(match.created_at).toLocaleString() : 'Unknown date'}
                        </div>
                        {match.id && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDelete(match.id as number);
                            }}
                            className="text-xs text-red-500 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-black/20 border border-white/5">
                <p className="text-white/70 mb-6">No matches played yet.</p>
                <button 
                  onClick={() => router.push("/create-match")}
                  className="ea-button inline-block"
                >
                  Play First Match
                </button>
              </div>
            )}
            
            {recentMatches.length > 0 && (
              <div className="mt-4 text-center">
                <button 
                  onClick={() => router.push("/matches")}
                  className="text-white/70 hover:text-white uppercase text-sm tracking-wider transition-colors duration-200"
                >
                  View All Matches →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#171721] p-6 rounded-lg max-w-md w-full border border-white/10">
            <h3 className="text-xl font-bold mb-4 text-white">Delete Match</h3>
            <p className="text-white/80 mb-6">
              Are you sure you want to delete this match? This action cannot be undone and will adjust your player statistics accordingly.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="ea-button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMatch}
                disabled={deleting}
                className="px-4 py-2 rounded-sm bg-red-600 hover:bg-red-700 text-white font-bold transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 