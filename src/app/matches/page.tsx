"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { isLoggedIn } from "../connect-button/actions/auth";
import { getMatches, deleteMatch, Match } from "../../lib/supabase";
import Image from "next/image";

export default function MatchesPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses' | 'draws'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  // Enhanced function to load matches with force refresh
  const loadMatches = useCallback(async (forceRefresh = false) => {
    try {
      setRefreshing(true);
      console.log(`[UI:Matches] Loading match data with forceRefresh=${forceRefresh}, timestamp=${Date.now()}`);
      
      // If forcing refresh, add a delay to ensure database is in sync
      if (forceRefresh) {
        console.log("[UI:Matches] Force refresh requested, adding delay");
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const matchData = await getMatches();
      console.log(`[UI:Matches] Retrieved ${matchData.length} matches`);
      setMatches(matchData);
      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error("[UI:Matches ERROR] Error fetching matches:", error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

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

      await loadMatches(true); // Force refresh on initial load
    }

    checkAuth();
  }, [account, router, loadMatches]);

  // Enhanced refresh on window focus or visibility change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Refresh when returning to tab
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && account) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          // Only refresh if it's been more than 30 seconds since last refresh
          if (timeSinceLastRefresh > 30000) {
            console.log('[UI:Matches] Tab became visible, refreshing data');
            loadMatches(true);
          }
        }
      };
      
      // Refresh when window regains focus
      const handleFocus = () => {
        if (account) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          // Only refresh if it's been more than 30 seconds since last refresh
          if (timeSinceLastRefresh > 30000) {
            console.log('[UI:Matches] Window regained focus, refreshing data');
            loadMatches(true);
          }
        }
      };
      
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Set interval to refresh data every 2 minutes if tab is active
      const intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && account) {
          console.log('[UI:Matches] Auto-refreshing data (2 minute interval)');
          loadMatches();
        }
      }, 120000); // 2 minutes
      
      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(intervalId);
      };
    }
  }, [account, loadMatches, lastRefreshTime]);

  // Filter handlers
  const handleFilterChange = (newFilter: 'all' | 'wins' | 'losses' | 'draws') => {
    setFilter(newFilter);
  };

  // Manual refresh handler
  const handleRefresh = () => {
    loadMatches(true); // Force refresh
  };

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
    
    console.log(`[UI:Matches] Starting match deletion for match ID: ${matchToDelete}`);
    
    try {
      setDeleting(true);
      console.log(`[UI:Matches] Calling API to delete match ${matchToDelete}`);
      
      const success = await deleteMatch(matchToDelete);
      
      console.log(`[UI:Matches] Delete API returned: success=${success}`);
      
      if (success) {
        // Close modal
        setShowDeleteModal(false);
        setMatchToDelete(null);
        
        // Filter out the deleted match from the current state immediately
        console.log(`[UI:Matches] Updating match list in React state`);
        setMatches(prevMatches => {
          const newMatches = prevMatches.filter(match => match.id !== matchToDelete);
          console.log(`[UI:Matches] Matches before: ${prevMatches.length}, after: ${newMatches.length}`);
          return newMatches;
        });
        
        // Refresh data to show updated matches
        console.log(`[UI:Matches] Refreshing data after deletion`);
        await loadMatches(true); // Force a refresh
        console.log(`[UI:Matches] Data refresh complete`);
      } else {
        console.error(`[UI:Matches ERROR] Failed to delete match ${matchToDelete}`);
      }
    } catch (error) {
      console.error(`[UI:Matches ERROR] Error deleting match ${matchToDelete}:`, error);
    } finally {
      setDeleting(false);
      console.log(`[UI:Matches] Match deletion process complete for ${matchToDelete}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // Filter matches based on current filter
  const filteredMatches = matches.filter(match => {
    if (filter === 'all') return true;
    
    const isPlayer1 = match.player1 === account?.address;
    const playerScore = isPlayer1 ? match.player1_score : match.player2_score;
    const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;
    
    if (filter === 'wins') return playerScore > opponentScore;
    if (filter === 'losses') return playerScore < opponentScore;
    if (filter === 'draws') return playerScore === opponentScore;
    
    return true;
  });

  return (
    <div className="min-h-[80vh]">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="fi-heading mb-2">MATCH HISTORY</h1>
          <div className="h-1 w-24 bg-[rgb(var(--accent-color))]"></div>
        </div>
        <button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="ea-button-secondary flex items-center"
        >
          {refreshing ? (
            <>
              <span className="animate-spin inline-block h-4 w-4 border-b-2 border-white rounded-full mr-2"></span>
              Refreshing...
            </>
          ) : 'Refresh'}
        </button>
      </div>
      
      {/* Filter Tabs */}
      <div className="fi-card mb-6">
        <div className="flex">
          <button 
            className={`flex-1 p-4 text-xs uppercase font-bold tracking-wider ${filter === 'all' ? 'bg-[rgba(var(--accent-color),0.1)] text-white border-b-2 border-[rgb(var(--accent-color))]' : 'text-white/60 hover:bg-black/20'}`}
            onClick={() => handleFilterChange('all')}
          >
            All Matches
          </button>
          <button 
            className={`flex-1 p-4 text-xs uppercase font-bold tracking-wider ${filter === 'wins' ? 'bg-[rgba(0,200,83,0.1)] text-[rgb(0,200,83)] border-b-2 border-[rgb(0,200,83)]' : 'text-white/60 hover:bg-black/20'}`}
            onClick={() => handleFilterChange('wins')}
          >
            <div className="flex items-center justify-center">
              <Image src="/trophy.png" alt="Wins" width={16} height={16} className="mr-1" />
              Wins
            </div>
          </button>
          <button 
            className={`flex-1 p-4 text-xs uppercase font-bold tracking-wider ${filter === 'losses' ? 'bg-[rgba(255,69,58,0.1)] text-[rgb(255,69,58)] border-b-2 border-[rgb(255,69,58)]' : 'text-white/60 hover:bg-black/20'}`}
            onClick={() => handleFilterChange('losses')}
          >
            <div className="flex items-center justify-center">
              <Image src="/defeat.png" alt="Losses" width={16} height={16} className="mr-1" />
              Losses
            </div>
          </button>
          <button 
            className={`flex-1 p-4 text-xs uppercase font-bold tracking-wider ${filter === 'draws' ? 'bg-[rgba(255,214,10,0.1)] text-[rgb(255,214,10)] border-b-2 border-[rgb(255,214,10)]' : 'text-white/60 hover:bg-black/20'}`}
            onClick={() => handleFilterChange('draws')}
          >
            <div className="flex items-center justify-center">
              <Image src="/handshake.png" alt="Draws" width={16} height={16} className="mr-1" />
              Draws
            </div>
          </button>
        </div>
      </div>

      {/* Match List */}
      <div className="fi-card p-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center mb-6">
          <span className="h-5 w-1 bg-[rgb(var(--accent-color))] mr-3"></span>
          {filter === 'all' ? 'All Matches' : 
           filter === 'wins' ? 'Wins' : 
           filter === 'losses' ? 'Losses' : 'Draws'} ({filteredMatches.length})
        </h2>

        {filteredMatches.length > 0 ? (
          <div className="space-y-4">
            {filteredMatches.map((match) => {
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
              
              const playerTeam = isPlayer1 ? match.player1_team : match.player2_team;
              const opponentTeam = isPlayer1 ? match.player2_team : match.player1_team;
              
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
                    <div className="flex items-center">
                      <div className="text-xs text-white/70 uppercase tracking-wider">
                        vs {opponentAddress.slice(0, 6)}...{opponentAddress.slice(-4)}
                      </div>
                      <button 
                        onClick={() => router.push(`/player-matches?playerId=${opponentAddress}`)}
                        className="ml-2 text-xs bg-[rgba(var(--accent-color),0.1)] hover:bg-[rgba(var(--accent-color),0.2)] text-white/90 px-2 py-1 rounded-sm uppercase tracking-wider transition-colors"
                      >
                        Profile
                      </button>
                    </div>
                  </div>
                  {(playerTeam || opponentTeam) && (
                    <div className="mt-2 text-xs text-blue-300 italic">
                      {playerTeam || "Your team"} vs {opponentTeam || "Opponent team"}
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-xs text-white/40">
                      {match.created_at ? new Date(match.created_at).toLocaleString() : 'Unknown date'}
                    </div>
                    {match.id && (
                      <button 
                        onClick={() => confirmDelete(match.id as number)}
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
            <p className="text-white/70 mb-2">No matches found for this filter.</p>
          </div>
        )}
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