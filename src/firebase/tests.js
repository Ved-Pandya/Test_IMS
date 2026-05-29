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
  arrayUnion,
  getDoc
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
 * FIXED: Fallback safety layer ensures missing or broken array paths are initialized properly
 */
export async function enrollStudents(testId, studentIds) {
  if (!testId) throw new Error("Missing test reference allocation.");
  if (!studentIds || studentIds.length === 0) return [];
  
  try {
    const testRef = doc(db, "tests", testId);
    const testSnap = await getDoc(testRef);

    if (!testSnap.exists()) {
      throw new Error("Target evaluation test configuration was not found.");
    }

    const testData = testSnap.data();
    
    // Safety check: Fallback to an empty array if enrolledStudents is missing or null
    const currentEnrolled = Array.isArray(testData.enrolledStudents) 
      ? testData.enrolledStudents 
      : [];

    // Filter out duplicates cleanly via Set macro mapping
    const updatedEnrollmentSet = new Set([...currentEnrolled, ...studentIds]);
    const finalizedArray = Array.from(updatedEnrollmentSet);

    // Save back to Firestore database
    await updateDoc(testRef, {
      enrolledStudents: finalizedArray
    });

    return finalizedArray; // Return the exact new enrollment list array for UI updates
  } catch (err) {
    console.error("Enrollment pipeline exception:", err);
    throw err;
  }
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