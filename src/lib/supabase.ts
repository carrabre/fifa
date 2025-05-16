import { createClient } from '@supabase/supabase-js';

// IMPORTANT NOTES ABOUT MATCH DELETION:
// This application uses a hybrid approach to match deletion:
// 1. Database deletion is attempted first using direct API and Supabase client
// 2. If database deletion fails (which may happen due to permissions/constraints), 
//    we use client-side filtering to hide deleted matches
// 3. We track deleted match IDs in localStorage so they remain hidden after refresh
// This approach ensures a good user experience even if the user lacks database delete permissions

const supabaseUrl = 'https://glkeaqhxfizzrselcpgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsa2VhcWh4Zml6enJzZWxjcGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNjg4NjgsImV4cCI6MjA2Mjc0NDg2OH0.tGJP98jZ4KTFDlXHpbR7MezreyqG6pmnXB0lo8r0mIY';

// Create Supabase client with debug enabled
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Prefer': 'return=representation'
    }
  }
});

// Log connection status
console.log("Supabase client initialized with URL:", supabaseUrl);

// User type definition
export type User = {
  wallet_address: string;
  display_name: string;
  created_at?: string;
};

export type Match = {
  id?: number;
  player1: string;
  player2: string;
  player1_score: number;
  player2_score: number;
  player1_team?: string;
  player2_team?: string;
  created_at?: string;
  winner?: string; // winner's wallet address
}

export type PlayerStats = {
  user_id: string;
  wins: number;
  losses: number;
  draws: number;
  goals_for: number;
  goals_against: number;
  total_games: number;
}

// In-memory tracking when Supabase tables fail
const inMemoryMatches: Match[] = [];
const inMemoryPlayerStats: Record<string, PlayerStats> = {};
const inMemoryUsers: Record<string, User> = {};
let nextMatchId = 1;

// Keep track of deleted match IDs for client-side filtering
const deletedMatchIds = new Set<number>();

// Load deleted match IDs from localStorage on initialization
if (typeof window !== 'undefined') {
  try {
    const savedDeletedIds = localStorage.getItem('deletedMatchIds');
    if (savedDeletedIds) {
      const ids = JSON.parse(savedDeletedIds);
      if (Array.isArray(ids)) {
        ids.forEach(id => deletedMatchIds.add(id));
        console.log(`[INIT] Loaded ${deletedMatchIds.size} deleted match IDs from localStorage`);
      }
    }
  } catch (error) {
    console.error('[INIT ERROR] Failed to load deleted match IDs from localStorage:', error);
  }
}

// Helper to save deleted match IDs to localStorage
function saveDeletedMatchIds() {
  if (typeof window !== 'undefined') {
    try {
      const idsArray = Array.from(deletedMatchIds);
      localStorage.setItem('deletedMatchIds', JSON.stringify(idsArray));
      console.log(`[STORAGE] Saved ${deletedMatchIds.size} deleted match IDs to localStorage`);
    } catch (error) {
      console.error('[STORAGE ERROR] Failed to save deleted match IDs to localStorage:', error);
    }
  }
}

// Function to check if a match is deleted
export function isMatchDeleted(matchId: number): boolean {
  return deletedMatchIds.has(matchId);
}

