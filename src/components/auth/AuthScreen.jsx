import { useState } from "react";
import { Btn, Card, Input, C, font } from "../ui/Primitives";

export default function AuthScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      // The .trim() completely prevents copy-paste spacing errors
      await onLogin(email.trim(), password.trim());
    } catch (err) {
      // This will now show the exact Firebase error (e.g. auth/invalid-credential)
      setError("Login Failed: " + err.message);
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
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Email Address" type="email" value={email} onChange={setEmail} placeholder="Enter your registered email" />
            <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" error={error} />

            <Btn onClick={handleSubmit} disabled={loading} style={{ width: "100%", justifyContent: "center", marginTop: 8, padding: "12px" }}>
              {loading ? "Authenticating..." : "Secure Login →"}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}