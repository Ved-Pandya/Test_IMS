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
  getDoc,
  writeBatch // <-- Added writeBatch import
} from "firebase/firestore";
import { db } from "./config";

/**
 * Creates a new test and generates a random 4-digit classroom PIN.
 */
export async function createTest({ title, duration, sections, teacherId, createdBy, markingScheme }) {
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  
  const ref = await addDoc(collection(db, "tests"), {
    title,
    duration,
    sections,
    teacherId,
    createdBy,
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
 */
export async function getTeacherTests(teacherId) {
  const q = query(collection(db, "tests"), where("teacherId", "==", teacherId));
  const snap = await getDocs(q);
  
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  
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
    
    const currentEnrolled = Array.isArray(testData.enrolledStudents) 
      ? testData.enrolledStudents 
      : [];

    const updatedEnrollmentSet = new Set([...currentEnrolled, ...studentIds]);
    const finalizedArray = Array.from(updatedEnrollmentSet);

    await updateDoc(testRef, {
      enrolledStudents: finalizedArray
    });

    return finalizedArray; 
  } catch (err) {
    console.error("Enrollment pipeline exception:", err);
    throw err;
  }
}

/**
 * Updates the editable fields of an existing test (name, duration, marking scheme, questions).
 */
export async function updateTest(testId, { title, duration, sections, markingScheme }) {
  if (!testId) throw new Error("Missing test reference allocation.");

  const testRef = doc(db, "tests", testId);
  await updateDoc(testRef, {
    title,
    duration,
    sections,
    markingScheme,
  });
}

/**
 * Removes an array of student IDs from a test's enrolledStudents list.
 */
export async function unenrollStudents(testId, studentIds) {
  if (!testId) throw new Error("Missing test reference allocation.");
  if (!studentIds || studentIds.length === 0) return [];

  try {
    const testRef = doc(db, "tests", testId);
    const testSnap = await getDoc(testRef);

    if (!testSnap.exists()) {
      throw new Error("Target evaluation test configuration was not found.");
    }

    const testData = testSnap.data();

    const currentEnrolled = Array.isArray(testData.enrolledStudents)
      ? testData.enrolledStudents
      : [];

    const removalSet = new Set(studentIds);
    const finalizedArray = currentEnrolled.filter((id) => !removalSet.has(id));

    await updateDoc(testRef, {
      enrolledStudents: finalizedArray
    });

    return finalizedArray;
  } catch (err) {
    console.error("Unenrollment pipeline exception:", err);
    throw err;
  }
}

/**
 * Generates a new random 4-digit PIN for a test.
 */
export async function updateTestPin(testId) {
  const newPin = Math.floor(1000 + Math.random() * 9000).toString();
  const testRef = doc(db, "tests", testId);
  
  await updateDoc(testRef, {
    pin: newPin
  });
  
  return newPin;
}

/**
 * Safely deletes a test and cascades the deletion to all student attempts attached to it.
 */
export async function deleteTestCompletely(testId) {
  const batch = writeBatch(db);

  // 1. Queue the primary test document for deletion
  const testRef = doc(db, "tests", testId);
  batch.delete(testRef);

  // 2. Find and queue ALL student attempts related to this specific test
  const attemptsQuery = query(collection(db, "attempts"), where("testId", "==", testId));
  const attemptsSnap = await getDocs(attemptsQuery);
  
  attemptsSnap.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  // 3. Execute the batch operation atomically
  await batch.commit();
  return true;
}