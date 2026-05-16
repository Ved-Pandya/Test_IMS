import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Badge, Btn, Card, Input, C, font } from "../ui/Primitives";
import { createStudentAsAdmin, createTeacherAsAdmin, updateStudentBatchByEmail } from "../../firebase/auth";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/config";

export default function AdminDashboard({ profile, onLogout }) {
  const [tab, setTab] = useState("students");
  const [loading, setLoading] = useState(false);
  
  // Bulk Upload State
  const [studentLogs, setStudentLogs] = useState([]);

  // UPDATED: Single Student State (Added Mobile and Exam)
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

  // Fetch teachers when switching to the teachers tab
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

  // --- BULK ENROLLMENT PARSER ---
  const handleStudentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setStudentLogs(["Reading file..."]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        setStudentLogs(prev => [...prev, `Found ${rows.length} students. Starting creation...`]);
        const results = [];

        for (let row of rows) {
          const regNo = String(row["RegNo"] || row["reg no"] || row["Registration No"] || "").trim();
          const name = String(row["Name"] || row["name"] || "").trim();
          const email = String(row["Email"] || row["email"] || "").trim().toLowerCase();
          const mobile = String(row["Mobile"] || row["mobile"] || "").trim();
          const batch = String(row["BatchNo"] || row["batch no"] || row["Batch"] || "").trim();
          const exam = String(row["Exam"] || row["exam"] || "").trim();

          if (!email || !name) {
            setStudentLogs(prev => [...prev, `⚠️ Skipped row: Missing Name or Email`]);
            continue;
          }

          try {
            const result = await createStudentAsAdmin({ 
              name, email, batch, regNo, mobile, exam
            });
            
            results.push({
              "Registration No": regNo,
              "Name": name,
              "Email": email,
              "Password": result.password || "Generated",
              "Mobile": mobile,
              "Batch": batch,
              "Exam": exam,
              "Status": "Success"
            });
            setStudentLogs(prev => [...prev, `✅ Created: ${email}`]);
          } catch (err) {
            results.push({
              "Registration No": regNo, "Name": name, "Email": email,
              "Password": "-", "Mobile": mobile, "Batch": batch, "Exam": exam,
              "Status": `Error: ${err.message}`
            });
            setStudentLogs(prev => [...prev, `❌ Failed ${email}: ${err.message}`]);
          }
        }

        const worksheet = XLSX.utils.json_to_sheet(results);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, worksheet, "Credentials");
        XLSX.writeFile(wb, "Student_Login_Credentials.xlsx");
        setStudentLogs(prev => [...prev, "🎉 Finished! Credentials spreadsheet downloaded."]);
      } catch (err) {
        setStudentLogs(prev => [...prev, `Critical Error: ${err.message}`]);
      } finally {
        setLoading(false);
        e.target.value = ""; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- UPDATED: ADD SINGLE STUDENT ---
  const handleAddSingleStudent = async () => {
    if (!sName || !sEmail || !sBatch || !sRegNo || !sMobile || !sExam) {
      return alert("All fields are required for a single student.");
    }
    
    setLoading(true);
    try {
      const result = await createStudentAsAdmin({ 
        name: sName.trim(), 
        email: sEmail.trim(), 
        batch: sBatch.trim(), 
        regNo: sRegNo.trim(),
        mobile: sMobile.trim(),
        exam: sExam.trim()
      });
      setSingleStudentCreds(result);
      
      // Clear all fields on success
      setSName(""); setSEmail(""); setSBatch(""); 
      setSRegNo(""); setSMobile(""); setSExam("");
    } catch (err) {
      alert("Failed to add student: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBatch = async () => {
    if (!uEmail || !uBatch) return alert("Email and new batch are required.");
    setLoading(true);
    try {
      const studentName = await updateStudentBatchByEmail(uEmail.trim(), uBatch.trim());
      alert(`Success! Moved ${studentName} to batch: ${uBatch.trim()}`);
      setUEmail("");
      setUBatch("");
    } catch (err) {
      alert("Update Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeacher = async () => {
    if (!tName || !tEmail) return alert("Name and Email are required.");
    if (tExams.length === 0) return alert("Please assign at least one exam to this teacher.");

    setLoading(true);
    try {
      const result = await createTeacherAsAdmin({ name: tName.trim(), email: tEmail.trim(), exams: tExams });
      setTeacherCredentials(result);
      setTName(""); setTEmail(""); setTExams([]);
      fetchTeachers(); 
    } catch (err) {
      alert("Failed to create teacher: " + err.message);
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
      await updateDoc(doc(db, "users", editTeacher.uid), { exams: editExams });
      setEditTeacher(null);
      fetchTeachers();
    } catch (err) {
      alert("Failed to update exams: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTeacher = async (uid, name) => {
    if (!window.confirm(`Are you sure you want to permanently remove ${name}'s dashboard access?`)) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", uid), { role: "revoked" });
      fetchTeachers();
    } catch (err) {
      alert("Failed to remove teacher: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60 }}>
        <span style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: C.textPrimary }}>📋 ExamPortal Admin</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 14, color: C.textSecondary }}>{profile.name}</span>
          <Btn variant="ghost" onClick={onLogout} style={{ padding: "7px 14px", fontSize: 13 }}>Sign out</Btn>
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: "40px auto", padding: "0 24px" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <Btn variant={tab === "students" ? "primary" : "ghost"} onClick={() => setTab("students")}>Manage Students</Btn>
          <Btn variant={tab === "teachers" ? "primary" : "ghost"} onClick={() => setTab("teachers")}>Manage Teachers</Btn>
        </div>

        {tab === "students" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Bulk Add */}
            <Card>
              <h2 style={{ fontFamily: font.heading, color: C.textPrimary, margin: "0 0 8px 0" }}>Bulk Student Enrollment</h2>
              <p style={{ color: C.textSecondary, fontSize: 14, marginBottom: 16 }}>Upload an Excel file with headers: <strong>RegNo, Name, Email, Mobile, BatchNo, Exam</strong>.</p>
              <input type="file" accept=".xlsx, .csv" onChange={handleStudentUpload} disabled={loading} style={{ color: C.textPrimary, marginBottom: 16 }} />
              {studentLogs.length > 0 && (
                <div style={{ background: "#000", padding: 16, borderRadius: 8, height: 120, overflowY: "auto", fontFamily: font.mono, fontSize: 12, color: C.textMuted }}>
                  {studentLogs.map((log, idx) => <div key={idx}>{log}</div>)}
                </div>
              )}
            </Card>

            {/* UPDATED: Add Single Student */}
            <Card>
              <h2 style={{ fontFamily: font.heading, color: C.textPrimary, margin: "0 0 16px 0" }}>Add Single Student</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Input label="Full Name" value={sName} onChange={setSName} placeholder="Student Name" />
                <Input label="Email" type="email" value={sEmail} onChange={setSEmail} placeholder="student@example.com" />
                <Input label="Registration No." value={sRegNo} onChange={setSRegNo} placeholder="e.g. REG-001" />
                <Input label="Mobile" value={sMobile} onChange={setSMobile} placeholder="e.g. 9876543210" />
                <Input label="Batch" value={sBatch} onChange={setSBatch} placeholder="e.g. CAT-2026" />
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Exam</label>
                  <select 
                    value={sExam} 
                    onChange={(e) => setSExam(e.target.value)}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, fontFamily: font.body, fontSize: 14, outline: "none", cursor: "pointer" }}
                  >
                    <option value="" disabled>-- Select Exam --</option>
                    {availableExams.map(exam => <option key={exam} value={exam}>{exam}</option>)}
                  </select>
                </div>
              </div>
              <Btn onClick={handleAddSingleStudent} disabled={loading} style={{ marginTop: 24 }}>
                {loading ? "Adding..." : "Add Student"}
              </Btn>

              {singleStudentCreds && (
                <div style={{ marginTop: 16, padding: 16, background: C.green + "22", border: `1px solid ${C.green}`, borderRadius: 8, color: C.textPrimary }}>
                  ✅ Student created! <strong>Password: {singleStudentCreds.password}</strong>
                </div>
              )}
            </Card>

            {/* Update Batch */}
            <Card>
              <h2 style={{ fontFamily: font.heading, color: C.textPrimary, margin: "0 0 16px 0" }}>Transfer Student Batch</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "end" }}>
                <Input label="Student's Email" type="email" value={uEmail} onChange={setUEmail} placeholder="student@example.com" />
                <Input label="New Batch Name" value={uBatch} onChange={setUBatch} placeholder="e.g. CAT-2027" />
              </div>
              <Btn onClick={handleUpdateBatch} disabled={loading} style={{ marginTop: 16 }}>
                {loading ? "Updating..." : "Transfer Batch"}
              </Btn>
            </Card>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Create Teacher */}
            <Card>
              <h2 style={{ fontFamily: font.heading, color: C.textPrimary, margin: "0 0 16px 0" }}>Provision Teacher Account</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
                <Input label="Teacher Name" value={tName} onChange={setTName} placeholder="e.g. Dr. R. Sharma" />
                <Input label="Email Address" type="email" value={tEmail} onChange={setTEmail} placeholder="teacher@institute.com" />
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Assign Exams</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {availableExams.map(exam => (
                      <button
                        key={exam}
                        onClick={() => handleToggleExam(exam)}
                        style={{
                          padding: "6px 12px", borderRadius: 20, border: `1px solid ${tExams.includes(exam) ? C.accent : C.border}`,
                          background: tExams.includes(exam) ? C.accentDim : "transparent",
                          color: tExams.includes(exam) ? C.accentText : C.textMuted,
                          cursor: "pointer", fontWeight: 600, fontSize: 12
                        }}
                      >
                        {exam} {tExams.includes(exam) && "✓"}
                      </button>
                    ))}
                  </div>
                </div>
                <Btn onClick={handleCreateTeacher} disabled={loading} style={{ marginTop: 12 }}>
                  {loading ? "Creating..." : "Create Teacher Account"}
                </Btn>
              </div>
              {teacherCredentials && (
                <div style={{ marginTop: 24, padding: 16, background: C.green + "22", border: `1px solid ${C.green}`, borderRadius: 8, color: C.textPrimary }}>
                  ✅ Teacher created! <strong>Password: {teacherCredentials.password}</strong>
                </div>
              )}
            </Card>

            {/* List Active Teachers */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
                <h3 style={{ margin: 0, fontSize: 15, fontFamily: font.heading, color: C.textPrimary }}>Active Teachers</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ padding: "12px 20px", color: C.textSecondary, fontWeight: 600, fontSize: 12 }}>Name</th>
                      <th style={{ padding: "12px 20px", color: C.textSecondary, fontWeight: 600, fontSize: 12 }}>Email</th>
                      <th style={{ padding: "12px 20px", color: C.textSecondary, fontWeight: 600, fontSize: 12 }}>Assigned Exams</th>
                      <th style={{ padding: "12px 20px", color: C.textSecondary, fontWeight: 600, fontSize: 12 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachersList.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: "32px", textAlign: "center", color: C.textMuted }}>No active teachers found.</td></tr>
                    ) : (
                      teachersList.map((t, idx) => (
                        <tr key={t.uid} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? "transparent" : C.surface }}>
                          <td style={{ padding: "12px 20px", color: C.textPrimary, fontWeight: 500 }}>{t.name}</td>
                          <td style={{ padding: "12px 20px", color: C.textSecondary }}>{t.email}</td>
                          <td style={{ padding: "12px 20px" }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {t.exams?.map(e => <Badge key={e} color="accent">{e}</Badge>)}
                            </div>
                          </td>
                          <td style={{ padding: "12px 20px", display: "flex", gap: 10 }}>
                            <button onClick={() => openEditTeacher(t)} style={{ background: "none", border: `1px solid ${C.border}`, color: C.textPrimary, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Edit</button>
                            <button onClick={() => handleRemoveTeacher(t.uid, t.name)} style={{ background: "none", border: `1px solid ${C.red}44`, color: C.redText, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Remove</button>
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

      {/* Edit Teacher Exams Modal */}
      {editTeacher && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 17, 23, 0.8)", display: "grid", placeItems: "center", zIndex: 100 }}>
          <Card style={{ width: 420, maxWidth: "90%", padding: 32 }}>
            <h2 style={{ fontFamily: font.heading, fontSize: 18, margin: "0 0 16px", color: C.textPrimary }}>Edit Exams: {editTeacher.name}</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
              {availableExams.map(exam => (
                <button
                  key={exam}
                  onClick={() => setEditExams(prev => prev.includes(exam) ? prev.filter(e => e !== exam) : [...prev, exam])}
                  style={{
                    padding: "6px 12px", borderRadius: 20, border: `1px solid ${editExams.includes(exam) ? C.accent : C.border}`,
                    background: editExams.includes(exam) ? C.accentDim : "transparent",
                    color: editExams.includes(exam) ? C.accentText : C.textMuted,
                    cursor: "pointer", fontWeight: 600, fontSize: 12
                  }}
                >
                  {exam} {editExams.includes(exam) && "✓"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setEditTeacher(null)} disabled={loading}>Cancel</Btn>
              <Btn variant="primary" onClick={saveTeacherExams} disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}