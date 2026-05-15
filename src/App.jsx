import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { login, logout } from "./firebase/auth"; // <-- 'register' is removed here
import AuthScreen from "./components/auth/AuthScreen";
import StudentDashboard from "./components/dashboard/StudentDashboard";
import TeacherDashboard from "./components/dashboard/TeacherDashboard";
import AdminDashboard from "./components/dashboard/AdminDashboard";
import ExamView from "./components/exam/ExamView";
import AttemptReview from "./components/dashboard/AttemptReview";

export default function App() {
  const { user, profile, loading } = useAuth();
  const [view, setView] = useState("dashboard");
  const [activeTest, setActiveTest] = useState(null);
  const [submittedAttempt, setSubmittedAttempt] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0f1117",
          color: "#eef1f8",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: 32,
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Exam Portal</div>
          <div style={{ color: "#8892a8" }}>Loading authentication state…</div>
        </div>
      </div>
    );
  }

  // If no user is logged in, show the pure Login screen (no registration)
  if (!user) {
    return <AuthScreen onLogin={login} />; 
  }

  const handleStartTest = (test, preview = false) => {
    setActiveTest(test);
    setPreviewMode(preview);
    setView("exam");
  };

  const resetSession = () => {
    setActiveTest(null);
    setSubmittedAttempt(null);
    setPreviewMode(false);
    setView("dashboard");
  };

  if (view === "exam" && activeTest) {
    return (
      <ExamView
        test={activeTest}
        studentId={previewMode ? "demo-student" : user.uid}
        studentName={previewMode ? "Demo Student" : profile?.name || "Student"}
        previewMode={previewMode}
        onCancel={resetSession}
        onSubmit={(attempt) => {
          setSubmittedAttempt(attempt);
          setView("review");
        }}
      />
    );
  }

  if (view === "review" && submittedAttempt && activeTest) {
    return <AttemptReview attempt={submittedAttempt} test={activeTest} onBack={resetSession} />;
  }

  // Routing based on the user's role
  if (profile?.role === "admin") {
    return <AdminDashboard profile={profile} onLogout={logout} />;
  }

  if (profile?.role === "teacher") {
    return <TeacherDashboard profile={profile} onLogout={logout} onDemoTest={(test) => handleStartTest(test, true)} />;
  }

  return <StudentDashboard profile={profile} onLogout={logout} onStartTest={(test) => handleStartTest(test)} />;
}