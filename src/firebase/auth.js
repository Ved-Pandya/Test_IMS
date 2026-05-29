// src/firebase/auth.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
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

export async function getUserProfile(uid, email = null) {
  // 1. If an email hint is present, check it immediately (Fastest path for new architecture)
  if (email) {
    const emailSnap = await getDoc(doc(db, "users", email.toLowerCase().trim()));
    if (emailSnap.exists()) return emailSnap.data();
  }

  // 2. Check if uid itself is a plain email string
  if (uid && uid.includes("@")) {
    const snap = await getDoc(doc(db, "users", uid.toLowerCase().trim()));
    if (snap.exists()) return snap.data();
  }
  
  // 3. Look up via user UID directly (Path for manually seeded accounts)
  if (uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) return snap.data();
  }

  throw new Error("User profile not found inside index mapping reference.");
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        // FIXED: Passes both the UID and the email string to guarantee a clean getDoc path
        const profile = await getUserProfile(firebaseUser.uid, firebaseUser.email);
        callback({ user: firebaseUser, profile });
      } catch (err) {
        console.warn("Real-time profile sync fallback active:", err.message);
        callback({ user: firebaseUser, profile: { name: firebaseUser.email?.split("@")[0] || "User", role: "student" } });
      }
    } else {
      callback({ user: null, profile: null });
    }
  });
}

export async function createStudentAsAdmin({ email, name, batch, regNo, mobile, exam }) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = regNo.trim();

  const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, cleanPassword);
  
  await setDoc(doc(db, "users", cleanEmail), {
    uid: cred.user.uid,
    email: cleanEmail,
    name: name.trim(),
    role: "student",
    batch: batch || "Unassigned",
    regNo: cleanPassword,
    mobile: mobile || "N/A",
    exam: exam || "Unassigned",
    createdAt: new Date(),
  });

  await signOut(secondaryAuth);
  return { email: cleanEmail, password: cleanPassword, regNo: cleanPassword, status: "Success" };
}

export async function createTeacherAsAdmin({ email, name, exams }) {
  const cleanEmail = email.trim().toLowerCase();
  const defaultTeacherPassword = name.trim().split(" ")[0] + "123";

  const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, defaultTeacherPassword);
  
  await setDoc(doc(db, "users", cleanEmail), {
    uid: cred.user.uid,
    email: cleanEmail,
    name: name.trim(),
    role: "teacher",
    exams: exams || [],
    regNo: defaultTeacherPassword,
    createdAt: new Date(),
  });

  await signOut(secondaryAuth);
  return { email: cleanEmail, password: defaultTeacherPassword, name, role: "teacher" };
}

export async function updateStudentBatchByEmail(email, newBatch) {
  const q = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()), where("role", "==", "student"));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    throw new Error("No student found with that email address.");
  }
  
  const userDoc = snap.docs[0];
  await updateDoc(userDoc.ref, { batch: newBatch });
  return userDoc.data().name; 
}