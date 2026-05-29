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
  // Check if uid is an email address string (from custom lookups) or standard UUID token
  if (uid.includes("@")) {
    const snap = await getDoc(doc(db, "users", uid.toLowerCase().trim()));
    if (snap.exists()) return snap.data();
  }
  
  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists()) return snap.data();

  // Secondary Fallback Query Index match if document names are keyed under standard UUID
  const q = query(collection(db, "users"), where("uid", "==", uid));
  const querySnap = await getDocs(q);
  if (!querySnap.empty) return querySnap.docs[0].data();

  throw new Error("User profile not found inside index mapping reference.");
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        // Fallback checks passing down either raw email string keys or auth token ids
        const profile = await getUserProfile(firebaseUser.email || firebaseUser.uid);
        callback({ user: firebaseUser, profile });
      } catch (err) {
        callback({ user: firebaseUser, profile: { name: firebaseUser.email.split("@")[0], role: "student" } });
      }
    } else {
      callback({ user: null, profile: null });
    }
  });
}

// Admin Helper: Bulk/Single Student Creation Custom Router Mapping
export async function createStudentAsAdmin({ email, name, batch, regNo, mobile, exam }) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = regNo.trim(); // <-- ENFORCED: Sets Registration Number directly as the authentication passkey string

  const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, cleanPassword);
  
  // FIXED: Document name is now explicitly set to the clean email string for uniform lookup speeds!
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

// Admin Helper: Teacher Creation Custom Router Mapping
export async function createTeacherAsAdmin({ email, name, exams }) {
  const cleanEmail = email.trim().toLowerCase();
  const defaultTeacherPassword = name.trim().split(" ")[0] + "123"; // Clean string configuration pass

  const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, defaultTeacherPassword);
  
  await setDoc(doc(db, "users", cleanEmail), {
    uid: cred.user.uid,
    email: cleanEmail,
    name: name.trim(),
    role: "teacher",
    exams: exams || [],
    regNo: defaultTeacherPassword, // Saved reference flag
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