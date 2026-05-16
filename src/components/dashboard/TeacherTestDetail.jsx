import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { Badge, Btn, Card, C, font } from "../ui/Primitives";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import AttemptReview from "./AttemptReview";
import { deleteAttempt, subscribeToTestAttempts } from "../../firebase/attempts";
import { updateTestPin } from "../../firebase/tests";

export default function TeacherTestDetail({ test, attempts: initialAttempts, onBack, onDemo }) {
  const [studentsMap, setStudentsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState("All");
  const [reviewAttempt, setReviewAttempt] = useState(null);
  
  const [localAttempts, setLocalAttempts] = useState(initialAttempts || []);
  const [currentPin, setCurrentPin] = useState(test.pin || "None");

  // Real-time listener for live exam monitoring
  useEffect(() => {
    const unsubscribe = subscribeToTestAttempts(test.id, (liveAttempts) => {
      setLocalAttempts(liveAttempts);
    });
    return () => unsubscribe();
  }, [test.id]);

  // Fetch student profiles to get batch names and registration numbers
  useEffect(() => {
    let active = true;
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "student"));
        const snap = await getDocs(q);
        if (!active) return;
        const map = {};
        snap.forEach(doc => { map[doc.id] = doc.data(); });
        setStudentsMap(map);
      } catch (err) {
        console.error("Failed to fetch students map", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchStudents();
    return () => { active = false; };
  }, []);

  const handleGenerateNewPin = async () => {
    if(!window.confirm("Generate a new PIN? Any students who haven't started will need the new one to access the test.")) return;
    try {
      const newPin = await updateTestPin(test.id);
      setCurrentPin(newPin);
    } catch (err) {
      alert("Failed to update PIN: " + err.message);
    }
  };

  const handleDeleteAttempt = async (attemptId, studentName) => {
    if(!window.confirm(`Are you sure you want to DELETE ${studentName}'s attempt? This will permanently erase their score and allow them to restart.`)) return;
    try {
      await deleteAttempt(attemptId);
      // We don't manually update state because the real-time listener handles it automatically
    } catch (err) {
      alert("Failed to delete attempt: " + err.message);
    }
  };

  const enrichedAttempts = useMemo(() => {
    return localAttempts.map(attempt => {
      const profile = studentsMap[attempt.studentId] || {};
      return { ...attempt, batch: profile.batch || "Unassigned", regNo: profile.regNo || "N/A" };
    });
  }, [localAttempts, studentsMap]);

  const availableBatches = useMemo(() => {
    const batches = new Set();
    enrichedAttempts.forEach(a => batches.add(a.batch));
    return Array.from(batches).sort();
  }, [enrichedAttempts]);

  const filteredAttempts = useMemo(() => {
    let result = selectedBatch === "All" ? enrichedAttempts : enrichedAttempts.filter(a => a.batch === selectedBatch);
    // Sort by highest score first, then by fastest time if there is a tie
    return result.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.timeTaken || 0) - (b.timeTaken || 0);
    });
  }, [enrichedAttempts, selectedBatch]);

  // Export Results to Excel
  const handleExportExcel = () => {
    const exportData = filteredAttempts.map((a, index) => ({
      Rank: index + 1,
      Name: a.studentName,
      RegNo: a.regNo,
      Batch: a.batch,
      Score: a.score,
      MaxScore: a.total,
      TimeTaken_Seconds: a.timeTaken,
      SubmissionReason: a.reason,
      Warnings: a.violations?.length > 0 ? "Yes" : "No",
      SubmittedAt: a.submittedAt?.toDate ? a.submittedAt.toDate().toLocaleString() : a.submittedAt
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Test Results");
    XLSX.writeFile(workbook, `${test.title.replace(/\s+/g, '_')}_Results.xlsx`);
  };

  if (reviewAttempt) {
    return <AttemptReview attempt={reviewAttempt} test={test} onBack={() => setReviewAttempt(null)} />;
  }

  // Update the math to respect the custom Marking Scheme
  const marking = test.markingScheme || { correct: 1, incorrect: 0 };
  const totalQuestions = test.sections.flatMap(s => s.questions).length;
  const maxScore = totalQuestions * marking.correct;

  const attemptCount = filteredAttempts.length;
  let avgScore = 0, highest = -9999, lowest = 99999;
  
  if (attemptCount > 0) {
    let totalScore = 0;
    filteredAttempts.forEach(a => {
      totalScore += a.score;
      if (a.score > highest) highest = a.score;
      if (a.score < lowest) lowest = a.score;
    });
    avgScore = Math.round((totalScore / attemptCount) * 10) / 10;
  } else {
    highest = 0;
    lowest = 0;
  }

  if (loading) return <div style={{ padding: 40, color: C.textPrimary, textAlign: "center", fontFamily: font.body }}>Loading analytics...</div>;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60, gap: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: font.body }}>← Back</button>
        <div style={{ width: 1, height: 24, background: C.border }} />
        <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: C.textPrimary }}>{test.title}</span>
        <Badge color={test.isActive ? "green" : "amber"}>{test.isActive ? "Active" : "Inactive"}</Badge>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onDemo} style={{ fontSize: 13 }}>Preview Test →</Btn>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 24px" }}>
        
        {/* Classroom PIN Banner */}
        <Card style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.accentDim, border: `1px solid ${C.accent}` }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.accentText, letterSpacing: 0.5, textTransform: "uppercase" }}>Classroom Access PIN</div>
            <div style={{ fontSize: 32, fontFamily: font.heading, fontWeight: 800, color: C.textPrimary, letterSpacing: 4 }}>{currentPin}</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>Students must enter this PIN to unlock the exam. Write it on the whiteboard.</div>
          </div>
          <Btn onClick={handleGenerateNewPin} style={{ fontSize: 13 }}>↻ Generate New PIN</Btn>
        </Card>

        {/* Analytics Header & Filters */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: font.heading, fontSize: 24, fontWeight: 800, color: C.textPrimary, margin: 0 }}>Test Analytics</h1>
            <div style={{ fontSize: 13, color: C.greenText, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, display: "inline-block", animation: "pulse 2s infinite" }}></span>
              Live Monitoring Active
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>FILTER BATCH</label>
              <select 
                value={selectedBatch} 
                onChange={(e) => setSelectedBatch(e.target.value)}
                style={{ padding: "10px 16px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, fontFamily: font.body, fontSize: 14, cursor: "pointer", outline: "none", minWidth: 200 }}
              >
                <option value="All">All Batches (Global)</option>
                {availableBatches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <Btn onClick={handleExportExcel} style={{ padding: "11px 16px" }}>📥 Export to Excel</Btn>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 32 }}>
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Total Attempts</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: font.heading, color: C.accentText }}>{attemptCount}</div>
          </Card>
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Average Score</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: font.heading, color: C.textPrimary }}>
              {avgScore} <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 500 }}>/ {maxScore}</span>
            </div>
          </Card>
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Highest Score</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: font.heading, color: C.greenText }}>{attemptCount > 0 ? highest : "-"}</div>
          </Card>
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Lowest Score</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: font.heading, color: C.redText }}>{attemptCount > 0 ? lowest : "-"}</div>
          </Card>
        </div>

        {/* Leaderboard Table */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
            <h3 style={{ margin: 0, fontSize: 15, fontFamily: font.heading, color: C.textPrimary }}>Topper Leaderboard</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: "12px 20px", color: C.textSecondary, fontWeight: 600, fontSize: 12 }}>Rank</th>
                  <th style={{ padding: "12px 20px", color: C.textSecondary, fontWeight: 600, fontSize: 12 }}>Name</th>
                  <th style={{ padding: "12px 20px", color: C.textSecondary, fontWeight: 600, fontSize: 12 }}>Batch</th>
                  <th style={{ padding: "12px 20px", color: C.textSecondary, fontWeight: 600, fontSize: 12 }}>Score</th>
                  <th style={{ padding: "12px 20px", color: C.textSecondary, fontWeight: 600, fontSize: 12 }}>Submission</th>
                  <th style={{ padding: "12px 20px", color: C.textSecondary, fontWeight: 600, fontSize: 12 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: "32px", textAlign: "center", color: C.textMuted }}>No attempts found.</td></tr>
                ) : (
                  filteredAttempts.map((attempt, idx) => {
                    const isTop3 = idx < 3;
                    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                    
                    return (
                      <tr key={attempt.id} style={{ borderBottom: `1px solid ${C.border}`, background: idx === 0 ? C.greenDim : idx % 2 === 0 ? "transparent" : C.surface }}>
                        <td style={{ padding: "12px 20px", color: isTop3 ? C.textPrimary : C.textSecondary, fontWeight: 800, fontSize: isTop3 ? 16 : 14 }}>{medal}</td>
                        <td style={{ padding: "12px 20px", color: C.textPrimary, fontWeight: 500 }}>{attempt.studentName}</td>
                        <td style={{ padding: "12px 20px", color: C.textSecondary }}><Badge color="accent">{attempt.batch}</Badge></td>
                        <td style={{ padding: "12px 20px", color: C.textPrimary, fontWeight: 700 }}>{attempt.score} <span style={{ color: C.textMuted, fontSize: 12 }}>/ {maxScore}</span></td>
                        <td style={{ padding: "12px 20px" }}>
                          <Badge color={attempt.reason.includes("Auto") || attempt.reason.includes("warning") ? "red" : attempt.reason.includes("Timer") ? "amber" : "green"}>
                            {attempt.reason.includes("Manual") ? "Manual" : "Auto"}
                          </Badge>
                          {attempt.violations?.length > 0 && <span style={{ marginLeft: 8, fontSize: 16 }} title="Tab switch warning issued">⚠️</span>}
                        </td>
                        <td style={{ padding: "12px 20px", display: "flex", gap: 8 }}>
                          <button onClick={() => setReviewAttempt(attempt)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", color: C.accentText, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Review</button>
                          <button onClick={() => handleDeleteAttempt(attempt.id, attempt.studentName)} style={{ background: "none", border: `1px solid ${C.red}44`, borderRadius: 6, padding: "5px 12px", color: C.redText, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reset</button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.2); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
}