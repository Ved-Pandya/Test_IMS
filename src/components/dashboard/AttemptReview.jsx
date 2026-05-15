import { useState } from "react";
import { Badge, Btn, Card, C, Divider, font } from "../ui/Primitives";
import { formatDuration } from "../../utils/format";

export default function AttemptReview({ attempt, test, onBack }) {
  const [activeSection, setActiveSection] = useState(0);
  const [showPassage, setShowPassage] = useState({});
  const flatQuestions = test.sections.flatMap((section) => section.questions.map((question) => ({ ...question, sectionName: section.name })));
  const pct = Math.round((attempt.score / attempt.total) * 100);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60, gap: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: font.body, display: "flex", alignItems: "center", gap: 6 }}>
          ← Back
        </button>
        <div style={{ width: 1, height: 24, background: C.border }} />
        <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: C.textPrimary }}>{test.title} — Review</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <Badge color={pct >= 70 ? "green" : pct >= 40 ? "amber" : "red"}>{attempt.score}/{attempt.total} · {pct}%</Badge>
          <Badge color="accent">{formatDuration(attempt.timeTaken)}</Badge>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <Card style={{ marginBottom: 28, display: "flex", gap: 0, overflow: "hidden", padding: 0 }}>
          <div style={{ flex: 1, padding: "22px 26px", borderRight: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Score</div>
            <div style={{ fontFamily: font.heading, fontSize: 32, fontWeight: 800, color: pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red }}>{attempt.score}<span style={{ fontSize: 16, color: C.textMuted }}>/{attempt.total}</span></div>
          </div>
          <div style={{ flex: 1, padding: "22px 26px", borderRight: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Time Taken</div>
            <div style={{ fontFamily: font.heading, fontSize: 24, fontWeight: 700, color: C.textPrimary }}>{formatDuration(attempt.timeTaken)}</div>
          </div>
          <div style={{ flex: 1, padding: "22px 26px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Submission</div>
            <div style={{ fontSize: 13, color: attempt.reason.includes("Auto") ? C.redText : C.greenText, fontWeight: 600 }}>{attempt.reason}</div>
          </div>
        </Card>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {test.sections.map((section, index) => {
            const correctAnswers = section.questions.filter((question) => attempt.answers[question.id] === question.correct).length;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(index)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: `1px solid ${activeSection === index ? C.accent : C.border}`,
                  background: activeSection === index ? C.accentDim : "transparent",
                  color: activeSection === index ? C.accentText : C.textMuted,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: font.body,
                }}
              >
                {section.name} <span style={{ opacity: 0.7, marginLeft: 4 }}>{correctAnswers}/{section.questions.length}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {test.sections[activeSection].questions.map((question, questionIndex) => {
            const userChoice = attempt.answers[question.id];
            const isCorrect = userChoice === question.correct;
            const notAttempted = userChoice === undefined;
            const borderColor = notAttempted ? C.border : isCorrect ? C.green : C.red;

            return (
              <Card key={question.id} style={{ borderColor, borderWidth: 1.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: notAttempted ? C.surface : isCorrect ? C.greenDim : C.redDim, border: `1.5px solid ${borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: notAttempted ? C.textMuted : isCorrect ? C.greenText : C.redText, flexShrink: 0 }}>
                    {questionIndex + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, color: notAttempted ? C.textMuted : isCorrect ? C.greenText : C.redText }}>
                    {notAttempted ? "NOT ATTEMPTED" : isCorrect ? "✓ CORRECT" : "✗ INCORRECT"}
                  </span>
                </div>

                {question.passage && (
                  <div style={{ marginBottom: 14 }}>
                    <button
                      onClick={() => setShowPassage((state) => ({ ...state, [question.id]: !state[question.id] }))}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.accentText,
                        background: C.accentDim,
                        border: `1px solid ${C.accent}33`,
                        borderRadius: 6,
                        padding: "5px 12px",
                        cursor: "pointer",
                        fontFamily: font.body,
                      }}
                    >
                      {showPassage[question.id] ? "▲ Hide Passage" : "▼ Show Passage"}
                    </button>
                    {showPassage[question.id] && (
                      <div style={{ marginTop: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", fontSize: 14, color: C.textSecondary, lineHeight: 1.8 }}>
                        {question.passage.split("\n").filter(Boolean).map((paragraph, index) => (
                          <p key={index} style={{ margin: "0 0 10px" }}>{paragraph.trim()}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <p style={{ fontSize: 15, color: C.textPrimary, lineHeight: 1.75, margin: "0 0 16px" }}>{question.text}</p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {question.options.map((option, optionIndex) => {
                    const isUser = optionIndex === userChoice;
                    const isRight = optionIndex === question.correct;
                    let bg = C.bg;
                    let border = C.border;
                    let color = C.textSecondary;
                    if (isRight) {
                      bg = C.greenDim;
                      border = C.green;
                      color = C.greenText;
                    } else if (isUser && !isRight) {
                      bg = C.redDim;
                      border = C.red;
                      color = C.redText;
                    }
                    return (
                      <div key={optionIndex} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 8, background: bg, border: `1px solid ${border}` }}>
                        <span style={{ width: 24, height: 24, borderRadius: "50%", border: `1.5px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, color, flexShrink: 0 }}>
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span style={{ fontSize: 14, color, flex: 1 }}>{option}</span>
                        {isRight && <span style={{ fontSize: 11, fontWeight: 700, color: C.greenText }}>✓ Correct</span>}
                        {isUser && !isRight && <span style={{ fontSize: 11, fontWeight: 700, color: C.redText }}>Your answer</span>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
