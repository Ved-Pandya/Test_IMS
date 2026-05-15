import React from "react";

export const C = {
  bg: "#0f1117",
  surface: "#181c27",
  surfaceHover: "#1e2436",
  border: "#252d42",
  borderLight: "#2e3a54",
  accent: "#4f8ef7",
  accentDim: "#1a2d54",
  accentText: "#a8c4ff",
  green: "#22c984",
  greenDim: "#0d2e20",
  greenText: "#6ee7b7",
  amber: "#f5a623",
  amberDim: "#2d1f05",
  amberText: "#fcd385",
  red: "#f05252",
  redDim: "#2d0f0f",
  redText: "#fca5a5",
  textPrimary: "#eef1f8",
  textSecondary: "#8892a8",
  textMuted: "#4e5a72",
};

export const font = {
  heading: "'Sora', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "monospace",
};

export const injectFonts = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById("ep-fonts")) return;

  const link = document.createElement("link");
  link.id = "ep-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap";
  document.head.appendChild(link);
};

export const Badge = ({ children, color = "accent" }) => {
  const map = {
    accent: [C.accentDim, C.accentText],
    green: [C.greenDim, C.greenText],
    amber: [C.amberDim, C.amberText],
    red: [C.redDim, C.redText],
  };
  const [bg, text] = map[color] || map.accent;

  return (
    <span
      style={{
        background: bg,
        color: text,
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 20,
        fontFamily: font.body,
        letterSpacing: 0.3,
      }}
    >
      {children}
    </span>
  );
};

export const Btn = ({ children, onClick, variant = "primary", disabled, style = {} }) => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 20px",
    borderRadius: 9,
    fontWeight: 600,
    fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "none",
    fontFamily: font.body,
    transition: "all 0.15s",
    opacity: disabled ? 0.45 : 1,
    ...style,
  };

  const variants = {
    primary: { background: C.accent, color: "#fff" },
    ghost: { background: "transparent", color: C.textSecondary, border: `1px solid ${C.border}` },
    danger: { background: C.redDim, color: C.redText, border: `1px solid ${C.red}44` },
    success: { background: C.greenDim, color: C.greenText, border: `1px solid ${C.green}44` },
  };

  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  );
};

export const Input = ({ label, value, onChange, type = "text", placeholder, error, style = {} }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && (
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: C.textSecondary,
          fontFamily: font.body,
          letterSpacing: 0.4,
        }}
      >
        {label}
      </label>
    )}
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      style={{
        background: C.surface,
        border: `1px solid ${error ? C.red : C.border}`,
        borderRadius: 8,
        padding: "10px 14px",
        color: C.textPrimary,
        fontSize: 14,
        fontFamily: font.body,
        outline: "none",
        ...style,
      }}
    />
    {error && <span style={{ fontSize: 12, color: C.red }}>{error}</span>}
  </div>
);

export const Card = ({ children, style = {} }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "24px 28px", ...style }}>{children}</div>
);

export const Divider = () => <div style={{ height: 1, background: C.border, margin: "20px 0" }} />;
