import { useEffect, useState } from "react";
import { Badge, Btn, Card, Input, C, font } from "../ui/Primitives";
import AttemptReview from "./AttemptReview";
import { getStudentAttempts } from "../../firebase/attempts";
import { getStudentTests } from "../../firebase/tests";

export default function StudentDashboard({ profile, onStartTest, onLogout }) {
  const [tab, setTab] = useState("tests");
  const [reviewAttempt, setReviewAttempt] = useState(null);
  const [tests, setTests] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Custom Modal State for PIN
  const [pinModal, setPinModal] = useState({ open: false, test: null });
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const fetchDashboardData = async (active = true) => {
    setLoading(true);
    try {
      const [loadedTests, loadedAttempts] = await Promise.all([
        getStudentTests(profile.uid), 
        getStudentAttempts(profile.uid)
      ]);
      if (!active) return;
      setTests(loadedTests);
      setAttempts(loadedAttempts);
    } catch (err) {
      if (!active) return;
      console.error(err);
    } finally {
      if (active) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchDashboardData(active);
    return () => { active = false; };
  }, [profile.uid]);

  const handleStartTestClick = (test) => {
    if (test.pin) {
      setPinModal({ open: true, test });
      setPinInput("");
      setPinError("");
    } else {
      onStartTest(test);
    }
  };

  const handleConfirmPin = () => {
    if (pinInput.trim() === pinModal.test.pin) {
      onStartTest(pinModal.test);
      setPinModal({ open: false, test: null });
    } else {
      setPinError("Incorrect PIN. Please try again.");
    }
  };

  const myAttempts = attempts;
  const attemptedTestIds = new Set(myAttempts.map((attempt) => attempt.testId));

  if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, color: C.textPrimary }}>Loading your tests...</div>;
  
  if (reviewAttempt) {
    const test = tests.find((item) => item.id === reviewAttempt.testId);
    return <AttemptReview attempt={reviewAttempt} test={test} onBack={() => { setReviewAttempt(null); fetchDashboardData(); }} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60 }}>
        <span style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: C.textPrimary }}>📋 ExamPortal</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 14, color: C.textSecondary }}>{profile.name}</span>
          <Btn variant="ghost" onClick={onLogout} style={{ padding: "7px 14px", fontSize: 13 }}>Sign out</Btn>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <Btn variant="ghost" onClick={() => fetchDashboardData(true)}>↻ Refresh Dashboard</Btn>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            ["Tests Enrolled", tests.length, C.accent],
            ["Completed", myAttempts.length, C.green],
            ["Avg Score", myAttempts.length ? Math.round(myAttempts.reduce((sum, item) => sum + (item.score / item.total) * 100, 0) / myAttempts.length) + "%" : "—", C.amber],
          ].map(([label, value, color]) => (
            <Card key={label} style={{ padding: "18px 22px" }}>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: font.heading, color }}>{value}</div>
            </Card>
          ))}
        </div>

        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          {[["tests", "My Tests"], ["history", "Attempt History"]].map(([key, label]) => (
            <button
              key={key} onClick={() => setTab(key)}
              style={{ padding: "10px 22px", background: "none", border: "none", borderBottom: `2px solid ${tab === key ? C.accent : "transparent"}`, color: tab === key ? C.textPrimary : C.textMuted, fontWeight: tab === key ? 600 : 400, fontSize: 14, cursor: "pointer", fontFamily: font.body }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "tests" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {tests.map((test) => {
              const attempted = attemptedTestIds.has(test.id);
              const attempt = myAttempts.find((item) => item.testId === test.id);
              const totalQ = test.sections.flatMap((section) => section.questions).length;
              return (
                <Card key={test.id} style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: font.heading, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{test.title}</span>
                      {attempted ? <Badge color="green">Completed</Badge> : <Badge color="accent">Not Attempted</Badge>}
                    </div>
                    <div style={{ fontSize: 13, color: C.textMuted, display: "flex", gap: 18 }}>
                      <span>⏱ {test.duration} min</span>
                      <span>📝 {totalQ} questions</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {attempted ? (
                      <Btn variant="ghost" onClick={() => setReviewAttempt(attempt)}>Review Answers</Btn>
                    ) : (
                      <Btn onClick={() => handleStartTestClick(test)}>Start Test →</Btn>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {myAttempts.length === 0 && <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>No attempts yet.</div>}
            {myAttempts.map((attempt) => {
              const test = tests.find((item) => item.id === attempt.testId);
              const pct = Math.round((attempt.score / attempt.total) * 100);
              return (
                <Card key={attempt.id}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 15, color: C.textPrimary }}>{test?.title || "Unknown Test"}</div>
                      <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Score: {attempt.score}/{attempt.total} ({pct}%)</div>
                      <div style={{ marginTop: 8, fontSize: 12, color: attempt.reason.includes("Auto") ? C.redText : C.textMuted }}>Submitted: {attempt.reason}</div>
                    </div>
                    <Btn variant="ghost" onClick={() => setReviewAttempt(attempt)} style={{ fontSize: 13 }}>Review →</Btn>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* NEW: Custom PIN Modal */}
      {pinModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 17, 23, 0.8)", display: "grid", placeItems: "center", zIndex: 100 }}>
          <Card style={{ width: 360, maxWidth: "90%", padding: 32 }}>
            <h2 style={{ fontFamily: font.heading, fontSize: 18, margin: "0 0 16px", color: C.textPrimary }}>Enter Classroom PIN</h2>
            <p style={{ color: C.textSecondary, fontSize: 14, marginBottom: 20 }}>This is a supervised exam. Please enter the 4-digit PIN provided by your teacher.</p>
            <Input 
              type="text" 
              value={pinInput} 
              onChange={setPinInput} 
              placeholder="e.g. 1234" 
              error={pinError} 
              style={{ fontSize: 20, letterSpacing: 2, textAlign: "center" }}
            />
            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setPinModal({ open: false, test: null })}>Cancel</Btn>
              <Btn variant="primary" onClick={handleConfirmPin}>Unlock Exam</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}