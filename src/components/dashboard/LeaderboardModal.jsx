import { useState, useEffect } from "react";
import { Card, Btn, Badge, C, font } from "../ui/Primitives";
import { subscribeToTestAttempts } from "../../firebase/attempts";

export default function LeaderboardModal({ test, onClose }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to real-time attempts and sort them
    const unsubscribe = subscribeToTestAttempts(test.id, (liveAttempts) => {
      // Sort by highest score first. If tied, sort by lowest time taken.
      const sorted = [...liveAttempts].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.timeTaken || 0) - (b.timeTaken || 0);
      });

      // Filter out multiple attempts by the same student to ensure fair ranking
      const uniqueStudents = new Set();
      const finalRanks = [];
      
      sorted.forEach(attempt => {
        if (!uniqueStudents.has(attempt.studentId)) {
          uniqueStudents.add(attempt.studentId);
          finalRanks.push(attempt);
        }
      });

      setLeaderboard(finalRanks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [test.id]);

  const getRankMedal = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 17, 23, 0.85)", display: "grid", placeItems: "center", zIndex: 999, padding: 24, backdropFilter: "blur(4px)" }}>
      <Card style={{ width: 600, maxWidth: "100%", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
        
        {/* Header */}
        <div style={{ padding: "20px 24px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: font.heading, fontSize: 20, margin: "0 0 4px", color: C.textPrimary }}>🏆 Global Leaderboard</h2>
            <div style={{ fontSize: 13, color: C.textMuted }}>{test.title}</div>
          </div>
          <Btn variant="ghost" onClick={onClose} style={{ padding: "8px 12px" }}>Close</Btn>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: "auto", flex: 1, background: C.bg }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>Loading live ranks...</div>
          ) : leaderboard.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>No attempts yet. The leaderboard is empty!</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leaderboard.map((attempt, idx) => {
                const isTop3 = idx < 3;
                return (
                  <div key={attempt.id} style={{ 
                    display: "flex", alignItems: "center", padding: "16px", borderRadius: 12,
                    background: idx === 0 ? "linear-gradient(90deg, rgba(255,215,0,0.15) 0%, transparent 100%)" : C.surface,
                    border: `1px solid ${idx === 0 ? "rgba(255,215,0,0.3)" : C.border}`
                  }}>
                    {/* Rank Indicator */}
                    <div style={{ width: 40, fontSize: isTop3 ? 24 : 16, fontWeight: 800, color: C.textSecondary, fontFamily: font.heading, textAlign: "center", marginRight: 16 }}>
                      {getRankMedal(idx)}
                    </div>
                    
                    {/* Student Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: isTop3 ? C.textPrimary : C.textSecondary }}>{attempt.studentName}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Completed in {Math.floor(attempt.timeTaken / 60)}m {attempt.timeTaken % 60}s</div>
                    </div>
                    
                    {/* Score */}
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: font.heading, color: idx === 0 ? "#FFD700" : C.accentText }}>
                        {attempt.score}
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Points</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}