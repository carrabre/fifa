"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { isLoggedIn } from "../connect-button/actions/auth";
import { getPlayerMatches, getUserByWallet, deleteMatch, Match } from "../../lib/supabase";
import Image from "next/image";

function PlayerMatchesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playerId = searchParams.get('playerId');
  const account = useActiveAccount();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerName, setPlayerName] = useState<string>('');
  const [stats, setStats] = useState({
    wins: 0,
    losses: 0,
    draws: 0,
    goalsFor: 0,
    goalsAgainst: 0
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  // Enhanced function to load player match data with force refresh option
  const loadPlayerMatchData = useCallback(async (forceRefresh = false) => {
    if (!playerId) return;
    
    try {
      setRefreshing(true);
      console.log(`[UI:PlayerMatches] Loading player match data for ${playerId} with forceRefresh=${forceRefresh}, timestamp=${Date.now()}`);
      
      // If forcing refresh, add a delay to ensure database is in sync
      if (forceRefresh) {
        console.log("[UI:PlayerMatches] Force refresh requested, adding delay");
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Get player name with cache busting timestamp
      const cacheBuster = Date.now();
      const userData = await getUserByWallet(playerId);
      if (userData) {
        setPlayerName(userData.display_name);
        console.log(`[UI:PlayerMatches] Set player name to ${userData.display_name}`);
      } else {
        setPlayerName(`${playerId.slice(0, 6)}...${playerId.slice(-4)}`);
        console.log(`[UI:PlayerMatches] Using abbreviated wallet as player name`);
      }
      
      // Get player matches
      const matchData = await getPlayerMatches(playerId);
      console.log(`[UI:PlayerMatches] Retrieved ${matchData.length} matches for player`);
      setMatches(matchData);
      
      // Calculate stats from matches
      let wins = 0, losses = 0, draws = 0, goalsFor = 0, goalsAgainst = 0;
      
      matchData.forEach(match => {
        const isPlayer1 = match.player1 === playerId;
        const playerScore = isPlayer1 ? match.player1_score : match.player2_score;
        const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;
        
        goalsFor += playerScore;
        goalsAgainst += opponentScore;
        
        if (playerScore > opponentScore) {
          wins++;
        } else if (playerScore < opponentScore) {
          losses++;
        } else {
          draws++;
        }
      });
      
      setStats({
        wins,
        losses,
        draws,
        goalsFor,
        goalsAgainst
      });
      
      console.log(`[UI:PlayerMatches] Updated player stats: W${wins}/L${losses}/D${draws}`);
      setLastRefreshTime(Date.now());
      
    } catch (error) {
      console.error(`[UI:PlayerMatches ERROR] Error fetching player matches:`, error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [playerId]);

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

      if (!playerId) {
        router.push("/leaderboard");
        return;
      }

      await loadPlayerMatchData(true); // Force refresh on initial load
    }

    checkAuth();
  }, [account, router, playerId, loadPlayerMatchData]);

  // Enhanced refresh on window focus or visibility change
  useEffect(() => {
    if (typeof window !== 'undefined' && playerId) {
      // Refresh when returning to tab
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && account) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          // Only refresh if it's been more than 30 seconds since last refresh
          if (timeSinceLastRefresh > 30000) {
            console.log('[UI:PlayerMatches] Tab became visible, refreshing data');
            loadPlayerMatchData(true);
          }
        }
      };
      
      // Refresh when window regains focus
      const handleFocus = () => {
        if (account) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          // Only refresh if it's been more than 30 seconds since last refresh
          if (timeSinceLastRefresh > 30000) {
            console.log('[UI:PlayerMatches] Window regained focus, refreshing data');
            loadPlayerMatchData(true);
          }
        }
      };
      
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Set interval to refresh data every 2 minutes if tab is active
      const intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && account) {
          console.log('[UI:PlayerMatches] Auto-refreshing data (2 minute interval)');
          loadPlayerMatchData();
        }
      }, 120000); // 2 minutes
      
      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(intervalId);
      };
    }
  }, [account, loadPlayerMatchData, playerId, lastRefreshTime]);

  // Manual refresh handler with force refresh
  const handleRefresh = () => {
    loadPlayerMatchData(true);
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
    
    console.log(`[UI:PlayerMatches] Starting match deletion for match ID: ${matchToDelete}`);
    
    try {
      setDeleting(true);
      console.log(`[UI:PlayerMatches] Calling API to delete match ${matchToDelete}`);
      
      const success = await deleteMatch(matchToDelete);
      
      console.log(`[UI:PlayerMatches] Delete API returned: success=${success}`);
      
      if (success) {
        // Close modal
        setShowDeleteModal(false);
        setMatchToDelete(null);
        
        // Filter out the deleted match from the current state immediately
        console.log(`[UI:PlayerMatches] Updating match list in React state`);
        setMatches(prevMatches => {
          const newMatches = prevMatches.filter(match => match.id !== matchToDelete);
          console.log(`[UI:PlayerMatches] Matches before: ${prevMatches.length}, after: ${newMatches.length}`);
          return newMatches;
        });
        
        // Recalculate stats immediately based on the updated matches
        console.log(`[UI:PlayerMatches] Recalculating stats after deletion`);
        setStats(prevStats => {
          // Find the deleted match in our current matches to adjust stats
          const deletedMatch = matches.find(match => match.id === matchToDelete);
          if (deletedMatch) {
            const isPlayer1 = deletedMatch.player1 === playerId;
            const playerScore = isPlayer1 ? deletedMatch.player1_score : deletedMatch.player2_score;
            const opponentScore = isPlayer1 ? deletedMatch.player2_score : deletedMatch.player1_score;
            
            // Determine which stat to decrement based on match result
            const updatedStats = { ...prevStats };
            updatedStats.goalsFor -= playerScore;
            updatedStats.goalsAgainst -= opponentScore;
            
            if (playerScore > opponentScore) {
              updatedStats.wins = Math.max(0, updatedStats.wins - 1);
            } else if (playerScore < opponentScore) {
              updatedStats.losses = Math.max(0, updatedStats.losses - 1);
            } else {
              updatedStats.draws = Math.max(0, updatedStats.draws - 1);
            }
            
            console.log(`[UI:PlayerMatches] Updated stats: W${updatedStats.wins}/L${updatedStats.losses}/D${updatedStats.draws}`);
            return updatedStats;
          }
          return prevStats;
        });
        
        // Refresh data to show updated matches and stats from server
        console.log(`[UI:PlayerMatches] Refreshing data after deletion`);
        await loadPlayerMatchData(true); // Force a refresh
        console.log(`[UI:PlayerMatches] Data refresh complete`);
      } else {
        console.error(`[UI:PlayerMatches ERROR] Failed to delete match ${matchToDelete}`);
        // Keep modal open to allow retry
      }
    } catch (error) {
      console.error(`[UI:PlayerMatches ERROR] Error deleting match ${matchToDelete}:`, error);
    } finally {
      setDeleting(false);
      console.log(`[UI:PlayerMatches] Match deletion process complete for ${matchToDelete}`);
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
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="fi-heading mb-2">
            {playerName ? playerName.toUpperCase() : 'PLAYER'} MATCHES
          </h1>
          <div className="h-1 w-24 bg-[rgb(var(--accent-color))]"></div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => router.push("/leaderboard")}
            className="ea-button-secondary flex items-center"
          >
            Back to Leaderboard
          </button>
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
      </div>

      {/* Player Statistics */}
      <div className="fi-card p-6 mb-8">
        <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center mb-6">
          <span className="h-5 w-1 bg-[rgb(var(--accent-color))] mr-3"></span>
          Player Statistics
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-[rgba(0,200,83,0.1)] p-4 text-center rounded-sm">
            <div className="text-[rgb(0,200,83)] text-xs uppercase tracking-wider mb-1">Wins</div>
            <div className="font-bold text-3xl text-white">{stats.wins}</div>
          </div>
          <div className="bg-[rgba(255,69,58,0.1)] p-4 text-center rounded-sm">
            <div className="text-[rgb(255,69,58)] text-xs uppercase tracking-wider mb-1">Losses</div>
            <div className="font-bold text-3xl text-white">{stats.losses}</div>
          </div>
          <div className="bg-[rgba(255,214,10,0.1)] p-4 text-center rounded-sm">
            <div className="text-[rgb(255,214,10)] text-xs uppercase tracking-wider mb-1">Draws</div>
            <div className="font-bold text-3xl text-white">{stats.draws}</div>
          </div>
          <div className="bg-black/20 p-4 text-center rounded-sm">
            <div className="text-white/70 text-xs uppercase tracking-wider mb-1">Goals Scored</div>
            <div className="font-bold text-3xl text-white">{stats.goalsFor}</div>
          </div>
          <div className="bg-black/20 p-4 text-center rounded-sm">
            <div className="text-white/70 text-xs uppercase tracking-wider mb-1">Goals Conceded</div>
            <div className="font-bold text-3xl text-white">{stats.goalsAgainst}</div>
          </div>
        </div>
      </div>

      {/* Match History */}
      <div className="fi-card p-6">
        <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center mb-6">
          <span className="h-5 w-1 bg-[rgb(var(--accent-color))] mr-3"></span>
          Match History
        </h2>
        
        {matches.length > 0 ? (
          <div className="space-y-4">
            {matches.map((match) => {
              const isPlayer1 = match.player1 === playerId;
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
                    <div className="text-xs text-white/70 uppercase tracking-wider">
                      vs {opponentAddress.slice(0, 6)}...{opponentAddress.slice(-4)}
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
                    {account?.address === playerId && match.id && (
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
            <p className="text-white/70 mb-2">No matches found for this player.</p>
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

export default function PlayerMatchesPage() {
  return (
    <Suspense>
      <PlayerMatchesContent />
    </Suspense>
  );
} 