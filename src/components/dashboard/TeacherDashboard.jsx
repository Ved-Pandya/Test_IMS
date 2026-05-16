import { useEffect, useState } from "react";
import { Badge, Btn, Card, Input, C, font } from "../ui/Primitives";
import { createTest, getTeacherTests, enrollStudents, updateTestPin } from "../../firebase/tests";
import { getAttemptsForTest, getAttemptsForTests } from "../../firebase/attempts";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import TestCreationForm from "./TestCreationForm";
import TeacherTestDetail from "./TeacherTestDetail";
import LeaderboardModal from "./LeaderboardModal";

export default function TeacherDashboard({ profile, onLogout, onDemoTest }) {
  const [selectedTest, setSelectedTest] = useState(null);
  const [tests, setTests] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
  const [selectedAttempts, setSelectedAttempts] = useState([]);
  
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [leaderboardModal, setLeaderboardModal] = useState(null);

  const [enrollModal, setEnrollModal] = useState({ open: false, testId: null });
  const [enrollMode, setEnrollMode] = useState("batch"); 
  const [batchInput, setBatchInput] = useState("");
  const [examInput, setExamInput] = useState(""); 
  const [studentInput, setStudentInput] = useState("");
  const [enrollLoading, setEnrollLoading] = useState(false);

  const fetchDashboardData = async (active = true) => {
    setLoading(true);
    try {
      const loadedTests = await getTeacherTests(profile.uid);
      if (!active) return;
      setTests(loadedTests);
      
      const testIds = loadedTests.map((test) => test.id);
      if (testIds.length === 0) {
        setAllAttempts([]);
        return;
      }
      const loadedAttempts = await getAttemptsForTests(testIds);
      if (!active) return;
      setAllAttempts(loadedAttempts);
    } catch (err) {
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

  const openTestDetails = async (test) => {
    setSelectedTest(test);
    setSelectedAttempts([]);
    setAttemptsLoading(true);
    try {
      const loadedAttempts = await getAttemptsForTest(test.id);
      setSelectedAttempts(loadedAttempts);
    } catch (err) {
      alert("Unable to load attempts.");
    } finally {
      setAttemptsLoading(false);
    }
  };

  const handleCreateTest = async (newTestData) => {
    setCreating(true);
    try {
      await createTest(newTestData);
      await fetchDashboardData(true);
      setCreating(false);
    } catch (err) {
      alert(err.message || "Unable to create test.");
      setCreating(false);
    }
  };

  const handleGenerateNewPin = async (test) => {
    if(!window.confirm(`Generate a new PIN for "${test.title}"?`)) return;
    try {
      const newPin = await updateTestPin(test.id);
      setTests((current) => current.map(t => t.id === test.id ? { ...t, pin: newPin } : t));
    } catch (err) {
      alert("Failed to update PIN: " + err.message);
    }
  };

  const handleConfirmEnroll = async () => {
    setEnrollLoading(true);
    try {
      let uidsToEnroll = [];

      if (enrollMode === "batch") {
        if (!batchInput.trim()) throw new Error("Please enter a batch name.");
        const q = query(collection(db, "users"), where("role", "==", "student"), where("batch", "==", batchInput.trim()));
        const snap = await getDocs(q);
        if (snap.empty) throw new Error(`No students found in batch: ${batchInput}`);
        uidsToEnroll = snap.docs.map(doc => doc.id);
        
      } else if (enrollMode === "exam") {
        if (!examInput.trim()) throw new Error("Please select an exam.");
        const q = query(collection(db, "users"), where("role", "==", "student"), where("exam", "==", examInput.trim()));
        const snap = await getDocs(q);
        if (snap.empty) throw new Error(`No students found registered for exam: ${examInput}`);
        uidsToEnroll = snap.docs.map(doc => doc.id);
        
      } else {
        if (!studentInput.trim()) throw new Error("Please enter a student email.");
        const q = query(collection(db, "users"), where("role", "==", "student"), where("email", "==", studentInput.trim()));
        const snap = await getDocs(q);
        if (snap.empty) throw new Error(`No student found with email: ${studentInput}`);
        uidsToEnroll = [snap.docs[0].id];
      }

      await enrollStudents(enrollModal.testId, uidsToEnroll);
      alert(`Successfully assigned test to ${uidsToEnroll.length} student(s)!`);
      
      setTests((current) =>
        current.map((t) => t.id === enrollModal.testId ? { ...t, enrolledStudents: Array.from(new Set([...t.enrolledStudents, ...uidsToEnroll])) } : t)
      );
      
      setEnrollModal({ open: false, testId: null });
      setBatchInput(""); setExamInput(""); setStudentInput("");
    } catch (err) {
      alert(err.message);
    } finally {
      setEnrollLoading(false);
    }
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, color: C.textPrimary }}>Loading...</div>;
  if (creating) return <TestCreationForm teacherId={profile.uid} teacherName={profile.name} onBack={() => setCreating(false)} onSave={handleCreateTest} />;
  if (selectedTest) return <TeacherTestDetail test={selectedTest} attempts={attemptsLoading ? [] : selectedAttempts} onBack={() => setSelectedTest(null)} onDemo={() => onDemoTest(selectedTest)} />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60 }}>
        <span style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: C.textPrimary }}>📋 ExamPortal Teacher</span>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onLogout}>Sign out</Btn>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h1 style={{ fontFamily: font.heading, fontSize: 24, fontWeight: 800, color: C.textPrimary, margin: 0 }}>My Tests</h1>
          <div style={{ display: "flex", gap: 12 }}>
            <Btn variant="ghost" onClick={() => fetchDashboardData(true)}>↻ Refresh Data</Btn>
            <Btn onClick={() => setCreating(true)}>+ Create New Test</Btn>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tests.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>You haven't created any tests yet.</div>}
          
          {tests.map((test) => {
            const attemptsForTest = allAttempts.filter((attempt) => attempt.testId === test.id);
            return (
              /* UPDATED: Increased vertical padding slightly to allow cleaner button distribution space */
              <Card key={test.id} style={{ display: "flex", alignItems: "center", gap: 24, padding: "24px 28px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontFamily: font.heading, fontSize: 17, fontWeight: 700, color: C.textPrimary }}>{test.title}</span>
                    <Badge color={test.isActive ? "green" : "amber"}>{test.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  
                  <div style={{ fontSize: 13, color: C.textMuted, display: "flex", gap: 18, alignItems: "center" }}>
                    <span>⏱ {test.duration} min</span>
                    <span>👥 {test.enrolledStudents?.length || 0} enrolled</span>
                    <span>📊 {attemptsForTest.length} attempts</span>
                    <div style={{ width: 1, height: 14, background: C.border }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>Class PIN:</span>
                      <Badge color="accent">{test.pin || "None"}</Badge>
                      <button onClick={() => handleGenerateNewPin(test)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 0 }}>↻</button>
                    </div>
                  </div>
                </div>
                
                {/* UPDATED: Structured flex row spacing rules containing exactly 4 buttons tightly fit */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Btn variant="ghost" onClick={() => onDemoTest(test)} style={{ fontSize: 13, padding: "8px 14px", border: `1px solid ${C.border}` }}>👁 Preview</Btn>
                  <Btn variant="ghost" onClick={() => setLeaderboardModal(test)} style={{ fontSize: 13, padding: "8px 14px" }}>🏆 Leaderboard</Btn>
                  <Btn variant="primary" onClick={() => setEnrollModal({ open: true, testId: test.id })} style={{ fontSize: 13, padding: "8px 14px" }}>Assign Test</Btn>
                  <Btn variant="ghost" onClick={() => openTestDetails(test)} style={{ fontSize: 13, padding: "8px 14px" }}>View Results</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {enrollModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 17, 23, 0.8)", display: "grid", placeItems: "center", zIndex: 100 }}>
          <Card style={{ width: 480, maxWidth: "90%", padding: 32 }}>
            <h2 style={{ fontFamily: font.heading, fontSize: 18, margin: "0 0 16px", color: C.textPrimary }}>Assign Test</h2>
            
            <div style={{ display: "flex", background: C.bg, borderRadius: 8, padding: 4, marginBottom: 20 }}>
              <button onClick={() => setEnrollMode("batch")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: enrollMode === "batch" ? C.surface : "transparent", color: enrollMode === "batch" ? C.textPrimary : C.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>By Batch</button>
              <button onClick={() => setEnrollMode("exam")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: enrollMode === "exam" ? C.surface : "transparent", color: enrollMode === "exam" ? C.textPrimary : C.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>By Exam</button>
              <button onClick={() => setEnrollMode("individual")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: enrollMode === "individual" ? C.surface : "transparent", color: enrollMode === "individual" ? C.textPrimary : C.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Individual</button>
            </div>

            {enrollMode === "batch" && (
              <Input label="Batch Name" value={batchInput} onChange={setBatchInput} placeholder="e.g. BATCH-A" />
            )}
            
            {enrollMode === "exam" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Select Exam Type</label>
                <select value={examInput} onChange={(e) => setExamInput(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, fontFamily: font.body, fontSize: 14, outline: "none", cursor: "pointer" }}>
                  <option value="" disabled>-- Select Exam --</option>
                  <option value="CAT">CAT</option>
                  <option value="CMAT">CMAT</option>
                  <option value="IPMAT">IPMAT</option>
                  <option value="CLAT">CLAT</option>
                  <option value="GMAT">GMAT</option>
                  <option value="BANK-PO">Bank PO</option>
                </select>
              </div>
            )}

            {enrollMode === "individual" && (
              <Input label="Student Email" type="email" value={studentInput} onChange={setStudentInput} placeholder="student@example.com" />
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setEnrollModal({ open: false, testId: null })} disabled={enrollLoading}>Cancel</Btn>
              <Btn variant="primary" onClick={handleConfirmEnroll} disabled={enrollLoading}>{enrollLoading ? "Assigning..." : "Confirm"}</Btn>
            </div>
          </Card>
        </div>
      )}

      {leaderboardModal && <LeaderboardModal test={leaderboardModal} onClose={() => setLeaderboardModal(null)} />}
    </div>
  );
}