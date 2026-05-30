import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Badge, Btn, Card, Input, C, font } from "../ui/Primitives";
import { createStudentAsAdmin, createTeacherAsAdmin, updateStudentBatchByEmail } from "../../firebase/auth";
import { collection, query, where, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/config";

export default function AdminDashboard({ profile, onLogout }) {
  const [tab, setTab] = useState("students");
  const [loading, setLoading] = useState(false);
  
  // Bulk Upload State
  const [studentLogs, setStudentLogs] = useState([]);

  // Single Student State
  const [sName, setSName] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sBatch, setSBatch] = useState("");
  const [sRegNo, setSRegNo] = useState("");
  const [sMobile, setSMobile] = useState("");
  const [sExam, setSExam] = useState("");
  const [singleStudentCreds, setSingleStudentCreds] = useState(null);

  // Update Batch State
  const [uEmail, setUEmail] = useState("");
  const [uBatch, setUBatch] = useState("");

  // Teacher State
  const [tName, setTName] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tExams, setTExams] = useState([]);
  const [teacherCredentials, setTeacherCredentials] = useState(null);

  // Existing Teachers State
  const [teachersList, setTeachersList] = useState([]);
  const [editTeacher, setEditTeacher] = useState(null);
  const [editExams, setEditExams] = useState([]);

  const availableExams = ["CAT", "CMAT", "CLAT", "IPMAT", "GMAT", "BANK-PO"];

  useEffect(() => {
    if (tab === "teachers") fetchTeachers();
  }, [tab]);

  const fetchTeachers = async () => {
    try {
      const q = query(collection(db, "users"), where("role", "==", "teacher"));
      const snap = await getDocs(q);
      setTeachersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(err) {
      console.error("Failed to fetch teachers", err);
    }
  };

  const handleToggleExam = (exam) => {
    setTExams(prev => prev.includes(exam) ? prev.filter(e => e !== exam) : [...prev, exam]);
  };

  // --- REFACTORED BULK ENROLLMENT PARSER WITH HIGH TOLERANCE NORMALIZATION ---
  const handleStudentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setStudentLogs(["Reading excel workbook matrix file..."]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        setStudentLogs(prev => [...prev, `Found ${rows.length} rows. Sanitizing structural fields...`]);
        const results = [];

        for (let row of rows) {
          // Fallback selectors catch column name variants regardless of space or case mutations
          const rawEmail = row.Email || row.email || row["EMAIL"] || row["Email ID"] || row["E-mail"];
          const rawName = row.Name || row.name || row["NAME"] || row["Student Name"];
          const rawRegNo = row.RegNo || row.regNo || row["RegNo "] || row["Registration No"] || row["Registration Number"] || row["RegistrationNo"];
          const rawMobile = row.Mobile || row.mobile || row["MobileNo"] || row["Mobile Number"];
          const rawExam = row.Exam || row.exam || row["EXAM"];

          // FIXED: Ultra-flexible batch column scanner maps fields mapping to any variant containing the substring "batch"
          let rawBatch = row.BatchNo || row.batchNo || row.Batch || row["Batch No"] || row["BatchNo "];
          if (!rawBatch) {
            const dynamicBatchKey = Object.keys(row).find(key => 
              key.toLowerCase().replace(/[^a-z0-9]/g, "").includes("batch")
            );
            if (dynamicBatchKey) {
              rawBatch = row[dynamicBatchKey];
            }
          }

          const email = String(rawEmail || "").trim().toLowerCase();
          const name = String(rawName || "").trim();
          const regNo = String(rawRegNo || "").trim();
          const mobile = String(rawMobile || "").trim();
          const exam = String(rawExam || "").trim();
          
          let batch = String(rawBatch || "").trim();
          if (batch.toLowerCase() === "undefined" || batch.toLowerCase() === "null") {
            batch = "";
          }

          if (!email || email === "" || !name || name === "") {
            setStudentLogs(prev => [...prev, `⚠️ Skipped line row segment: Missing operational Name or Email keys.`]);
            continue;
          }

          if (!regNo || regNo === "") {
            setStudentLogs(prev => [...prev, `⚠️ Skipped ${email}: Registration Number configuration column cell is empty.`]);
            continue;
          }

          try {
            // Standard execution path via admin API orchestration layer
            await createStudentAsAdmin({ 
              name, email, batch, regNo, mobile, exam
            });
            
            results.push({
              "Registration No": regNo,
              "Name": name,
              "Email": email,
              "Password": regNo, 
              "Mobile": mobile,
              "Batch": batch || "Unassigned",
              "Exam": exam,
              "Status": "Success"
            });
            setStudentLogs(prev => [...prev, `✅ Provisioned Enrollee Document: ${email}`]);
          } catch (err) {
            // FIXED: Intercepts duplicate account errors gracefully and directly rewrites/creates their Firestore data node mapping
            if (err.message.includes("email-already-in-use") || err.code === "auth/email-already-in-use" || String(err).includes("already-in-use")) {
              try {
                await setDoc(doc(db, "users", email), {
                  email: email,
                  name: name,
                  role: "student",
                  batch: batch || "Unassigned",
                  regNo: regNo,
                  mobile: mobile || "N/A",
                  exam: exam || "Unassigned",
                  updatedAt: new Date(),
                }, { merge: true });

                results.push({
                  "Registration No": regNo,
                  "Name": name,
                  "Email": email,
                  "Password": regNo, 
                  "Mobile": mobile,
                  "Batch": batch || "Unassigned",
                  "Exam": exam,
                  "Status": "Success (Linked profile data)"
                });
                setStudentLogs(prev => [...prev, `⚠️ Handled duplication link path safely for: ${email}`]);
              } catch (fsErr) {
                results.push({
                  "Registration No": regNo, "Name": name, "Email": email,
                  "Password": "-", "Mobile": mobile, "Batch": batch, "Exam": exam,
                  "Status": `Error: ${fsErr.message}`
                });
                setStudentLogs(prev => [...prev, `❌ Firestore tracking link breakdown ${email}: ${fsErr.message}`]);
              }
            } else {
              results.push({
                "Registration No": regNo, "Name": name, "Email": email,
                "Password": "-", "Mobile": mobile, "Batch": batch, "Exam": exam,
                "Status": `Error: ${err.message}`
              });
              setStudentLogs(prev => [...prev, `❌ Compilation Drop ${email}: ${err.message}`]);
            }
          }
        }

        const worksheet = XLSX.utils.json_to_sheet(results);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, worksheet, "Credentials");
        XLSX.writeFile(wb, "Student_Login_Credentials.xlsx");
        setStudentLogs(prev => [...prev, "🎉 Operational complete! Credentials workbook spreadsheet downloaded."]);
      } catch (err) {
        setStudentLogs(prev => [...prev, `Critical Core Parse Exception Error: ${err.message}`]);
      } finally {
        setLoading(false);
        e.target.value = ""; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- INDIVIDUAL ACCOUNT PROVISIONS ---
  const handleAddSingleStudent = async () => {
    if (!sName || !sEmail || !sBatch || !sRegNo || !sMobile || !sExam) {
      return alert("All fields are strictly mandatory for processing individual enrollees.");
    }
    
    setLoading(true);
    try {
      await createStudentAsAdmin({ 
        name: sName.trim(), 
        email: sEmail.trim().toLowerCase(), 
        batch: sBatch.trim(), 
        regNo: sRegNo.trim(), 
        mobile: sMobile.trim(),
        exam: sExam.trim()
      });
      
      setSingleStudentCreds({ email: sEmail.trim().toLowerCase(), password: sRegNo.trim() });
      
      setSName(""); setSEmail(""); setSBatch(""); 
      setSRegNo(""); setSMobile(""); setSExam("");
    } catch (err) {
      alert("Failed to provision student record profile: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBatch = async () => {
    if (!uEmail || !uBatch) return alert("Email and destination batch properties target string required.");
    setLoading(true);
    try {
      const studentName = await updateStudentBatchByEmail(uEmail.trim().toLowerCase(), uBatch.trim());
      alert(`Success! Relocated ${studentName} to batch track sequence: ${uBatch.trim()}`);
      setUEmail("");
      setUBatch("");
    } catch (err) {
      alert("Update Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeacher = async () => {
    if (!tName || !tEmail) return alert("Name and identity routing email properties are mandatory parameters.");
    if (tExams.length === 0) return alert("Assign at least one core exam pipeline tracker category to this instructor account.");

    setLoading(true);
    try {
      const result = await createTeacherAsAdmin({ 
        name: tName.trim(), 
        email: tEmail.trim().toLowerCase(), 
        exams: tExams 
      });
      setTeacherCredentials(result);
      setTName(""); setTEmail(""); setTExams([]);
      fetchTeachers(); 
    } catch (err) {
      alert("Failed to create teacher account profile data nodes: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditTeacher = (teacher) => {
    setEditTeacher(teacher);
    setEditExams(teacher.exams || []);
  };

  const saveTeacherExams = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", editTeacher.id), { exams: editExams });
      setEditTeacher(null);
      fetchTeachers();
    } catch (err) {
      alert("Failed to update exams array reference data points: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTeacher = async (uid, name) => {
    if (!window.confirm(`Are you absolutely sure you want to permanently strip operational console access keys from ${name}?`)) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", uid), { role: "revoked" });
      fetchTeachers();
    } catch (err) {
      alert("Failed to suspend user session role credentials: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body, paddingBottom: 60 }}>
      
      <style>{`
        .admin-nav-tray { display: flex; gap: 12px; margin-bottom: 24px; }
        .admin-form-grid-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .admin-action-row-split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: end; }
        .admin-table-scroll-view { overflow-x: auto; width: 100%; border-radius: 8px; }
        .teacher-data-matrix-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; min-width: 680px; }
        .teacher-data-matrix-table th, .teacher-data-matrix-table td { padding: 12px 20px; }

        @media (max-width: 640px) {
          .admin-nav-tray { flex-direction: column !important; gap: 8px !important; }
          .admin-nav-tray button { width: 100% !important; justify-content: center; }
          .admin-form-grid-layout, .admin-action-row-split { grid-template-columns: 1fr !important; gap: 12px !important; }
          .teacher-actions-flex-cell { flex-direction: column !important; gap: 6px !important; align-items: flex-start !important; }
          .teacher-actions-flex-cell button { width: 100% !important; text-align: center; justify-content: center; }
        }
      `}</style>

      {/* Global Module Navigation Bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", height: 60 }}>
        <span style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 16, color: C.textPrimary }}>📋 ExamPortal Admin</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn variant="ghost" onClick={onLogout} style={{ padding: "6px 12px", fontSize: 13 }}>Sign out</Btn>
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: "32px auto", padding: "0 16px" }}>
        
        {/* Core Tab System Toggles */}
        <div className="admin-nav-tray">
          <Btn variant={tab === "students" ? "primary" : "ghost"} onClick={() => setTab("students")} style={{ flex: 1 }}>Manage Students</Btn>
          <Btn variant={tab === "teachers" ? "primary" : "ghost"} onClick={() => setTab("teachers")} style={{ flex: 1 }}>Manage Teachers</Btn>
        </div>

        {tab === "students" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* 1. BULK ENROLLMENT UTILITY CARD */}
            <Card>
              <h2 style={{ fontFamily: font.heading, fontSize: 17, color: C.textPrimary, margin: "0 0 8px 0" }}>Bulk Student Enrollment</h2>
              <p style={{ color: C.textSecondary, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>Upload an Excel file with headers: <strong>RegNo, Name, Email, Mobile, BatchNo, Exam</strong>. The password will automatically lock to their respective Registration Numbers.</p>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleStudentUpload} disabled={loading} style={{ color: C.textPrimary, marginBottom: 16, fontSize: 13 }} />
              {studentLogs.length > 0 && (
                <div style={{ background: "#0F111A", padding: 14, borderRadius: 8, height: 120, overflowY: "auto", fontFamily: font.mono, fontSize: 11, color: C.textMuted, border: `1px solid ${C.border}` }}>
                  {studentLogs.map((log, idx) => <div key={idx} style={{ marginBottom: 4 }}>{log}</div>)}
                </div>
              )}
            </Card>

            {/* 2. SINGLE ADDITION MANAGEMENT CARD */}
            <Card>
              <h2 style={{ fontFamily: font.heading, fontSize: 17, color: C.textPrimary, margin: "0 0 16px 0" }}>Add Single Student Account</h2>
              <div className="admin-form-grid-layout">
                <Input label="Full Name String" value={sName} onChange={setSName} placeholder="e.g. Rahul Verma" />
                <Input label="Login E-Mail Address" type="email" value={sEmail} onChange={setSEmail} placeholder="rahul@domain.edu" />
                <Input label="Registration Number (Access Password)" value={sRegNo} onChange={setSRegNo} placeholder="e.g. 21BCE1094" />
                <Input label="Mobile Vector Tracker" value={sMobile} onChange={setSMobile} placeholder="e.g. 9876543210" />
                <Input label="Assigned Class Batch Code" value={sBatch} onChange={setSBatch} placeholder="e.g. CAT-2026-A" />
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Target Stream Pipeline</label>
                  <select 
                    value={sExam} 
                    onChange={(e) => setSExam(e.target.value)}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, fontFamily: font.body, fontSize: 14, outline: "none", cursor: "pointer" }}
                  >
                    <option value="" disabled>-- Select Exam --</option>
                    {availableExams.map(exam => <option key={exam} value={exam}>{exam}</option>)}
                  </select>
                </div>
              </div>
              <Btn onClick={handleAddSingleStudent} disabled={loading} style={{ marginTop: 20, width: "100%", justifyContent: "center" }}>
                {loading ? "Writing Profile..." : "Provision Student User"}
              </Btn>

              {singleStudentCreds && (
                <div style={{ marginTop: 16, padding: 14, background: "rgba(16, 185, 129, 0.08)", border: `1px solid ${C.green}`, borderRadius: 8, color: C.textPrimary, fontSize: 13 }}>
                  ✅ Account compiled! Username ID: <strong>{singleStudentCreds.email}</strong> | Secured Password: <strong>{singleStudentCreds.password}</strong>
                </div>
              )}
            </Card>

            {/* 3. BATCH MIGRATION LOGISTICS CARD */}
            <Card>
              <h2 style={{ fontFamily: font.heading, fontSize: 17, color: C.textPrimary, margin: "0 0 16px 0" }}>Transfer Student Batch Track</h2>
              <div className="admin-action-row-split">
                <Input label="Target Student Identity Email" type="email" value={uEmail} onChange={setUEmail} placeholder="student@example.com" />
                <Input label="Destination Batch Identity Target" value={uBatch} onChange={setUBatch} placeholder="e.g. CMAT-2027" />
              </div>
              <Btn onClick={handleUpdateBatch} disabled={loading} style={{ marginTop: 16, width: "100%", justifyContent: "center" }}>
                {loading ? "Migrating Data..." : "Execute Track Transfer"}
              </Btn>
            </Card>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* 4. FACULTY PROVISIONING MANAGEMENT CARD */}
            <Card>
              <h2 style={{ fontFamily: font.heading, fontSize: 17, color: C.textPrimary, margin: "0 0 16px 0" }}>Provision Teacher Account</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="admin-form-grid-layout">
                  <Input label="Faculty Profile Full Name" value={tName} onChange={setTName} placeholder="e.g. Prof. Anand Mehta" />
                  <Input label="Official Communication E-Mail Address" type="email" value={tEmail} onChange={setTEmail} placeholder="mehta@institute.org" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Assign Exam Authority Pipelines</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {availableExams.map(exam => (
                      <button
                        key={exam}
                        onClick={() => handleToggleExam(exam)}
                        style={{
                          padding: "6px 14px", borderRadius: 20, border: `1px solid ${tExams.includes(exam) ? C.accent : C.border}`,
                          background: tExams.includes(exam) ? C.accentDim : "transparent",
                          color: tExams.includes(exam) ? C.accentText : C.textMuted,
                          cursor: "pointer", fontWeight: 600, fontSize: 12, transition: "all 0.2s ease"
                        }}
                      >
                        {exam} {tExams.includes(exam) && "✓"}
                      </button>
                    ))}
                  </div>
                </div>
                <Btn onClick={handleCreateTeacher} disabled={loading} style={{ marginTop: 8, width: "100%", justifyContent: "center" }}>
                  {loading ? "Provisioning System Tokens..." : "Initialize Instructor Console Account"}
                </Btn>
              </div>
              {teacherCredentials && (
                <div style={{ marginTop: 20, padding: 14, background: "rgba(16, 185, 129, 0.08)", border: `1px solid ${C.green}`, borderRadius: 8, color: C.textPrimary, fontSize: 13 }}>
                  ✅ Instructor profile added! Default Temporary Login Password: <strong>{teacherCredentials.password}</strong>
                </div>
              )}
            </Card>

            {/* 5. ACTIVE STAFF MANAGEMENT ROSTER GRID CARD */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
                <h3 style={{ margin: 0, fontSize: 16, fontFamily: font.heading, color: C.textPrimary }}>Active Staff Faculty Members</h3>
              </div>
              
              <div className="admin-table-scroll-view">
                <table className="teacher-data-matrix-table">
                  <thead>
                    <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ color: C.textSecondary, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Instructor Profile</th>
                      <th style={{ color: C.textSecondary, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>E-Mail Destination</th>
                      <th style={{ color: C.textSecondary, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Assigned Authority Tracks</th>
                      <th style={{ color: C.textSecondary, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Management Operations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachersList.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: "32px", textAlign: "center", color: C.textMuted }}>No active structural teacher account entities verified in registry.</td></tr>
                    ) : (
                      teachersList.map((t, idx) => (
                        <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? "transparent" : C.surface }}>
                          <td style={{ color: C.textPrimary, fontWeight: 600 }}>{t.name}</td>
                          <td style={{ color: C.textSecondary, fontFamily: font.mono, fontSize: 13 }}>{t.email}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {t.exams?.map(e => <Badge key={e} color="accent">{e}</Badge>)}
                            </div>
                          </td>
                          <td style={{ padding: "12px 20px" }}>
                            <div className="teacher-actions-flex-cell" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <button onClick={() => openEditTeacher(t)} style={{ background: "none", border: `1px solid ${C.border}`, color: C.textPrimary, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Modify Tracks</button>
                              <button onClick={() => handleRemoveTeacher(t.id, t.name)} style={{ background: "none", border: `1px solid ${C.red}33`, color: C.redText, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Revoke Console</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* CORE SUBSYSTEM TRACK AUTHORITY EDIT INTERCEPT OVERLAY MODAL */}
      {editTeacher && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 17, 23, 0.82)", display: "grid", placeItems: "center", zIndex: 600, padding: 16 }}>
          <Card style={{ width: 420, maxWidth: "100%", padding: 24 }}>
            <h2 style={{ fontFamily: font.heading, fontSize: 17, margin: "0 0 16px", color: C.textPrimary }}>Edit Authority Pipelines: {editTeacher.name}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              {availableExams.map(exam => (
                <button
                  key={exam}
                  onClick={() => setEditExams(prev => prev.includes(exam) ? prev.filter(e => e !== exam) : [...prev, exam])}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: `1px solid ${editExams.includes(exam) ? C.accent : C.border}`,
                    background: editExams.includes(exam) ? C.accentDim : "transparent",
                    color: editExams.includes(exam) ? C.accentText : C.textMuted,
                    cursor: "pointer", fontWeight: 600, fontSize: 12, transition: "all 0.2s ease"
                  }}
                >
                  {exam} {editExams.includes(exam) && "✓"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setEditTeacher(null)} disabled={loading}>Cancel</Btn>
              <Btn variant="primary" onClick={saveTeacherExams} disabled={loading}>{loading ? "Saving Records..." : "Commit Structure Changes"}</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}