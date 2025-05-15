"use client";
import { useEffect, useState } from "react";
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

      await loadMatchData();
      setLoading(false);
    }

    checkAuth();
  }, [account, router]);

  // Function to load matches data
  const loadMatchData = async () => {
    try {
      setRefreshing(true);
      const matchData = await getMatches();
      setMatches(matchData);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // Filter matches for current user
  const userMatches = matches.filter(match => 
    match.player1 === account?.address || match.player2 === account?.address
  );

  // Apply additional filters
  const filteredMatches = userMatches.filter(match => {
    if (filter === 'all') return true;
    
    const isPlayer1 = match.player1 === account?.address;
    const playerScore = isPlayer1 ? match.player1_score : match.player2_score;
    const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;
    
    if (filter === 'wins') return playerScore > opponentScore;
    if (filter === 'losses') return playerScore < opponentScore;
    if (filter === 'draws') return playerScore === opponentScore;
    
    return true;
  });

  // Calculate stats
  const totalMatches = userMatches.length;
  const wins = userMatches.filter(match => {
    const isPlayer1 = match.player1 === account?.address;
    const playerScore = isPlayer1 ? match.player1_score : match.player2_score;
    const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;
    return playerScore > opponentScore;
  }).length;
  
  const losses = userMatches.filter(match => {
    const isPlayer1 = match.player1 === account?.address;
    const playerScore = isPlayer1 ? match.player1_score : match.player2_score;
    const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;
    return playerScore < opponentScore;
  }).length;
  
  const draws = userMatches.filter(match => {
    const isPlayer1 = match.player1 === account?.address;
    const playerScore = isPlayer1 ? match.player1_score : match.player2_score;
    const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;
    return playerScore === opponentScore;
  }).length;

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
        
        // Filter out the deleted match from the current state
        setMatches(prev => prev.filter(match => match.id !== matchToDelete));
        
        // Refresh data to show updated matches and stats
        await loadMatchData();
        
        // No forced page refresh anymore - rely on React state updates
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
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white">Match History</h1>
        <p className="text-blue-200">Review all your FIFA matches</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-white">{totalMatches}</div>
          <div className="text-sm text-blue-200">Total Matches</div>
        </div>
        <div className="bg-green-500/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-400">{wins}</div>
          <div className="text-sm text-green-300">Wins</div>
        </div>
        <div className="bg-red-500/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-400">{losses}</div>
          <div className="text-sm text-red-300">Losses</div>
        </div>
        <div className="bg-yellow-500/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-400">{draws}</div>
          <div className="text-sm text-yellow-300">Draws</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <button 
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
          }`}
        >
          All Matches
        </button>
        <button 
          onClick={() => setFilter('wins')}
          className={`px-4 py-2 rounded-full ${
            filter === 'wins' ? 'bg-green-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
          }`}
        >
          Wins
        </button>
        <button 
          onClick={() => setFilter('losses')}
          className={`px-4 py-2 rounded-full ${
            filter === 'losses' ? 'bg-red-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
          }`}
        >
          Losses
        </button>
        <button 
          onClick={() => setFilter('draws')}
          className={`px-4 py-2 rounded-full ${
            filter === 'draws' ? 'bg-yellow-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
          }`}
        >
          Draws
        </button>
      </div>

      {/* Match List */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 shadow-lg">
        {filteredMatches.length > 0 ? (
          <div className="space-y-4">
            {filteredMatches.map((match) => {
              const isPlayer1 = match.player1 === account?.address;
              const playerScore = isPlayer1 ? match.player1_score : match.player2_score;
              const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;
              const opponentAddress = isPlayer1 ? match.player2 : match.player1;
              const playerTeam = isPlayer1 ? match.player1_team : match.player2_team;
              const opponentTeam = isPlayer1 ? match.player2_team : match.player1_team;
              
              // Determine if it was a win, loss or draw
              let resultClass = "bg-yellow-500/20 text-yellow-300"; // draw
              let resultText = "Draw";
              let resultIcon = "📊";
              
              if (playerScore > opponentScore) {
                resultClass = "bg-green-500/20 text-green-300";
                resultText = "Win";
                resultIcon = "🏆";
              } else if (playerScore < opponentScore) {
                resultClass = "bg-red-500/20 text-red-300";
                resultText = "Loss";
                resultIcon = "❌";
              }
              
              return (
                <div key={match.id} className="bg-white/5 rounded-lg p-4 transition-all hover:bg-white/10">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="flex items-center">
                      <div className={`px-3 py-1 rounded ${resultClass} font-medium text-sm mr-3 flex items-center`}>
                        <span className="mr-1">{resultIcon}</span>
                        {resultText}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white text-xl font-bold">
                          {playerScore} - {opponentScore}
                        </span>
                        {(playerTeam || opponentTeam) && (
                          <span className="text-xs text-blue-300 mt-1">
                            {playerTeam || "Your team"} vs {opponentTeam || "Opponent team"}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-sm flex items-center justify-between sm:justify-end flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <span className="bg-blue-600/20 px-3 py-1 rounded text-blue-300">
                          vs {opponentAddress.slice(0, 6)}...{opponentAddress.slice(-4)}
                        </span>
                        <span className="text-blue-200 text-xs">
                          {match.created_at ? new Date(match.created_at).toLocaleString() : 'Unknown date'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {match.id && (
                    <div className="flex justify-end mt-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(match.id as number);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Delete Match
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            {userMatches.length > 0 ? (
              <p className="text-blue-200">No matches found with the selected filter.</p>
            ) : (
              <div>
                <p className="text-blue-200 mb-4">You haven't played any matches yet.</p>
                <button 
                  onClick={() => router.push("/create-match")}
                  className="bg-[#107c10] hover:bg-[#0b5e0b] text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Play your first match
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {userMatches.length > 0 && (
        <div className="mt-6 text-center">
          <button 
            onClick={() => router.push("/create-match")}
            className="bg-[#107c10] hover:bg-[#0b5e0b] text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            Record New Match
          </button>
        </div>
      )}

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
                className="px-4 py-2 rounded-sm bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
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