// src/firebase/tests.js
// Create, read, update, delete tests (teacher-side)

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

// ─── Teacher: create a new test ───────────────────────────────────────────────
// sections format: [{ id, name, questions: [{ id, type, text, passage, imageUrl, options, correct }] }]
export async function createTest({ title, duration, sections, teacherId, createdBy }) {
  const ref = await addDoc(collection(db, "tests"), {
    title,
    duration,        // in minutes
    sections,
    teacherId,
    createdBy,
    enrolledStudents: [],
    isActive: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Teacher: fetch all tests they created ────────────────────────────────────
export async function getTeacherTests(teacherId) {
  const q = query(collection(db, "tests"), where("teacherId", "==", teacherId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Anyone: fetch a single test by ID ───────────────────────────────────────
export async function getTest(testId) {
  const snap = await getDoc(doc(db, "tests", testId));
  if (!snap.exists()) throw new Error("Test not found");
  return { id: snap.id, ...snap.data() };
}

// ─── Teacher: update test details ─────────────────────────────────────────────
export async function updateTest(testId, updates) {
  await updateDoc(doc(db, "tests", testId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// ─── Teacher: delete a test ───────────────────────────────────────────────────
export async function deleteTest(testId) {
  await deleteDoc(doc(db, "tests", testId));
}

// ─── Teacher: toggle test active/inactive ─────────────────────────────────────
export async function setTestActive(testId, isActive) {
  await updateDoc(doc(db, "tests", testId), { isActive });
}

// ─── Teacher: enroll students by their UIDs ───────────────────────────────────
export async function enrollStudents(testId, studentUids) {
  const snap = await getDoc(doc(db, "tests", testId));
  const current = snap.data().enrolledStudents || [];
  const merged = Array.from(new Set([...current, ...studentUids]));
  await updateDoc(doc(db, "tests", testId), { enrolledStudents: merged });
}

// ─── Student: fetch all tests they are enrolled in ───────────────────────────
export async function getStudentTests(studentId) {
  const q = query(
    collection(db, "tests"),
    where("enrolledStudents", "array-contains", studentId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
