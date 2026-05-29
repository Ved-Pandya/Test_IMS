import { useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { Btn, Card, Input, C, font } from "../ui/Primitives";

export default function AuthScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    if(e) e.preventDefault();
    setError("");
    
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      // 1. Target lookup check using the email key directly
      let userDocRef = doc(db, "users", normalizedEmail);
      let userSnapshot = await getDoc(userDocRef);
      let userData = null;

      if (userSnapshot.exists()) {
        userData = userSnapshot.data();
      } else {
        // Fallback secondary matching index logic query pass for backwards-compatibility 
        const q = query(collection(db, "users"), where("email", "==", normalizedEmail));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          userData = querySnap.docs[0].data();
        }
      }

      if (!userData) {
        throw new Error("No account found matching this Email ID.");
      }

      // 2. Validate password parameters matching the regNo string constraint rules
      const storedRegistrationPassword = userData.regNo || userData.passwordCredentialBackup;

      if (!storedRegistrationPassword || String(storedRegistrationPassword).trim() !== cleanPassword) {
        throw new Error("Invalid password. Please enter your official Registration Number / Employee ID.");
      }

      if (userData.role === "revoked") {
        throw new Error("This profile console platform key access parameter is suspended.");
      }

      // 3. Complete auth handshake transition
      await onLogin(normalizedEmail, cleanPassword);
      
    } catch (err) {
      setError(err.message || "Login Failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.body, padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 52, height: 52, background: C.accent, borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16 }}>📋</div>
          <div style={{ fontFamily: font.heading, fontSize: 26, fontWeight: 800, color: C.textPrimary }}>ExamPortal</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Restricted Access Area</div>
        </div>

        <Card>
          <h2 style={{ margin: "0 0 20px 0", fontSize: 18, color: C.textPrimary, textAlign: "center" }}>Sign In</h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Email Address" type="email" value={email} onChange={setEmail} placeholder="Enter your registered email" />
            <Input label="Registration Number / Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" error={error} />

            <Btn type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", marginTop: 8, padding: "12px" }}>
              {loading ? "Authenticating..." : "Secure Login →"}
            </Btn>
          </form>
        </Card>
      </div>
    </div>
  );
}