import { useState } from "react";
import mammoth from "mammoth";
import { Btn, Card, Input, C, font } from "../ui/Primitives";

export default function TestCreationForm({ teacherId, teacherName, onBack, onSave }) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(120);
  const [markCorrect, setMarkCorrect] = useState(3);
  const [markIncorrect, setMarkIncorrect] = useState(1);
  const [isParsing, setIsParsing] = useState(false);

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
      type: "mcq",
      options: ["", "", "", ""],
      correct: 0,
    });
    setSections(newSections);
  };

  const handleTemplateUpload = async (event, sectionIndex) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsParsing(true);
    try {
      let rawText = "";
      if (file.name.endsWith(".txt")) {
        rawText = await file.text();
      } else if (file.name.endsWith(".docx")) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        rawText = result.value;
      } else {
        throw new Error("Unsupported file format. Please upload a .docx or .txt file.");
      }
      
      const lines = rawText.split("\n").map(line => line.trim()).filter(Boolean);
      const parsedQuestions = [];
      let currentQuestion = null;
      let currentPassage = "";
      let isReadingPassage = false;

      for (let line of lines) {
        if (line === "[PASSAGE]") {
          isReadingPassage = true;
          currentPassage = "";
          continue;
        }
        if (line === "[END_PASSAGE]") {
          isReadingPassage = false;
          continue;
        }
        if (isReadingPassage) {
          currentPassage += (currentPassage ? "\n" : "") + line;
          continue;
        }

        if (line.startsWith("[Q]")) {
          if (currentQuestion) parsedQuestions.push(currentQuestion);
          currentQuestion = {
            id: Date.now().toString() + Math.random(),
            text: line.replace("[Q]", "").trim(),
            passage: currentPassage, 
            type: "mcq",
            options: ["", "", "", ""],
            correct: 0
          };
          if (!isReadingPassage) currentPassage = "";
          continue;
        }

        if (currentQuestion) {
          if (line.startsWith("[TYPE]")) {
            const typeVal = line.replace("[TYPE]", "").trim().toLowerCase();
            currentQuestion.type = typeVal === "tita" ? "tita" : "mcq";
            if (currentQuestion.type === "tita") {
              currentQuestion.correct = "";
              currentQuestion.options = [];
            }
          }
          else if (line.startsWith("[A]")) currentQuestion.options[0] = line.replace("[A]", "").trim();
          else if (line.startsWith("[B]")) currentQuestion.options[1] = line.replace("[B]", "").trim();
          else if (line.startsWith("[C]")) currentQuestion.options[2] = line.replace("[C]", "").trim();
          else if (line.startsWith("[D]")) currentQuestion.options[3] = line.replace("[D]", "").trim();
          else if (line.startsWith("[ANS]")) {
            const ansVal = line.replace("[ANS]", "").trim();
            if (currentQuestion.type === "mcq") {
              const charCode = ansVal.toUpperCase().charCodeAt(0);
              currentQuestion.correct = isNaN(ansVal) ? (charCode - 65) : (parseInt(ansVal, 10) - 1);
            } else {
              currentQuestion.correct = ansVal;
            }
          }
        }
      }

      if (currentQuestion) parsedQuestions.push(currentQuestion);
      if (parsedQuestions.length === 0) throw new Error("No valid tags found.");

      const newSections = [...sections];
      newSections[sectionIndex].questions.push(...parsedQuestions);
      setSections(newSections);
      alert(`🎉 Success! Loaded ${parsedQuestions.length} template questions.`);
    } catch (err) {
      alert("Parsing Failed: " + err.message);
    } finally {
      setIsParsing(false);
      event.target.value = ""; 
    }
  };

  const updateQuestion = (sIdx, qIdx, field, value) => {
    const newSections = [...sections];
    newSections[sIdx].questions[qIdx][field] = value;
    if (field === 'type' && value === 'tita') {
      newSections[sIdx].questions[qIdx].correct = "";
      newSections[sIdx].questions[qIdx].options = [];
    } else if (field === 'type' && value === 'mcq') {
      newSections[sIdx].questions[qIdx].correct = 0;
      newSections[sIdx].questions[qIdx].options = ["", "", "", ""];
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
      markingScheme: { correct: Number(markCorrect), incorrect: Number(markIncorrect) },
      teacherId,
      createdBy: teacherName,
      sections,
    };
    onSave(newTest);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body, paddingBottom: 60 }}>
      
      <style>{`
        .form-settings-grid-1 { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 16px; }
        .form-settings-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .form-action-tray { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
        
        @media (max-width: 600px) {
          .form-settings-grid-1, .form-settings-grid-2, .form-options-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .form-action-tray button, .form-action-tray div { flex: 1 1 100% !important; text-align: center; justify-content: center; width: 100%; }
          .form-action-tray div button { width: 100% !important; justify-content: center; }
        }
      `}</style>

      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", height: 60, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>← Back</button>
        <div style={{ width: 1, height: 24, background: C.border, margin: "0 16px" }} />
        <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 15, color: C.textPrimary }}>New Test Engine</span>
        <div style={{ flex: 1 }} />
        <Btn onClick={handleSave} style={{ padding: "6px 12px", fontSize: 13 }}>Save Test</Btn>
      </div>

      <div style={{ maxWidth: 800, margin: "24px auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 24 }}>
        
        <Card style={{ padding: 20 }}>
          <h2 style={{ fontFamily: font.heading, fontSize: 16, color: C.textPrimary, margin: "0 0 16px" }}>Test Settings</h2>
          <div className="form-settings-grid-1">
            <Input label="Test Title" value={title} onChange={setTitle} placeholder="e.g. CAT Mock 1" />
            <Input label="Duration (mins)" type="number" value={duration} onChange={setDuration} />
          </div>
          <div className="form-settings-grid-2">
            <Input label="Correct (+)" type="number" value={markCorrect} onChange={setMarkCorrect} />
            <Input label="Incorrect (-)" type="number" value={markIncorrect} onChange={setMarkIncorrect} />
          </div>
        </Card>

        {sections.map((section, sIdx) => (
          <div key={section.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input 
              value={section.name} 
              onChange={(val) => {
                const ns = [...sections]; ns[sIdx].name = val; setSections(ns);
              }} 
              style={{ fontSize: 18, fontWeight: 700, background: "transparent", border: "none", borderBottom: `2px solid ${C.border}`, borderRadius: 0, padding: "4px 0", color: C.textPrimary }}
            />

            {section.questions.map((q, qIdx) => (
              <Card key={q.id} style={{ borderLeft: `4px solid ${C.accent}`, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: C.textSecondary, fontSize: 13 }}>Question {qIdx + 1}</div>
                  <button onClick={() => handleRemoveQuestion(sIdx, qIdx)} style={{ background: "none", border: "none", color: C.redText, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Remove</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Input label="Question Text" value={q.text} onChange={(val) => updateQuestion(sIdx, qIdx, "text", val)} />
                  <textarea 
                    value={q.passage} onChange={(e) => updateQuestion(sIdx, qIdx, "passage", e.target.value)}
                    placeholder="Reference Passage (Optional)..."
                    style={{ width: "100%", minHeight: 80, padding: 12, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary, fontSize: 14 }}
                  />

                  <div style={{ padding: 14, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <select value={q.type} onChange={(e) => updateQuestion(sIdx, qIdx, "type", e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, background: C.surface, color: C.textPrimary, border: `1px solid ${C.border}`, marginBottom: 14 }}>
                      <option value="mcq">Multiple Choice (MCQ)</option>
                      <option value="tita">Type in the Answer (TITA)</option>
                    </select>

                    {q.type === 'mcq' ? (
                      <>
                        <div className="form-options-grid">
                          {q.options?.map((opt, optIdx) => (
                            <Input key={optIdx} label={`Option ${String.fromCharCode(65 + optIdx)}`} value={opt} onChange={(val) => updateOption(sIdx, qIdx, optIdx, val)} />
                          ))}
                        </div>
                        <select value={q.correct} onChange={(e) => updateQuestion(sIdx, qIdx, "correct", Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, background: C.surface, color: C.textPrimary, border: `1px solid ${C.border}` }}>
                          {q.options?.map((_, idx) => <option key={idx} value={idx}>Option {String.fromCharCode(65 + idx)}</option>)}
                        </select>
                      </>
                    ) : (
                      <Input label="Correct Value String" value={q.correct} onChange={(val) => updateQuestion(sIdx, qIdx, "correct", val)} placeholder="e.g. 42" />
                    )}
                  </div>
                </div>
              </Card>
            ))}

            <div className="form-action-tray">
              <Btn variant="ghost" onClick={() => handleAddQuestion(sIdx)} style={{ border: `1px dashed ${C.border}` }}>+ Add Question</Btn>
              <div style={{ position: "relative", overflow: "hidden", display: "inline-block" }}>
                <Btn variant="primary" disabled={isParsing} style={{ background: C.green, color: "#fff" }}>{isParsing ? "Parsing..." : "📄 Upload Template"}</Btn>
                <input type="file" accept=".docx,.txt" onChange={(e) => handleTemplateUpload(e, sIdx)} disabled={isParsing} style={{ position: "absolute", top: 0, left: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }} />
              </div>
            </div>

          </div>
        ))}

        <Btn variant="primary" onClick={handleAddSection} style={{ alignSelf: "center", padding: "10px 20px" }}>+ Add Section</Btn>
      </div>
    </div>
  );
}