import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Btn, Badge, Card, C, font, Input } from "../ui/Primitives";
import { formatTime } from "../../utils/format";
import { submitAttempt } from "../../firebase/attempts";

export default function ExamView({ test, studentId, studentName, previewMode, onCancel, onSubmit }) {
  const [answers, setAnswers] = useState({});
  const [activeSection, setActiveSection] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(test.duration * 60);
  const [submitting, setSubmitting] = useState(false);
  
  // NEW: Warning System State
  const [warnings, setWarnings] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  
  const timerRef = useRef(null);
  const gracePeriodRef = useRef(true);

  // Fallback marking scheme if the test doesn't have one defined
  const marking = test.markingScheme || { correct: 1, incorrect: 0 };

  const flatQuestions = useMemo(
    () => test.sections.flatMap((section) => section.questions.map((question) => ({ ...question, sectionName: section.name }))),
    [test]
  );

  const handleSubmit = useCallback(
    async (reason) => {
      if (submitting) return;
      setSubmitting(true);
      window.clearInterval(timerRef.current);

      // NEW: Advanced Scoring Logic (TITA + Negative Marking)
      let score = 0;
      flatQuestions.forEach(q => {
        const ans = answers[q.id];
        if (ans !== undefined && ans !== "") {
          let isCorrect = false;
          if (q.type === 'tita') {
            // TITA: Compare text ignoring case and extra spaces
            isCorrect = String(ans).trim().toLowerCase() === String(q.correct).trim().toLowerCase();
          } else {
            // MCQ: Compare index
            isCorrect = ans === q.correct;
          }
          
          if (isCorrect) {
            score += marking.correct;
          } else {
            score -= marking.incorrect; // Subtract penalty
          }
        }
      });

      const attempt = {
        testId: test.id,
        studentId,
        studentName,
        answers,
        score,
        total: flatQuestions.length * marking.correct, // Max possible score
        timeTaken: test.duration * 60 - secondsLeft,
        reason,
        violations: warnings > 0 ? [{ time: new Date().toLocaleString(), reason: "Received tab-switch warning" }] : [],
        submittedAt: new Date().toLocaleString(),
      };

      if (!previewMode && studentId !== "demo-student") {
        try {
          const attemptId = await submitAttempt(attempt);
          attempt.id = attemptId;
        } catch (error) {
          setSubmitting(false);
          alert(error?.message || "Unable to save attempt.");
          return;
        }
      }
      onSubmit(attempt);
    },
    [answers, flatQuestions, onSubmit, previewMode, studentId, studentName, secondsLeft, submitting, test.id, test.duration, marking, warnings]
  );

  const triggerAntiCheat = useCallback((violationType) => {
    if (previewMode) return;
    
    setWarnings(prev => {
      const newCount = prev + 1;
      if (newCount === 1) {
        setShowWarningModal(true); // Show warning first time
        return newCount;
      } else {
        handleSubmit(`Auto-submitted: Repeated violation (${violationType})`); // Submit second time
        return newCount;
      }
    });
  }, [handleSubmit, previewMode]);

  // Timer
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

  // Anti-Cheat Listeners
  const submitRef = useRef(triggerAntiCheat);
  useEffect(() => { submitRef.current = triggerAntiCheat; }, [triggerAntiCheat]);

  useEffect(() => {
    const graceTimer = setTimeout(() => { gracePeriodRef.current = false; }, 2000);
    
    const handleVisibilityChange = () => {
      if (gracePeriodRef.current || showWarningModal) return;
      if (document.hidden || document.visibilityState === "hidden") submitRef.current("Switched tabs or minimized");
    };

    const handleBlur = () => {
      if (gracePeriodRef.current || showWarningModal) return;
      setTimeout(() => {
        if (document.hidden) return; 
        submitRef.current("Lost window focus");
      }, 200);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      clearTimeout(graceTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [showWarningModal]); 

  const handleSelect = (questionId, value) => {
    setAnswers((state) => ({ ...state, [questionId]: value }));
  };

  const section = test.sections[activeSection];
  const answeredCount = Object.keys(answers).filter(k => answers[k] !== "").length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      
      {/* NEW: The Strike-1 Warning Modal */}
      {showWarningModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(220, 38, 38, 0.95)", display: "grid", placeItems: "center", zIndex: 9999, padding: 24 }}>
          <Card style={{ maxWidth: 500, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontFamily: font.heading, fontSize: 24, margin: "0 0 16px", color: C.redText }}>EXAM VIOLATION WARNING</h2>
            <p style={{ color: C.textPrimary, fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
              We detected that you left the exam window, changed tabs, or opened another application. 
              <br/><br/>
              <strong>This is your ONLY warning.</strong> If you leave this window again, your exam will be instantly submitted with your current score.
            </p>
            <Btn variant="primary" onClick={() => { setShowWarningModal(false); gracePeriodRef.current = true; setTimeout(() => gracePeriodRef.current = false, 2000); }} style={{ width: "100%", padding: 16, fontSize: 16, background: C.red, color: "#fff" }}>
              I Understand, Return to Exam
            </Btn>
          </Card>
        </div>
      )}

      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60, gap: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: font.body }}>← Cancel</button>
        <div style={{ width: 1, height: 24, background: C.border }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: C.textPrimary }}>{test.title}</span>
        </div>
        <div style={{ flex: 1 }} />
        <Badge color={secondsLeft <= 60 ? "red" : "accent"}>⏱ {formatTime(secondsLeft)}</Badge>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
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
              key={sectionItem.id} onClick={() => setActiveSection(index)}
              style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${activeSection === index ? C.accent : C.border}`, background: activeSection === index ? C.accentDim : C.surface, color: activeSection === index ? C.accentText : C.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: font.body }}
            >
              {sectionItem.name} ({sectionItem.questions.length})
            </button>
          ))}
        </div>

        <Card>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
            <span>Answer the questions below.</span>
            <span>Marking: +{marking.correct} / -{marking.incorrect}</span>
          </div>
          
          {section.questions.map((question, questionIndex) => {
            const currentAnswer = answers[question.id];
            return (
              <div key={question.id} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.accentDim, display: "grid", placeItems: "center", fontWeight: 700, color: C.accentText }}>{questionIndex + 1}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                    {question.text} {question.type === 'tita' && <Badge color="amber" style={{marginLeft: 8}}>TITA</Badge>}
                  </div>
                </div>
                {question.passage && (
                  <div style={{ marginBottom: 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, color: C.textSecondary, lineHeight: 1.8 }}>
                    {question.passage.split("\n").filter(Boolean).map((paragraph, idx) => (<p key={idx} style={{ margin: "0 0 10px" }}>{paragraph}</p>))}
                  </div>
                )}
                
                {/* Render MCQ or TITA Input */}
                {question.type === 'tita' ? (
                  <div style={{ maxWidth: 400 }}>
                    <Input 
                      placeholder="Type your answer here..." 
                      value={currentAnswer || ""} 
                      onChange={(val) => handleSelect(question.id, val)} 
                    />
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {question.options.map((option, optionIndex) => {
                      const selected = currentAnswer === optionIndex;
                      return (
                        <button
                          key={optionIndex} type="button" onClick={() => handleSelect(question.id, optionIndex)}
                          style={{ textAlign: "left", borderRadius: 12, border: `1px solid ${selected ? C.accent : C.border}`, background: selected ? C.accentDim : C.surface, color: selected ? C.accentText : C.textPrimary, padding: "14px 18px", cursor: "pointer", fontFamily: font.body, fontSize: 14 }}
                        >
                          <span style={{ display: "inline-block", width: 24, height: 24, borderRadius: "50%", border: `1.5px solid ${selected ? C.accent : C.textMuted}`, marginRight: 12, textAlign: "center", lineHeight: "24px", color: selected ? C.accentText : C.textMuted }}>
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          {option}
                        </button>
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