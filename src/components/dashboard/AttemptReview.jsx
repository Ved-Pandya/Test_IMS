import { useMemo } from "react";
import { Card, Badge, C, font } from "../ui/Primitives";

export default function AttemptReview({ attempt, test, onBack }) {
  const flatQuestions = useMemo(
    () => test.sections.flatMap((section) => section.questions.map((question) => ({ ...question, sectionName: section.name }))),
    [test]
  );

  // Retrieve the marking scheme, fallback to +1/0 if it's an old test
  const marking = test.markingScheme || { correct: 1, incorrect: 0 };
  const maxScore = flatQuestions.length * marking.correct;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60, gap: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: font.body }}>← Back</button>
        <div style={{ width: 1, height: 24, background: C.border }} />
        <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: C.textPrimary }}>{test.title} — Review</span>
        <div style={{ flex: 1 }} />
        <Badge color={attempt.score > 0 ? "green" : "red"}>{attempt.score} / {maxScore} Points</Badge>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* Top Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Total Score</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: font.heading, color: attempt.score > 0 ? C.greenText : C.textPrimary }}>
              {attempt.score} <span style={{ fontSize: 16, color: C.textMuted }}>/ {maxScore}</span>
            </div>
          </Card>
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Time Taken</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: font.heading, color: C.textPrimary }}>
              {Math.floor(attempt.timeTaken / 60)}m {attempt.timeTaken % 60}s
            </div>
          </Card>
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Submission Status</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: attempt.reason.includes("Auto") ? C.redText : C.greenText, lineHeight: 1.4 }}>
              {attempt.reason}
            </div>
          </Card>
        </div>

        <Card>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, display: "flex", justifyContent: "space-between" }}>
            <span>Review your answers below.</span>
            <Badge color="accent">Marking: +{marking.correct} / -{marking.incorrect}</Badge>
          </div>

          {flatQuestions.map((question, questionIndex) => {
            // Safely grab the answer (handles cases where attempt.answers might be undefined)
            const studentAns = attempt.answers ? attempt.answers[question.id] : undefined;
            
            let isUnattempted = studentAns === undefined || studentAns === "";
            let isCorrect = false;

            if (!isUnattempted) {
              if (question.type === 'tita') {
                isCorrect = String(studentAns).trim().toLowerCase() === String(question.correct).trim().toLowerCase();
              } else {
                isCorrect = studentAns === question.correct;
              }
            }

            return (
              <div key={question.id} style={{ marginBottom: 32, paddingBottom: 32, borderBottom: questionIndex === flatQuestions.length - 1 ? "none" : `1px solid ${C.border}` }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <Badge color={isUnattempted ? "gray" : isCorrect ? "green" : "red"}>
                    {isUnattempted ? "NOT ATTEMPTED (0)" : isCorrect ? `CORRECT (+${marking.correct})` : `INCORRECT (-${marking.incorrect})`}
                  </Badge>
                  <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{question.sectionName}</div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.surface, border: `1px solid ${C.border}`, display: "grid", placeItems: "center", fontWeight: 700, color: C.textSecondary, flexShrink: 0, marginTop: 2 }}>
                    {questionIndex + 1}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, lineHeight: 1.5 }}>
                    {question.text}
                  </div>
                </div>

                {question.passage && (
                  <div style={{ marginBottom: 16, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, color: C.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
                    {question.passage}
                  </div>
                )}

                {/* TITA Question Review */}
                {question.type === 'tita' ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: 40 }}>
                    <div style={{ padding: "12px 16px", borderRadius: 8, background: isUnattempted ? C.surface : isCorrect ? C.greenDim : C.redDim, border: `1px solid ${isUnattempted ? C.border : isCorrect ? C.green : C.red}` }}>
                      <span style={{ fontSize: 12, color: isUnattempted ? C.textMuted : isCorrect ? C.greenText : C.redText, display: "block", marginBottom: 4 }}>Your Answer:</span>
                      <span style={{ color: isUnattempted ? C.textMuted : C.textPrimary, fontWeight: 600, fontSize: 16 }}>
                        {isUnattempted ? "—" : studentAns}
                      </span>
                    </div>
                    {!isCorrect && (
                      <div style={{ padding: "12px 16px", borderRadius: 8, background: C.surface, border: `1px solid ${C.green}44` }}>
                        <span style={{ fontSize: 12, color: C.greenText, display: "block", marginBottom: 4 }}>Correct Answer:</span>
                        <span style={{ color: C.greenText, fontWeight: 600, fontSize: 16 }}>{question.correct}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* MCQ Question Review */
                  <div style={{ display: "grid", gap: 10, marginLeft: 40 }}>
                    {question.options.map((option, optionIndex) => {
                      const isSelected = studentAns === optionIndex;
                      const isActualCorrect = question.correct === optionIndex;
                      
                      let bg = C.surface;
                      let border = C.border;
                      let textCol = C.textSecondary;

                      if (isActualCorrect) {
                        bg = C.greenDim; border = C.green; textCol = C.greenText;
                      } else if (isSelected && !isCorrect) {
                        bg = C.redDim; border = C.red; textCol = C.redText;
                      }

                      return (
                        <div key={optionIndex} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderRadius: 8, background: bg, border: `1px solid ${border}` }}>
                          <span style={{ display: "inline-block", width: 24, height: 24, borderRadius: "50%", border: `1.5px solid ${textCol}`, marginRight: 12, textAlign: "center", lineHeight: "24px", color: textCol, fontSize: 12, fontWeight: 600 }}>
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <span style={{ color: textCol, flex: 1, fontSize: 14 }}>{option}</span>
                          
                          {isActualCorrect && <span style={{ color: C.greenText, fontSize: 12, fontWeight: 700 }}>✓ Correct</span>}
                          {isSelected && !isCorrect && <span style={{ color: C.redText, fontSize: 12, fontWeight: 700 }}>✗ Your Answer</span>}
                          {isSelected && isCorrect && <span style={{ color: C.greenText, fontSize: 12, fontWeight: 700, marginLeft: 8 }}>(Your Answer)</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}