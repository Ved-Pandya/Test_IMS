import { useState, useEffect, useRef } from "react";
import { Btn, Card, Badge, C, font } from "../ui/Primitives";

export default function ExamView({ test, studentProfile, onSubmitExam }) {
  // --- Exam States ---
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  
  const currentSection = test.sections[currentSectionIdx];
  const currentQuestion = currentSection?.questions[currentQuestionIdx];

  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState(new Set());
  
  // --- Proctoring & Anti-Cheating States ---
  const [violations, setViolations] = useState([]); 
  const [warningCount, setWarningCount] = useState(0);
  
  // Hard limits adjusted so warnings happen on 1st and 2nd switch; auto-submits on the 3rd.
  const MAX_ALLOWED_VIOLATIONS = 3; 
  
  // --- Safe Modal UI States ---
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [currentWarningReason, setCurrentWarningReason] = useState("");
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");

  const isSystemModalOpenRef = useRef(false);
  const warningCountRef = useRef(0);
  
  // FIXED: Time lock reference completely stops double-counting overlapping visibility vs blur loops
  const lastViolationTimeRef = useRef(0);

  useEffect(() => {
    warningCountRef.current = warningCount;
  }, [warningCount]);
  
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

  // --- STRICT PROCTORING ENGINE SECURITY LAYER ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isSystemModalOpenRef.current && showTerminationModal) return;
        triggerProctorViolation("Tab switched or window minimized");
      }
    };

    const handleWindowBlur = () => {
      if (isSystemModalOpenRef.current) {
        console.log("Proctoring focus monitor paused: Active session dialog open.");
        return;
      }
      triggerProctorViolation("Left the active exam window focus area");
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    const handleKeyDown = (e) => {
      if (
        (e.ctrlKey && e.key === "c") || 
        (e.ctrlKey && e.key === "v") || 
        (e.ctrlKey && e.key === "u") || 
        e.key === "F12"
      ) {
        e.preventDefault();
      }
    };

    const handleBeforeUnload = (e) => {
      if (warningCountRef.current + 1 >= MAX_ALLOWED_VIOLATIONS) return;
      e.preventDefault();
      e.returnValue = "Warning: Leaving or closing this screen will invalidate your exam progress.";
      return e.returnValue;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [warningCount, violations, showTerminationModal]); 

  const triggerProctorViolation = (reasonStr) => {
    const now = Date.now();
    
    // FIXED: If an overlapping browser event fires within 500ms of the last recorded violation, reject it immediately
    if (now - lastViolationTimeRef.current < 500) {
      console.log("Proctor engine blocked duplicate concurrent event structure.");
      return;
    }
    
    lastViolationTimeRef.current = now; // Lock timestamp instantly

    const newCount = warningCount + 1;
    const timestamp = new Date().toLocaleTimeString();
    const violationLog = `${timestamp} - ${reasonStr}`;
    
    const updatedViolations = [...violations, violationLog];
    setViolations(updatedViolations);
    setWarningCount(newCount);

    if (newCount >= MAX_ALLOWED_VIOLATIONS) {
      handleAutoSubmit(`Exceeded Security Integrity Limits (${MAX_ALLOWED_VIOLATIONS} Violations)`);
    } else {
      isSystemModalOpenRef.current = true;
      setCurrentWarningReason(reasonStr);
      setShowWarningModal(true);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

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
      setCurrentQuestionIdx(test.sections[currentSectionIdx - 1].questions.length - 1);
    }
  };

  const processCalculatedGrading = (reasonStr) => {
    let totalScore = 0;
    const flatQuestions = test.sections.flatMap((s) => s.questions);
    
    // FIXED: Safely parse custom marking scheme values into positive integers, eliminating string concatenation issues
    const correctReward = Number(test.markingScheme?.correct !== undefined ? Math.abs(test.markingScheme.correct) : 3);
    const incorrectPenalty = Number(test.markingScheme?.incorrect !== undefined ? Math.abs(test.markingScheme.incorrect) : 1);

    const isViolatedLock = reasonStr.includes("Security Integrity Limits");

    if (isViolatedLock) {
      totalScore = 0;
    } else {
      flatQuestions.forEach((q) => {
        const studentAns = answers[q.id];
        if (studentAns === undefined || studentAns === "") return;

        if (q.type === "tita") {
          const isCorrect = String(studentAns).trim().toLowerCase() === String(q.correct).trim().toLowerCase();
          if (isCorrect) totalScore += correctReward;
        } else {
          const isCorrect = Number(studentAns) === Number(q.correct);
          if (isCorrect) {
            totalScore += correctReward;
          } else {
            // FIXED: Safely reduces the calculated total score metrics via numerical integer deduction subtraction
            totalScore -= incorrectPenalty;
          }
        }
      });
    }

    return {
      testId: test.id,
      testTitle: test.title,
      studentId: studentProfile.uid,
      studentName: studentProfile.name,
      answers,
      score: totalScore,
      total: flatQuestions.length * correctReward,
      timeTaken,
      reason: reasonStr,
      violations, 
      isAutoSubmitted: isViolatedLock || reasonStr.includes("Timer Expired"),
      submittedAt: new Date(),
    };
  };

  const handleManualSubmitTrigger = () => {
    isSystemModalOpenRef.current = true;
    setShowSubmitModal(true);
  };

  const handleConfirmManualSubmit = () => {
    isSystemModalOpenRef.current = false;
    setShowSubmitModal(false);
    const payload = processCalculatedGrading("Manual Submission");
    onSubmitExam(payload);
  };

  const handleCancelManualSubmit = () => {
    isSystemModalOpenRef.current = false;
    setShowSubmitModal(false);
  };

  const handleConfirmTerminationSubmit = () => {
    isSystemModalOpenRef.current = false;
    setShowTerminationModal(false);
    const payload = processCalculatedGrading(`Auto Submission (${terminationReason})`);
    onSubmitExam(payload);
  };

  const handleCloseWarningModal = () => {
    isSystemModalOpenRef.current = false;
    setShowWarningModal(false);
  };

  const handleAutoSubmit = (reason) => {
    isSystemModalOpenRef.current = true;
    setTerminationReason(reason);
    setShowTerminationModal(true);
  };

  const getQuestionStatus = (qId) => {
    const isAnswered = answers[qId] !== undefined && answers[qId] !== "";
    const isMarked = markedForReview.has(qId);

    if (isMarked && isAnswered) return "purple-answered";
    if (isMarked) return "purple";
    if (isAnswered) return "green";
    return "gray";
  };

  const setQuestionAndCloseMobile = (idx) => {
    setCurrentQuestionIdx(idx);
    setMobilePaletteOpen(false);
  };

  const hasPassage = currentQuestion?.passage && currentQuestion.passage.trim().length > 0;
  const flatQuestions = test.sections.flatMap((s) => s.questions);
  const attemptedCount = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== "").length;

  if (!currentQuestion) return <div style={{ color: C.textPrimary, padding: 40 }}>Empty test parameters.</div>;

  return (
    <div style={{ height: "100vh", background: C.bg, fontFamily: font.body, display: "flex", flexDirection: "column", overflow: "hidden", userSelect: "none" }} onCopy={(e) => e.preventDefault()}>
      
      <style>{`
        .exam-layout-grid { display: grid; grid-template-columns: 1fr 280px; }
        .workspace-split-pane { display: grid; grid-template-columns: ${hasPassage ? "1fr 1fr" : "1fr"}; gap: 24px; }
        .desktop-right-rail { display: flex; }
        .mobile-palette-toggle-bar { display: none; }
        
        .passage-box {
          max-height: 100%;
        }
        
        @media (max-width: 768px) {
          .exam-layout-grid { grid-template-columns: 1fr !important; }
          .workspace-split-pane {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto;
            overflow-y: auto !important;
            max-height: calc(100vh - 210px) !important;
            gap: 16px;
          }
          .passage-box {
            min-height: 240px;
            max-height: 40vh;
          }
          .desktop-right-rail { display: none !important; }
          .mobile-palette-toggle-bar {
            display: flex !important;
            background: ${C.surface};
            border-bottom: 1px solid ${C.border};
            padding: 8px 24px;
            justify-content: space-between;
            align-items: center;
          }
          .mobile-drawer-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 17, 23, 0.8); z-index: 200; display: flex; justify-content: flex-end; }
          .mobile-drawer-content { width: 290px; background: ${C.surface}; height: 100%; padding: 24px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
        }
      `}</style>

      {/* HEADER ROW */}
      <div style={{ height: 64, background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 15, fontFamily: font.heading, fontWeight: 800, color: C.textPrimary, margin: 0, maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{test.title}</h1>
          <span style={{ fontSize: 11, color: C.textMuted }}>{studentProfile.name.split(" ")[0]}</span>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {warningCount > 0 && (
            <Badge color="red" style={{ fontWeight: 700 }}>⚠️ VIOLATIONS: {warningCount}/{MAX_ALLOWED_VIOLATIONS}</Badge>
          )}
          <Badge color={timeLeft < 300 ? "red" : "accent"} style={{ fontSize: 14, padding: "6px 12px", fontFamily: font.mono, fontWeight: 700 }}>
            ⏱ {formatTime(timeLeft)}
          </Badge>
          <Badge color="gray" style={{ fontSize: 11, padding: "4px 8px" }}>Attempted: {attemptedCount}/{flatQuestions.length}</Badge>
          <Btn onClick={handleManualSubmitTrigger} style={{ background: C.red, color: "#fff", padding: "6px 12px", fontSize: 13, border: "none" }}>Submit</Btn>
        </div>
      </div>

      {/* SECTION TABS ROW */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 4, padding: "4px 24px 0", overflowX: "auto" }}>
        {test.sections.map((sec, idx) => {
          const changeSection = (e) => {
            e.preventDefault();
            setCurrentSectionIdx(idx); 
            setCurrentQuestionIdx(0);
          };
          return (
            <button
              key={sec.id || idx}
              onTouchStart={changeSection}
              onClick={changeSection}
              style={{
                padding: "12px 14px",
                background: "none",
                border: "none",
                borderBottom: `3px solid ${currentSectionIdx === idx ? C.accent : "transparent"}`,
                color: currentSectionIdx === idx ? C.textPrimary : C.textMuted,
                fontWeight: currentSectionIdx === idx ? 700 : 500,
                cursor: "pointer",
                fontFamily: font.body,
                fontSize: 13,
                whiteSpace: "nowrap"
              }}
            >
              {sec.name}
            </button>
          );
        })}
      </div>

      <div className="mobile-palette-toggle-bar">
        <Badge color="accent">Q. {currentQuestionIdx + 1} of {currentSection.questions.length}</Badge>
        <Btn variant="ghost" onClick={() => setMobilePaletteOpen(true)} style={{ padding: "4px 10px", fontSize: 12 }}>
          📊 View Grid Matrix
        </Btn>
      </div>

      {/* CORE SPLIT INTERFACE PANE */}
      <div className="exam-layout-grid" style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="workspace-split-pane" style={{ height: "100%", maxHeight: "calc(100vh - 180px)", overflow: "hidden" }}>
            
            {hasPassage && (
              <div className="passage-box" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, overflowY: "auto", lineHeight: 1.6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.accentText, display: "block", marginBottom: 12, textTransform: "uppercase" }}>Reading Comprehension Passage</span>
                <div style={{ color: C.textPrimary, fontSize: 14, whiteSpace: "pre-wrap" }}>
                  {currentQuestion.passage}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <Card style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px" }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <Badge color="accent">Question {currentQuestionIdx + 1}</Badge>
                  <Badge color={currentQuestion.type === "tita" ? "amber" : "gray"}>
                    {currentQuestion.type === "tita" ? "TITA" : "MCQ"}
                  </Badge>
                </div>

                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, lineHeight: 1.5, marginBottom: 20 }}>
                  {currentQuestion.text}
                </div>

                <div style={{ flex: 1 }}>
                  {currentQuestion.type === "tita" ? (
                    <div>
                      <input
                        type="text"
                        value={answers[currentQuestion.id] || ""}
                        onChange={(e) => handleTitaInput(e.target.value)}
                        placeholder="Type text or numerical answer..."
                        style={{ width: "100%", padding: "12px 14px", borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, fontFamily: font.body, fontSize: 14, outline: "none" }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {currentQuestion.options?.map((opt, idx) => {
                        const isSelected = answers[currentQuestion.id] === idx;
                        return (
                          <div
                            key={idx}
                            onClick={() => handleSelectOption(idx)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "12px 14px",
                              borderRadius: 8,
                              background: isSelected ? C.accentDim : C.bg,
                              border: `1px solid ${isSelected ? C.accent : C.border}`,
                              cursor: "pointer"
                            }}
                          >
                            <span style={{
                              width: 22, height: 22, borderRadius: "50%",
                              border: `1.5px solid ${isSelected ? C.accent : C.textMuted}`,
                              marginRight: 12, textAlign: "center", lineHeight: "22px",
                              fontSize: 11, fontWeight: 700,
                              color: isSelected ? C.accentText : C.textMuted,
                              background: isSelected ? C.surface : "transparent"
                            }}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span style={{ color: isSelected ? C.textPrimary : C.textSecondary, fontSize: 14 }}>{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 20 }}>
                  <Btn variant="ghost" onClick={handleToggleMarkReview} style={{ border: `1px solid ${C.border}`, fontSize: 12, padding: "6px 12px" }}>
                    🔖 {markedForReview.has(currentQuestion.id) ? "Unmark" : "Review"}
                  </Btn>
                  <Btn variant="ghost" onClick={handleClearAnswer} disabled={answers[currentQuestion.id] === undefined} style={{ fontSize: 12, padding: "6px 12px" }}>
                    🚫 Clear Response
                  </Btn>
                </div>

              </Card>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
            <Btn variant="ghost" onClick={handlePrev} disabled={currentSectionIdx === 0 && currentQuestionIdx === 0} style={{ padding: "8px 14px", fontSize: 13 }}>
              ← Prev
            </Btn>
            <Btn variant="primary" onClick={handleNext} disabled={currentSectionIdx === test.sections.length - 1 && currentQuestionIdx === currentSection.questions.length - 1} style={{ padding: "8px 14px", fontSize: 13 }}>
              Save & Next →
            </Btn>
          </div>
        </div>

        {/* DESKTOP PERMANENT RIGHT SIDEBAR */}
        <div className="desktop-right-rail" style={{ background: C.surface, borderLeft: `1px solid ${C.border}`, padding: 20, flexDirection: "column", gap: 20, overflowY: "auto" }}>
          <PaletteContent currentSection={currentSection} currentQuestionIdx={currentQuestionIdx} getQuestionStatus={getQuestionStatus} setCurrentQuestionIdx={setCurrentQuestionIdx} test={test} />
        </div>
      </div>

      {/* MOBILE OVERLAY INTERACTION DRAWER */}
      {mobilePaletteOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobilePaletteOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: C.textPrimary }}>Exam Navigation</span>
              <Btn variant="ghost" onClick={() => setMobilePaletteOpen(false)} style={{ padding: "4px 8px" }}>✕ Close</Btn>
            </div>
            <div style={{ width: "100%", height: 1, background: C.border }} />
            <PaletteContent currentSection={currentSection} currentQuestionIdx={currentQuestionIdx} getQuestionStatus={getQuestionStatus} setCurrentQuestionIdx={setQuestionAndCloseMobile} test={test} />
          </div>
        </div>
      )}

      {/* --- INLINE FOCUS-SAFE PORTAL CUSTOM MODALS --- */}
      
      {/* 1. MANUAL SUBMISSION DIALOG */}
      {showSubmitModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(10, 11, 14, 0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28, borderRadius: 16, maxWidth: 420, width: "100%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)" }}>
            <h3 style={{ margin: "0 0 10px", color: C.textPrimary, fontSize: 18, fontWeight: 800, fontFamily: font.heading }}>Confirm Exam Submission</h3>
            <p style={{ color: C.textSecondary, fontSize: 14, lineHeight: 1.5, margin: "0 0 20px" }}>
              Are you sure you want to finish your test session? You have answered <strong>{attemptedCount}</strong> out of <strong>{flatQuestions.length}</strong> questions.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn onClick={handleCancelManualSubmit} variant="ghost" style={{ padding: "8px 16px", fontSize: 13 }}>Cancel and Return</Btn>
              <Btn onClick={handleConfirmManualSubmit} style={{ background: C.green || "#10b981", color: "#fff", padding: "8px 16px", fontSize: 13, border: "none" }}>Confirm Submission</Btn>
            </div>
          </div>
        </div>
      )}

      {/* 2. PROCTORING VIOLATION WARNING DIALOG */}
      {showWarningModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(220, 38, 38, 0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: C.surface, border: `2px solid ${C.red || "#ef4444"}`, padding: 28, borderRadius: 16, maxWidth: 420, width: "100%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)" }}>
            <h3 style={{ margin: "0 0 10px", color: C.red || "#ef4444", fontSize: 18, fontWeight: 800, fontFamily: font.heading }}>⚠️ SECURITY VIOLATION WARNING</h3>
            <p style={{ color: C.textPrimary, fontSize: 14, lineHeight: 1.5, margin: "0 0 12px" }}>
              The system detected an out-of-bounds action: <strong style={{ color: C.accentText }}>"{currentWarningReason}"</strong>.
            </p>
            <p style={{ color: C.textSecondary, fontSize: 13, lineHeight: 1.5, margin: "0 0 24px" }}>
              Match Rule Violations: <strong>{warningCount} / {MAX_ALLOWED_VIOLATIONS}</strong>.<br />
              <span style={{ color: C.redText, fontWeight: 700 }}>WARNING:</span> Leaving this active window layout <strong>ONE</strong> more time will trigger an immediate automatic session lock and submission.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn onClick={handleCloseWarningModal} style={{ background: C.textPrimary, color: C.bg, padding: "8px 20px", fontSize: 13, fontWeight: 700, border: "none" }}>I Understand, Resume Test</Btn>
            </div>
          </div>
        </div>
      )}

      {/* 3. HARD TERMINATION LOCKOUT DIALOG */}
      {showTerminationModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "#0a0b0e", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 32, borderRadius: 16, maxWidth: 460, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
            <h3 style={{ margin: "0 0 12px", color: C.red || "#ef4444", fontSize: 20, fontWeight: 800, fontFamily: font.heading }}>Exam Session Terminated</h3>
            <p style={{ color: C.textSecondary, fontSize: 14, lineHeight: 1.6, margin: "0 0 28px" }}>
              Your terminal link has been locked due to the following system event:<br />
              <strong style={{ color: C.textPrimary }}>{terminationReason}</strong>
            </p>
            <Btn onClick={handleConfirmTerminationSubmit} style={{ background: C.red, color: "#fff", width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, border: "none" }}>Transmit Log Data & Exit</Btn>
          </div>
        </div>
      )}

    </div>
  );
}

function PaletteContent({ currentSection, currentQuestionIdx, getQuestionStatus, setCurrentQuestionIdx, test }) {
  return (
    <>
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
                key={q.id || idx}
                onClick={() => setCurrentQuestionIdx(idx)}
                style={{
                  width: 36, height: 36, borderRadius: 6,
                  background: bg, border, color: textCol,
                  fontWeight: 700, fontSize: 12, cursor: "pointer",
                  fontFamily: font.mono, display: "grid", placeItems: "center"
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      <Card style={{ padding: 12, background: C.bg, marginTop: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 4 }}>SECTION MARKING</div>
        <div style={{ fontSize: 12, color: C.textPrimary, fontWeight: 600 }}>
          Correct: <span style={{ color: C.greenText }}>+{test.markingScheme?.correct || 3}</span> | Inc: <span style={{ color: C.redText }}>-{test.markingScheme?.incorrect || 1}</span>
        </div>
      </Card>
    </>
  );
}