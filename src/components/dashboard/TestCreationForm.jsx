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

  // --- SMART TEXT & DOCX TEMPLATE ENGINE WITH LIVE PASSAGE RESET ---
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
        // Track Passage Declarations
        if (line === "[PASSAGE]") {
          isReadingPassage = true;
          currentPassage = "";
          continue;
        }
        if (line === "[END_PASSAGE]") {
          isReadingPassage = false;
          // Note: We leave currentPassage populated here temporarily so that if a question 
          // immediately follows, it grabs it. We handle structural cleanup down below.
          continue;
        }
        if (isReadingPassage) {
          currentPassage += (currentPassage ? "\n" : "") + line;
          continue;
        }

        // Catch Question Foundations
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

          // FIX: If we aren't actively inside a passage block, clear out the text memory 
          // right after assigning it to this question. This prevents it bleeding into the next standalone item.
          if (!isReadingPassage) {
            currentPassage = "";
          }
          continue;
        }

        // Process Configuration Attributes
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

      if (parsedQuestions.length === 0) {
        throw new Error("No valid tags found. Check if file matches the requested template rules.");
      }

      const newSections = [...sections];
      newSections[sectionIndex].questions.push(...parsedQuestions);
      setSections(newSections);
      
      alert(`🎉 Success! Instantly compiled and loaded ${parsedQuestions.length} template questions.`);
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
      {/* Sticky Action Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>← Back</button>
        <div style={{ width: 1, height: 24, background: C.border, margin: "0 16px" }} />
        <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: C.textPrimary }}>Create New Test</span>
        <div style={{ flex: 1 }} />
        <Btn onClick={handleSave}>Save & Create Test</Btn>
      </div>

      <div style={{ maxWidth: 800, margin: "32px auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 32 }}>
        
        {/* Parametric Metadata Block */}
        <Card>
          <h2 style={{ fontFamily: font.heading, fontSize: 18, color: C.textPrimary, margin: "0 0 20px" }}>Test Settings</h2>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
            <Input label="Test Title" value={title} onChange={setTitle} placeholder="e.g. CAT Full Length Mock 3" />
            <Input label="Duration (minutes)" type="number" value={duration} onChange={setDuration} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input label="Marks for Correct Answer (+)" type="number" value={markCorrect} onChange={setMarkCorrect} />
            <Input label="Marks for Incorrect Answer (-)" type="number" value={markIncorrect} onChange={setMarkIncorrect} />
          </div>
        </Card>

        {/* Sections Mapping Loop */}
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
                  <Input label="Question Text" value={q.text} onChange={(val) => updateQuestion(sIdx, qIdx, "text", val)} placeholder="Enter the question contents..." />
                  
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "block" }}>Passage / Reference Text (Optional)</label>
                    <textarea 
                      value={q.passage} 
                      onChange={(e) => updateQuestion(sIdx, qIdx, "passage", e.target.value)}
                      placeholder="Paste Reading Comprehension reference passage contextual blocks directly here..."
                      style={{ width: "100%", minHeight: 100, padding: 12, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary, fontFamily: font.body, fontSize: 14, resize: "vertical" }}
                    />
                  </div>

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
                          {q.options?.map((opt, optIdx) => (
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
                            {q.options?.map((_, idx) => (
                              <option key={idx} value={idx}>Option {String.fromCharCode(65 + idx)}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <div>
                        <Input 
                          label="Exact Evaluation Target String Value" 
                          value={q.correct} 
                          onChange={(val) => updateQuestion(sIdx, qIdx, "correct", val)} 
                          placeholder="e.g. 24 or India" 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {/* Action Controller Tray */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => handleAddQuestion(sIdx)} style={{ border: `1px dashed ${C.border}` }}>
                + Add Question Manually
              </Btn>
              
              <div style={{ position: "relative", overflow: "hidden", display: "inline-block" }}>
                <Btn variant="primary" disabled={isParsing} style={{ background: C.green, color: "#fff" }}>
                  {isParsing ? "Extracting..." : "📄 Upload Template (.docx / .txt)"}
                </Btn>
                <input 
                  type="file" 
                  accept=".docx,.txt"
                  onChange={(e) => handleTemplateUpload(e, sIdx)}
                  disabled={isParsing}
                  style={{ position: "absolute", top: 0, left: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
                />
              </div>

              <Btn 
                variant="ghost" 
                onClick={() => {
                  const templateText = 
`[PASSAGE]
In the heart of Western Europe, France has historically played a central role in global politics and culture. Its capital city is known worldwide for art, fashion, and gastronomy.
[END_PASSAGE]

[Q] What is the capital of France?
[TYPE] MCQ
[A] London
[B] Berlin
[C] Paris
[D] Madrid
[ANS] C

[Q] Find the value of x if 2x + 5 = 15.
[TYPE] TITA
[ANS] 5`;

                  const blob = new Blob([templateText], { type: "text/plain;charset=utf-8" });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = "ExamPortal_Template_Sample.txt";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                style={{ color: C.textSecondary, border: `1px solid ${C.border}` }}
              >
                📥 Download Sample Template (.txt)
              </Btn>
            </div>

          </div>
        ))}

        <Btn variant="primary" onClick={handleAddSection} style={{ alignSelf: "center", padding: "12px 24px" }}>
          + Add New Section
        </Btn>
      </div>
    </div>
  );
}