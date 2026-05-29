import { useEffect, useState } from "react";
import { Badge, Card, Btn, C, font } from "../ui/Primitives";
import { getAttemptsForTest } from "../../firebase/attempts";

export default function LeaderboardModal({ test, onClose }) {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboardData() {
      try {
        const attempts = await getAttemptsForTest(test.id);
        
        // Group by studentId to keep only their highest score achieved
        const highestAttempts = {};
        attempts.forEach((att) => {
          const existing = highestAttempts[att.studentId];
          if (!existing || att.score > existing.score) {
            highestAttempts[att.studentId] = att;
          }
        });

        // Convert back to array, sort descending by score, then ascending by time taken
        const sortedRankings = Object.values(highestAttempts).sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return a.timeTaken - b.timeTaken;
        });

        setRankings(sortedRankings);
      } catch (err) {
        console.error("Error generating leaderboard rankings:", err);
      } finally {
        setLoading(false);
      }
    }
    
    loadLeaderboardData();
  }, [test.id]);

  // Helper format converter for seconds into MM:SS tracking configuration
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 17, 23, 0.85)", display: "grid", placeItems: "center", zIndex: 500, padding: 16 }}>
      
      <style>{`
        .leaderboard-container {
          width: 540px; maxWidth: 100%; maxHeight: 85vh; display: flex; flex-direction: column; padding: 24px;
        }
        .leaderboard-scroll-box {
          width: 100%; overflow-x: auto; margin-top: 16px; border: 1px solid ${C.border}; border-radius: 8px; background: ${C.bg};
        }
        .leaderboard-table {
          width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; min-width: 440px;
        }
        .leaderboard-table th, .leaderboard-table td {
          padding: 12px 16px; border-bottom: 1px solid ${C.border}; color: ${C.textPrimary};
        }
        .leaderboard-table th {
          background: ${C.surface}; color: ${C.textMuted}; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .rank-badge {
          width: 24px; height: 24px; display: inline-grid; place-items: center; border-radius: 50%; font-weight: 700; font-size: 12px;
        }
        
        @media (max-width: 480px) {
          .leaderboard-container { padding: 18px !important; }
          .leaderboard-title { fontSize: 16px !important; }
          .leaderboard-table th, .leaderboard-table td { padding: 10px 12px !important; font-size: 13px !important; }
        }
      `}</style>

      <Card className="leaderboard-container">
        
        {/* Modal Dynamic Header Bar Context */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 className="leaderboard-title" style={{ fontFamily: font.heading, fontSize: 18, fontWeight: 800, color: C.textPrimary, margin: 0 }}>
            🏆 Test Leaderboard
          </h2>
          <Btn variant="ghost" onClick={onClose} style={{ padding: "4px 8px", fontSize: 13 }}>✕ Close</Btn>
        </div>
        <span style={{ fontSize: 13, color: C.textMuted, display: "block", marginBottom: 12 }}>{test.title}</span>

        {/* Core Rankings Interactive viewport box */}
        <div className="leaderboard-scroll-box">
          {loading ? (
            <div style={{ padding: 32, color: C.textMuted, textAlign: "center", fontSize: 14 }}>
              Compiling batch attempts scorecard rankings...
            </div>
          ) : rankings.length === 0 ? (
            <div style={{ padding: 32, color: C.textMuted, textAlign: "center", fontSize: 14 }}>
              No student submissions logged yet.
            </div>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Rank</th>
                  <th>Student Name</th>
                  <th style={{ textAlignment: "right" }}>Score</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((entry, idx) => {
                  const rank = idx + 1;
                  
                  // Style highlight parameters for top 3 podium configurations
                  let rankBg = "transparent", rankCol = C.textSecondary;
                  if (rank === 1) { rankBg = "#F59E0B"; rankCol = "#000"; }
                  else if (rank === 2) { rankBg = "#94A3B8"; rankCol = "#000"; }
                  else if (rank === 3) { rankBg = "#B45309"; rankCol = "#fff"; }

                  return (
                    <tr key={entry.id} style={{ background: entry.studentId === "TEACHER_SANDBOX_PREVIEW" ? "rgba(99, 102, 241, 0.05)" : "transparent" }}>
                      <td>
                        <span className="rank-badge" style={{ background: rankBg, color: rankCol }}>
                          {rank}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {entry.studentName}
                      </td>
                      <td style={{ fontWeight: 700, color: C.accentText }}>
                        {entry.score} <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted }}>/ {entry.total}</span>
                      </td>
                      <td style={{ fontFamily: font.mono, fontSize: 13, color: C.textSecondary }}>
                        {formatDuration(entry.timeTaken)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </Card>
    </div>
  );
}