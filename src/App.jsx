import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { login, logout } from "./firebase/auth";
import AuthScreen from "./components/auth/AuthScreen";
import StudentDashboard from "./components/dashboard/StudentDashboard";
import TeacherDashboard from "./components/dashboard/TeacherDashboard";
import AdminDashboard from "./components/dashboard/AdminDashboard";
import ExamView from "./components/exam/ExamView";
import AttemptReview from "./components/dashboard/AttemptReview";
import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase/config";

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

  const handleExamSubmitPipeline = async (attemptPayload) => {
    if (previewMode) {
      console.log("Simulated Sandbox Execution Payload:", attemptPayload);
      alert("🎉 Simulation Test Complete! All validation engines verified. No historical record logs were appended to your production Firestore collection databases.");
      setSubmittedAttempt(attemptPayload);
      setView("review");
    } else {
      try {
        // Save the live student results to production Firestore
        const docRef = await addDoc(collection(db, "attempts"), attemptPayload);
        const attemptWithId = { id: docRef.id, ...attemptPayload };
        setSubmittedAttempt(attemptWithId);
        setView("review");
      } catch (err) {
        alert("Failed to submit attempt data to cloud server: " + err.message);
      }
    }
  };

  if (view === "exam" && activeTest) {
    return (
      <ExamView
        test={activeTest}
        studentProfile={{
          uid: previewMode ? "demo-student" : user.uid,
          name: previewMode ? `${profile?.name || "Teacher"} (Preview Mode)` : profile?.name || "Student"
        }}
        onSubmitExam={handleExamSubmitPipeline}
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
    return (
      <TeacherDashboard 
        profile={profile} 
        onLogout={logout} 
        onDemoTest={(test) => handleStartTest(test, true)} 
      />
    );
  }

  return (
    <StudentDashboard 
      profile={profile} 
      onLogout={logout} 
      onStartTest={(test) => handleStartTest(test, false)} 
    />
  );
}