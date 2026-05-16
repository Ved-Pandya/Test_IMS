import { useState } from "react";
import { Btn, Card, Input, C, font } from "../ui/Primitives";

export default function TestCreationForm({ teacherId, teacherName, onBack, onSave }) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(120);
  
  // NEW: Marking Scheme State
  const [markCorrect, setMarkCorrect] = useState(3);
  const [markIncorrect, setMarkIncorrect] = useState(1);

  const [sections, setSections] = useState([
    { id: Date.now().toString(), name: "Section 1", questions: [] }
  ]);

  const handleAddSection = () => {
    setSections([...sections, { id: Date.now().toString(), name: `Section ${sections.length + 1}`, questions: [] }]);
  };

  const handleAddQuestion = (sectionIndex) => {
    const newSections = [...sections];
    newSections[sectionIndex].questions.push({
      id: Date.now().toString() + Math.random(),
      text: "",
      passage: "",
      type: "mcq", // Defaults to MCQ
      options: ["", "", "", ""],
      correct: 0, // 0-3 for MCQ, string for TITA
    });
    setSections(newSections);
  };

  const updateQuestion = (sIdx, qIdx, field, value) => {
    const newSections = [...sections];
    newSections[sIdx].questions[qIdx][field] = value;
    
    // Auto-reset the correct answer field if they change the question type to prevent data bugs
    if (field === 'type' && value === 'tita') {
      newSections[sIdx].questions[qIdx].correct = "";
    } else if (field === 'type' && value === 'mcq') {
      newSections[sIdx].questions[qIdx].correct = 0;
    }
    
    setSections(newSections);
  };

  const updateOption = (sIdx, qIdx, optIdx, value) => {
    const newSections = [...sections];
    newSections[sIdx].questions[qIdx].options[optIdx] = value;
    setSections(newSections);
  };

  const handleRemoveQuestion = (sIdx, qIdx) => {
    const newSections = [...sections];
    newSections[sIdx].questions.splice(qIdx, 1);
    setSections(newSections);
  };

  const handleSave = () => {
    if (!title.trim()) return alert("Please enter a test title.");
    
    const newTest = {
      title,
      duration: Number(duration),
      markingScheme: {
        correct: Number(markCorrect),
        incorrect: Number(markIncorrect)
      },
      teacherId,
      createdBy: teacherName,
      sections,
    };
    onSave(newTest);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body, paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>← Back</button>
        <div style={{ width: 1, height: 24, background: C.border, margin: "0 16px" }} />
        <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: C.textPrimary }}>Create New Test</span>
        <div style={{ flex: 1 }} />
        <Btn onClick={handleSave}>Save & Create Test</Btn>
      </div>

      <div style={{ maxWidth: 800, margin: "32px auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 32 }}>
        
        {/* Test Settings */}
        <Card>
          <h2 style={{ fontFamily: font.heading, fontSize: 18, color: C.textPrimary, margin: "0 0 20px" }}>Test Settings</h2>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
            <Input label="Test Title" value={title} onChange={setTitle} placeholder="e.g. CAT Mock Exam 1" />
            <Input label="Duration (minutes)" type="number" value={duration} onChange={setDuration} />
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input label="Marks for Correct Answer (+)" type="number" value={markCorrect} onChange={setMarkCorrect} />
            <Input label="Marks for Incorrect Answer (-)" type="number" value={markIncorrect} onChange={setMarkIncorrect} />
          </div>
        </Card>

        {/* Sections */}
        {sections.map((section, sIdx) => (
          <div key={section.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Input 
                value={section.name} 
                onChange={(val) => {
                  const newSections = [...sections];
                  newSections[sIdx].name = val;
                  setSections(newSections);
                }} 
                style={{ fontSize: 18, fontWeight: 700, fontFamily: font.heading, background: "transparent", border: "none", borderBottom: `2px solid ${C.border}`, borderRadius: 0, padding: "8px 0", color: C.textPrimary }}
              />
            </div>

            {section.questions.map((q, qIdx) => (
              <Card key={q.id} style={{ borderLeft: `4px solid ${C.accent}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: C.textSecondary, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>Question {qIdx + 1}</div>
                  <button onClick={() => handleRemoveQuestion(sIdx, qIdx)} style={{ background: "none", border: "none", color: C.redText, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Remove</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Common Fields */}
                  <Input label="Question Text" value={q.text} onChange={(val) => updateQuestion(sIdx, qIdx, "text", val)} placeholder="Enter the question..." />
                  
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Passage / Reference Text (Optional)</label>
                    <textarea 
                      value={q.passage} 
                      onChange={(e) => updateQuestion(sIdx, qIdx, "passage", e.target.value)}
                      placeholder="Paste reading comprehension passage or data tables here..."
                      style={{ width: "100%", minHeight: 100, padding: 12, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary, fontFamily: font.body, fontSize: 14, resize: "vertical" }}
                    />
                  </div>

                  {/* Type Selector & Dynamic Fields */}
                  <div style={{ padding: 16, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Question Type</label>
                      <select 
                        value={q.type} 
                        onChange={(e) => updateQuestion(sIdx, qIdx, "type", e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.textPrimary, fontSize: 14, outline: "none", cursor: "pointer" }}
                      >
                        <option value="mcq">Multiple Choice (MCQ)</option>
                        <option value="tita">Type in the Answer (TITA)</option>
                      </select>
                    </div>

                    {q.type === 'mcq' ? (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                          {q.options.map((opt, optIdx) => (
                            <Input 
                              key={optIdx} 
                              label={`Option ${String.fromCharCode(65 + optIdx)}`} 
                              value={opt} 
                              onChange={(val) => updateOption(sIdx, qIdx, optIdx, val)} 
                            />
                          ))}
                        </div>
                        <div>
                          <label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Correct Option</label>
                          <select 
                            value={q.correct} 
                            onChange={(e) => updateQuestion(sIdx, qIdx, "correct", Number(e.target.value))}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.textPrimary, fontSize: 14, outline: "none", cursor: "pointer" }}
                          >
                            {q.options.map((_, idx) => (
                              <option key={idx} value={idx}>Option {String.fromCharCode(65 + idx)}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <div>
                        <Input 
                          label="Exact Correct Answer" 
                          value={q.correct} 
                          onChange={(val) => updateQuestion(sIdx, qIdx, "correct", val)} 
                          placeholder="e.g. 42 or Apple" 
                        />
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>*Students must type this exact text. Evaluation ignores capitalization and extra spaces.</div>
                      </div>
                    )}
                  </div>

                </div>
              </Card>
            ))}

            <Btn variant="ghost" onClick={() => handleAddQuestion(sIdx)} style={{ alignSelf: "flex-start", border: `1px dashed ${C.border}` }}>
              + Add Question to {section.name}
            </Btn>
          </div>
        ))}

        <Btn variant="primary" onClick={handleAddSection} style={{ alignSelf: "center", padding: "12px 24px" }}>
          + Add New Section
        </Btn>

      </div>
    </div>
  );
}