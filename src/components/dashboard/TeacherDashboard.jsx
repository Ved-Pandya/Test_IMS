import { useEffect, useState } from "react";
import { Badge, Btn, Card, Input, C, font } from "../ui/Primitives";
import { createTest, getTeacherTests, enrollStudents, unenrollStudents, updateTest, updateTestPin, deleteTestCompletely } from "../../firebase/tests";
import { getAttemptsForTest, getAttemptsForTests } from "../../firebase/attempts";
import { collection, query, where, getDocs, doc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import TestCreationForm from "./TestCreationForm";
import TeacherTestDetail from "./TeacherTestDetail";
import LeaderboardModal from "./LeaderboardModal";
import * as XLSX from "xlsx"; 

export default function TeacherDashboard({ profile, onLogout, onDemoTest }) {
  const [selectedTest, setSelectedTest] = useState(null);
  const [tests, setTests] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
  const [selectedAttempts, setSelectedAttempts] = useState([]);
  
  const [creating, setCreating] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [leaderboardModal, setLeaderboardModal] = useState(null);
  const [exportingId, setExportingId] = useState(null);

  const [enrollModal, setEnrollModal] = useState({ open: false, testId: null });
  const [enrollAction, setEnrollAction] = useState("add");
  const [enrollMode, setEnrollMode] = useState("batch");
  const [examInput, setExamInput] = useState("");
  const [studentInput, setStudentInput] = useState("");
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [rosterStudents, setRosterStudents] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [selectedAddBatches, setSelectedAddBatches] = useState(new Set());
  const [selectedRemoveBatches, setSelectedRemoveBatches] = useState(new Set());

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

  const handleUpdateTest = async (testData) => {
    try {
      await updateTest(editingTest.id, testData);
      await fetchDashboardData(true);
      setEditingTest(null);
    } catch (err) {
      alert(err.message || "Unable to update test.");
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

  const handleDeleteTest = async (testId, testName) => {
    if (!window.confirm(`⚠️ DANGER: Are you absolutely sure you want to permanently erase "${testName}"?\n\nThis will completely delete the test configuration AND wipe all student attempts/scores attached to it. This cannot be undone.`)) return;
    
    setLoading(true);
    try {
      await deleteTestCompletely(testId);
      setTests((current) => current.filter(t => t.id !== testId));
      setAllAttempts((current) => current.filter(a => a.testId !== testId));
    } catch (err) {
      alert("Failed to execute termination purge: " + err.message);
    } finally {
      setLoading(false);
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

  const handleExportXLSX = async (test) => {
    const testAttempts = allAttempts.filter((a) => a.testId === test.id);
    
    if (testAttempts.length === 0) {
      alert("No candidate attempts found to export for this test yet.");
      return;
    }

    setExportingId(test.id);
    
    try {
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

      const exportData = testAttempts.map(att => {
        const studentInfo = studentDataMap[att.studentId] || {};
        const accuracy = att.total > 0 ? Math.round((att.score / att.total) * 100) : 0;
        const timeMin = Math.round((att.timeTaken || 0) / 60);
        const violationsCount = att.violations ? att.violations.length : 0;
        
        let submissionMode = "Normal Manual Submission";
        if (att.isAutoSubmitted || att.reason?.includes("Security Integrity")) {
          submissionMode = violationsCount >= 2 
            ? "Auto-Submitted (Violation Terminated)" 
            : "Auto-Submitted (Timer Expired)";
        }

        return {
          "Registration Number": studentInfo.regNo || "N/A",
          "Student Name": att.studentName || studentInfo.name || "Unknown",
          "Batch": studentInfo.batch || "N/A",
          "Score Obtained": att.score,
          "Total Marks": att.total,
          "Accuracy": `${accuracy}%`,
          "Time Taken (min)": timeMin,
          "Submission Status": submissionMode, 
          "Total Tab Violations": violationsCount
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Test Results");

      XLSX.writeFile(workbook, `${test.title.replace(/\s+/g, '_')}_Results.xlsx`);
      
    } catch (err) {
      console.error(err);
      alert("Failed to generate Excel file: " + err.message);
    } finally {
      setExportingId(null);
    }
  };

  const openEnrollModal = async (testId) => {
    setEnrollModal({ open: true, testId });
    setEnrollAction("add");
    setEnrollMode("batch");
    setSelectedAddBatches(new Set());
    setSelectedRemoveBatches(new Set());
    setExamInput(""); setStudentInput("");

    setRosterLoading(true);
    try {
      const q = query(collection(db, "users"), where("role", "==", "student"));
      const snap = await getDocs(q);
      setRosterStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      alert("Failed to load student roster: " + err.message);
    } finally {
      setRosterLoading(false);
    }
  };

  const closeEnrollModal = () => {
    setEnrollModal({ open: false, testId: null });
    setExamInput(""); setStudentInput("");
    setSelectedAddBatches(new Set());
    setSelectedRemoveBatches(new Set());
  };

  const toggleBatchSelection = (setFn, batchName) => {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(batchName)) next.delete(batchName); else next.add(batchName);
      return next;
    });
  };

  const currentEnrollTest = tests.find((t) => t.id === enrollModal.testId);
  const currentEnrolledSet = new Set(currentEnrollTest?.enrolledStudents || []);

  const addBatchGroups = {};
  rosterStudents.forEach((s) => {
    const b = (s.batch || "").trim();
    if (!b) return;
    addBatchGroups[b] = (addBatchGroups[b] || 0) + 1;
  });

  const removeBatchGroups = {};
  rosterStudents.forEach((s) => {
    const b = (s.batch || "").trim();
    if (!b || !currentEnrolledSet.has(s.id)) return;
    removeBatchGroups[b] = (removeBatchGroups[b] || 0) + 1;
  });

  const handleConfirmEnroll = async () => {
    setEnrollLoading(true);
    try {
      if (enrollModal.testId === null || enrollModal.testId === undefined || String(enrollModal.testId).trim() === "") {
        throw new Error("Missing test reference allocation.");
      }

      if (enrollAction === "remove") {
        if (selectedRemoveBatches.size === 0) throw new Error("Select at least one batch to remove.");
        const uidsToRemove = rosterStudents
          .filter((s) => currentEnrolledSet.has(s.id) && selectedRemoveBatches.has((s.batch || "").trim()))
          .map((s) => s.id);

        if (uidsToRemove.length === 0) throw new Error("No enrolled students found in the selected batch(es).");

        const updatedRoster = await unenrollStudents(enrollModal.testId, uidsToRemove);
        alert(`Successfully removed ${uidsToRemove.length} student(s) from this test.`);
        setTests((current) =>
          current.map((t) => t.id === enrollModal.testId ? { ...t, enrolledStudents: updatedRoster || [] } : t)
        );
        closeEnrollModal();
        return;
      }

      let uidsToEnroll = [];

      if (enrollMode === "batch") {
        if (selectedAddBatches.size === 0) throw new Error("Select at least one batch.");
        uidsToEnroll = rosterStudents
          .filter((s) => selectedAddBatches.has((s.batch || "").trim()))
          .map((s) => s.id);
        if (uidsToEnroll.length === 0) throw new Error("No students found in the selected batch(es).");

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
        current.map((t) => t.id === enrollModal.testId ? { ...t, enrolledStudents: updatedRoster || [] } : t)
      );

      closeEnrollModal();
    } catch (err) {
      alert(err.message);
    } finally {
      setEnrollLoading(false);
    }
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, color: C.textPrimary }}>Loading...</div>;
  if (creating) return <TestCreationForm teacherId={profile.uid} teacherName={profile.name} onBack={() => setCreating(false)} onSave={handleCreateTest} />;
  if (editingTest) return <TestCreationForm teacherId={profile.uid} teacherName={profile.name} initialTest={editingTest} onBack={() => setEditingTest(null)} onSave={handleUpdateTest} />;

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
            flex-wrap: wrap; gap: 10px 14px !with-margin;
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
            const containsViolatedSubmissions = attemptsForTest.some(a => a.isAutoSubmitted || a.violations?.length >= 2);

            return (
              <Card key={test.id} className="teacher-test-card">
                <div style={{ flex: 1, width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: font.heading, fontSize: 17, fontWeight: 700, color: C.textPrimary }}>{test.title}</span>
                    <Badge color={test.isActive ? "green" : "amber"}>{test.isActive ? "Active" : "Inactive"}</Badge>
                    
                    {containsViolatedSubmissions && (
                      <Badge color="red" style={{ fontWeight: 800, animation: "pulse 2s infinite" }}>⚠️ AUTO-SUBMISSIONS DETECTED</Badge>
                    )}
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
                  
                  <Btn 
                    variant="ghost" 
                    onClick={() => handleExportXLSX(test)} 
                    disabled={exportingId === test.id}
                    style={{ fontSize: 13, padding: "8px 14px", background: "rgba(16, 185, 129, 0.1)", color: C.greenText || "#10b981", border: "none", opacity: exportingId === test.id ? 0.6 : 1 }}
                  >
                    {exportingId === test.id ? "⏳ Exporting..." : "📥 Export"}
                  </Btn>
                  
                  <Btn variant="ghost" onClick={() => setEditingTest(test)} style={{ fontSize: 13, padding: "8px 14px" }}>✏️ Edit</Btn>
                  <Btn variant="primary" onClick={() => openEnrollModal(test.id)} style={{ fontSize: 13, padding: "8px 14px" }}>Assign</Btn>
                  <Btn variant="ghost" onClick={() => openTestDetails(test)} style={{ fontSize: 13, padding: "8px 14px" }}>Results</Btn>
                  
                  <Btn 
                    onClick={() => handleDeleteTest(test.id, test.title)} 
                    style={{ background: "#ef4444", color: "#fff", padding: "8px 14px", fontSize: 13, border: "none", opacity: 0.9 }}
                  >
                    🗑️ Delete
                  </Btn>
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
            <h2 style={{ fontFamily: font.heading, fontSize: 18, margin: "0 0 16px", color: C.textPrimary }}>Manage Assigned Students</h2>

            <div style={{ display: "flex", background: C.bg, borderRadius: 8, padding: 4, marginBottom: 12 }}>
              <button type="button" onClick={() => setEnrollAction("add")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: enrollAction === "add" ? C.surface : "transparent", color: enrollAction === "add" ? C.textPrimary : C.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Add</button>
              <button type="button" onClick={() => setEnrollAction("remove")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: enrollAction === "remove" ? C.surface : "transparent", color: enrollAction === "remove" ? C.redText || "#ef4444" : C.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>− Remove</button>
            </div>

            {enrollAction === "add" && (
              <div style={{ display: "flex", background: C.bg, borderRadius: 8, padding: 4, marginBottom: 20, overflowX: "auto" }}>
                <button type="button" onClick={() => setEnrollMode("batch")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: enrollMode === "batch" ? C.surface : "transparent", color: enrollMode === "batch" ? C.textPrimary : C.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>By Batch</button>
                <button type="button" onClick={() => setEnrollMode("exam")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: enrollMode === "exam" ? C.surface : "transparent", color: enrollMode === "exam" ? C.textPrimary : C.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>By Exam</button>
                <button type="button" onClick={() => setEnrollMode("individual")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: enrollMode === "individual" ? C.surface : "transparent", color: enrollMode === "individual" ? C.textPrimary : C.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>Individual</button>
              </div>
            )}

            {enrollAction === "add" && enrollMode === "batch" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Select Batch(es)</label>
                {rosterLoading ? (
                  <div style={{ color: C.textMuted, fontSize: 13, padding: "12px 0" }}>Loading batches...</div>
                ) : Object.keys(addBatchGroups).length === 0 ? (
                  <div style={{ color: C.textMuted, fontSize: 13, padding: "12px 0" }}>No students with a batch assigned were found.</div>
                ) : (
                  <div style={{ maxHeight: 220, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8, padding: 6 }}>
                    {Object.keys(addBatchGroups).sort().map((batchName) => {
                      const checked = selectedAddBatches.has(batchName);
                      return (
                        <label key={batchName} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, cursor: "pointer", background: checked ? C.bg : "transparent" }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleBatchSelection(setSelectedAddBatches, batchName)} />
                          <span style={{ color: C.textPrimary, fontSize: 13, fontWeight: 600, flex: 1 }}>{batchName}</span>
                          <span style={{ color: C.textMuted, fontSize: 12 }}>({addBatchGroups[batchName]})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {enrollAction === "add" && enrollMode === "exam" && (
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
            {enrollAction === "add" && enrollMode === "individual" && <Input label="Student Email" type="email" value={studentInput} onChange={setStudentInput} placeholder="student@example.com" />}

            {enrollAction === "remove" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Select Assigned Batch(es) To Remove</label>
                {rosterLoading ? (
                  <div style={{ color: C.textMuted, fontSize: 13, padding: "12px 0" }}>Loading assigned batches...</div>
                ) : Object.keys(removeBatchGroups).length === 0 ? (
                  <div style={{ color: C.textMuted, fontSize: 13, padding: "12px 0" }}>No batches are currently assigned to this test.</div>
                ) : (
                  <div style={{ maxHeight: 220, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8, padding: 6 }}>
                    {Object.keys(removeBatchGroups).sort().map((batchName) => {
                      const checked = selectedRemoveBatches.has(batchName);
                      return (
                        <label key={batchName} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, cursor: "pointer", background: checked ? C.bg : "transparent" }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleBatchSelection(setSelectedRemoveBatches, batchName)} />
                          <span style={{ color: C.textPrimary, fontSize: 13, fontWeight: 600, flex: 1 }}>{batchName}</span>
                          <span style={{ color: C.textMuted, fontSize: 12 }}>({removeBatchGroups[batchName]})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <Btn
                type="button"
                variant="ghost"
                onClick={closeEnrollModal}
                disabled={enrollLoading}
              >
                Cancel
              </Btn>
              <Btn
                type="button"
                variant="primary"
                onClick={handleConfirmEnroll}
                disabled={enrollLoading}
                style={enrollAction === "remove" ? { background: "#ef4444", color: "#fff" } : undefined}
              >
                {enrollLoading ? "Working..." : (enrollAction === "add" ? "Confirm Add" : "Confirm Remove")}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {leaderboardModal && <LeaderboardModal test={leaderboardModal} onClose={() => setLeaderboardModal(null)} />}
    </div>
  );
}