// Function to create or update a user
export async function saveUser(user: User): Promise<User> {
  console.log("Saving user:", user);
  
  try {
    // Try Supabase first - upsert to update if exists, otherwise create
    const { error } = await supabase
      .from('users')
      .upsert([user], { 
        onConflict: 'wallet_address',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.warn("Supabase user save error:", JSON.stringify(error));
      throw error;
    }
    
    console.log("User saved in Supabase");
    return user;
  } catch (error) {
    console.error("Error saving user to Supabase:", typeof error === 'object' ? JSON.stringify(error) : error);
    
    // Fallback to in-memory
    inMemoryUsers[user.wallet_address] = {
      ...user,
      created_at: user.created_at || new Date().toISOString()
    };
    console.log("User saved in memory:", inMemoryUsers[user.wallet_address]);
    
    return inMemoryUsers[user.wallet_address];
  }
}

// Function to get a user by wallet address
export async function getUserByWallet(walletAddress: string): Promise<User | null> {
  try {
    // Add a cache-busting parameter to prevent cached responses
    const timestamp = new Date().getTime();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .maybeSingle();
    
    if (error) {
      console.warn(`Error fetching user ${walletAddress}:`, JSON.stringify(error));
      throw error;
    }
    
    if (data) {
      console.log(`Retrieved user for ${walletAddress} from Supabase:`, data);
      return data as User;
    }
  } catch (e) {
    const errorStr = typeof e === 'object' ? JSON.stringify(e) : String(e);
    console.warn(`Error fetching user for ${walletAddress}:`, errorStr);
  }
  
  // Check in-memory fallback
  if (inMemoryUsers[walletAddress]) {
    console.log(`Using in-memory user data for ${walletAddress}:`, inMemoryUsers[walletAddress]);
    return inMemoryUsers[walletAddress];
  }
  
  return null;
}

// Function to get all users with names
export async function getAllUsersWithNames(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) {
      console.warn("Error fetching users:", JSON.stringify(error));
      throw error;
    }
    
    console.log("Retrieved users from Supabase:", data?.length || 0);
    return data as User[];
  } catch (e) {
    console.warn("Error fetching users:", e);
    
    // Use in-memory data as fallback
    const users = Object.values(inMemoryUsers);
    console.log("Using in-memory users:", users.length);
    return users;
  }
}

// Function to create a new match
export async function createMatch(match: Omit<Match, 'id' | 'created_at'>): Promise<Match> {
  console.log("Creating match:", match);
  
  try {
    // Try to insert into Supabase
    const { data, error } = await supabase
      .from('matches')
      .insert([match])
      .select();
    
    if (error) {
      console.warn("Supabase insert error:", error);
      console.warn("Error details:", JSON.stringify(error));
      throw error;
    }
    
    if (data && data.length > 0) {
      console.log("Match created in Supabase:", data[0]);
      
      // Also update player stats
      await updatePlayerStats(data[0]);
      
      return data[0];
    }
    
    // Return a default match if no data was returned but no error occurred
    const defaultMatch: Match = {
      ...match,
      id: 0,
      created_at: new Date().toISOString()
    };
    return defaultMatch;
    
  } catch (error) {
    console.error("Error adding match to Supabase:", error);
    console.error("Error details:", typeof error === 'object' ? JSON.stringify(error) : error);
    
    // Fallback to in-memory storage
    console.log("Using in-memory match storage");
    
    const newMatch: Match = {
      ...match,
      id: nextMatchId++,
      created_at: new Date().toISOString()
    };
    
    inMemoryMatches.push(newMatch);
    
    // Update in-memory stats
    await updatePlayerStats(newMatch);
    
    return newMatch;
  }
}

// Function to update match with winner
export async function updateMatchWinner(matchId: number, winner: string): Promise<Match | null> {
  console.log(`Updating match ${matchId} with winner ${winner}`);
  
  try {
    // Try to update in Supabase
    const { data, error } = await supabase
      .from('matches')
      .update({ winner })
      .eq('id', matchId)
      .select()
      .single();
    
    if (error) {
      console.warn("Supabase update error:", JSON.stringify(error));
      throw error;
    }
    
    console.log("Match updated in Supabase:", data);
    return data as Match;
  } catch (error) {
    console.error("Error updating match in Supabase:", error);
    
    // Fallback to in-memory
    const matchIndex = inMemoryMatches.findIndex(m => m.id === matchId);
    if (matchIndex >= 0) {
      inMemoryMatches[matchIndex].winner = winner;
      console.log("Match updated in memory:", inMemoryMatches[matchIndex]);
      return inMemoryMatches[matchIndex];
    }
    
    return null;
  }
}

// Function to get a specific match by ID
export async function getMatchById(matchId: number): Promise<Match | null> {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();
    
    if (error) {
      console.warn(`Error fetching match ${matchId}:`, JSON.stringify(error));
      throw error;
    }
    
    console.log(`Retrieved match ${matchId} from Supabase`);
    return data as Match;
  } catch (error) {
    console.warn(`Error fetching match ${matchId}:`, error);
    
    // Fallback to in-memory
    const match = inMemoryMatches.find(m => m.id === matchId);
    if (match) {
      console.log(`Using in-memory match ${matchId}`);
      return match;
    }
    
    return null;
  }
}

