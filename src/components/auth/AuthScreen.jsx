import { useState } from "react";
import { collection, query, where, getDocs, limit } from "firebase/firestore"; // <-- Added limit import
import { db } from "../../firebase/config";
import { Btn, Card, Input, C, font } from "../ui/Primitives";

export default function AuthScreen({ onLogin }) {
  const [identifier, setIdentifier] = useState(""); 
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError("");
    
    if (!identifier.trim() || !password.trim()) {
      setError("Please enter your Registration Number and Password.");
      return;
    }

    setLoading(true);
    try {
      // 1. Clean the inputs
      // Note: We do NOT use toLowerCase() here because Registration Numbers might contain 
      // case-sensitive characters (like CAT-2026-A).
      const cleanIdentifier = identifier.trim();
      const cleanPassword = password.trim();

      let targetEmail = cleanIdentifier.toLowerCase(); // Only lowercase if it's an email

      // 2. If the user typed a RegNo instead of an email (it has no '@' symbol)
      if (!cleanIdentifier.includes("@")) {
        // Query the users collection to find the hidden email attached to this regNo
        const q = query(
          collection(db, "users"), 
          where("regNo", "==", cleanIdentifier),
          limit(1) // <-- FIXED: Restricts the query size to instantly satisfy the new security rule!
        );
        
        const snap = await getDocs(q);

        if (snap.empty) {
          throw new Error("No account found matching this Registration Number.");
        }

        // Extract the real email from the database to satisfy Firebase Auth
        targetEmail = snap.docs[0].data().email;
      }

      // 3. Complete auth handshake using the resolved email and their password
      await onLogin(targetEmail, cleanPassword);
      
    } catch (err) {
      setError(err.message || "Login Failed. Please check your credentials.");
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
            <Input label="Registration Number (User ID)" type="text" value={identifier} onChange={setIdentifier} placeholder="Enter your Registration No." />
            <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" error={error} />

            <Btn type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", marginTop: 8, padding: "12px" }}>
              {loading ? "Authenticating..." : "Secure Login →"}
            </Btn>
          </form>
        </Card>
      </div>
    </div>
  );
}