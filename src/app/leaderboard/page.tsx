"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { isLoggedIn } from "../connect-button/actions/auth";
import { getLeaderboard, PlayerStats, getUserByWallet } from "../../lib/supabase";
import Image from "next/image";

// Force this route to be dynamic so that server actions (auth checks) are handled correctly at runtime.
export const dynamic = "force-dynamic";

type LeaderboardPlayer = PlayerStats & {
  displayName?: string;
};

export default function LeaderboardPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  // Enhanced function to load leaderboard data with force refresh
  const loadLeaderboardData = useCallback(async (forceRefresh = false) => {
    try {
      setRefreshing(true);
      console.log(`[UI:Leaderboard] Loading leaderboard data with forceRefresh=${forceRefresh}, timestamp=${Date.now()}`);
      
      // Add a delay if forcing refresh to ensure database is in sync
      if (forceRefresh) {
        console.log("[UI:Leaderboard] Force refresh requested, adding delay");
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Use a cache-busting timestamp parameter
      const cacheBuster = `cb_${Date.now()}`;
      const leaderboardData = await getLeaderboard();
      
      // Load display names for all players
      const playersWithNames = await Promise.all(
        leaderboardData.map(async (player) => {
          try {
            // Add a timestamp to force fresh data
            const userData = await getUserByWallet(player.user_id);
            return {
              ...player,
              displayName: userData?.display_name || `${player.user_id.slice(0, 6)}...${player.user_id.slice(-4)}`
            };
          } catch (error) {
            console.error(`Error fetching name for ${player.user_id}:`, error);
            return {
              ...player,
              displayName: `${player.user_id.slice(0, 6)}...${player.user_id.slice(-4)}`
            };
          }
        })
      );
      
      console.log(`[UI:Leaderboard] Retrieved ${playersWithNames.length} players for leaderboard`);
      setPlayers(playersWithNames);
      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error("[UI:Leaderboard ERROR] Error fetching leaderboard:", error);
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

      await loadLeaderboardData(true); // Force refresh on initial load
    }

    checkAuth();
  }, [account, router, loadLeaderboardData]);

  // Enhanced refresh on window focus or visibility change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Refresh when returning to tab
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && account) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          // Only refresh if it's been more than 30 seconds since last refresh
          if (timeSinceLastRefresh > 30000) {
            console.log('[UI:Leaderboard] Tab became visible, refreshing data');
            loadLeaderboardData(true);
          }
        }
      };
      
      // Refresh when window regains focus
      const handleFocus = () => {
        if (account) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          // Only refresh if it's been more than 30 seconds since last refresh
          if (timeSinceLastRefresh > 30000) {
            console.log('[UI:Leaderboard] Window regained focus, refreshing data');
            loadLeaderboardData(true);
          }
        }
      };
      
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Set interval to refresh data every 2 minutes if tab is active
      const intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && account) {
          console.log('[UI:Leaderboard] Auto-refreshing data (2 minute interval)');
          loadLeaderboardData();
        }
      }, 120000); // 2 minutes
      
      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(intervalId);
      };
    }
  }, [account, loadLeaderboardData, lastRefreshTime]);

  // Manual refresh handler
  const handleRefresh = () => {
    loadLeaderboardData(true); // Force refresh
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // Calculate rank for the current user
  const currentUserRank = players.findIndex(player => player.user_id === account?.address) + 1;

  return (
    <div className="min-h-[80vh]">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="fi-heading mb-2">LEADERBOARD</h1>
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

      {/* Top 3 Players Podium */}
      {players.length >= 3 && (
        <div className="flex justify-center items-end mb-12 pb-8 px-4 max-w-3xl mx-auto">
          {/* 2nd Place */}
          <div className="flex flex-col items-center mx-2">
            <div className="w-16 h-16 bg-[rgba(255,255,255,0.1)] rounded-full flex items-center justify-center mb-2 border-2 border-[rgba(255,255,255,0.3)]">
              <span className="text-2xl font-bold text-white">2</span>
            </div>
            <div className="text-center">
              <div className="bg-black/20 border border-white/10 h-28 w-24 flex items-center justify-center px-2">
                <span className="text-xs text-white overflow-hidden overflow-ellipsis font-medium uppercase">
                  {players[1]?.displayName}
                </span>
              </div>
            </div>
            <div className="bg-black/20 border border-white/10 px-2 py-1 text-white/80 text-sm uppercase tracking-wider">
              {players[1]?.wins || 0} W
            </div>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center mx-2 -mb-6 z-10">
            <div className="relative mb-2">
              <div className="w-20 h-20 bg-[rgb(var(--accent-color))] rounded-full flex items-center justify-center border-2 border-[rgba(255,255,255,0.5)]">
                <span className="text-3xl font-black text-white">1</span>
              </div>
              <Image 
                src="/crown.png" 
                alt="Crown" 
                width={40} 
                height={40} 
                className="absolute -top-5 left-1/2 transform -translate-x-1/2" 
              />
            </div>
            <div className="text-center">
              <div className="bg-[rgba(var(--accent-color),0.2)] border border-[rgba(var(--accent-color),0.3)] h-36 w-28 flex items-center justify-center px-2">
                <span className="text-sm text-white font-bold overflow-hidden overflow-ellipsis uppercase">
                  {players[0]?.displayName}
                </span>
              </div>
            </div>
            <div className="bg-black/20 border border-[rgba(var(--accent-color),0.3)] px-3 py-1 text-[rgb(var(--accent-color))] text-sm font-bold uppercase tracking-wider">
              {players[0]?.wins || 0} W
            </div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center mx-2">
            <div className="w-16 h-16 bg-[rgba(255,214,10,0.2)] rounded-full flex items-center justify-center mb-2 border-2 border-[rgba(255,214,10,0.3)]">
              <span className="text-2xl font-bold text-white">3</span>
            </div>
            <div className="text-center">
              <div className="bg-black/20 border border-white/10 h-24 w-24 flex items-center justify-center px-2">
                <span className="text-xs text-white overflow-hidden overflow-ellipsis font-medium uppercase">
                  {players[2]?.displayName}
                </span>
              </div>
            </div>
            <div className="bg-black/20 border border-white/10 px-2 py-1 text-white/80 text-sm uppercase tracking-wider">
              {players[2]?.wins || 0} W
            </div>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="fi-card p-6 overflow-x-auto">
        <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center mb-6">
          <span className="h-5 w-1 bg-[rgb(var(--accent-color))] mr-3"></span>
          Rankings
        </h2>
        
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-white/10">
              <th className="py-2 px-4 text-white/70 uppercase text-xs tracking-wider">Rank</th>
              <th className="py-2 px-4 text-white/70 uppercase text-xs tracking-wider">Player</th>
              <th className="py-2 px-4 text-center text-white/70 uppercase text-xs tracking-wider">Wins</th>
              <th className="py-2 px-4 text-center text-white/70 uppercase text-xs tracking-wider">Losses</th>
              <th className="py-2 px-4 text-center text-white/70 uppercase text-xs tracking-wider">Draws</th>
              <th className="py-2 px-4 text-center text-white/70 uppercase text-xs tracking-wider">Win %</th>
              <th className="py-2 px-4 text-center text-white/70 uppercase text-xs tracking-wider">Goals For</th>
              <th className="py-2 px-4 text-center text-white/70 uppercase text-xs tracking-wider">Goals Against</th>
              <th className="py-2 px-4 text-center text-white/70 uppercase text-xs tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.length > 0 ? (
              players.map((player, index) => {
                const isCurrentUser = player.user_id === account?.address;
                const winPercentage = player.total_games 
                  ? Math.round((player.wins / player.total_games) * 100) 
                  : 0;
                
                return (
                  <tr 
                    key={player.user_id} 
                    className={`border-b border-white/5 ${isCurrentUser ? 'bg-[rgba(var(--accent-color),0.05)]' : ''} hover:bg-black/30 cursor-pointer transition-colors duration-200`}
                    onClick={() => router.push(`/player-matches?playerId=${player.user_id}`)}
                  >
                    <td className="py-3 px-4">
                      {index === 0 ? (
                        <span className="flex items-center">
                          <span className="text-[rgb(var(--accent-color))] mr-1">★</span> 1
                        </span>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-[rgba(var(--accent-color),0.1)] flex items-center justify-center mr-2 border border-[rgba(var(--accent-color),0.2)]">
                          <span className="text-xs font-medium">{player.displayName?.charAt(0).toUpperCase() || player.user_id.substring(0, 2)}</span>
                        </div>
                        <span className={`${isCurrentUser ? "font-bold" : ""} uppercase text-sm tracking-wider`}>
                          {player.displayName}
                          {isCurrentUser && <span className="ml-2 text-xs bg-[rgba(var(--accent-color),0.2)] border border-[rgba(var(--accent-color),0.3)] px-2 py-0.5 rounded-sm uppercase text-[rgb(var(--accent-color))]">You</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-[rgb(0,200,83)]">{player.wins}</td>
                    <td className="py-3 px-4 text-center text-[rgb(255,69,58)]">{player.losses}</td>
                    <td className="py-3 px-4 text-center text-[rgb(255,214,10)]">{player.draws}</td>
                    <td className="py-3 px-4 text-center">{winPercentage}%</td>
                    <td className="py-3 px-4 text-center">{player.goals_for}</td>
                    <td className="py-3 px-4 text-center">{player.goals_against}</td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/player-matches?playerId=${player.user_id}`);
                        }}
                        className="ea-button-secondary bg-[rgba(var(--accent-color),0.1)] hover:bg-[rgba(var(--accent-color),0.2)] text-xs px-3 py-1"
                      >
                        View Matches
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-6 text-center text-white/60">
                  No players found on the leaderboard yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Your Rank */}
      {currentUserRank > 0 && (
        <div className="mt-6 fi-card p-4 text-center">
          <p className="text-white/70 uppercase text-sm tracking-wider">
            Your current rank: <span className="font-bold text-white">{currentUserRank}</span> 
            {currentUserRank === 1 
              ? ' - Congratulations! You are the top player!' 
              : ` - Play more to climb ${currentUserRank - 1} more position${currentUserRank - 1 > 1 ? 's' : ''}!`
            }
          </p>
        </div>
      )}
    </div>
  );
} 