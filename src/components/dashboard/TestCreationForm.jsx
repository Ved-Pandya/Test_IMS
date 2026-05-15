import { useState } from "react";
import { Badge, Btn, Card, Divider, Input, C, font } from "../ui/Primitives";

export default function TestCreationForm({ teacherId, teacherName, onBack, onSave }) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("20");
  const [sections, setSections] = useState([{ id: "s1", name: "Section 1", questions: [] }]);
  const [activeSection, setActiveSection] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const newQuestion = () => ({
    id: `q${Date.now()}`,
    type: "mcq",
    passage: "",
    text: "",
    imageUrl: null,
    imageFile: null,
    options: ["", "", "", ""],
    correct: 0,
  });

  const addSection = () => {
    setSections((previous) => [...previous, { id: `s${Date.now()}`, name: `Section ${sections.length + 1}`, questions: [] }]);
    setActiveSection(sections.length);
  };

  const addQuestion = () => {
    setSections((previous) =>
      previous.map((section, index) =>
        index !== activeSection
          ? section
          : { ...section, questions: [...section.questions, newQuestion()] }
      )
    );
  };

  const updateQuestion = (questionIndex, field, value) => {
    setSections((previous) =>
      previous.map((section, sectionIndex) =>
        sectionIndex !== activeSection
          ? section
          : {
              ...section,
              questions: section.questions.map((question, index) =>
                index !== questionIndex ? question : { ...question, [field]: value }
              ),
            }
      )
    );
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    setSections((previous) =>
      previous.map((section, sectionIndex) =>
        sectionIndex !== activeSection
          ? section
          : {
              ...section,
              questions: section.questions.map((question, index) =>
                index !== questionIndex
                  ? question
                  : {
                      ...question,
                      options: question.options.map((option, idx) =>
                        idx !== optionIndex ? option : value
                      ),
                    }
              ),
            }
      )
    );
  };

  const removeQuestion = (questionIndex) => {
    setSections((previous) =>
      previous.map((section, sectionIndex) =>
        sectionIndex !== activeSection
          ? section
          : {
              ...section,
              questions: section.questions.filter((_, index) => index !== questionIndex),
            }
      )
    );
  };

  const handleImageUpload = (questionIndex, file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSections((previous) =>
      previous.map((section, sectionIndex) =>
        sectionIndex !== activeSection
          ? section
          : {
              ...section,
              questions: section.questions.map((question, index) =>
                index !== questionIndex ? question : { ...question, imageUrl: url, imageFile: file }
              ),
            }
      )
    );
  };

  const validate = () => {
    const validationErrors = {};
    if (!title.trim()) validationErrors.title = "Test title is required";
    if (!duration || isNaN(duration) || Number(duration) < 1) validationErrors.duration = "Enter a valid duration";

    sections.forEach((section, sectionIndex) => {
      if (!section.name.trim()) validationErrors[`section_${sectionIndex}`] = "Section name required";
      section.questions.forEach((question, questionIndex) => {
        if (!question.text.trim()) validationErrors[`question_${sectionIndex}_${questionIndex}`] = "Question text required";
        question.options.forEach((option, optionIndex) => {
          if (!option.trim()) validationErrors[`option_${sectionIndex}_${questionIndex}_${optionIndex}`] = "Option required";
        });
      });
    });

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    const sectionsPayload = sections.map((section) => ({
      id: section.id,
      name: section.name,
      questions: section.questions.map((question) => ({
        id: question.id,
        type: question.type,
        passage: question.passage,
        text: question.text,
        imageUrl: null,
        options: question.options,
        correct: question.correct,
      })),
    }));

    const payload = {
      title,
      duration: Number(duration),
      sections: sectionsPayload,
      teacherId,
      createdBy: teacherName,
    };

    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);
  const currentSection = sections[activeSection];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 60, gap: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: font.body }}>
          ← Cancel
        </button>
        <div style={{ width: 1, height: 24, background: C.border }} />
        <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: C.textPrimary }}>{title || "New Test"}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: C.textMuted }}>{totalQuestions} question{totalQuestions !== 1 ? "s" : ""} · {sections.length} section{sections.length !== 1 ? "s" : ""}</span>
        <Btn onClick={handleSave} disabled={saving} style={{ marginLeft: 10 }}>{saving ? "Saving…" : "Save Test ✓"}</Btn>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 18 }}>Test Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 16 }}>
            <Input label="Test Title" value={title} onChange={setTitle} placeholder="CAT Mock — Quantitative Aptitude" error={errors.title} />
            <Input label="Duration (minutes)" type="number" value={duration} onChange={setDuration} placeholder="20" error={errors.duration} />
          </div>
        </Card>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {sections.map((section, index) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(index)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${activeSection === index ? C.accent : C.border}`,
                background: activeSection === index ? C.accentDim : C.surface,
                color: activeSection === index ? C.accentText : C.textMuted,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: font.body,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {section.name}
              <span style={{ fontSize: 11, opacity: 0.7 }}>({section.questions.length})</span>
            </button>
          ))}
          <Btn variant="ghost" onClick={addSection} style={{ fontSize: 13, padding: "8px 14px" }}>+ Add Section</Btn>
        </div>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <input
              value={currentSection.name}
              onChange={(event) => setSections((previous) =>
                previous.map((section, index) =>
                  index !== activeSection ? section : { ...section, name: event.target.value }
                )
              )}
              placeholder="Section Name"
              style={{
                fontSize: 16,
                fontWeight: 700,
                fontFamily: font.heading,
                color: C.textPrimary,
                background: "transparent",
                border: "none",
                outline: "none",
                flex: 1,
              }}
            />
            {errors[`section_${activeSection}`] && <span style={{ fontSize: 12, color: C.red }}>{errors[`section_${activeSection}`]}</span>}
          </div>
          <Divider />

          {currentSection.questions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.textMuted }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📝</div>
              <div style={{ fontSize: 14 }}>No questions yet. Add your first question below.</div>
            </div>
          ) : (
            currentSection.questions.map((question, questionIndex) => (
              <div key={question.id} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: questionIndex < currentSection.questions.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentDim, color: C.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                    Q{questionIndex + 1}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.textSecondary }}>Multiple Choice</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => removeQuestion(questionIndex)} style={{ background: C.redDim, border: "none", color: C.redText, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font.body }}>
                    Remove
                  </button>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Reading Passage (optional — for RC questions)</label>
                  <textarea
                    value={question.passage}
                    onChange={(event) => updateQuestion(questionIndex, "passage", event.target.value)}
                    placeholder="Paste the passage text here…"
                    rows={3}
                    style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.textPrimary, fontSize: 13, fontFamily: font.body, resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Question Text *</label>
                  <textarea
                    value={question.text}
                    onChange={(event) => updateQuestion(questionIndex, "text", event.target.value)}
                    placeholder="Type the question here…"
                    rows={2}
                    style={{ width: "100%", background: C.bg, border: `1px solid ${errors[`question_${activeSection}_${questionIndex}`] ? C.red : C.border}`, borderRadius: 8, padding: "10px 14px", color: C.textPrimary, fontSize: 14, fontFamily: font.body, resize: "vertical", boxSizing: "border-box" }}
                  />
                  {errors[`question_${activeSection}_${questionIndex}`] && <span style={{ fontSize: 12, color: C.red }}>Required</span>}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Figure / Image (optional)</label>
                  {question.imageUrl ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <img src={question.imageUrl} alt="Question figure" style={{ height: 80, borderRadius: 8, border: `1px solid ${C.border}` }} />
                      <button onClick={() => updateQuestion(questionIndex, "imageUrl", null)} style={{ background: C.redDim, border: "none", color: C.redText, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: font.body }}>
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 8, border: `1px dashed ${C.borderLight}`, color: C.textMuted, cursor: "pointer", fontSize: 13, fontFamily: font.body }}>
                      📎 Upload Image
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => handleImageUpload(questionIndex, event.target.files?.[0])} />
                    </label>
                  )}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Answer Options * (click radio to mark correct)</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          onClick={() => updateQuestion(questionIndex, "correct", optionIndex)}
                          type="button"
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            border: `2px solid ${question.correct === optionIndex ? C.green : C.border}`,
                            background: question.correct === optionIndex ? C.green : "transparent",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                          title="Mark as correct answer"
                        />
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, width: 18 }}>{String.fromCharCode(65 + optionIndex)}</span>
                        <input
                          value={option}
                          onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                          style={{
                            flex: 1,
                            background: question.correct === optionIndex ? C.greenDim : C.bg,
                            border: `1px solid ${errors[`option_${activeSection}_${questionIndex}_${optionIndex}`] ? C.red : question.correct === optionIndex ? C.green : C.border}`,
                            borderRadius: 7,
                            padding: "9px 12px",
                            color: question.correct === optionIndex ? C.greenText : C.textPrimary,
                            fontSize: 14,
                            fontFamily: font.body,
                            outline: "none",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}

          <Btn variant="ghost" onClick={addQuestion} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
            + Add Question
          </Btn>
        </Card>
      </div>
    </div>
  );
}
