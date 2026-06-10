import { useState } from "react";
import { Badge, Btn, Card, C, font } from "../ui/Primitives";
import AttemptReview from "./AttemptReview"; // 1. Import the existing review component

export default function TeacherTestDetail({ test, attempts, onBack, onDemo, onResetAttempt }) {
  // 2. Add state to track which attempt is currently being reviewed
  const [viewingAttempt, setViewingAttempt] = useState(null);

  // Compute analytics data points
  const totalEnrolled = test.enrolledStudents?.length || 0;
  const totalAttempts = attempts.length;
  const avgScore = totalAttempts > 0 
    ? Math.round(attempts.reduce((acc, c) => acc + c.score, 0) / totalAttempts) 
    : 0;

  // 3. If the teacher is viewing a specific attempt, render the AttemptReview component
  if (viewingAttempt) {
    return (
      <AttemptReview 
        attempt={viewingAttempt} 
        test={test} 
        onBack={() => setViewingAttempt(null)} // Close the review to go back to the table
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font.body, paddingBottom: 40 }}>
      
      <style>{`
        .detail-header-tray {
          background: ${C.surface}; border-bottom: 1px solid ${C.border};
          padding: 0 32px; display: flex; align-items: center; height: 60px;
          position: sticky; top: 0; z-index: 10;
        }
        .analytics-summary-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px;
        }
        .responsive-table-wrapper {
          width: 100%; overflow-x: auto; background: ${C.surface};
          border: 1px solid ${C.border}; border-radius: 12px;
        }
        .proctor-table {
          width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; min-width: 750px;
        }
        .proctor-table th, .proctor-table td {
          padding: 14px 18px; border-bottom: 1px solid ${C.border}; color: ${C.textPrimary};
          vertical-align: middle;
        }
        .proctor-table th {
          background: ${C.bg}; color: ${C.textMuted}; font-weight: 600; font-size: 12px; text-transform: uppercase;
        }

        @media (max-width: 680px) {
          .detail-header-tray { padding: 0 16px !important; }
          .analytics-summary-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .detail-header-title { display: none !important; }
        }
      `}</style>

      {/* Header Context Actions panel Container */}
      <div className="detail-header-tray">
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>← Back</button>
        <div style={{ width: 1, height: 24, background: C.border, margin: "0 16px" }} />
        <span className="detail-header-title" style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: C.textPrimary, marginRight: 12 }}>{test.title}</span>
        <Badge color={test.isActive ? "green" : "gray"}>{test.isActive ? "Live" : "Draft"}</Badge>
        
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onDemo} style={{ fontSize: 13, padding: "6px 14px" }}>👁 View as Student</Btn>
      </div>

      <div style={{ maxWidth: 960, margin: "32px auto", padding: "0 16px" }}>
        
        {/* Macro KPI Cards Grid block */}
        <div className="analytics-summary-grid">
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Total Enrolled</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.textPrimary }}>{totalEnrolled} <span style={{ fontSize: 14, fontWeight: 400, color: C.textMuted }}>Candidates</span></div>
          </Card>
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Papers Attempted</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.greenText }}>{totalAttempts} <span style={{ fontSize: 14, fontWeight: 400, color: C.textMuted }}>Submissions</span></div>
          </Card>
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Average Metric Score</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.accentText }}>{avgScore} <span style={{ fontSize: 14, fontWeight: 400, color: C.textMuted }}>Points</span></div>
          </Card>
        </div>

        {/* Student Submission Data Management Grid */}
        <h3 style={{ fontFamily: font.heading, fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 16 }}>Candidate Roster Results</h3>
        
        <div className="responsive-table-wrapper">
          <table className="proctor-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Score Value</th>
                <th>Submission Route</th>
                <th>Security Infractions Log</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", color: C.textMuted, padding: 32 }}>No candidate submission logs recorded for this test configuration item.</td>
                </tr>
              ) : (
                attempts.map((att) => (
                  <tr key={att.id}>
                    <td style={{ fontWeight: 600 }}>{att.studentName}</td>
                    <td>
                      <span style={{ color: att.score >= (att.total / 2) ? C.greenText : C.redText, fontWeight: 700 }}>{att.score}</span>
                      <span style={{ color: C.textMuted, fontSize: 12 }}> / {att.total}</span>
                    </td>
                    <td>
                      <Badge color={att.reason?.includes("Auto") ? "red" : "gray"}>{att.reason || "Manual Run"}</Badge>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: "260px" }}>
                      {att.violations && att.violations.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {att.violations.map((v, i) => (
                            <span key={i} style={{ color: C.redText, background: "rgba(239, 68, 68, 0.08)", padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>⚠️ {v}</span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: C.textMuted }}>None (Flawless Integrity)</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {/* 4. Added "View Details" button alongside Reset Attempt */}
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <Btn 
                          variant="ghost" 
                          onClick={() => setViewingAttempt(att)}
                          style={{ 
                            padding: "6px 12px", 
                            fontSize: 12, 
                            border: `1px solid ${C.border}`
                          }}
                        >
                          👁️ View Details
                        </Btn>
                        <Btn 
                          variant="ghost" 
                          onClick={() => onResetAttempt(att.id, att.studentName)}
                          style={{ 
                            padding: "6px 12px", 
                            fontSize: 12, 
                            color: C.redText || "#ef4444", 
                            background: "rgba(239, 68, 68, 0.05)",
                            border: "1px solid rgba(239, 68, 68, 0.15)"
                          }}
                        >
                          🔄 Reset
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}