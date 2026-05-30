import { useEffect, useState } from "react";
import { Badge, Btn, Card, Input, C, font } from "../ui/Primitives";
import { createTest, getTeacherTests, enrollStudents, updateTestPin } from "../../firebase/tests";
import { getAttemptsForTest, getAttemptsForTests } from "../../firebase/attempts";
// FIXED: Added getDoc import to fetch individual student data for the Excel sheet
import { collection, query, where, getDocs, doc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import TestCreationForm from "./TestCreationForm";
import TeacherTestDetail from "./TeacherTestDetail";
import LeaderboardModal from "./LeaderboardModal";
import * as XLSX from "xlsx"; // <-- Added Excel library import

export default function TeacherDashboard({ profile, onLogout, onDemoTest }) {
  const [selectedTest, setSelectedTest] = useState(null);
  const [tests, setTests] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
  const [selectedAttempts, setSelectedAttempts] = useState([]);
  
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [leaderboardModal, setLeaderboardModal] = useState(null);
  
  // Track which test is currently generating an Excel sheet
  const [exportingId, setExportingId] = useState(null);

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

  const handleResetStudentAttempt = async (attemptId, studentName) => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to reset the exam attempt for ${studentName || "this student"}?\nThis will permanently delete their answers and allow them to retake the test.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "attempts", attemptId));
      setSelectedAttempts((prev) => prev.filter((a) => a.id !== attemptId));
      setAllAttempts((prev) => prev.filter((a) => a.id !== attemptId));
      alert("Exam session successfully cleared. The student can now re-enter the test panel.");
    } catch (err) {
      console.error("Error executing reset workflow loop:", err);
      alert("Failed to wipe search logs: " + err.message);
    }
  };

  // --- NEW ROBUST .XLSX EXPORT ENGINE ---
  const handleExportXLSX = async (test) => {
    const testAttempts = allAttempts.filter((a) => a.testId === test.id);
    
    if (testAttempts.length === 0) {
      alert("No candidate attempts found to export for this test yet.");
      return;
    }

    setExportingId(test.id); // Trigger loading state
    
    try {
      // 1. Fetch unique students to gather their Registration Numbers and Batch Data
      const uniqueStudentIds = [...new Set(testAttempts.map(a => a.studentId))];
      const studentDataMap = {};

      await Promise.all(uniqueStudentIds.map(async (uid) => {
        try {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists()) {
            studentDataMap[uid] = userSnap.data();
          }
        } catch (e) {
          console.warn("Could not fetch user details for:", uid);
        }
      }));

      // 2. Map the data cleanly into JSON objects specifically formatted for Excel columns
      const exportData = testAttempts.map(att => {
        const studentInfo = studentDataMap[att.studentId] || {};
        const accuracy = att.total > 0 ? Math.round((att.score / att.total) * 100) : 0;
        const timeMin = Math.round((att.timeTaken || 0) / 60);
        const violationsCount = att.violations ? att.violations.length : 0;
        
        return {
          "Registration Number": studentInfo.regNo || "N/A",
          "Student Name": att.studentName || studentInfo.name || "Unknown",
          "Batch": studentInfo.batch || "N/A",
          "Score": att.score,
          "Total Marks": att.total,
          "Accuracy (%)": `${accuracy}%`,
          "Time Taken (min)": timeMin,
          "Submission Type": att.reason || "Manual Run",
          "Security Violations": violationsCount
        };
      });

      // 3. Create the Workbook and Worksheet securely using the xlsx library
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Test Results");

      // 4. Trigger download
      XLSX.writeFile(workbook, `${test.title.replace(/\s+/g, '_')}_Results.xlsx`);
      
    } catch (err) {
      console.error(err);
      alert("Failed to generate Excel file: " + err.message);
    } finally {
      setExportingId(null);
    }
  };

  const handleConfirmEnroll = async () => {
    setEnrollLoading(true);
    try {
      let uidsToEnroll = [];

      if (enrollModal.testId === null || enrollModal.testId === undefined || String(enrollModal.testId).trim() === "") {
        throw new Error("Missing test reference allocation.");
      }

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

      const updatedRoster = await enrollStudents(enrollModal.testId, uidsToEnroll);
      alert(`Successfully assigned test to ${uidsToEnroll.length} student(s)!`);
      
      setTests((current) =>
        current.map((t) => 
          t.id === enrollModal.testId 
            ? { ...t, enrolledStudents: updatedRoster || [] } 
            : t
        )
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
  
  if (selectedTest) {
    return (
      <TeacherTestDetail 
        test={selectedTest} 
        attempts={attemptsLoading ? [] : selectedAttempts} 
        onBack={() => setSelectedTest(null)} 
        onDemo={() => onDemoTest(selectedTest)}
        onResetAttempt={handleResetStudentAttempt}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      
      <style>{`
        .teacher-test-card {
          display: flex; align-items: center; gap: 24px; padding: 24px 28px;
        }
        .teacher-card-actions {
          display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end;
        }
        .header-title-container {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px;
        }
        .header-title-container div {
          display: flex; gap: 12px;
        }

        @media (max-width: 768px) {
          .teacher-test-card {
            flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; padding: 20px !important;
          }
          .teacher-card-actions {
            width: 100% !important; justify-content: flex-start !important; border-top: 1px solid ${C.border}; padding-top: 14px; gap: 6px !important;
          }
          .teacher-card-actions button {
            flex: 1 1 calc(50% - 6px) !important; text-align: center; justify-content: center; font-size: 12px !important; padding: 8px 10px !important;
          }
          .header-title-container {
            flex-direction: column !important; align-items: flex-start !important; gap: 16px !important;
          }
          .header-title-container div {
            width: 100% !important;
          }
          .header-title-container div button {
            flex: 1 !important; justify-content: center;
          }
          .card-meta-row {
            flex-wrap: wrap; gap: 10px 14px !important;
          }
        }
      `}</style>

      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", height: 60 }}>
        <span style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 16, color: C.textPrimary }}>📋 Teacher Dashboard</span>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onLogout} style={{ padding: "6px 12px", fontSize: 13 }}>Sign out</Btn>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 16px" }}>
        <div className="header-title-container">
          <h1 style={{ fontFamily: font.heading, fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: 0 }}>My Tests</h1>
          <div>
            <Btn variant="ghost" onClick={() => fetchDashboardData(true)}>↻ Refresh</Btn>
            <Btn onClick={() => setCreating(true)}>+ Create Test</Btn>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tests.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>You haven't created any tests yet.</div>}
          
          {tests.map((test) => {
            const attemptsForTest = allAttempts.filter((attempt) => attempt.testId === test.id);
            return (
              <Card key={test.id} className="teacher-test-card">
                <div style={{ flex: 1, width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: font.heading, fontSize: 17, fontWeight: 700, color: C.textPrimary }}>{test.title}</span>
                    <Badge color={test.isActive ? "green" : "amber"}>{test.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  
                  <div className="card-meta-row" style={{ fontSize: 13, color: C.textMuted, display: "flex", gap: 18, alignItems: "center" }}>
                    <span>⏱ {test.duration} min</span>
                    <span>👥 {test.enrolledStudents?.length || 0} enrolled</span>
                    <span>📊 {attemptsForTest.length} attempts</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 600 }}>PIN:</span>
                      <Badge color="accent">{test.pin || "None"}</Badge>
                      <button onClick={() => handleGenerateNewPin(test)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 0 }}>↻</button>
                    </div>
                  </div>
                </div>
                
                <div className="teacher-card-actions">
                  <Btn variant="ghost" onClick={() => onDemoTest(test)} style={{ fontSize: 13, padding: "8px 14px", border: `1px solid ${C.border}` }}>👁 Preview</Btn>
                  <Btn variant="ghost" onClick={() => setLeaderboardModal(test)} style={{ fontSize: 13, padding: "8px 14px" }}>🏆 Board</Btn>
                  
                  {/* UPDATED: Safely calls XLSX generator and displays loading state */}
                  <Btn 
                    variant="ghost" 
                    onClick={() => handleExportXLSX(test)} 
                    disabled={exportingId === test.id}
                    style={{ fontSize: 13, padding: "8px 14px", background: "rgba(16, 185, 129, 0.1)", color: C.greenText || "#10b981", border: "none", opacity: exportingId === test.id ? 0.6 : 1 }}
                  >
                    {exportingId === test.id ? "⏳ Exporting..." : "📥 Export"}
                  </Btn>
                  
                  <Btn variant="primary" onClick={() => setEnrollModal({ open: true, testId: test.id })} style={{ fontSize: 13, padding: "8px 14px" }}>Assign</Btn>
                  <Btn variant="ghost" onClick={() => openTestDetails(test)} style={{ fontSize: 13, padding: "8px 14px" }}>Results</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Enroll Modal */}
      {enrollModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 17, 23, 0.8)", display: "grid", placeItems: "center", zIndex: 100, padding: 16 }}>
          <Card style={{ width: 480, maxWidth: "100%", padding: 24 }}>
            <h2 style={{ fontFamily: font.heading, fontSize: 18, margin: "0 0 16px", color: C.textPrimary }}>Assign Test</h2>
            
            <div style={{ display: "flex", background: C.bg, borderRadius: 8, padding: 4, marginBottom: 20, overflowX: "auto" }}>
              <button type="button" onClick={() => setEnrollMode("batch")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: enrollMode === "batch" ? C.surface : "transparent", color: enrollMode === "batch" ? C.textPrimary : C.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>By Batch</button>
              <button type="button" onClick={() => setEnrollMode("exam")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: enrollMode === "exam" ? C.surface : "transparent", color: enrollMode === "exam" ? C.textPrimary : C.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>By Exam</button>
              <button type="button" onClick={() => setEnrollMode("individual")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: enrollMode === "individual" ? C.surface : "transparent", color: enrollMode === "individual" ? C.textPrimary : C.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>Individual</button>
            </div>

            {enrollMode === "batch" && <Input label="Batch Name" value={batchInput} onChange={setBatchInput} placeholder="e.g. BATCH-A" />}
            {enrollMode === "exam" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Select Exam Type</label>
                <select value={examInput} onChange={(e) => setExamInput(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, fontFamily: font.body, fontSize: 14, outline: "none" }}>
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
            {enrollMode === "individual" && <Input label="Student Email" type="email" value={studentInput} onChange={setStudentInput} placeholder="student@example.com" />}

            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <Btn 
                type="button"
                variant="ghost" 
                onClick={() => {
                  setEnrollModal((prev) => ({ ...prev, open: false }));
                  setBatchInput(""); setExamInput(""); setStudentInput("");
                }} 
                disabled={enrollLoading}
              >
                Cancel
              </Btn>
              <Btn type="button" variant="primary" onClick={handleConfirmEnroll} disabled={enrollLoading}>{enrollLoading ? "Assigning..." : "Confirm"}</Btn>
            </div>
          </Card>
        </div>
      )}

      {leaderboardModal && <LeaderboardModal test={leaderboardModal} onClose={() => setLeaderboardModal(null)} />}
    </div>
  );
}