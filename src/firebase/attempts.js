// src/firebase/attempts.js
// Save and retrieve student test attempts

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

// ─── Student: submit their completed attempt ──────────────────────────────────
// Call this on manual submit, timer expiry, or auto-submit (violations)
export async function submitAttempt({
  testId,
  studentId,
  studentName,
  answers,       // { q1: 2, q2: 0, ... }
  score,
  total,
  timeTaken,     // seconds elapsed
  reason,        // "Manually submitted" | "Timer expired" | "Auto-submitted: ..."
  violations,    // [{ time, reason }, ...]
}) {
  const ref = await addDoc(collection(db, "attempts"), {
    testId,
    studentId,
    studentName,
    answers,
    score,
    total,
    timeTaken,
    reason,
    violations,
    submittedAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Teacher: get all attempts for a specific test ────────────────────────────
export async function getAttemptsForTest(testId) {
  const q = query(
    collection(db, "attempts"),
    where("testId", "==", testId),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Student: get their own attempts (all tests) ──────────────────────────────
export async function getStudentAttempts(studentId) {
  const q = query(
    collection(db, "attempts"),
    where("studentId", "==", studentId),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Fetch attempts for multiple tests ───────────────────────────────────────
export async function getAttemptsForTests(testIds) {
  if (!Array.isArray(testIds) || testIds.length === 0) {
    return [];
  }

  const batches = [];
  for (let i = 0; i < testIds.length; i += 10) {
    batches.push(testIds.slice(i, i + 10));
  }

  const allAttempts = [];
  for (const batch of batches) {
    const q = query(
      collection(db, "attempts"),
      where("testId", "in", batch),
      orderBy("submittedAt", "desc")
    );
    const snap = await getDocs(q);
    allAttempts.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  return allAttempts;
}

// ─── Check if a student has already attempted a test ─────────────────────────
export async function hasAttempted(testId, studentId) {
  const q = query(
    collection(db, "attempts"),
    where("testId", "==", testId),
    where("studentId", "==", studentId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
