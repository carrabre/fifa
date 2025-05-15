import { supabase } from './supabase';

// Constants for Supabase connection
const supabaseUrl = 'https://glkeaqhxfizzrselcpgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsa2VhcWh4Zml6enJzZWxjcGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNjg4NjgsImV4cCI6MjA2Mjc0NDg2OH0.tGJP98jZ4KTFDlXHpbR7MezreyqG6pmnXB0lo8r0mIY';

/**
 * Script to set up required Supabase tables
 */
export async function setupSupabaseTables() {
  console.log("=== SUPABASE SETUP DEBUG INFO ===");
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Supabase Key: ${supabaseKey.substring(0, 10)}...`);
  
  try {
    // Verify Supabase connection
    console.log("Testing Supabase connection...");
    try {
      const { data, error } = await supabase.from('_dummy_').select('*').limit(1);
      console.log("Connection test response:", error);
    } catch (e) {
      console.log("Connection test exception:", e);
    }
    
    // Test permissions for common operations
    await testDatabasePermissions();
    
    // Setup users table if needed
    await createUsersTable();
    
    // Setup matches table if needed
    await createMatchesTable();
    
    // Setup player_stats table if needed
    await createPlayerStatsTable();
    
    // Direct API test to check access
    try {
      console.log("Testing direct API access...");
      const res = await fetch(`${supabaseUrl}/rest/v1/matches?select=id&limit=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      console.log(`API test status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const data = await res.json();
        console.log("API data:", JSON.stringify(data).substring(0, 100) + "...");
      }
    } catch (e) {
      console.error("API test exception:", e);
    }
    
    console.log("Supabase tables setup complete");
    console.log("=== END SUPABASE SETUP DEBUG INFO ===");
    return true;
  } catch (err) {
    console.error("Error in Supabase setup:", err);
    return false;
  }
}

// Function to test database permissions for debugging
async function testDatabasePermissions() {
  console.log("=== TESTING DATABASE PERMISSIONS ===");
  
  // Test READ permissions
  try {
    console.log("Testing READ permissions...");
    const { data: readData, error: readError } = await supabase
      .from('matches')
      .select('id')
      .limit(1);
    
    if (readError) {
      console.error("READ permission test failed:", readError);
    } else {
      console.log("READ permission test passed");
    }
  } catch (e) {
    console.error("READ permission test exception:", e);
  }
  
  // Test INSERT permissions with dummy data
  try {
    console.log("Testing INSERT permissions...");
    const testMatch = {
      player1: 'permission_test_user',
      player2: 'permission_test_user',
      player1_score: 0,
      player2_score: 0,
      player1_team: 'test',
      player2_team: 'test'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('matches')
      .insert([testMatch])
      .select();
    
    if (insertError) {
      console.error("INSERT permission test failed:", insertError);
    } else {
      console.log("INSERT permission test passed");
      
      // If insert worked, test DELETE permission
      if (insertData && insertData.length > 0) {
        const testId = insertData[0].id;
        console.log(`Testing DELETE permissions for inserted match ${testId}...`);
        
        const { error: deleteError } = await supabase
          .from('matches')
          .delete()
          .eq('id', testId);
        
        if (deleteError) {
          console.error(`DELETE permission test failed for match ${testId}:`, deleteError);
          console.log("⚠️ This explains why matches cannot be deleted from the database");
        } else {
          console.log(`DELETE permission test passed for match ${testId}`);
        }
      }
    }
  } catch (e) {
    console.error("INSERT/DELETE permission test exception:", e);
  }
  
  console.log("=== PERMISSION TESTS COMPLETE ===");
}

// Function to create users table
async function createUsersTable() {
  try {
    console.log("Checking for users table...");
    const { data, error } = await supabase.from('users').select('wallet_address').limit(1);
    console.log("Users table check response:", error ? `Error: ${JSON.stringify(error)}` : "Table exists");
    
    if (error && error.code === '42P01') {
      console.log("Users table doesn't exist, creating it...");
      
      // Try to create a record to trigger table creation
      console.log("Attempting to create users table with insert...");
      const insertResponse = await supabase.from('users').insert({
        wallet_address: 'system',
        display_name: 'System User',
        created_at: new Date().toISOString()
      });
      
      console.log("Insert response:", JSON.stringify(insertResponse));
      
      if (insertResponse.error) {
        console.error("Error creating users table:", JSON.stringify(insertResponse.error));
        console.log("Will use in-memory fallback for users");
      } else {
        console.log("Successfully created users table through insertion");
      }
    }
  } catch (err) {
    console.error("Exception in users table setup:", err);
    console.log("Will use in-memory fallback for users");
  }
}

// Function to create matches table
async function createMatchesTable() {
  try {
    console.log("Checking for matches table...");
    const { data, error } = await supabase.from('matches').select('id').limit(1);
    console.log("Matches table check response:", error ? `Error: ${JSON.stringify(error)}` : "Table exists");
    
    if (error && error.code === '42P01') {
      console.log("Matches table doesn't exist, creating it...");
      
      // Skip the SQL API method as it's failing with 404 errors
      // Try to create a record to trigger table creation
      console.log("Attempting to create matches table with insert...");
      const insertResponse = await supabase.from('matches').insert({
        player1: 'system',
        player2: 'system',
        player1_score: 0,
        player2_score: 0,
        player1_team: 'setup',
        player2_team: 'setup'
      });
      
      console.log("Insert response:", JSON.stringify(insertResponse));
      
      if (insertResponse.error) {
        console.error("Error creating matches table:", JSON.stringify(insertResponse.error));
        console.log("Will use in-memory fallback for matches");
      } else {
        console.log("Successfully created matches table through insertion");
      }
    }
  } catch (err) {
    console.error("Exception in matches table setup:", err);
    console.log("Will use in-memory fallback for matches");
  }
}

// Function to create player_stats table
async function createPlayerStatsTable() {
  try {
    console.log("Checking for player_stats table...");
    const { data, error } = await supabase.from('player_stats').select('user_id').limit(1);
    console.log("Player_stats table check response:", error ? `Error: ${JSON.stringify(error)}` : "Table exists");
    
    if (error && error.code === '42P01') {
      console.log("Player_stats table doesn't exist, creating it...");
      
      // Skip the SQL API method as it's failing with 404 errors
      // Try to create a record to trigger table creation
      console.log("Attempting to create player_stats table with insert...");
      const insertResponse = await supabase.from('player_stats').insert({
        user_id: 'system',
        wins: 0,
        losses: 0,
        draws: 0,
        goals_for: 0,
        goals_against: 0,
        total_games: 0
      });
      
      console.log("Insert response:", JSON.stringify(insertResponse));
      
      if (insertResponse.error) {
        console.error("Error creating player_stats table:", JSON.stringify(insertResponse.error));
        console.log("Will use in-memory fallback for player stats");
      } else {
        console.log("Successfully created player_stats table through insertion");
      }
    }
  } catch (err) {
    console.error("Exception in player_stats table setup:", err);
    console.log("Will use in-memory fallback for player stats");
  }
} 