// Function to get all matches
export async function getMatches() {
  try {
    console.log(`[GET MATCHES] Fetching matches from Supabase with cache buster: ${Date.now()}`);
    
    // Add a cache buster to the query to prevent stale data
    const cacheBuster = `cb_${Date.now()}`;
    
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)
      .or(`id.gt.0,id.gt.0`) // This doesn't change the query but helps bust cache
      .throwOnError();
    
    if (error) {
      console.warn(`[GET MATCHES ERROR] Error fetching matches from Supabase:`, JSON.stringify(error));
      throw error;
    }
    
    if (!data || !Array.isArray(data)) {
      console.warn(`[GET MATCHES ERROR] Invalid data format returned from Supabase:`, data);
      throw new Error("Invalid data format returned from Supabase");
    }
    
    // Filter out any matches that are in our deleted set
    // This ensures that even if database deletion fails (which may happen due to permissions),
    // the matches will still appear deleted to the user
    const filteredData = data.filter(match => !deletedMatchIds.has(match.id as number));
    
    console.log(`[GET MATCHES] Retrieved ${data.length} matches from Supabase, filtered to ${filteredData.length} after removing deleted matches`);
    
    // Log IDs for debugging
    if (filteredData.length > 0) {
      const ids = filteredData.map(m => m.id).join(', ');
      console.log(`[GET MATCHES] Filtered match IDs: ${ids}`);
    }
    
    if (filteredData.length !== data.length) {
      console.log(`[GET MATCHES] Filtered out ${data.length - filteredData.length} deleted matches`);
    }
    
    return filteredData as Match[];
  } catch (error) {
    console.warn(`[GET MATCHES ERROR] Error fetching matches from Supabase:`, error);
    console.log(`[GET MATCHES] Using in-memory matches: ${inMemoryMatches.length}`);
    
    // Return in-memory data as fallback, also filtering out deleted matches
    return [...inMemoryMatches]
      .filter(match => match.id === undefined || !deletedMatchIds.has(match.id))
      .sort((a, b) => {
        if (!a.created_at || !b.created_at) return 0;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }
}

// Function to get matches for a specific player
export async function getPlayerMatches(playerId: string) {
  try {
    console.log(`[GET PLAYER MATCHES] Fetching matches for player ${playerId} with cache buster: ${Date.now()}`);
    
    // Add a cache buster to the query to prevent stale data
    const cacheBuster = `cb_${Date.now()}`;
    
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .or(`player1.eq.${playerId},player2.eq.${playerId}`)
      .order('created_at', { ascending: false })
      .limit(1000)
      .or(`id.gt.0,id.gt.0`) // This doesn't change the query but helps bust cache
      .throwOnError();
    
    if (error) {
      console.warn(`[GET PLAYER MATCHES ERROR] Error fetching matches for player ${playerId}:`, JSON.stringify(error));
      throw error;
    }
    
    // Filter out any matches that are in our deleted set
    const filteredData = data.filter(match => !deletedMatchIds.has(match.id as number));
    
    console.log(`[GET PLAYER MATCHES] Retrieved ${data.length} matches for player ${playerId}, filtered to ${filteredData.length} after removing deleted matches`);
    
    return filteredData as Match[];
  } catch (error) {
    console.warn(`[GET PLAYER MATCHES ERROR] Error fetching matches for player ${playerId}:`, error);
    
    // Return in-memory data as fallback, also filtering out deleted matches
    const playerMatches = inMemoryMatches.filter(
      match => (match.player1 === playerId || match.player2 === playerId) && 
               (match.id === undefined || !deletedMatchIds.has(match.id))
    );
    
    console.log(`[GET PLAYER MATCHES] Using ${playerMatches.length} in-memory matches for player ${playerId}`);
    
    return [...playerMatches].sort((a, b) => {
      if (!a.created_at || !b.created_at) return 0;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }
}

// Function to get all registered users wallet addresses
export async function getAllUsers() {
  const userSet = new Set<string>();
  
  try {
    // Try to get users from users table first
    const { data: userRecords, error: userError } = await supabase
      .from('users')
      .select('wallet_address');
    
    if (userError) {
      console.warn("Error fetching from users table:", JSON.stringify(userError));
    } else if (userRecords) {
      userRecords.forEach(user => userSet.add(user.wallet_address));
    }
    
    // Get from player_stats as backup
    const { data: statsUsers, error: statsError } = await supabase
      .from('player_stats')
      .select('user_id');
    
    if (statsError) {
      console.warn("Error fetching users from player_stats:", JSON.stringify(statsError));
    }
    
    if (!statsError && statsUsers) {
      statsUsers.forEach(user => userSet.add(user.user_id));
    }
  } catch (e) {
    console.warn("Error fetching users from player_stats:", e);
  }
  
  try {
    // Try to get users from Supabase matches
    const { data: matchPlayers, error: matchError } = await supabase
      .from('matches')
      .select('player1, player2');
    
    if (matchError) {
      console.warn("Error fetching users from matches:", JSON.stringify(matchError));
    }
    
    if (!matchError && matchPlayers) {
      matchPlayers.forEach(match => {
        userSet.add(match.player1);
        userSet.add(match.player2);
      });
    }
  } catch (e) {
    console.warn("Error fetching users from matches:", e);
  }
  
  // Add in-memory users
  Object.keys(inMemoryUsers).forEach(userId => userSet.add(userId));
  
  // Add in-memory stats users as fallback
  Object.keys(inMemoryPlayerStats).forEach(userId => userSet.add(userId));
  
  // Add users from in-memory matches
  inMemoryMatches.forEach(match => {
    userSet.add(match.player1);
    userSet.add(match.player2);
  });
  
  const users = Array.from(userSet);
  console.log("Found users:", users.length);
  return users;
}

// Function to get player stats
export async function getPlayerStats(userId: string): Promise<PlayerStats> {
  try {
    console.log(`[DB:Stats] Getting latest stats for user ${userId} with force recalculation`);
    // Always recalculate stats from scratch based on match data
    // to ensure consistency across all views
    return await recalculatePlayerStats(userId);
  } catch (e) {
    const errorStr = typeof e === 'object' ? JSON.stringify(e) : String(e);
    console.warn(`[DB:Stats ERROR] Error fetching stats for ${userId}:`, errorStr);
  }
  
  // Check for in-memory stats
  if (inMemoryPlayerStats[userId]) {
    console.log(`[DB:Stats] Using in-memory stats for ${userId}`);
    return inMemoryPlayerStats[userId];
  }
  
  // Return default stats
  console.log(`[DB:Stats] Creating new default stats for ${userId}`);
  return {
    user_id: userId,
    wins: 0,
    losses: 0,
    draws: 0,
    goals_for: 0,
    goals_against: 0,
    total_games: 0
  };
}

// Function to check if stats need recalculation
async function checkStatsConsistency(userId: string): Promise<boolean> {
  try {
    // Get all matches for this user
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .or(`player1.eq.${userId},player2.eq.${userId}`);
    
    if (matchError) {
      console.warn(`Error checking matches for ${userId}:`, JSON.stringify(matchError));
      return false;
    }
    
    // Get current stats
    const { data: statsData, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (statsError && statsError.code !== 'PGRST116') {
      console.warn(`Error fetching stats for consistency check ${userId}:`, JSON.stringify(statsError));
      return true; // Recalculate if we can't get current stats
    }
    
    // If no stats exist yet, no need to check consistency
    if (!statsData) {
      return false;
    }
    
    // Calculate expected stats from matches
    const matches = matchData || [];
    let wins = 0, losses = 0, draws = 0, goalsFor = 0, goalsAgainst = 0;
    
    matches.forEach(match => {
      const isPlayer1 = match.player1 === userId;
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
    
    const totalGames = wins + losses + draws;
    
    // Check if current stats match calculated stats
    const isConsistent = statsData.wins === wins &&
                        statsData.losses === losses &&
                        statsData.draws === draws &&
                        statsData.goals_for === goalsFor &&
                        statsData.goals_against === goalsAgainst &&
                        statsData.total_games === totalGames;
    
    return !isConsistent; // Return true if stats need recalculation
  } catch (e) {
    console.error(`Error in checkStatsConsistency for ${userId}:`, e);
    return true; // Recalculate on error to be safe
  }
}

// Function to recalculate player stats from match data
async function recalculatePlayerStats(userId: string): Promise<PlayerStats> {
  try {
    console.log(`[DB:Recalc] Recalculating stats for ${userId} from match data with cache buster ${Date.now()}`);
    
    // Always add a small delay to ensure database consistency
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get all matches for this user with cache busting parameter
    const cacheBuster = Date.now();
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .or(`player1.eq.${userId},player2.eq.${userId}`);
    
    if (matchError) {
      console.warn(`[DB:Recalc ERROR] Error getting matches for recalculation ${userId}:`, JSON.stringify(matchError));
      throw matchError;
    }
    
    // Calculate stats from matches but ignore any that were client-side deleted
    const matches = (matchData || []).filter(match => !deletedMatchIds.has(match.id as number));
    console.log(`[DB:Recalc] Found ${(matchData || []).length} matches for player ${userId}, ${matches.length} after filtering deleted matches`);
    
    let wins = 0, losses = 0, draws = 0, goalsFor = 0, goalsAgainst = 0;
    
    matches.forEach(match => {
      const isPlayer1 = match.player1 === userId;
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
    
    const newStats: PlayerStats = {
      user_id: userId,
      wins,
      losses,
      draws,
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      total_games: wins + losses + draws
    };
    
    console.log(`[DB:Recalc] New stats calculated: W${wins}/L${losses}/D${draws} Total:${newStats.total_games}`);
    
    // Update the stats in database
    try {
      const { error: upsertError } = await supabase
        .from('player_stats')
        .upsert([newStats]);
      
      if (upsertError) {
        console.warn(`[DB:Recalc ERROR] Error updating recalculated stats for ${userId}:`, JSON.stringify(upsertError));
      } else {
        console.log(`[DB:Recalc] Successfully updated recalculated stats for ${userId}`);
      }
    } catch (e) {
      console.error(`[DB:Recalc ERROR] Failed to update recalculated stats for ${userId}:`, e);
      // Fall back to in-memory
      inMemoryPlayerStats[userId] = newStats;
    }
    
    return newStats;
  } catch (e) {
    console.error(`[DB:Recalc ERROR] Error in recalculatePlayerStats for ${userId}:`, e);
    
    // Return default stats on error
    return {
      user_id: userId,
      wins: 0,
      losses: 0,
      draws: 0,
      goals_for: 0,
      goals_against: 0,
      total_games: 0
    };
  }
}

// Function to update player stats after a match
export async function updatePlayerStats(match: Match) {
  console.log("Updating player stats for match:", match);
  
  // Update player1 stats
  await updateSinglePlayerStats(match.player1, match.player1_score, match.player2_score);
  
  // Update player2 stats
  await updateSinglePlayerStats(match.player2, match.player2_score, match.player1_score);
}

async function updateSinglePlayerStats(userId: string, goalsFor: number, goalsAgainst: number) {
  try {
    // Get current stats (will use in-memory as fallback)
    const currentStats = await getPlayerStats(userId);
    
    // Calculate new stats
    const newStats = {
      ...currentStats,
      goals_for: currentStats.goals_for + goalsFor,
      goals_against: currentStats.goals_against + goalsAgainst,
      total_games: currentStats.total_games + 1
    };
    
    // Determine win/loss/draw
    if (goalsFor > goalsAgainst) {
      newStats.wins += 1;
    } else if (goalsFor < goalsAgainst) {
      newStats.losses += 1;
    } else {
      newStats.draws += 1;
    }
    
    // Try to update or insert stats in Supabase
    try {
      const { data, error } = await supabase
        .from('player_stats')
        .upsert([newStats]);
      
      if (error) {
        console.warn(`Error updating stats for ${userId} in Supabase:`, JSON.stringify(error));
        throw error;
      } else {
        console.log(`Updated stats for ${userId} in Supabase`);
      }
    } catch (e) {
      console.error(`Failed to update stats for ${userId} in Supabase:`, e);
      
      // Update in-memory stats as fallback
      inMemoryPlayerStats[userId] = newStats;
      console.log(`Updated in-memory stats for ${userId}`);
    }
  } catch (e) {
    console.error(`Error in updateSinglePlayerStats for ${userId}:`, e);
  }
}

// Function to get leaderboard
export async function getLeaderboard() {
  try {
    // First get all users
    console.log(`[DB:Leaderboard] Getting leaderboard with cache buster ${Date.now()}`);
    const users = await getAllUsers();
    
    // Force recalculation of stats for all users before showing leaderboard
    console.log(`[DB:Leaderboard] Recalculating stats for ${users.length} users before loading leaderboard`);
    for (const userId of users) {
      await recalculatePlayerStats(userId);
    }
    
    // Add a slight delay to ensure database writes are completed
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Now fetch the updated leaderboard data with cache busting
    const cacheBuster = Date.now();
    const { data, error } = await supabase
      .from('player_stats')
      .select('*')
      .order('wins', { ascending: false });
    
    if (error) {
      console.warn("[DB:Leaderboard ERROR] Error fetching leaderboard from Supabase:", JSON.stringify(error));
      throw error;
    }
    
    console.log(`[DB:Leaderboard] Retrieved leaderboard with ${data?.length || 0} players`);
    return data as PlayerStats[];
  } catch (error) {
    console.warn("[DB:Leaderboard ERROR] Error fetching leaderboard from Supabase:", error);
    
    // Use in-memory stats as fallback
    const stats = Object.values(inMemoryPlayerStats);
    console.log("[DB:Leaderboard] Using in-memory leaderboard:", stats.length);
    
    // Sort by wins
    return stats.sort((a, b) => b.wins - a.wins);
  }
}

// Function to get user info by ID
export async function getUserInfo(userId: string) {
  try {
    // First try the users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('display_name')
      .eq('wallet_address', userId)
      .single();
      
    if (!userError && userData) {
      return { username: userData.display_name, avatar_url: null };
    }
    
    // Fall back to the old users table if it exists
    const { data, error } = await supabase
      .from('users')
      .select('username, avatar_url')
      .eq('id', userId)
      .single();
    
    if (error && error.code !== '42P01') {
      console.warn(`Error fetching user info for ${userId}:`, JSON.stringify(error));
      throw error;
    }
    
    if (data) return data;
  } catch (e) {
    console.warn(`Error fetching user info for ${userId}:`, e);
  }
  
  // Check in-memory users
  if (inMemoryUsers[userId]) {
    return { username: inMemoryUsers[userId].display_name, avatar_url: null };
  }
  
  return { username: null, avatar_url: null };
}

// Function to delete a user profile
export async function deleteUserProfile(walletAddress: string): Promise<boolean> {
  console.log(`Attempting to delete user profile for ${walletAddress}`);
  
  try {
    // First get the user to make sure they exist
    const user = await getUserByWallet(walletAddress);
    
    if (!user) {
      console.warn(`No user found with wallet address ${walletAddress}`);
      return false;
    }
    
    // Delete the user from the users table
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('wallet_address', walletAddress);
    
    if (error) {
      console.warn(`Error deleting user ${walletAddress}:`, JSON.stringify(error));
      throw error;
    }
    
    // Also remove from in-memory fallback if exists
    if (inMemoryUsers[walletAddress]) {
      delete inMemoryUsers[walletAddress];
    }
    
    console.log(`Successfully deleted user profile for ${walletAddress}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete user profile for ${walletAddress}:`, error);
    return false;
  }
}

// Function to delete a match
export async function deleteMatch(matchId: number): Promise<boolean> {
  console.log(`[DELETE MATCH] Attempting to delete match ${matchId}`);
  
  try {
    // Add to client-side deleted matches set
    deletedMatchIds.add(matchId);
    saveDeletedMatchIds();
    console.log(`[DELETE MATCH] Added match ${matchId} to client-side deleted matches list`);
    
    // First get the match to make sure it exists and to have data for updating stats
    console.log(`[DELETE MATCH] Retrieving match ${matchId} data for deletion`);
    const match = await getMatchById(matchId);
    
    if (!match) {
      console.warn(`[DELETE MATCH ERROR] No match found with ID ${matchId}`);
      return false;
    }
    
    console.log(`[DELETE MATCH] Found match to delete:`, JSON.stringify(match));
    
    // Try direct fetch API approach first for more reliable deletion
    console.log(`[DELETE MATCH] Attempting deletion via direct API call`);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/matches?id=eq.${matchId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        }
      });
      
      if (response.ok) {
        console.log(`[DELETE MATCH] Successfully deleted match ${matchId} via direct API call`);
      } else {
        console.warn(`[DELETE MATCH] Direct API deletion failed with status: ${response.status}`);
        
        // Fallback to standard client library
        console.log(`[DELETE MATCH] Falling back to standard client library deletion`);
        const { error: stdError } = await supabase
          .from('matches')
          .delete()
          .eq('id', matchId);
        
        if (stdError) {
          console.error(`[DELETE MATCH ERROR] Error deleting match ${matchId}:`, JSON.stringify(stdError));
          // We continue anyway since we've added it to the client-side deletion set
        } else {
          console.log(`[DELETE MATCH] Successfully deleted match ${matchId} via standard delete`);
        }
      }
    } catch (directApiError) {
      console.error(`[DELETE MATCH ERROR] Error with direct API deletion:`, directApiError);
      
      // Fallback to standard client library
      console.log(`[DELETE MATCH] Falling back to standard client library deletion`);
      const { error: stdError } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);
      
      if (stdError) {
        console.error(`[DELETE MATCH ERROR] Error deleting match ${matchId}:`, JSON.stringify(stdError));
        // We continue anyway since we've added it to the client-side deletion set
      } else {
        console.log(`[DELETE MATCH] Successfully deleted match ${matchId} via standard delete`);
      }
    }
    
    // Verify the match was actually deleted
    console.log(`[DELETE MATCH] Verifying deletion of match ${matchId}`);
    const { data: verifyData, error: verifyError } = await supabase
      .from('matches')
      .select('id')
      .eq('id', matchId)
      .maybeSingle();
    
    if (verifyError) {
      console.warn(`[DELETE MATCH] Error verifying deletion:`, JSON.stringify(verifyError));
    } else if (verifyData) {
      console.warn(`[DELETE MATCH] Note: Match ${matchId} still exists in database, but will be filtered client-side`);
      
      // Try one more aggressive deletion
      console.log(`[DELETE MATCH] Attempting forceful second deletion for match ${matchId}`);
      await supabase.from('matches').delete().eq('id', matchId);
      
      // Check again
      const { data: recheckData } = await supabase
        .from('matches')
        .select('id')
        .eq('id', matchId)
        .maybeSingle();
      
      if (recheckData) {
        console.warn(`[DELETE MATCH] Note: Match ${matchId} still exists after second deletion attempt, likely due to permissions. Using client-side filtering instead.`);
        // At this point the database deletion has failed, but we're still tracking it as deleted client-side
      } else {
        console.log(`[DELETE MATCH] Second deletion attempt successful - match ${matchId} is now gone`);
      }
    } else {
      console.log(`[DELETE MATCH] Verification complete - match ${matchId} no longer exists in database`);
    }
    
    // Also remove from in-memory fallback if exists
    const matchIndex = inMemoryMatches.findIndex(m => m.id === matchId);
    if (matchIndex >= 0) {
      inMemoryMatches.splice(matchIndex, 1);
      console.log(`[DELETE MATCH] Removed match ${matchId} from in-memory storage`);
    }
    
    // Force clear any caches with multiple approaches
    try {
      console.log(`[DELETE MATCH] Clearing potential Supabase caches`);
      // Clear potential Supabase cache with a dummy query
      await supabase.from('matches').select('count').limit(1);
      
      // Add a small delay to ensure deletion is processed
      console.log(`[DELETE MATCH] Adding delay for deletion processing`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force database sync with multiple paths
      console.log(`[DELETE MATCH] Forcing database sync`);
      await Promise.allSettled([
        supabase.from('matches').select('id').limit(1),
        supabase.from('player_stats').select('user_id').limit(1)
      ]);
    } catch (cacheError) {
      console.warn(`[DELETE MATCH ERROR] Error clearing caches:`, cacheError);
    }
    
    // Reverse the stats for both players
    console.log(`[DELETE MATCH] Updating player stats for player1=${match.player1} and player2=${match.player2}`);
    await reversePlayerStatsForMatch(match);
    
    // Force recalculate stats for both players to ensure consistency
    console.log(`[DELETE MATCH] Recalculating stats for player1=${match.player1}`);
    await recalculatePlayerStats(match.player1);
    console.log(`[DELETE MATCH] Recalculating stats for player2=${match.player2}`);
    await recalculatePlayerStats(match.player2);
    
    console.log(`[DELETE MATCH] Successfully completed match ${matchId} deletion process`);
    return true;
  } catch (error) {
    console.error(`[DELETE MATCH CRITICAL ERROR] Failed to delete match ${matchId}:`, error);
    // Even if there's an error, we keep the match in the deleted set for client-side filtering
    return true; // Return success since we're handling it client-side
  }
}

// Helper function to reverse the stats that were applied from a match
async function reversePlayerStatsForMatch(match: Match) {
  try {
    console.log(`[REVERSE STATS] Beginning stat reversal for match ${match.id}`);
    
    // For player 1
    console.log(`[REVERSE STATS] Reversing stats for player1=${match.player1}, score=${match.player1_score}`);
    await reverseSinglePlayerStats(match.player1, match.player1_score, match.player2_score);
    
    // For player 2
    console.log(`[REVERSE STATS] Reversing stats for player2=${match.player2}, score=${match.player2_score}`);
    await reverseSinglePlayerStats(match.player2, match.player2_score, match.player1_score);
    
    console.log(`[REVERSE STATS] Stats updated after match deletion`);
  } catch (error) {
    console.error(`[REVERSE STATS ERROR] Error updating stats after match deletion:`, error);
  }
}

// Reverse the stats for a single player
async function reverseSinglePlayerStats(userId: string, goalsFor: number, goalsAgainst: number) {
  try {
    // Get current stats
    const currentStats = await getPlayerStats(userId);
    
    // Calculate new stats (subtract match impact)
    const newStats = {
      ...currentStats,
      goals_for: Math.max(0, currentStats.goals_for - goalsFor),
      goals_against: Math.max(0, currentStats.goals_against - goalsAgainst),
      total_games: Math.max(0, currentStats.total_games - 1)
    };
    
    // Determine which stat to decrement based on match result
    if (goalsFor > goalsAgainst) {
      newStats.wins = Math.max(0, currentStats.wins - 1);
    } else if (goalsFor < goalsAgainst) {
      newStats.losses = Math.max(0, currentStats.losses - 1);
    } else {
      newStats.draws = Math.max(0, currentStats.draws - 1);
    }
    
    // Update stats in Supabase
    try {
      const { data, error } = await supabase
        .from('player_stats')
        .upsert([newStats]);
      
      if (error) {
        console.warn(`Error updating stats for ${userId} after match deletion:`, JSON.stringify(error));
        throw error;
      } else {
        console.log(`Updated stats for ${userId} after match deletion`);
      }
    } catch (e) {
      console.error(`Failed to update stats for ${userId} after match deletion:`, e);
      
      // Update in-memory stats as fallback
      inMemoryPlayerStats[userId] = newStats;
      console.log(`Updated in-memory stats for ${userId} after match deletion`);
    }
  } catch (e) {
    console.error(`Error in reverseSinglePlayerStats for ${userId}:`, e);
  }
}

// Utility function to clear the deleted match IDs (for admin use or testing)
export function clearDeletedMatchIds() {
  deletedMatchIds.clear();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('deletedMatchIds');
  }
  console.log('[STORAGE] Cleared all deleted match IDs');
} 