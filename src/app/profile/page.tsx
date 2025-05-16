"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getCurrentAddress, isLoggedIn, updateUserDisplayName } from "../connect-button/actions/auth";
import { getUserByWallet, getPlayerStats } from "../../lib/supabase";
import Image from "next/image";

export default function ProfilePage() {
  const router = useRouter();
  const account = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  const loadProfileData = useCallback(async (forceRefresh = false) => {
    try {
      setRefreshing(true);
      console.log(`[UI:Profile] Loading profile data with forceRefresh=${forceRefresh}, timestamp=${Date.now()}`);
      
      // If forcing refresh, add a delay to ensure database is in sync
      if (forceRefresh) {
        console.log("[UI:Profile] Force refresh requested, adding delay");
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Get current address
      const address = await getCurrentAddress();
      setCurrentAddress(address);

      if (address) {
        // Load user profile with cache busting
        const cacheBuster = Date.now();
        const userData = await getUserByWallet(address);
        if (userData) {
          setDisplayName(userData.display_name);
          console.log(`[UI:Profile] Set display name to ${userData.display_name}`);
        }
        
        // Get player stats with force refresh to ensure we have latest data
        const playerStats = await getPlayerStats(address);
        setStats(playerStats);
        console.log(`[UI:Profile] Updated player stats: W${playerStats.wins}/L${playerStats.losses}/D${playerStats.draws}`);
      }

      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error("[UI:Profile ERROR] Error loading profile:", error);
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

      await loadProfileData(true); // Force refresh on initial load
    }

    checkAuth();
  }, [account, router, loadProfileData]);

  // Enhanced refresh on window focus or visibility change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Refresh when returning to tab
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && account) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          // Only refresh if it's been more than 30 seconds since last refresh
          if (timeSinceLastRefresh > 30000) {
            console.log('[UI:Profile] Tab became visible, refreshing data');
            loadProfileData(true);
          }
        }
      };
      
      // Refresh when window regains focus
      const handleFocus = () => {
        if (account) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          // Only refresh if it's been more than 30 seconds since last refresh
          if (timeSinceLastRefresh > 30000) {
            console.log('[UI:Profile] Window regained focus, refreshing data');
            loadProfileData(true);
          }
        }
      };
      
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Set interval to refresh data every 2 minutes if tab is active
      const intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && account) {
          console.log('[UI:Profile] Auto-refreshing data (2 minute interval)');
          loadProfileData();
        }
      }, 120000); // 2 minutes
      
      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(intervalId);
      };
    }
  }, [account, loadProfileData, lastRefreshTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSubmitting(true);

    if (!displayName) {
      setError("Display name cannot be empty");
      setSubmitting(false);
      return;
    }

    try {
      const updated = await updateUserDisplayName(displayName);
      if (updated) {
        setSuccess(true);
        // Refresh data to show updated info
        await loadProfileData(true);
      } else {
        setError("Failed to update display name");
      }
    } catch (err) {
      console.error("Error updating display name:", err);
      setError("An error occurred while updating display name");
    } finally {
      setSubmitting(false);
    }
  };

  // Manual refresh handler
  const handleRefresh = () => {
    loadProfileData(true); // Force refresh
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
          <h1 className="fi-heading mb-2">PROFILE</h1>
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
    
      <div className="max-w-lg mx-auto">
        <div className="fi-card p-8">
          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto bg-[rgba(var(--accent-color),0.1)] rounded-full flex items-center justify-center mb-4 border-4 border-[rgba(var(--accent-color),0.2)]">
              <span className="text-3xl font-black">
                {displayName ? displayName.charAt(0).toUpperCase() : currentAddress ? currentAddress.substring(0, 2) : "?"}
              </span>
            </div>
            <div className="text-white/60 uppercase text-xs tracking-wider mb-1">WALLET ADDRESS</div>
            <p className="text-white text-sm overflow-hidden text-ellipsis font-mono">
              {currentAddress}
            </p>
          </div>

          {error && (
            <div className="bg-[rgba(255,69,58,0.1)] border border-[rgba(255,69,58,0.3)] text-[rgb(255,69,58)] p-3 mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-[rgba(0,200,83,0.1)] border border-[rgba(0,200,83,0.3)] text-[rgb(0,200,83)] p-3 mb-6">
              Display name updated successfully!
            </div>
          )}

          <form onSubmit={handleSubmit} className="mb-10">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center mb-6">
              <span className="h-5 w-1 bg-[rgb(var(--accent-color))] mr-3"></span>
              Profile Settings
            </h2>
            
            <div className="mb-6">
              <label className="block text-white/70 uppercase text-xs tracking-wider mb-2" htmlFor="displayName">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="input"
              />
              <p className="text-white/50 text-xs mt-2 uppercase">
                This name will be displayed to other players
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`ea-button w-full ${
                submitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {submitting ? "Updating..." : "Update Profile"}
            </button>
          </form>

          {stats && (
            <div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center mb-6">
                <span className="h-5 w-1 bg-[rgb(var(--accent-color))] mr-3"></span>
                Player Stats
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/20 p-4 border border-white/5">
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-1 flex items-center justify-center">
                    <Image src="/trophy.png" alt="Wins" width={16} height={16} className="mr-1" />
                    Wins
                  </p>
                  <p className="text-3xl font-black text-[rgb(0,200,83)]">{stats.wins}</p>
                </div>
                <div className="bg-black/20 p-4 border border-white/5">
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-1 flex items-center justify-center">
                    <Image src="/defeat.png" alt="Losses" width={16} height={16} className="mr-1" />
                    Losses
                  </p>
                  <p className="text-3xl font-black text-[rgb(255,69,58)]">{stats.losses}</p>
                </div>
                <div className="bg-black/20 p-4 border border-white/5">
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-1 flex items-center justify-center">
                    <Image src="/handshake.png" alt="Draws" width={16} height={16} className="mr-1" />
                    Draws
                  </p>
                  <p className="text-3xl font-black text-[rgb(255,214,10)]">{stats.draws}</p>
                </div>
                <div className="bg-black/20 p-4 border border-white/5">
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-1 flex items-center justify-center">
                    <Image src="/coin.png" alt="Total Games" width={16} height={16} className="mr-1" />
                    Total Games
                  </p>
                  <p className="text-3xl font-black text-white">{stats.total_games}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-black/20 p-4 border border-white/5">
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-1 flex items-center justify-center">
                    <Image src="/coin.png" alt="Goals Scored" width={16} height={16} className="mr-1" />
                    Goals Scored
                  </p>
                  <p className="text-3xl font-black text-white">{stats.goals_for}</p>
                </div>
                <div className="bg-black/20 p-4 border border-white/5">
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-1 flex items-center justify-center">
                    <Image src="/coin.png" alt="Goals Conceded" width={16} height={16} className="mr-1" />
                    Goals Conceded
                  </p>
                  <p className="text-3xl font-black text-white">{stats.goals_against}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="ea-button-secondary"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => router.push("/create-match")}
              className="ea-button"
            >
              New Match
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 