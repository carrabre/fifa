"use client";
import { useEffect, useState, useCallback } from "react";
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
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  const loadUserData = useCallback(async (forceRefresh = false) => {
    if (!account) {
      return;
    }
    
    try {
      setRefreshing(true);
      console.log(`[UI:Dashboard] Loading user data with forceRefresh=${forceRefresh}, timestamp=${Date.now()}`);
      
      // If forcing refresh, add a delay to ensure database is in sync
      if (forceRefresh) {
        console.log("[UI:Dashboard] Force refresh requested, adding delay");
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Setup Supabase tables if they don't exist
      await setupSupabaseTables();
      
      // Always fetch fresh user profile data with cache busting
      const cacheBuster = Date.now();
      const userProfile = await getUserByWallet(account.address);
      console.log('[UI:Dashboard] User profile retrieved:', userProfile);
      
      if (userProfile) {
        setDisplayName(userProfile.display_name);
        console.log('[UI:Dashboard] Setting display name to:', userProfile.display_name);
      } else {
        // Reset display name if no profile found
        setDisplayName(null);
      }
      
      // Get player stats with force refresh
      const stats = await getPlayerStats(account.address);
      setPlayerStats(stats);

      // If stats show 0 total games, create an initial player_stats record
      if (stats.total_games === 0) {
        console.log("[UI:Dashboard] Initializing player stats in database...");
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
          console.error("[UI:Dashboard ERROR] Error initializing player stats:", error);
        }
      }

      // Get recent matches with cache busting
      console.log("[UI:Dashboard] Fetching recent matches");
      const matches = await getMatches();
      console.log(`[UI:Dashboard] Got ${matches.length} total matches`);
      
      // Filter matches where this player participated
      const userMatches = matches.filter(match => 
        match.player1 === account.address || match.player2 === account.address
      );
      console.log(`[UI:Dashboard] Filtered to ${userMatches.length} user matches`);
      
      // Take only the 5 most recent ones
      setRecentMatches(userMatches.slice(0, 5));
      console.log(`[UI:Dashboard] Set ${Math.min(userMatches.length, 5)} recent matches`);
      
      // Update the last refresh timestamp
      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error("[UI:Dashboard ERROR] Error fetching data:", error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [account]);

  // Initial load and auth check
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

      await loadUserData(true); // Force refresh on initial load
    }

    checkAuth();
  }, [account, router, loadUserData]);

  // Enhanced refresh on window focus or visibility change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Refresh when returning to tab
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && account) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          // Only refresh if it's been more than 30 seconds since last refresh
          if (timeSinceLastRefresh > 30000) {
            console.log('[UI:Dashboard] Tab became visible, refreshing data');
            loadUserData(true);
          }
        }
      };
      
      // Refresh when window regains focus
      const handleFocus = () => {
        if (account) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          // Only refresh if it's been more than 30 seconds since last refresh
          if (timeSinceLastRefresh > 30000) {
            console.log('[UI:Dashboard] Window regained focus, refreshing data');
            loadUserData(true);
          }
        }
      };
      
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Set interval to refresh data every 2 minutes if tab is active
      const intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && account) {
          console.log('[UI:Dashboard] Auto-refreshing data (2 minute interval)');
          loadUserData();
        }
      }, 120000); // 2 minutes
      
      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(intervalId);
      };
    }
  }, [account, loadUserData, lastRefreshTime]);

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
    
    console.log(`[UI:Dashboard] Starting match deletion for match ID: ${matchToDelete}`);
    
    try {
      setDeleting(true);
      console.log(`[UI:Dashboard] Calling API to delete match ${matchToDelete}`);
      
      const success = await deleteMatch(matchToDelete);
      
      console.log(`[UI:Dashboard] Delete API returned: success=${success}`);
      
      if (success) {
        // Close modal
        setShowDeleteModal(false);
        setMatchToDelete(null);
        
        // Filter out the deleted match from the current state immediately
        console.log(`[UI:Dashboard] Updating match list in React state`);
        setRecentMatches(prevMatches => {
          const newMatches = prevMatches.filter(match => match.id !== matchToDelete);
          console.log(`[UI:Dashboard] Matches before: ${prevMatches.length}, after: ${newMatches.length}`);
          return newMatches;
        });
        
        // Refresh data to show updated matches and stats
        console.log(`[UI:Dashboard] Refreshing data after deletion`);
        await loadUserData(true); // Force a refresh
        console.log(`[UI:Dashboard] Data refresh complete`);
      } else {
        console.error(`[UI:Dashboard ERROR] Failed to delete match ${matchToDelete}`);
      }
    } catch (error) {
      console.error(`[UI:Dashboard ERROR] Error deleting match ${matchToDelete}:`, error);
    } finally {
      setDeleting(false);
      console.log(`[UI:Dashboard] Match deletion process complete for ${matchToDelete}`);
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
          onClick={() => loadUserData(true)} 
          className="ea-button-secondary flex items-center"
          disabled={refreshing}
        >
          {refreshing ? (
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
            <div className="flex justify-center space-x-2 mt-3">
              <button
                onClick={() => router.push("/profile")}
                className="bg-white/5 hover:bg-white/10 text-white/90 px-4 py-2 rounded-sm text-xs uppercase tracking-wider transition-colors duration-200"
              >
                Edit Profile
              </button>
              <button
                onClick={() => router.push("/player-matches?playerId=" + account?.address)}
                className="bg-white/5 hover:bg-white/10 text-white/90 px-4 py-2 rounded-sm text-xs uppercase tracking-wider transition-colors duration-200"
              >
                View Matches
              </button>
            </div>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-black/20 mb-3">
            <span className="text-white/70 uppercase text-xs tracking-wider">Total Games</span>
            <span className="font-bold text-white">{playerStats?.total_games || 0}</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[rgba(0,200,83,0.1)] p-3 text-center">
              <div className="text-[rgb(0,200,83)] text-xs uppercase tracking-wider flex items-center justify-center">
                <Image src="/trophy.png" alt="Wins" width={16} height={16} className="mr-1" />
                Wins
              </div>
              <div className="font-bold text-xl text-white">{playerStats?.wins || 0}</div>
            </div>
            <div className="bg-[rgba(255,69,58,0.1)] p-3 text-center">
              <div className="text-[rgb(255,69,58)] text-xs uppercase tracking-wider flex items-center justify-center">
                <Image src="/defeat.png" alt="Losses" width={16} height={16} className="mr-1" />
                Losses
              </div>
              <div className="font-bold text-xl text-white">{playerStats?.losses || 0}</div>
            </div>
            <div className="bg-[rgba(255,214,10,0.1)] p-3 text-center">
              <div className="text-[rgb(255,214,10)] text-xs uppercase tracking-wider flex items-center justify-center">
                <Image src="/handshake.png" alt="Draws" width={16} height={16} className="mr-1" />
                Draws
              </div>
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
                className="ea-button flex items-center justify-center"
              >
                <Image src="/fifa-logo.png" alt="FIFA" width={20} height={20} className="mr-2" />
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
                className="ea-button-secondary flex items-center justify-center"
              >
                <Image src="/crown.png" alt="Crown" width={16} height={16} className="mr-2" />
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
                  let resultIcon = "/handshake.png";
                  
                  if (playerScore > opponentScore) {
                    resultClass = "bg-[rgba(0,200,83,0.2)] text-[rgb(0,200,83)]";
                    resultText = "WIN";
                    resultIcon = "/trophy.png";
                  } else if (playerScore < opponentScore) {
                    resultClass = "bg-[rgba(255,69,58,0.2)] text-[rgb(255,69,58)]";
                    resultText = "LOSS";
                    resultIcon = "/defeat.png";
                  }
                  
                  return (
                    <div key={match.id} className="bg-black/20 border border-white/5 p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <div className={`px-2 py-1 rounded-sm ${resultClass} font-medium text-xs uppercase tracking-wider flex items-center`}>
                            <Image 
                              src={resultIcon} 
                              alt={resultText}
                              width={16}
                              height={16}
                              className="mr-1"
                            />
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