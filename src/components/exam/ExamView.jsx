import { useState, useEffect } from "react";
import { Btn, Card, Badge, C, font } from "../ui/Primitives";

export default function ExamView({ test, studentProfile, onSubmitExam }) {
  // --- Exam States ---
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  
  // Flattening mapped pointer positions to look up active questions globally or per section
  const currentSection = test.sections[currentSectionIdx];
  const currentQuestion = currentSection?.questions[currentQuestionIdx];

  // Answer state mapper: Key format: "questionId" -> value (index for MCQ, string for TITA)
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState(new Set());
  
  // --- Timer Operations Engine ---
  const [timeLeft, setTimeLeft] = useState((test.duration || 120) * 60);
  const [timeTaken, setTimeTaken] = useState(0);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleAutoSubmit("Timer Expired");
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
      setTimeTaken((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format seconds to human-readable HH:MM:SS format
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // --- Input Modification Handlers ---
  const handleSelectOption = (optionIndex) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }));
  };

  const handleTitaInput = (textValue) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: textValue }));
  };

  const handleClearAnswer = () => {
    setAnswers((prev) => {
      const updated = { ...prev };
      delete updated[currentQuestion.id];
      return updated;
    });
  };

  const handleToggleMarkReview = () => {
    setMarkedForReview((prev) => {
      const updated = new Set(prev);
      if (updated.has(currentQuestion.id)) {
        updated.delete(currentQuestion.id);
      } else {
        updated.add(currentQuestion.id);
      }
      return updated;
    });
  };

  // --- Navigation Matrix Controllers ---
  const handleNext = () => {
    if (currentQuestionIdx < currentSection.questions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    } else if (currentSectionIdx < test.sections.length - 1) {
      setCurrentSectionIdx(currentSectionIdx + 1);
      setCurrentQuestionIdx(0);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(currentQuestionIdx - 1);
    } else if (currentSectionIdx > 0) {
      setCurrentSectionIdx(currentSectionIdx - 1);
      // Set to final question of the previous section
      setCurrentQuestionIdx(test.sections[currentSectionIdx - 1].questions.length - 1);
    }
  };

  // --- Evaluation Strategy Engine ---
  const processCalculatedGrading = (reasonStr) => {
    let totalScore = 0;
    const flatQuestions = test.sections.flatMap((s) => s.questions);
    const grading = test.markingScheme || { correct: 3, incorrect: 1 };

    flatQuestions.forEach((q) => {
      const studentAns = answers[q.id];
      if (studentAns === undefined || studentAns === "") return; // unattempted

      if (q.type === "tita") {
        const isCorrect = String(studentAns).trim().toLowerCase() === String(q.correct).trim().toLowerCase();
        if (isCorrect) totalScore += grading.correct;
      } else {
        const isCorrect = Number(studentAns) === Number(q.correct);
        if (isCorrect) {
          totalScore += grading.correct;
        } else {
          totalScore -= grading.incorrect; // subtract negative penalty metrics
        }
      }
    });

    return {
      testId: test.id,
      testTitle: test.title,
      studentId: studentProfile.uid,
      studentName: studentProfile.name,
      answers,
      score: totalScore,
      total: flatQuestions.length * grading.correct,
      timeTaken,
      reason: reasonStr,
      submittedAt: new Date(),
    };
  };

  const handleManualSubmit = () => {
    const flatQuestions = test.sections.flatMap((s) => s.questions);
    const attemptedCount = Object.keys(answers).filter(k => answers[k] !== "").length;
    
    if (window.confirm(`Are you sure you want to finish? You answered ${attemptedCount} / ${flatQuestions.length} questions.`)) {
      const payload = processCalculatedGrading("Manual Submission");
      onSubmitExam(payload);
    }
  };

  const handleAutoSubmit = (reason) => {
    alert(`Exam session closing automatically: ${reason}`);
    const payload = processCalculatedGrading(`Auto Submission (${reason})`);
    onSubmitExam(payload);
  };

  // Status mapping helper for question palette dots
  const getQuestionStatus = (qId) => {
    const isAnswered = answers[qId] !== undefined && answers[qId] !== "";
    const isMarked = markedForReview.has(qId);

    if (isMarked && isAnswered) return "purple-answered";
    if (isMarked) return "purple";
    if (isAnswered) return "green";
    return "gray";
  };

  // Dynamic layout rendering setup helper
  const hasPassage = currentQuestion?.passage && currentQuestion.passage.trim().length > 0;

  if (!currentQuestion) return <div style={{ color: C.textPrimary, padding: 40 }}>Empty test parameters.</div>;

  return (
    <div style={{ height: "100vh", background: C.bg, fontFamily: font.body, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      
      {/* 1. RUNTIME UTILITY HEADER */}
      <div style={{ height: 64, background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 16, fontFamily: font.heading, fontWeight: 800, color: C.textPrimary, margin: 0 }}>{test.title}</h1>
          <span style={{ fontSize: 12, color: C.textMuted }}>Candidate: {studentProfile.name}</span>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Badge color={timeLeft < 300 ? "red" : "accent"} style={{ fontSize: 16, padding: "8px 16px", fontFamily: font.mono, fontWeight: 700 }}>
            ⏱ {formatTime(timeLeft)}
          </Badge>
          <Btn variant="primary" onClick={handleManualSubmit} style={{ background: C.red, color: "#fff" }}>Submit Test</Btn>
        </div>
      </div>

      {/* 2. SECTION TABS HEADER ROW */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 4, padding: "4px 24px 0" }}>
        {test.sections.map((sec, idx) => (
          <button
            key={sec.id}
            onClick={() => { setCurrentSectionIdx(idx); setCurrentQuestionIdx(0); }}
            style={{
              padding: "12px 20px",
              background: "none",
              border: "none",
              borderBottom: `3px solid ${currentSectionIdx === idx ? C.accent : "transparent"}`,
              color: currentSectionIdx === idx ? C.textPrimary : C.textMuted,
              fontWeight: currentSectionIdx === idx ? 700 : 500,
              cursor: "pointer",
              fontFamily: font.body,
              fontSize: 13
            }}
          >
            {sec.name}
          </button>
        ))}
      </div>

      {/* 3. CORE CORE SPLIT WORKSPACE ENGINE */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 280px", overflow: "hidden" }}>
        
        {/* LEFT WORKSPACE PANE */}
        <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
          
          <div style={{ display: "grid", gridTemplateColumns: hasPassage ? "1fr 1fr" : "1fr", gap: 24, height: "100%", maxHeight: "calc(100vh - 180px)", overflow: "hidden" }}>
            
            {/* CONDITIONAL SUB-PANEL A: PASSAGE VIEWPORT OVERFLOW SCROLL */}
            {hasPassage && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, overflowY: "auto", height: "100%", lineHeight: 1.6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.accentText, letterSpacing: 0.5, display: "block", marginBottom: 12, textTransform: "uppercase" }}>Reading Comprehension Passage</span>
                <div style={{ color: C.textPrimary, fontSize: 14, whiteSpace: "pre-wrap" }}>
                  {currentQuestion.passage}
                </div>
              </div>
            )}

            {/* SUB-PANEL B: ACTIVE QUESTION CONTENT AND CONTROL EVALUATOR */}
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
              <Card style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100%" }}>
                
                {/* Meta-Badge Information */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <Badge color="accent">Question {currentQuestionIdx + 1} of {currentSection.questions.length}</Badge>
                  <Badge color={currentQuestion.type === "tita" ? "amber" : "gray"}>
                    {currentQuestion.type === "tita" ? "TITA Type Input" : "MCQ Single Target Option"}
                  </Badge>
                </div>

                {/* Core Text Body String */}
                <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, lineHeight: 1.5, marginBottom: 24 }}>
                  {currentQuestion.text}
                </div>

                {/* Interface Context Routing Variant Input Shells */}
                <div style={{ flex: 1 }}>
                  {currentQuestion.type === "tita" ? (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Type your answer string down below:</label>
                      <input
                        type="text"
                        value={answers[currentQuestion.id] || ""}
                        onChange={(e) => handleTitaInput(e.target.value)}
                        placeholder="Type text or numerical answer value evaluation sequence..."
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, fontFamily: font.body, fontSize: 15, outline: "none" }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {currentQuestion.options?.map((opt, idx) => {
                        const isSelected = answers[currentQuestion.id] === idx;
                        return (
                          <div
                            key={idx}
                            onClick={() => handleSelectOption(idx)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "14px 16px",
                              borderRadius: 8,
                              background: isSelected ? C.accentDim : C.bg,
                              border: `1px solid ${isSelected ? C.accent : C.border}`,
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                          >
                            <span style={{
                              width: 24, height: 24, borderRadius: "50%",
                              border: `1.5px solid ${isSelected ? C.accent : C.textMuted}`,
                              marginRight: 14, textAlign: "center", lineHeight: "24px",
                              fontSize: 12, fontWeight: 700,
                              color: isSelected ? C.accentText : C.textMuted,
                              background: isSelected ? C.surface : "transparent"
                            }}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span style={{ color: isSelected ? C.textPrimary : C.textSecondary, fontSize: 14, fontWeight: isSelected ? 600 : 400 }}>{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Question Lower Interlock Controller Row */}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, paddingTop: 20, marginTop: 24 }}>
                  <Btn variant="ghost" onClick={handleToggleMarkReview} style={{ border: `1px solid ${C.border}`, fontSize: 13 }}>
                    🔖 {markedForReview.has(currentQuestion.id) ? "Unmark Review" : "Mark for Review"}
                  </Btn>
                  <Btn variant="ghost" onClick={handleClearAnswer} disabled={answers[currentQuestion.id] === undefined} style={{ fontSize: 13 }}>
                    🚫 Clear Response
                  </Btn>
                </div>

              </Card>
            </div>

          </div>

          {/* LOWER RUNTIME SYSTEM TOGGLE SWITCH TRAYS */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Btn variant="ghost" onClick={handlePrev} disabled={currentSectionIdx === 0 && currentQuestionIdx === 0}>
              ← Previous Question
            </Btn>
            <Btn variant="primary" onClick={handleNext} disabled={currentSectionIdx === test.sections.length - 1 && currentQuestionIdx === currentSection.questions.length - 1}>
              Save & Next →
            </Btn>
          </div>

        </div>

        {/* RIGHT PALETTE DASHBOARD RAIL PANE */}
        <div style={{ background: C.surface, borderLeft: `1px solid ${C.border}`, padding: 20, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          
          {/* Diagnostic Stats Legend Summary Badge Container */}
          <div>
            <h4 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>Question Status Matrix</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.textSecondary }}><span style={{ width: 10, height: 10, borderRadius: "2px", background: C.green }} /> Answered</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.textSecondary }}><span style={{ width: 10, height: 10, borderRadius: "2px", background: C.border }} /> Unanswered</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.textSecondary }}><span style={{ width: 10, height: 10, borderRadius: "2px", background: "#4C6EF5" }} /> Review Only</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.textSecondary }}><span style={{ width: 10, height: 10, borderRadius: "2px", background: "#7048E8" }} /> Marked + Ans</div>
            </div>
          </div>

          <div style={{ width: "100%", height: 1, background: C.border }} />

          {/* Live Component Matrix Array Node Core */}
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>{currentSection.name} Palette</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {currentSection.questions.map((q, idx) => {
                const status = getQuestionStatus(q.id);
                const isActive = currentQuestionIdx === idx;
                
                let bg = C.bg, border = `1px solid ${C.border}`, textCol = C.textSecondary;
                if (status === "green") { bg = C.green; border = `1px solid ${C.green}`; textCol = "#fff"; } 
                else if (status === "purple") { bg = "#4C6EF5"; border = "1px solid #4C6EF5"; textCol = "#fff"; } 
                else if (status === "purple-answered") { bg = "#7048E8"; border = "1px solid #7048E8"; textCol = "#fff"; }

                if (isActive) border = `2px solid ${C.accentText || C.textPrimary}`;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIdx(idx)}
                    style={{
                      width: 36, height: 36, borderRadius: 6,
                      background: bg, border, color: textCol,
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                      fontFamily: font.mono, display: "grid", placeItems: "center",
                      boxShadow: isActive ? "0 0 8px rgba(99, 102, 241, 0.4)" : "none"
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Informational Marking Scheme Summary footer layout cards */}
          <Card style={{ padding: 12, background: C.bg }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 4 }}>SECTION MARKING</div>
            <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
              Correct: <span style={{ color: C.greenText }}>+{test.markingScheme?.correct || 3}</span> | Incorrect: <span style={{ color: C.redText }}>-{test.markingScheme?.incorrect || 1}</span>
            </div>
          </Card>

        </div>

      </div>

    </div>
  );
}