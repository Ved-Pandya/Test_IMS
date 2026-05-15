// src/firebase/attempts.js
import { collection, addDoc, getDocs, doc, deleteDoc, query, where, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "./config";

const sortByNewest = (attempts) => {
  return attempts.sort((a, b) => {
    const timeA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
    const timeB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
    return timeB - timeA;
  });
};

export async function submitAttempt({ testId, studentId, studentName, answers, score, total, timeTaken, reason, violations }) {
  const ref = await addDoc(collection(db, "attempts"), {
    testId, studentId, studentName, answers, score, total, timeTaken, reason, violations, submittedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getAttemptsForTest(testId) {
  const q = query(collection(db, "attempts"), where("testId", "==", testId));
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return sortByNewest(docs);
}

export async function getStudentAttempts(studentId) {
  const q = query(collection(db, "attempts"), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return sortByNewest(docs);
}

export async function getAttemptsForTests(testIds) {
  if (!Array.isArray(testIds) || testIds.length === 0) return [];
  const batches = [];
  for (let i = 0; i < testIds.length; i += 10) { batches.push(testIds.slice(i, i + 10)); }
  const allAttempts = [];
  for (const batch of batches) {
    const q = query(collection(db, "attempts"), where("testId", "in", batch));
    const snap = await getDocs(q);
    allAttempts.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return sortByNewest(allAttempts);
}

export async function hasAttempted(testId, studentId) {
  const q = query(collection(db, "attempts"), where("testId", "==", testId), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function deleteAttempt(attemptId) {
  await deleteDoc(doc(db, "attempts", attemptId));
}

// NEW: Real-time listener for live classroom monitoring
export function subscribeToTestAttempts(testId, callback) {
  const q = query(collection(db, "attempts"), where("testId", "==", testId));
  
  // onSnapshot runs immediately, and then runs again every time the data changes
  const unsubscribe = onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(sortByNewest(docs));
  });

  return unsubscribe; 
}