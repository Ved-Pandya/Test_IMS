import { useEffect, useState } from "react";
import { Badge, Btn, Card, C, font } from "../ui/Primitives";
import { getStudentTests } from "../../firebase/tests";
import { getStudentAttempts } from "../../firebase/attempts";

export default function StudentDashboard({ profile, onLogout, onStartTest }) {
  const [tests, setTests] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("my-tests"); // "my-tests" or "history"

  useEffect(() => {
    async function loadStudentData() {
      try {
        const [enrolledTests, pastAttempts] = await Promise.all([
          getStudentTests(profile.uid),
          getStudentAttempts(profile.uid)
        ]);
        setTests(enrolledTests);
        setAttempts(pastAttempts);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStudentData();
  }, [profile.uid]);

  const calculateAverageScore = () => {
    if (attempts.length === 0) return "0%";
    const totalPercentage = attempts.reduce((acc, curr) => {
      const percentage = curr.total > 0 ? (curr.score / curr.total) * 100 : 0;
      return acc + percentage;
    }, 0);
    return `${Math.round(totalPercentage / attempts.length)}%`;
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, color: C.textPrimary }}>
        Loading Student Dashboard...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body, paddingBottom: 40 }}>
      
      {/* Dynamic Responsive Styles Injection */}
      <style>{`
        .student-metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }
        .student-test-card {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 24px 28px;
        }
        .student-card-actions {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: flex-end;
        }

        @media (max-width: 600px) {
          .student-metrics-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            margin-bottom: 24px !important;
          }
          .student-test-card {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            padding: 20px !important;
          }
          .student-card-actions {
            width: 100% !important;
            justify-content: flex-start !important;
            border-top: 1px solid ${C.border};
            padding-top: 14px;
          }
          .student-card-actions button, .student-card-actions a {
            flex: 1 !important;
            text-align: center;
            justify-content: center;
          }
        }
      `}</style>

      {/* Navigation Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", height: 60 }}>
        <span style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 16, color: C.textPrimary }}>🎓 Student Portal</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: C.textMuted, marginRight: 16, display: "inline-block" }}>{profile.name}</span>
        <Btn variant="ghost" onClick={onLogout} style={{ padding: "6px 12px", fontSize: 13 }}>Sign out</Btn>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        
        {/* 1. TOP METRICS TRACKING GRID */}
        <div className="student-metrics-grid">
          <Card style={{ padding: 20, textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Tests Enrolled</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: C.accentText }}>{tests.length}</div>
          </Card>
          
          <Card style={{ padding: 20, textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Completed</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: C.greenText }}>{attempts.length}</div>
          </Card>
          
          <Card style={{ padding: 20, textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Avg Score</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: C.amberText }}>{calculateAverageScore()}</div>
          </Card>
        </div>

        {/* 2. SUB-TAB TOGGLES CONTAINER */}
        <div style={{ display: "flex", gap: 24, borderBottom: `1px solid ${C.border}`, marginBottom: 20, paddingLeft: 8 }}>
          <button 
            onClick={() => setActiveTab("my-tests")}
            style={{
              background: "none", border: "none", padding: "12px 4px", fontSize: 15, fontWeight: 700,
              color: activeTab === "my-tests" ? C.textPrimary : C.textMuted,
              borderBottom: `3px solid ${activeTab === "my-tests" ? C.accent : "transparent"}`,
              cursor: "pointer"
            }}
          >
            My Tests
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            style={{
              background: "none", border: "none", padding: "12px 4px", fontSize: 15, fontWeight: 700,
              color: activeTab === "history" ? C.textPrimary : C.textMuted,
              borderBottom: `3px solid ${activeTab === "history" ? C.accent : "transparent"}`,
              cursor: "pointer"
            }}
          >
            Attempt History
          </button>
        </div>

        {/* 3. SUB-VIEW CONDITIONAL RENDER WORKFLOW */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {activeTab === "my-tests" ? (
            <>
              {tests.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>No tests assigned to your batch yet.</div>
              )}
              
              {tests.map((test) => {
                const pastAttempt = attempts.find(a => a.testId === test.id);
                return (
                  <Card key={test.id} className="student-test-card">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: font.heading, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{test.title}</span>
                        {pastAttempt ? (
                          <Badge color="green">Completed</Badge>
                        ) : (
                          <Badge color={test.isActive ? "accent" : "gray"}>{test.isActive ? "Available" : "Locked"}</Badge>
                        )}
                      </div>
                      
                      <div style={{ fontSize: 13, color: C.textMuted, display: "flex", gap: 14, alignItems: "center" }}>
                        <span>⏱ {test.duration} min</span>
                        <span>📝 {test.sections?.reduce((acc, s) => acc + s.questions.length, 0) || 0} questions</span>
                      </div>
                    </div>

                    <div className="student-card-actions">
                      {pastAttempt ? (
                        <Btn variant="ghost" disabled style={{ opacity: 0.6, fontSize: 13, padding: "8px 16px" }}>Submitted</Btn>
                      ) : (
                        <Btn 
                          variant="primary" 
                          disabled={!test.isActive}
                          onClick={() => onStartTest(test)} 
                          style={{ fontSize: 13, padding: "8px 16px" }}
                        >
                          Start Test →
                        </Btn>
                      )}
                    </div>
                  </Card>
                );
              })}
            </>
          ) : (
            <>
              {attempts.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>You haven't completed any tests yet.</div>
              )}
              
              {attempts.map((attempt) => {
                const percentage = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;
                return (
                  <Card key={attempt.id} className="student-test-card">
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: font.heading, fontSize: 16, fontWeight: 700, color: C.textPrimary, display: "block", marginBottom: 6 }}>{attempt.testTitle}</span>
                      <div style={{ fontSize: 13, color: C.textMuted, display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <span>Score: <strong style={{ color: C.textPrimary }}>{attempt.score}/{attempt.total}</strong></span>
                        <span>Accuracy: <strong style={{ color: C.textPrimary }}>{percentage}%</strong></span>
                        <span>Taken: {Math.round(attempt.timeTaken / 60)} min</span>
                      </div>
                    </div>
                    <div className="student-card-actions">
                      <Badge color={percentage >= 50 ? "green" : "red"} style={{ padding: "8px 14px", fontSize: 13 }}>
                        {percentage}% Score
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </div>

      </div>
    </div>
  );
}