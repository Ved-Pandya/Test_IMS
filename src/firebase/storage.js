// src/firebase/storage.js
// Upload and retrieve question images

import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./config";

// ─── Upload a question image ───────────────────────────────────────────────────
// Returns the public download URL to store in question.imageUrl
// file: a File object from an <input type="file"> element
// testId: the Firestore test document ID
// questionId: e.g. "q1", "q3"
export async function uploadQuestionImage(file, testId, questionId) {
  const ext = file.name.split(".").pop();
  const path = `question-images/${testId}/${questionId}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
}

// ─── Delete a question image ───────────────────────────────────────────────────
export async function deleteQuestionImage(testId, questionId, ext = "png") {
  const path = `question-images/${testId}/${questionId}.${ext}`;
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}
