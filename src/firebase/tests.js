// src/firebase/tests.js
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp, 
  arrayUnion 
} from "firebase/firestore";
import { db } from "./config";

/**
 * Creates a new test and generates a random 4-digit classroom PIN.
 * UPDATED: Now properly accepts and saves the custom markingScheme (+4 / -1)
 */
export async function createTest({ title, duration, sections, teacherId, createdBy, markingScheme }) {
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  
  const ref = await addDoc(collection(db, "tests"), {
    title,
    duration,
    sections,
    teacherId,
    createdBy,
    // Safely fallback to +1 / 0 if the teacher doesn't specify one
    markingScheme: markingScheme || { correct: 1, incorrect: 0 }, 
    enrolledStudents: [], 
    isActive: true,
    pin: pin,
    createdAt: serverTimestamp(),
  });
  
  return ref.id;
}

/**
 * Fetches all tests created by a specific teacher for their dashboard.
 * Sorts them so the newest tests appear at the top.
 */
export async function getTeacherTests(teacherId) {
  const q = query(collection(db, "tests"), where("teacherId", "==", teacherId));
  const snap = await getDocs(q);
  
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  
  // Sort by newest first
  return docs.sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return timeB - timeA;
  });
}

/**
 * Fetches only the tests that a specific student has been assigned to.
 */
export async function getStudentTests(studentId) {
  const q = query(collection(db, "tests"), where("enrolledStudents", "array-contains", studentId));
  const snap = await getDocs(q);
  
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Adds an array of student IDs to a test's enrolledStudents list.
 * Uses arrayUnion to prevent duplicates and safely append to the existing list.
 */
export async function enrollStudents(testId, studentIds) {
  if (!studentIds || studentIds.length === 0) return;
  
  const testRef = doc(db, "tests", testId);
  await updateDoc(testRef, {
    enrolledStudents: arrayUnion(...studentIds)
  });
}

/**
 * Generates a new random 4-digit PIN for a test to lock out old students.
 */
export async function updateTestPin(testId) {
  const newPin = Math.floor(1000 + Math.random() * 9000).toString();
  const testRef = doc(db, "tests", testId);
  
  await updateDoc(testRef, {
    pin: newPin
  });
  
  return newPin;
}