// src/firebase/auth.js
// All authentication helpers — sign up, sign in, sign out

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "./config";

// Register a new teacher or student
export async function register({ email, password, name, role }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // Store extra user info in Firestore (role, name)
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    email,
    name,
    role, // "teacher" or "student"
    createdAt: new Date(),
  });
  return cred.user;
}

// Sign in existing user
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// Sign out
export async function logout() {
  await signOut(auth);
}

// Get the Firestore user profile (includes role, name)
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("User profile not found");
  return snap.data();
}

// React hook: subscribe to auth state changes
// Returns { user, profile, loading }
// Usage: const { user, profile, loading } = useAuthState();
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
