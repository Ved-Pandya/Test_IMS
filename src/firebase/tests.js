// src/firebase/tests.js
import { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

export async function createTest({ title, duration, sections, teacherId, createdBy }) {
  // Generate a random 4-digit PIN (1000 - 9999)
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  
  const ref = await addDoc(collection(db, "tests"), {
    title,
    duration,
    sections,
    teacherId,
    createdBy,
    enrolledStudents: [],
    isActive: true,
    pin: pin, // Save the PIN to the database
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTeacherTests(teacherId) {
  const q = query(collection(db, "tests"), where("teacherId", "==", teacherId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTest(testId) {
  const snap = await getDoc(doc(db, "tests", testId));
  if (!snap.exists()) throw new Error("Test not found");
  return { id: snap.id, ...snap.data() };
}

export async function updateTest(testId, updates) {
  await updateDoc(doc(db, "tests", testId), { ...updates, updatedAt: serverTimestamp() });
}

// NEW: Function to regenerate the PIN
export async function updateTestPin(testId) {
  const newPin = Math.floor(1000 + Math.random() * 9000).toString();
  await updateDoc(doc(db, "tests", testId), { pin: newPin });
  return newPin;
}

export async function deleteTest(testId) {
  await deleteDoc(doc(db, "tests", testId));
}

export async function setTestActive(testId, isActive) {
  await updateDoc(doc(db, "tests", testId), { isActive });
}

export async function enrollStudents(testId, studentUids) {
  const snap = await getDoc(doc(db, "tests", testId));
  const current = snap.data().enrolledStudents || [];
  const merged = Array.from(new Set([...current, ...studentUids]));
  await updateDoc(doc(db, "tests", testId), { enrolledStudents: merged });
}

export async function getStudentTests(studentId) {
  const q = query(collection(db, "tests"), where("enrolledStudents", "array-contains", studentId), where("isActive", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}