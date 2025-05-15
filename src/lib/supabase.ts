import { createClient } from '@supabase/supabase-js';

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
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.warn("Error fetching matches from Supabase:", JSON.stringify(error));
      throw error;
    }
    
    console.log("Retrieved matches from Supabase:", data?.length || 0);
    return data as Match[];
  } catch (error) {
    console.warn("Error fetching matches from Supabase:", error);
    console.log("Using in-memory matches:", inMemoryMatches.length);
    
    // Return in-memory data as fallback
    return [...inMemoryMatches].sort((a, b) => {
      if (!a.created_at || !b.created_at) return 0;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }
}

// Function to get matches for a specific player
export async function getPlayerMatches(playerId: string) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .or(`player1.eq.${playerId},player2.eq.${playerId}`)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.warn(`Error fetching matches for player ${playerId}:`, JSON.stringify(error));
      throw error;
    }
    
    console.log(`Retrieved matches for player ${playerId} from Supabase:`, data?.length || 0);
    return data as Match[];
  } catch (error) {
    console.warn(`Error fetching matches for player ${playerId}:`, error);
    
    // Return in-memory data as fallback
    const playerMatches = inMemoryMatches.filter(
      match => match.player1 === playerId || match.player2 === playerId
    );
    
    console.log(`Using in-memory matches for player ${playerId}:`, playerMatches.length);
    
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
    // Check if we need to recalculate stats from match data
    const needsRecalculation = await checkStatsConsistency(userId);
    
    if (needsRecalculation) {
      // Recalculate stats from scratch based on match data
      return await recalculatePlayerStats(userId);
    }
    
    const { data, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.warn(`Error fetching stats for ${userId}:`, JSON.stringify(error));
      throw error;
    }
    
    if (data) {
      console.log(`Retrieved stats for ${userId} from Supabase`);
      return data as PlayerStats;
    }
  } catch (e) {
    const errorStr = typeof e === 'object' ? JSON.stringify(e) : String(e);
    console.warn(`Error fetching stats for ${userId}:`, errorStr);
  }
  
  // Check for in-memory stats
  if (inMemoryPlayerStats[userId]) {
    console.log(`Using in-memory stats for ${userId}`);
    return inMemoryPlayerStats[userId];
  }
  
  // Return default stats
  console.log(`Creating new default stats for ${userId}`);
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
    console.log(`Recalculating stats for ${userId} from match data`);
    
    // Get all matches for this user
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .or(`player1.eq.${userId},player2.eq.${userId}`);
    
    if (matchError) {
      console.warn(`Error getting matches for recalculation ${userId}:`, JSON.stringify(matchError));
      throw matchError;
    }
    
    // Calculate stats from matches
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
    
    const newStats: PlayerStats = {
      user_id: userId,
      wins,
      losses,
      draws,
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      total_games: wins + losses + draws
    };
    
    // Update the stats in database
    try {
      const { error: upsertError } = await supabase
        .from('player_stats')
        .upsert([newStats]);
      
      if (upsertError) {
        console.warn(`Error updating recalculated stats for ${userId}:`, JSON.stringify(upsertError));
      } else {
        console.log(`Successfully updated recalculated stats for ${userId}`);
      }
    } catch (e) {
      console.error(`Failed to update recalculated stats for ${userId}:`, e);
      // Fall back to in-memory
      inMemoryPlayerStats[userId] = newStats;
    }
    
    return newStats;
  } catch (e) {
    console.error(`Error in recalculatePlayerStats for ${userId}:`, e);
    
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
    const users = await getAllUsers();
    
    // Force recalculation of stats for all users (bypass consistency check)
    for (const userId of users) {
      await recalculatePlayerStats(userId);
    }
    
    // Now fetch the updated leaderboard data
    const { data, error } = await supabase
      .from('player_stats')
      .select('*')
      .order('wins', { ascending: false });
    
    if (error) {
      console.warn("Error fetching leaderboard from Supabase:", JSON.stringify(error));
      throw error;
    }
    
    console.log("Retrieved leaderboard with recalculated stats:", data?.length || 0);
    return data as PlayerStats[];
  } catch (error) {
    console.warn("Error fetching leaderboard from Supabase:", error);
    
    // Use in-memory stats as fallback
    const stats = Object.values(inMemoryPlayerStats);
    console.log("Using in-memory leaderboard:", stats.length);
    
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
  console.log(`Attempting to delete match ${matchId}`);
  
  try {
    // First get the match to make sure it exists and to have data for updating stats
    const match = await getMatchById(matchId);
    
    if (!match) {
      console.warn(`No match found with ID ${matchId}`);
      return false;
    }
    
    let deleted = false;
    
    // Try using RPC method first if available
    try {
      const { data, error } = await supabase.rpc('delete_match_by_id', { match_id: matchId });
      
      if (!error && data === true) {
        console.log(`Successfully deleted match ${matchId} via RPC`);
        deleted = true;
      } else if (error) {
        console.warn(`Error with RPC delete match ${matchId}:`, JSON.stringify(error));
      }
    } catch (rpcError) {
      console.warn(`Exception in RPC delete for match ${matchId}:`, rpcError);
    }
    
    // Fallback to standard delete if RPC didn't work
    if (!deleted) {
      const { error: stdError } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);
      
      if (stdError) {
        console.warn(`Error deleting match ${matchId}:`, JSON.stringify(stdError));
        throw stdError;
      } else {
        console.log(`Successfully deleted match ${matchId} via standard delete`);
        deleted = true;
      }
    }
    
    // Also remove from in-memory fallback if exists
    const matchIndex = inMemoryMatches.findIndex(m => m.id === matchId);
    if (matchIndex >= 0) {
      inMemoryMatches.splice(matchIndex, 1);
    }
    
    // Force clear any caches with multiple approaches
    try {
      // Clear potential Supabase cache with a dummy query
      await supabase.from('matches').select('count').limit(1);
      
      // Force database sync with multiple paths
      await Promise.allSettled([
        supabase.from('matches').select('id').limit(1),
        supabase.from('player_stats').select('user_id').limit(1)
      ]);
    } catch (cacheError) {
      console.warn("Error clearing caches:", cacheError);
    }
    
    // Reverse the stats for both players
    await reversePlayerStatsForMatch(match);
    
    // Force recalculate stats for both players to ensure consistency
    await recalculatePlayerStats(match.player1);
    await recalculatePlayerStats(match.player2);
    
    console.log(`Successfully completed match ${matchId} deletion process`);
    return true;
  } catch (error) {
    console.error(`Failed to delete match ${matchId}:`, error);
    return false;
  }
}

// Helper function to reverse the stats that were applied from a match
async function reversePlayerStatsForMatch(match: Match) {
  try {
    // For player 1
    await reverseSinglePlayerStats(match.player1, match.player1_score, match.player2_score);
    
    // For player 2
    await reverseSinglePlayerStats(match.player2, match.player2_score, match.player1_score);
    
    console.log(`Stats updated after match deletion`);
  } catch (error) {
    console.error(`Error updating stats after match deletion:`, error);
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