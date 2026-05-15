// INTEGRATION GUIDE
// How to connect ExamView, TeacherDashboard, and ResultView to Firebase
// ─────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// 1. WRAP YOUR APP WITH AUTH STATE
// ══════════════════════════════════════════════════════════════

// In App.jsx, replace the hardcoded view state with auth-aware routing:

import { useAuth } from "./hooks/useAuth";
import { login, register, logout } from "./firebase/auth";

export default function App() {
  const { user, profile, loading } = useAuth();
  const [view, setView] = useState("dashboard");
  const [activeTest, setActiveTest] = useState(null);
  const [result, setResult] = useState(null);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen onLogin={login} onRegister={register} />;

  if (view === "exam") return (
    <ExamView
      test={activeTest}
      studentId={user.uid}
      studentName={profile.name}
      onSubmit={(r) => { setResult(r); setView("result"); }}
    />
  );
  if (view === "result") return <ResultView result={result} onBack={() => setView("dashboard")} />;

  if (profile.role === "teacher") return (
    <TeacherDashboard
      teacherId={user.uid}
      teacherName={profile.name}
      onStartTest={(test) => { setActiveTest(test); setView("exam"); }}
    />
  );

  return (
    <StudentDashboard
      studentId={user.uid}
      onStartTest={(test) => { setActiveTest(test); setView("exam"); }}
    />
  );
}


// ══════════════════════════════════════════════════════════════
// 2. TEACHER DASHBOARD — load real tests
// ══════════════════════════════════════════════════════════════

import { getTeacherTests, createTest } from "./firebase/tests";
import { getAttemptsForTest } from "./firebase/attempts";

// Inside TeacherDashboard component:
const [tests, setTests] = useState([]);
const [attempts, setAttempts] = useState({});

useEffect(() => {
  getTeacherTests(teacherId).then(setTests);
}, [teacherId]);

// When a teacher clicks a test to view results:
async function loadResults(testId) {
  const data = await getAttemptsForTest(testId);
  setAttempts((prev) => ({ ...prev, [testId]: data }));
}


// ══════════════════════════════════════════════════════════════
// 3. EXAM VIEW — receive real test data as a prop
// ══════════════════════════════════════════════════════════════

// Change ExamView signature from hardcoded SAMPLE_TEST to:
function ExamView({ test, studentId, studentName, onSubmit }) {
  // Replace SAMPLE_TEST with `test` everywhere
  // Replace FLAT_QUESTIONS with:
  const flatQuestions = test.sections.flatMap((s) =>
    s.questions.map((q) => ({ ...q, sectionName: s.name }))
  );
  // ... rest of component unchanged
}


// ══════════════════════════════════════════════════════════════
// 4. SUBMIT — save attempt to Firestore
// ══════════════════════════════════════════════════════════════

import { submitAttempt } from "./firebase/attempts";

// In ExamView, replace the onSubmit call with:
const doSubmit = useCallback(async (reason) => {
  if (submittedRef.current) return;
  submittedRef.current = true;
  clearInterval(timerRef.current);

  const score = flatQuestions.filter((q) => answers[q.id] === q.correct).length;
  const attemptData = {
    testId: test.id,
    studentId,
    studentName,
    answers,
    score,
    total: flatQuestions.length,
    timeTaken: test.duration * 60 - secondsLeft,
    reason,
    violations,
  };

  await submitAttempt(attemptData); // save to Firestore
  onSubmit(attemptData);            // navigate to result screen
}, [answers, violations, secondsLeft, test, studentId, studentName, onSubmit]);


// ══════════════════════════════════════════════════════════════
// 5. CREATE TEST WITH IMAGE UPLOAD (teacher)
// ══════════════════════════════════════════════════════════════

import { createTest } from "./firebase/tests";
import { uploadQuestionImage } from "./firebase/storage";

async function handleCreateTest(formData, imageFiles) {
  // First create the test to get a Firestore ID
  const testId = await createTest({
    title: formData.title,
    duration: formData.duration,
    sections: formData.sections,
    teacherId: currentUser.uid,
    createdBy: profile.name,
  });

  // Then upload any question images
  for (const [questionId, file] of Object.entries(imageFiles)) {
    const url = await uploadQuestionImage(file, testId, questionId);
    // Update the question's imageUrl in Firestore
    // (fetch the test, find the question, update imageUrl, call updateTest)
  }
}


// ══════════════════════════════════════════════════════════════
// 6. GUARD AGAINST REPEAT ATTEMPTS
// ══════════════════════════════════════════════════════════════

import { hasAttempted } from "./firebase/attempts";

// In StudentDashboard, before showing "Start Test":
async function handleStartTest(test) {
  const already = await hasAttempted(test.id, studentId);
  if (already) {
    alert("You have already attempted this test.");
    return;
  }
  onStartTest(test);
}


// ══════════════════════════════════════════════════════════════
// 7. ENV VARIABLES (keep your API key out of git)
// ══════════════════════════════════════════════════════════════

// Create a .env file in your project root:
// VITE_FIREBASE_API_KEY=your_key
// VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
// VITE_FIREBASE_PROJECT_ID=your_project_id
// VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
// VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
// VITE_FIREBASE_APP_ID=your_app_id

// Then in config.js use:
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Add .env to .gitignore — never commit API keys to git.
