// src/firebase/auth.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
// FIXED: Added 'limit' to the firestore imports
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
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

// JIT login intercept handles both Registration Numbers and normal emails flawlessly
export async function login(identifier, password) {
  const cleanInput = String(identifier || "").trim();
  const cleanPassword = String(password || "").trim();

  if (!cleanInput || !cleanPassword) {
    throw new Error("Credentials cannot be processed empty.");
  }

  // Path A: If logging in using a plain email string (Admins / Teachers)
  if (cleanInput.includes("@")) {
    const cred = await signInWithEmailAndPassword(auth, cleanInput.toLowerCase(), cleanPassword);
    return cred.user;
  }

  // Path B: If logging in using a Student Registration Number
  const studentQuery = query(
    collection(db, "users"), 
    where("role", "==", "student"), 
    where("regNo", "==", cleanInput),
    limit(1) // FIXED: Added limit(1) to satisfy Firestore unauthenticated read rules!
  );
  const snap = await getDocs(studentQuery);

  if (snap.empty) {
    throw new Error("Invalid Registration Number. No matching student profile found.");
  }

  const studentDoc = snap.docs[0];
  const studentData = studentDoc.data();
  const studentEmail = studentData.email;

  // Ensure programmatic password string satisfies the minimum length requirement (> 6 characters)
  const runtimeAuthPassword = cleanPassword.length < 6 ? `${cleanPassword}@portal` : cleanPassword;

  // INTERCEPT: First-time login path under lazy provisioning method
  if (studentData.isAuthProvisioned === false) {
    console.log("Lazy Provision Engine Intercept: Creating live authentication node parameters...");
    try {
      // 1. Register account credentials inside Firebase Auth safely
      const newCred = await createUserWithEmailAndPassword(auth, studentEmail, runtimeAuthPassword);
      
      // 2. Sync authenticating tracking UID back to Firestore
      await updateDoc(doc(db, "users", studentEmail), {
        uid: newCred.user.uid,
        isAuthProvisioned: true,
        activatedAt: new Date()
      });

      return newCred.user;
    } catch (authErr) {
      // Fallback path catches edge-case race conditions securely
      if (authErr.code === "auth/email-already-in-use" || authErr.message?.includes("already-in-use")) {
        const fallbackCred = await signInWithEmailAndPassword(auth, studentEmail, runtimeAuthPassword);
        await updateDoc(doc(db, "users", studentEmail), {
          uid: fallbackCred.user.uid,
          isAuthProvisioned: true
        });
        return fallbackCred.user;
      }
      throw authErr;
    }
  }

  // Path C: Standard verified subsequent authentications path handshake
  const cred = await signInWithEmailAndPassword(auth, studentEmail, runtimeAuthPassword);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export async function getUserProfile(uid, email = null) {
  if (email) {
    const emailSnap = await getDoc(doc(db, "users", email.toLowerCase().trim()));
    if (emailSnap.exists()) return emailSnap.data();
  }

  if (uid && uid.includes("@")) {
    const snap = await getDoc(doc(db, "users", uid.toLowerCase().trim()));
    if (snap.exists()) return snap.data();
  }
  
  if (uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) return snap.data();
  }

  if (uid) {
    const q = query(collection(db, "users"), where("uid", "==", uid), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data();
  }

  throw new Error("User profile not found inside index mapping reference.");
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
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

  await setDoc(doc(db, "users", cleanEmail), {
    email: cleanEmail,
    name: name.trim(),
    role: "student",
    batch: batch || "Unassigned",
    regNo: cleanPassword,
    mobile: mobile || "N/A",
    exam: exam || "Unassigned",
    isAuthProvisioned: false,
    createdAt: new Date(),
  }, { merge: true });

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
  }, { merge: true });

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