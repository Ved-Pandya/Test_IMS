import { useEffect, useState } from "react";
import { Badge, Btn, Card, C, font } from "../ui/Primitives";
import { getStudentTests } from "../../firebase/tests";
import { getStudentAttempts } from "../../firebase/attempts";

export default function StudentDashboard({ profile, onLogout, onStartTest }) {
  const [tests, setTests] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Secure Pin Modal States ---
  const [selectedPinTest, setSelectedPinTest] = useState(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");

  const accountIdentifier = profile?.email || profile?.uid;

  useEffect(() => {
    async function loadStudentData() {
      if (!accountIdentifier) {
        console.warn("Skipping dashboard lookup pipeline: Account identity parameter is undefined.");
        return;
      }

      setLoading(true);
      try {
        const [enrolledTests, pastAttempts] = await Promise.all([
          getStudentTests(accountIdentifier),
          getStudentAttempts(accountIdentifier)
        ]);
        setTests(enrolledTests || []);
        setAttempts(pastAttempts || []);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    
    loadStudentData();
  }, [accountIdentifier]);

  // --- Pin Verification Logic Handler ---
  const handleVerifyPinAndLaunch = () => {
    setPinError("");
    
    const cleanInputPin = String(enteredPin).trim();
    const targetTestPin = String(selectedPinTest?.pin || "").trim();

    if (!selectedPinTest?.pin || targetTestPin === "" || targetTestPin === "undefined") {
      onStartTest(selectedPinTest);
      setSelectedPinTest(null);
      return;
    }

    if (cleanInputPin === targetTestPin) {
      onStartTest(selectedPinTest);
      setSelectedPinTest(null);
      setEnteredPin("");
    } else {
      setPinError("Invalid test access PIN code. Please confirm entry coordinates with your examiner.");
    }
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
      
      <style>{`
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
        <span style={{ fontSize: 13, color: C.textMuted, marginRight: 16, display: "inline-block" }}>{profile?.name || "Student"}</span>
        <Btn variant="ghost" onClick={onLogout} style={{ padding: "6px 12px", fontSize: 13 }}>Sign out</Btn>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        
        {/* ACTIVE EXAM LISTING WORKFLOW */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                      onClick={() => {
                        if (test.pin && String(test.pin).trim() !== "" && String(test.pin) !== "undefined") {
                          setSelectedPinTest(test);
                        } else {
                          onStartTest(test);
                        }
                      }} 
                      style={{ fontSize: 13, padding: "8px 16px" }}
                    >
                      Start Test →
                    </Btn>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* --- Safe Verification Pin Entry Modal Overlay Panel --- */}
      {selectedPinTest && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(10, 11, 14, 0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24, borderRadius: 16, maxWidth: 360, width: "100%" }}>
            <h3 style={{ margin: "0 0 6px", color: C.textPrimary, fontSize: 16, fontWeight: 800, fontFamily: font.heading }}>Secure Exam Verification</h3>
            <p style={{ color: C.textMuted, fontSize: 12, margin: "0 0 20px" }}>This evaluation requires an administrative access PIN code to unlock the session parameters.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); handleVerifyPinAndLaunch(); }} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <input 
                type="text" 
                value={enteredPin} 
                onChange={(e) => setEnteredPin(e.target.value)} 
                placeholder="Enter test access PIN"
                autoFocus
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, fontFamily: font.mono, fontSize: 14, outline: "none" }}
              />
              {pinError && <span style={{ color: C.redText || "#ef4444", fontSize: 12, fontWeight: 600 }}>{pinError}</span>}
            </form>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn onClick={() => { setSelectedPinTest(null); setEnteredPin(""); setPinError(""); }} variant="ghost" style={{ padding: "6px 12px", fontSize: 12 }}>Cancel</Btn>
              <Btn onClick={handleVerifyPinAndLaunch} variant="primary" style={{ padding: "6px 14px", fontSize: 12 }}>Unlock and Start →</Btn>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}