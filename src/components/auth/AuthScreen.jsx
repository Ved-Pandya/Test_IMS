import { useState } from "react";
import { Btn, Card, Input, C, font } from "../ui/Primitives";

export default function AuthScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password || (mode === "register" && !name)) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        await onRegister({ email, password, name, role });
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      setError(err?.message ?? "Unable to authenticate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font.body,
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: C.accent,
              borderRadius: 14,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              marginBottom: 16,
            }}
          >
            📋
          </div>
          <div style={{ fontFamily: font.heading, fontSize: 26, fontWeight: 800, color: C.textPrimary }}>
            ExamPortal
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>CAT · IPMAT · CLAT · CMAT</div>
        </div>

        <Card>
          <div style={{ display: "flex", background: C.bg, borderRadius: 10, padding: 4, marginBottom: 24 }}>
            {['login', 'register'].map((option) => (
              <button
                key={option}
                onClick={() => setMode(option)}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 7,
                  border: "none",
                  background: mode === option ? C.surface : "transparent",
                  color: mode === option ? C.textPrimary : C.textMuted,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: font.body,
                  transition: "all 0.2s",
                  textTransform: "capitalize",
                }}
              >
                {option}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, letterSpacing: 0.4, display: "block", marginBottom: 8 }}>
                I AM A
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {['student', 'teacher'].map((item) => (
                  <button
                    key={item}
                    onClick={() => setRole(item)}
                    style={{
                      flex: 1,
                      padding: 9,
                      borderRadius: 8,
                      border: `1px solid ${role === item ? C.accent : C.border}`,
                      background: role === item ? C.accentDim : "transparent",
                      color: role === item ? C.accentText : C.textMuted,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: font.body,
                      textTransform: "capitalize",
                    }}
                  >
                    {item === 'student' ? '🎓 Student' : '👨‍🏫 Teacher'}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'register' && <Input label="Full Name" value={name} onChange={setName} placeholder="Arjun Mehta" />}
            <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
            <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" error={error} />

            <Btn
              onClick={handleSubmit}
              disabled={loading}
              style={{ width: "100%", justifyContent: "center", marginTop: 4, padding: "12px" }}
            >
              {loading ? "Please wait…" : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </Btn>
          </div>
        </Card>

        <p style={{ textAlign: "center", fontSize: 12, color: C.textMuted, marginTop: 20 }}>
          Demo: click {mode === 'login' ? 'Sign In' : 'Create Account'} to continue.
        </p>
      </div>
    </div>
  );
}
