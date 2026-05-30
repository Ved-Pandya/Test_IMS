import { useState } from "react";
import { Btn, Card, Input, C, font } from "../ui/Primitives";
// FIXED: Import your smart custom login orchestrator directly
import { login } from "../../firebase/auth"; 

export default function AuthScreen({ onLoginSuccess }) {
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
      const cleanIdentifier = identifier.trim();
      const cleanPassword = password.trim();

      // FIXED: Route credentials directly into your updated login function wrapper.
      // This will handle checking if it's a RegNo or Email, run the lazy JIT signup if 
      // needed, apply the password length fallback, and return the final authenticated user.
      const firebaseUser = await login(cleanIdentifier, cleanPassword);
      
      // Pass the fully authenticated user object back up to your global app state manager container
      if (onLoginSuccess) {
        onLoginSuccess(firebaseUser);
      }
      
    } catch (err) {
      // Clean up common Firebase error strings to keep the UI professional
      if (err.message.includes("auth/invalid-credential") || err.code === "auth/invalid-credential") {
        setError("Invalid credentials. Please verify your User ID and password.");
      } else {
        setError(err.message || "Login Failed. Please check your credentials.");
      }
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
            <Input label="IMS Pin (User ID)" type="text" value={identifier} onChange={setIdentifier} placeholder="Enter your IMS Pin" />
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