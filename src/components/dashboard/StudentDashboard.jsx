import { useEffect, useState } from "react";
import { Badge, Btn, Card, C, Divider, font } from "../ui/Primitives";
import AttemptReview from "./AttemptReview";
import { getStudentAttempts } from "../../firebase/attempts";
import { getStudentTests } from "../../firebase/tests";

export default function StudentDashboard({ profile, onStartTest, onLogout }) {
  const [tab, setTab] = useState("tests");
  const [reviewAttempt, setReviewAttempt] = useState(null);
  const [tests, setTests] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([getStudentTests(profile.uid), getStudentAttempts(profile.uid)])
      .then(([loadedTests, loadedAttempts]) => {
        if (!active) return;
        setTests(loadedTests);
        setAttempts(loadedAttempts);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Unable to load student data.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profile.uid]);

  const myAttempts = attempts;
  const attemptedTestIds = new Set(myAttempts.map((attempt) => attempt.testId));
  const myTests = tests;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, color: C.textPrimary, fontFamily: font.body }}>
        <div>Loading your tests and attempts…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, color: C.redText, fontFamily: font.body, padding: 24, textAlign: "center" }}>
        <div>{error}</div>
      </div>
    );
  }

  if (reviewAttempt) {
    const test = myTests.find((item) => item.id === reviewAttempt.testId);
    if (!test) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, color: C.textPrimary, fontFamily: font.body }}>
          <div>Loading review data…</div>
        </div>
      );
    }
    return <AttemptReview attempt={reviewAttempt} test={test} onBack={() => setReviewAttempt(null)} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60 }}>
        <span style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: C.textPrimary }}>📋 ExamPortal</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.accentDim, border: `1px solid ${C.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: C.accentText }}>
            {profile.name.split(" ").map((item) => item[0]).join("").slice(0, 2)}
          </div>
          <span style={{ fontSize: 14, color: C.textSecondary }}>{profile.name}</span>
          <Btn variant="ghost" onClick={onLogout} style={{ padding: "7px 14px", fontSize: 13 }}>Sign out</Btn>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            ["Tests Enrolled", myTests.length, C.accent],
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
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "10px 22px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${tab === key ? C.accent : "transparent"}`,
                color: tab === key ? C.textPrimary : C.textMuted,
                fontWeight: tab === key ? 600 : 400,
                fontSize: 14,
                cursor: "pointer",
                fontFamily: font.body,
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "tests" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {myTests.map((test) => {
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
                    <div style={{ fontSize: 13, color: C.textMuted, display: "flex", gap: 18, flexWrap: "wrap" }}>
                      <span>⏱ {test.duration} min</span>
                      <span>📝 {totalQ} questions</span>
                      <span>📚 {test.sections.length} sections</span>
                      {attempted && <span style={{ color: C.greenText }}>✓ Score: {attempt.score}/{attempt.total} ({Math.round((attempt.score / attempt.total) * 100)}%)</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {attempted ? (
                      <Btn variant="ghost" onClick={() => setReviewAttempt(attempt)}>Review Answers</Btn>
                    ) : (
                      <Btn onClick={() => onStartTest(test)}>Start Test →</Btn>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {myAttempts.length === 0 && (
              <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                <div>No attempts yet. Start a test above!</div>
              </div>
            )}
            {myAttempts.map((attempt) => {
              const test = myTests.find((item) => item.id === attempt.testId);
              const pct = Math.round((attempt.score / attempt.total) * 100);
              const isAuto = attempt.reason.includes("Auto-submitted");
              return (
                <Card key={attempt.id}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: pct >= 70 ? C.greenDim : pct >= 40 ? C.amberDim : C.redDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, fontFamily: font.heading, color: pct >= 70 ? C.greenText : pct >= 40 ? C.amberText : C.redText }}>{pct}%</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 15, color: C.textPrimary, marginBottom: 4 }}>{test?.title || "Unknown Test"}</div>
                      <div style={{ fontSize: 13, color: C.textMuted, display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <span>{attempt.score}/{attempt.total} correct</span>
                        <span>⏱ {attempt.timeTaken ? `${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s` : "—"}</span>
                        <span>📅 {attempt.submittedAt}</span>
                        {isAuto && <span style={{ color: C.redText }}>⚠ Auto-submitted</span>}
                        {attempt.violations.length > 0 && <span style={{ color: C.amberText }}>🚨 {attempt.violations.length} violation(s)</span>}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: C.textMuted }}>Submitted: {attempt.reason}</div>
                    </div>
                    <Btn variant="ghost" onClick={() => setReviewAttempt(attempt)} style={{ fontSize: 13, padding: "8px 16px" }}>Review →</Btn>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
