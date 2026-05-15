import { useState } from "react";
import { Badge, Btn, Card, C, font } from "../ui/Primitives";
import AttemptReview from "./AttemptReview";
import { formatDuration } from "../../utils/format";

export default function TeacherTestDetail({ test, attempts, onBack, onDemo }) {
  const [reviewAttempt, setReviewAttempt] = useState(null);

  if (reviewAttempt) {
    return <AttemptReview attempt={reviewAttempt} test={test} onBack={() => setReviewAttempt(null)} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60, gap: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: font.body }}>
          ← Back
        </button>
        <div style={{ width: 1, height: 24, background: C.border }} />
        <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: C.textPrimary }}>{test.title}</span>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onDemo} style={{ fontSize: 13, padding: "8px 16px" }}>Preview as Student →</Btn>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            ["Attempts", attempts.length, C.accent],
            ["Avg Score", attempts.length ? Math.round(attempts.reduce((sum, item) => sum + (item.score / item.total) * 100, 0) / attempts.length) + "%" : "—", C.green],
            ["Avg Time", attempts.length ? formatDuration(Math.round(attempts.reduce((sum, item) => sum + item.timeTaken, 0) / attempts.length)) : "—", C.textPrimary],
            ["Auto Submits", attempts.filter((item) => item.reason.includes("Auto")).length, C.red],
          ].map(([label, value, color]) => (
            <Card key={label} style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: font.heading, color }}>{value}</div>
            </Card>
          ))}
        </div>

        {attempts.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div>No attempts yet.</div>
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Student', 'Score', 'Percentage', 'Time', 'Submitted Via', 'Violations', ''].map((heading) => (
                    <th key={heading} style={{ padding: "12px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, background: C.bg }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt, index) => {
                  const pct = Math.round((attempt.score / attempt.total) * 100);
                  const isAuto = attempt.reason.includes("Auto");
                  return (
                    <tr key={attempt.id} style={{ borderBottom: index < attempts.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <td style={{ padding: "14px 18px", fontWeight: 600, color: C.textPrimary, fontSize: 14 }}>{attempt.studentName}</td>
                      <td style={{ padding: "14px 18px", fontWeight: 700, color: C.textPrimary, fontFamily: font.mono }}>{attempt.score}/{attempt.total}</td>
                      <td style={{ padding: "14px 18px" }}><span style={{ fontWeight: 700, color: pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red }}>{pct}%</span></td>
                      <td style={{ padding: "14px 18px", color: C.textMuted, fontSize: 13 }}>{formatDuration(attempt.timeTaken)}</td>
                      <td style={{ padding: "14px 18px" }}><span style={{ fontSize: 12, color: isAuto ? C.redText : C.textMuted }}>{isAuto ? "⚠ " : ""}{attempt.reason}</span></td>
                      <td style={{ padding: "14px 18px", color: attempt.violations.length > 0 ? C.redText : C.textMuted, fontWeight: attempt.violations.length > 0 ? 700 : 400 }}>{attempt.violations.length > 0 ? `⚠ ${attempt.violations.length}` : "—"}</td>
                      <td style={{ padding: "14px 18px" }}>
                        <button onClick={() => setReviewAttempt(attempt)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", color: C.accentText, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font.body }}>Review</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
