import { Badge, Btn, Card, C, font } from "../ui/Primitives";

export default function AttemptReview({ attempt, test, onBack }) {
  // Extract configuration mapping criteria references
  const flatQuestions = test.sections.flatMap((s) => s.questions);
  const accuracy = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body, paddingBottom: 60 }}>
      
      <style>{`
        .review-score-banner {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px;
        }
        .review-question-card {
          border-left: 4px solid ${C.border}; display: flex; flexDirection: column; gap: 16px;
        }
        .review-options-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
        }

        @media (max-width: 640px) {
          .review-score-banner { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .review-options-grid { grid-template-columns: 1fr !important; gap: 8px !important; }
        }
      `}</style>

      {/* Static Floating Sticky Header Panel Control */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", height: 60, position: "sticky", top: 0, zIndex: 10 }}>
        <span style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 16, color: C.textPrimary }}>Review Performance Metric</span>
        <div style={{ flex: 1 }} />
        <Btn onClick={onBack} style={{ padding: "6px 14px", fontSize: 13 }}>Close Review</Btn>
      </div>

      <div style={{ maxWidth: 800, margin: "32px auto", padding: "0 16px" }}>
        
        {/* Core Review Banner Panel Blocks */}
        <div className="review-score-banner">
          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 4 }}>FINAL SCORE</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: attempt.score >= 0 ? C.greenText : C.redText }}>{attempt.score} <span style={{ fontSize: 13, color: C.textMuted }}>pts</span></div>
          </Card>
          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 4 }}>TOTAL POSSIBLE</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.textPrimary }}>{attempt.total}</div>
          </Card>
          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 4 }}>ACCURACY MATRIX</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.accentText }}>{accuracy}%</div>
          </Card>
          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 4 }}>TIME SPENT</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.textPrimary }}>{Math.round(attempt.timeTaken / 60)} <span style={{ fontSize: 13, color: C.textMuted }}>mins</span></div>
          </Card>
        </div>

        {/* Detailed Question Review Cards Breakdown */}
        <h3 style={{ fontFamily: font.heading, fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 20 }}>Question Breakdown</h3>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {flatQuestions.map((q, qIdx) => {
            const studentAns = attempt.answers[q.id];
            const isUnattempted = studentAns === undefined || studentAns === "";
            
            let isCorrect = false;
            if (!isUnattempted) {
              isCorrect = q.type === "tita" 
                ? String(studentAns).trim().toLowerCase() === String(q.correct).trim().toLowerCase()
                : Number(studentAns) === Number(q.correct);
            }

            return (
              <Card key={q.id} className="review-question-card" style={{ borderLeftColor: isUnattempted ? C.border : (isCorrect ? C.green : C.red) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Question {qIdx + 1}</span>
                  {isUnattempted ? (
                    <Badge color="gray">Skipped (0 Marks)</Badge>
                  ) : (
                    <Badge color={isCorrect ? "green" : "red"}>{isCorrect ? "Correct Response" : "Incorrect Response"}</Badge>
                  )}
                </div>

                {q.passage && (
                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, padding: 14, borderRadius: 8, fontSize: 13, color: C.textSecondary, whiteSpace: "pre-wrap", maxHeight: 120, overflowY: "auto" }}>
                    {q.passage}
                  </div>
                )}

                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{q.text}</div>

                {/* Option Content Area Checks */}
                {q.type === "tita" ? (
                  <div style={{ padding: 12, background: C.bg, borderRadius: 8, fontSize: 14 }}>
                    <div style={{ marginBottom: 6 }}>Your Answer: <strong style={{ color: isCorrect ? C.greenText : C.redText }}>{isUnattempted ? "Blank" : studentAns}</strong></div>
                    <div>Correct Evaluation Target: <strong style={{ color: C.greenText }}>{q.correct}</strong></div>
                  </div>
                ) : (
                  <div className="review-options-grid">
                    {q.options?.map((opt, oIdx) => {
                      const wasSelected = studentAns === oIdx;
                      const isTargetCorrect = q.correct === oIdx;
                      
                      let optBg = C.bg, optBorder = C.border, optText = C.textSecondary;
                      if (isTargetCorrect) {
                        optBg = "rgba(16, 185, 129, 0.08)"; optBorder = C.green; optText = C.greenText;
                      } else if (wasSelected && !isCorrect) {
                        optBg = "rgba(239, 68, 68, 0.08)"; optBorder = C.red; optText = C.redText;
                      }

                      return (
                        <div key={oIdx} style={{ padding: "10px 12px", background: optBg, border: `1px solid ${optBorder}`, borderRadius: 8, fontSize: 14, color: optText, display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontWeight: 700 }}>{String.fromCharCode(65 + oIdx)}.</span>
                          <span>{opt}</span>
                          <div style={{ flex: 1 }} />
                          {isTargetCorrect && <span>✓</span>}
                          {wasSelected && !isCorrect && <span>✕</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
}