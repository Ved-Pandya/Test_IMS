import { useEffect, useState } from "react";
import { Badge, Btn, Card, C, font } from "../ui/Primitives";
import { createTest, getTeacherTests } from "../../firebase/tests";
import { getAttemptsForTest, getAttemptsForTests } from "../../firebase/attempts";
import TestCreationForm from "./TestCreationForm";
import TeacherTestDetail from "./TeacherTestDetail";

export default function TeacherDashboard({ profile, onLogout, onDemoTest }) {
  const [tab, setTab] = useState("tests");
  const [selectedTest, setSelectedTest] = useState(null);
  const [tests, setTests] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
  const [selectedAttempts, setSelectedAttempts] = useState([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    getTeacherTests(profile.uid)
      .then(async (loadedTests) => {
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
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Unable to load teacher data.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profile.uid]);

  const openTestDetails = async (test) => {
    setSelectedTest(test);
    setSelectedAttempts([]);
    setAttemptsLoading(true);
    try {
      const loadedAttempts = await getAttemptsForTest(test.id);
      setSelectedAttempts(loadedAttempts);
    } catch (err) {
      setError(err.message || "Unable to load attempts.");
    } finally {
      setAttemptsLoading(false);
    }
  };

  const handleCreateTest = async (newTestData) => {
    setCreating(true);
    try {
      const testId = await createTest(newTestData);
      const createdTest = { ...newTestData, id: testId, enrolledStudents: [], isActive: true };
      setTests((current) => [createdTest, ...current]);
      setCreating(false);
    } catch (err) {
      setError(err.message || "Unable to create test.");
      setCreating(false);
    }
  };

  const totalAttempts = allAttempts.length;
  const autoSubmits = allAttempts.filter((attempt) => attempt.reason?.includes("Auto")).length;
  const myTests = tests;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, color: C.textPrimary, fontFamily: font.body }}>
        <div>Loading teacher dashboard…</div>
      </div>
    );
  }

  if (creating) {
    return (
      <TestCreationForm teacherId={profile.uid} teacherName={profile.name} onBack={() => setCreating(false)} onSave={handleCreateTest} />
    );
  }

  if (selectedTest) {
    return (
      <TeacherTestDetail
        test={selectedTest}
        attempts={attemptsLoading ? [] : selectedAttempts}
        onBack={() => setSelectedTest(null)}
        onDemo={() => onDemoTest(selectedTest)}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60 }}>
        <span style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: C.textPrimary }}>📋 ExamPortal</span>
        <div style={{ width: 1, height: 28, background: C.border, margin: "0 18px" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: 0.3 }}>Teacher</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.accentDim, border: `1px solid ${C.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: C.accentText }}>
            {profile.name.split(" ").map((item) => item[0]).join("").slice(0, 2)}
          </div>
          <span style={{ fontSize: 14, color: C.textSecondary }}>{profile.name}</span>
          <Btn variant="ghost" onClick={onLogout} style={{ padding: "7px 14px", fontSize: 13 }}>Sign out</Btn>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: font.heading, fontSize: 24, fontWeight: 800, color: C.textPrimary, margin: 0 }}>My Tests</h1>
            <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 14 }}>{myTests.length} test{myTests.length !== 1 ? "s" : ""} created</p>
          </div>
          <Btn onClick={() => setCreating(true)}>+ Create New Test</Btn>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 32 }}>
          {[
            ["Total Tests", myTests.length, C.accent],
            ["Total Questions", myTests.reduce((sum, test) => sum + test.sections.flatMap((section) => section.questions).length, 0), C.textPrimary],
            ["Total Attempts", totalAttempts, C.green],
            ["Auto Submits", autoSubmits, C.red],
          ].map(([label, value, color]) => (
            <Card key={label} style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: font.heading, color }}>{value}</div>
            </Card>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {myTests.map((test) => {
            const attemptsForTest = allAttempts.filter((attempt) => attempt.testId === test.id);
            const avgScore = attemptsForTest.length
              ? Math.round(attemptsForTest.reduce((sum, attempt) => sum + (attempt.score / attempt.total) * 100, 0) / attemptsForTest.length)
              : null;
            const autoCount = attemptsForTest.filter((attempt) => attempt.reason.includes("Auto")).length;
            const totalQ = test.sections.flatMap((section) => section.questions).length;
            return (
              <Card key={test.id} style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: font.heading, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{test.title}</span>
                    <Badge color={test.isActive ? "green" : "amber"}>{test.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted, display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <span>⏱ {test.duration} min</span>
                    <span>📝 {totalQ} questions · {test.sections.length} sections</span>
                    <span>👥 {test.enrolledStudents.length} enrolled</span>
                    <span>📊 {attemptsForTest.length} attempts{avgScore !== null ? ` · avg ${avgScore}%` : ""}</span>
                    {autoCount > 0 && <span style={{ color: C.redText }}>⚠ {autoCount} auto-submit{autoCount > 1 ? "s" : ""}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <Btn variant="ghost" onClick={() => openTestDetails(test)} style={{ fontSize: 13, padding: "8px 16px" }}>View Results</Btn>
                  <Btn variant="ghost" onClick={() => onDemoTest(test)} style={{ fontSize: 13, padding: "8px 16px" }}>Preview →</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
