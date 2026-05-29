import { useState, useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { login, logout } from "./firebase/auth";
import AuthScreen from "./components/auth/AuthScreen";
import StudentDashboard from "./components/dashboard/StudentDashboard";
import TeacherDashboard from "./components/dashboard/TeacherDashboard";
import AdminDashboard from "./components/dashboard/AdminDashboard";
import ExamView from "./components/exam/ExamView";
import AttemptReview from "./components/dashboard/AttemptReview";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase/config";

export default function App() {
  const { user, profile: initialProfile, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  
  const [view, setView] = useState("dashboard");
  const [activeTest, setActiveTest] = useState(null);
  const [submittedAttempt, setSubmittedAttempt] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  // --- ENGINE COMPATIBILITY SYNCHRONIZER LAYER ---
  useEffect(() => {
    async function synchronizeUserProfile() {
      if (!user) {
        setProfile(null);
        return;
      }
      
      setProfileLoading(true);
      try {
        // 1. Try structural lookup using the email identification key directly
        const emailKey = user.email?.toLowerCase().trim();
        if (emailKey) {
          const emailSnap = await getDoc(doc(db, "users", emailKey));
          if (emailSnap.exists()) {
            setProfile(emailSnap.data());
            return;
          }
        }

        // 2. Fallback lookup using standard user.uid
        const uidSnap = await getDoc(doc(db, "users", user.uid));
        if (uidSnap.exists()) {
          setProfile(uidSnap.data());
          return;
        }

        // 3. Last fallback: Preserve initial wrapper data profile if database keys are unpopulated
        if (initialProfile) {
          setProfile(initialProfile);
        } else {
          setProfile({ name: user.email?.split("@")[0] || "User", role: "student", uid: user.uid });
        }
      } catch (err) {
        console.error("Profile synchronization loop exception:", err);
        setProfile(initialProfile || { name: "User", role: "student", uid: user.uid });
      } finally {
        setProfileLoading(false);
      }
    }

    synchronizeUserProfile();
  }, [user, initialProfile]);

  const loading = authLoading || profileLoading;

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
          <div style={{ color: "#8892a8" }}>Synchronizing secure profile parameters…</div>
        </div>
      </div>
    );
  }

  // If no user is logged in, show the clean login interface
  if (!user || !profile) {
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
          uid: previewMode ? "demo-student" : (profile.email || user.uid),
          name: previewMode ? `${profile?.name || "Teacher"} (Preview Mode)` : profile?.name || "Student"
        }}
        onSubmitExam={handleExamSubmitPipeline}
      />
    );
  }

  if (view === "review" && submittedAttempt && activeTest) {
    return <AttemptReview attempt={submittedAttempt} test={activeTest} onBack={resetSession} />;
  }

  // --- DYNAMIC DASHBOARD PORTAL ROUTER ---
  if (profile.role === "admin") {
    return <AdminDashboard profile={profile} onLogout={logout} />;
  }

  if (profile.role === "teacher") {
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