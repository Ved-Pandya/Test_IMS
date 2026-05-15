import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Btn, Badge, Card, C, font } from "../ui/Primitives";
import { formatTime } from "../../utils/format";
import { submitAttempt } from "../../firebase/attempts";

export default function ExamView({ test, studentId, studentName, previewMode, onCancel, onSubmit }) {
  const [answers, setAnswers] = useState({});
  const [activeSection, setActiveSection] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(test.duration * 60);
  const [submitting, setSubmitting] = useState(false);
  
  const timerRef = useRef(null);
  const gracePeriodRef = useRef(true);

  const flatQuestions = useMemo(
    () => test.sections.flatMap((section) => section.questions.map((question) => ({ ...question, sectionName: section.name }))),
    [test]
  );

  const handleSubmit = useCallback(
    async (reason) => {
      if (submitting) return;
      setSubmitting(true);
      window.clearInterval(timerRef.current);

      const score = flatQuestions.filter((question) => answers[question.id] === question.correct).length;
      const attempt = {
        testId: test.id,
        studentId,
        studentName,
        answers,
        score,
        total: flatQuestions.length,
        timeTaken: test.duration * 60 - secondsLeft,
        reason,
        violations: reason.includes("Auto-submitted") ? [{ time: new Date().toLocaleString(), reason }] : [],
        submittedAt: new Date().toLocaleString(),
      };

      if (!previewMode && studentId !== "demo-student") {
        try {
          const attemptId = await submitAttempt(attempt);
          attempt.id = attemptId;
        } catch (error) {
          setSubmitting(false);
          alert(error?.message || "Unable to save attempt. Please try again.");
          return;
        }
      }

      onSubmit(attempt);
    },
    [answers, flatQuestions, onSubmit, previewMode, studentId, studentName, secondsLeft, submitting, test.id, test.duration]
  );

  // 1. Timer Hook
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timerRef.current);
          handleSubmit("Timer expired");
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerRef.current);
  }, [handleSubmit]);

  // 2. Stable Submit Reference (prevents listeners from resetting every second)
  const submitRef = useRef(handleSubmit);
  useEffect(() => {
    submitRef.current = handleSubmit;
  }, [handleSubmit]);

  // 3. Independent Grace Period Hook (Runs exactly once)
  useEffect(() => {
    const graceTimer = setTimeout(() => {
      gracePeriodRef.current = false;
    }, 2000);
    return () => clearTimeout(graceTimer);
  }, []);

  // 4. Anti-Cheat Event Listeners Hook
  useEffect(() => {
    if (previewMode) return;

    const handleVisibilityChange = () => {
      if (gracePeriodRef.current) return;
      if (document.hidden || document.visibilityState === "hidden") {
        submitRef.current("Auto-submitted: Backgrounded app, switched tabs, or locked screen");
      }
    };

    const handlePageHide = () => {
      if (gracePeriodRef.current) return;
      submitRef.current("Auto-submitted: Closed the browser app or navigated away");
    };

    const handleBlur = () => {
      if (gracePeriodRef.current) return;
      setTimeout(() => {
        if (document.hidden) return; 
        submitRef.current("Auto-submitted: Lost window focus (opened notifications or split-screen)");
      }, 200);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("blur", handleBlur);
    };
  }, [previewMode]); // Only re-run if preview mode changes, not every second!

  const handleSelect = (questionId, optionIndex) => {
    setAnswers((state) => ({ ...state, [questionId]: optionIndex }));
  };

  const section = test.sections[activeSection];
  const answeredCount = Object.keys(answers).length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60, gap: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: font.body }}>
          ← Cancel
        </button>
        <div style={{ width: 1, height: 24, background: C.border }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: C.textPrimary }}>{test.title}</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>{studentName} — {test.duration} min exam</span>
        </div>
        <div style={{ flex: 1 }} />
        <Badge color={secondsLeft <= 60 ? "red" : "accent"}>⏱ {formatTime(secondsLeft)}</Badge>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        {!previewMode && (
          <div style={{ background: C.redDim, border: `1px solid ${C.red}44`, borderRadius: 8, padding: "12px 16px", color: C.redText, fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <strong style={{ display: "block", marginBottom: 2 }}>Strict Exam Mode Active</strong>
              Do not change tabs, minimize the browser, open notifications, or split your screen. Doing so will immediately auto-submit your exam.
            </div>
          </div>
        )}

        <Card style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Section</div>
            <div style={{ fontFamily: font.heading, fontSize: 20, fontWeight: 700, color: C.textPrimary }}>{section.name}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Questions answered</div>
            <div style={{ fontFamily: font.heading, fontSize: 20, fontWeight: 700, color: C.accentText }}>{answeredCount}/{flatQuestions.length}</div>
          </div>
          <div style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={() => handleSubmit("Manual submit")} disabled={submitting} style={{ padding: "10px 18px" }}>
            {submitting ? "Submitting…" : "Submit Exam"}
          </Btn>
        </Card>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {test.sections.map((sectionItem, index) => (
            <button
              key={sectionItem.id}
              onClick={() => setActiveSection(index)}
              style={{
                padding: "9px 18px", borderRadius: 10,
                border: `1px solid ${activeSection === index ? C.accent : C.border}`,
                background: activeSection === index ? C.accentDim : C.surface,
                color: activeSection === index ? C.accentText : C.textSecondary,
                fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: font.body,
              }}
            >
              {sectionItem.name} ({sectionItem.questions.length})
            </button>
          ))}
        </div>

        <Card>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Answer the questions below and submit before the timer ends.</div>
          {section.questions.map((question, questionIndex) => {
            const currentAnswer = answers[question.id];
            return (
              <div key={question.id} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.accentDim, display: "grid", placeItems: "center", fontWeight: 700, color: C.accentText }}>{questionIndex + 1}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{question.text}</div>
                </div>
                {question.passage && (
                  <div style={{ marginBottom: 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, color: C.textSecondary, lineHeight: 1.8 }}>
                    {question.passage.split("\n").filter(Boolean).map((paragraph, idx) => (<p key={idx} style={{ margin: "0 0 10px" }}>{paragraph}</p>))}
                  </div>
                )}
                <div style={{ display: "grid", gap: 10 }}>
                  {question.options.map((option, optionIndex) => {
                    const selected = currentAnswer === optionIndex;
                    return (
                      <button
                        key={optionIndex} type="button" onClick={() => handleSelect(question.id, optionIndex)}
                        style={{
                          textAlign: "left", borderRadius: 12, border: `1px solid ${selected ? C.accent : C.border}`,
                          background: selected ? C.accentDim : C.surface, color: selected ? C.accentText : C.textPrimary,
                          padding: "14px 18px", cursor: "pointer", fontFamily: font.body, fontSize: 14,
                        }}
                      >
                        <span style={{ display: "inline-block", width: 24, height: 24, borderRadius: "50%", border: `1.5px solid ${selected ? C.accent : C.textMuted}`, marginRight: 12, textAlign: "center", lineHeight: "24px", color: selected ? C.accentText : C.textMuted }}>
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}