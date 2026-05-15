// src/firebase/auth.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "./config";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const secondaryApp = initializeApp(firebaseConfig, "SecondaryAdminApp");
const secondaryAuth = getAuth(secondaryApp);

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("User profile not found");
  return snap.data();
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const profile = await getUserProfile(firebaseUser.uid);
      callback({ user: firebaseUser, profile });
    } else {
      callback({ user: null, profile: null });
    }
  });
}

// Admin Helper: Bulk/Single Student Creation
export async function createStudentAsAdmin({ email, name, batch, regNo }) {
  const randomPassword = Math.random().toString(36).slice(-8);
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, randomPassword);
  
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    email,
    name,
    role: "student",
    batch: batch || "Unassigned",
    regNo: regNo || "N/A",
    createdAt: new Date(),
  });

  await signOut(secondaryAuth);
  return { email, password: randomPassword, regNo, status: "Success" };
}

// Admin Helper: Teacher Creation
export async function createTeacherAsAdmin({ email, name, exams }) {
  const randomPassword = Math.random().toString(36).slice(-8);
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, randomPassword);
  
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    email,
    name,
    role: "teacher",
    exams: exams || [],
    createdAt: new Date(),
  });

  await signOut(secondaryAuth);
  return { email, password: randomPassword, name, role: "teacher" };
}

// NEW: Admin Helper: Change Student Batch by Email
export async function updateStudentBatchByEmail(email, newBatch) {
  const q = query(collection(db, "users"), where("email", "==", email), where("role", "==", "student"));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    throw new Error("No student found with that email address.");
  }
  
  const userDoc = snap.docs[0];
  await updateDoc(userDoc.ref, { batch: newBatch });
  
  return userDoc.data().name; // Return name for success message
}