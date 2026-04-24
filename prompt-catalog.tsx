import { useState, useEffect, useRef } from "react";

const DEFAULT_PROMPTS = [
  {
    id: "replace-primereact",
    label: "Replace PrimeReact Imports",
    description: "Replace PrimeReact imports with wrapper components from shared-ui.",
    hasFields: true,
    builtin: true,
    promptTemplate: `I want to replace every PrimeReact {{PRIMEREACT_COMPONENT}} with our internal {{SHARED_UI_COMPONENT}} component.

## 1. Component Mapping

- Old: import { {{PRIMEREACT_COMPONENT}} } from '{{PRIMEREACT_IMPORT_FROM}}'
- New: import { {{SHARED_UI_COMPONENT}} } from '@ds-oc-fe/ui'

## 2. Scope

Targets:
{{TARGET_FOLDERS}}

Source (Reference only): shared-ui/ (Do NOT modify this folder).

## 3. Your Task (Planning Phase)

Please perform a deep analysis of the codebase and produce two things:

### A) Migration Plan (migration-plan-{{PRIMEREACT_COMPONENT}}.md)

Create this file in the root. It must include:
- A comparison of {{SHARED_UI_COMPONENT}} (in shared-ui) vs PrimeReact's {{PRIMEREACT_COMPONENT}}.
- A definitive mapping of prop changes (e.g., disabled -> isDisabled, invalid -> hasError, etc.).
- A list of all files in the target folders that currently use the old component.
- Identification of any "risky" usages (e.g., complex event handlers or props that don't exist in our internal version).

### B) Handover Prompt

Provide a final response in this chat containing a single, optimized prompt. This prompt will be used in a brand-new chat to execute the actual code changes. It should instruct the next Claude instance to read migration-plan-{{PRIMEREACT_COMPONENT}}.md and execute the refactor based on its findings.

## 4. Constraints

> IMPORTANT: Do NOT commit anything to Git. This will be done manually after the job is completed.

Please start by analyzing the component definitions and the target files.`,
    fields: [
      { key: "PRIMEREACT_COMPONENT", label: "PrimeReact Component", required: true, hint: "InputTextarea", type: "text" },
      { key: "SHARED_UI_COMPONENT", label: "Shared UI Component", required: true, hint: "TextArea", type: "text" },
      { key: "PRIMEREACT_IMPORT_FROM", label: "PrimeReact Import From", required: true, hint: "primereact/inputtextarea", type: "text" },
      { key: "TARGET_FOLDERS", label: "Target Folders", required: true, hint: "- apps/search-mfe/\n- apps/smartlit/\n- legacy/\n- shared-widgets/", type: "textarea" },
    ],
  },
  {
    id: "code-refactoring",
    label: "Code Refactoring",
    description: "Generates a prompt for refactoring a legacy component using the refactor-feature skill. Fill in the fields below to customize the prompt for your target component.",
    hasFields: true,
    builtin: true,
    promptTemplate: `Using the refactor-feature skill, please refactor this legacy component.
Additional context:
   • Folder/Component: {{FOLDERS}}
   • Target: Align with patterns in {{TARGET}}{{#NOTES}}
   • Notes: {{NOTES}}{{/NOTES}}{{#OUTPUT}}
   • Output: The refactored component should be in {{OUTPUT}}{{/OUTPUT}}`,
    fields: [
      { key: "FOLDERS", label: "Folders / Components", required: true, hint: "- legacy/alerts\n- shared-widgets/", type: "textarea" },
      { key: "TARGET", label: "Align with Target", required: true, hint: "shared-widgets/backend-administration", type: "text" },
      { key: "NOTES", label: "Notes", required: false, hint: "Part of the SmartLit refactor", type: "text" },
      { key: "OUTPUT", label: "Output Folder", required: false, hint: "shared-widgets/alerts", type: "text" },
    ],
  },
];

const VERSION = "1.0.2";

const MILESTONES = [
  { count: 1,  msg: "Welcome to the catalog! Your first prompt, copied with care. 🐾" },
  { count: 5,  msg: "Five prompts down. The cat is impressed. 😼" },
  { count: 10, msg: "Ten copies! You're basically a prompt wizard now. 🧙‍♂️🐱" },
  { count: 25, msg: "25 prompts! The cat demands a treat. 🐟" },
  { count: 50, msg: "50 prompts copied. Legendary status unlocked. 🏆🐱" },
];

function extractPlaceholders(template) {
  const keys = [], seen = new Set();
  const re = /{{[#/]?([A-Z0-9_]+)}}/g;
  let m;
  while ((m = re.exec(template)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); keys.push(m[1]); }
  }
  return keys;
}

function renderTemplate(template, fields) {
  let out = template.replace(/{{#([A-Z0-9_]+)}}([\s\S]*?){{\/\1}}/g, (_, key, inner) =>
    fields[key]?.trim() ? inner : "");
  out = out.replace(/{{([A-Z0-9_]+)}}/g, (_, key) => fields[key]?.trim() || `{{${key}}}`);
  return out;
}

const DARK = {
  page: "#06040f", card: "#110e1e", cardBorder: "#2e2a4a", divider: "#1e1a30",
  heading: "#f0eeff", subtext: "#8a87b0", sectionLabel: "#7c3aed",
  labelColor: "#b8b5e0", optionalColor: "#6b6890", badgeBg: "#1e1a3a",
  inputBg: "#13101f", inputBorder: "#2e2a4a", inputText: "#f0eeff",
  previewBg: "#0f0d1a", previewBorder: "#2e2a4a", previewText: "#ddd9ff",
  placeholderText: "#a78bfa", placeholderBg: "#1e1a3a",
  resetBorder: "#2e2a4a", resetText: "#9d9abf", resetBg: "transparent",
  hintText: "#4b4870", toggleBg: "#1e1a3a", toggleBorder: "#3d3a60", toggleText: "#9d9abf",
  dropdownBg: "#13101f", dropdownBorder: "#2e2a4a", dropdownText: "#f0eeff",
  descriptionBg: "#0f0d1a", descriptionBorder: "#2e2a4a", descriptionText: "#8a87b0",
  dangerText: "#f87171", dangerBorder: "#3b1f1f", dangerBg: "transparent",
  modalOverlay: "rgba(0,0,0,0.75)", modalBg: "#110e1e", modalBorder: "#2e2a4a",
  textareaBg: "#0f0d1a", fieldCardBg: "#0f0d1a", fieldCardBorder: "#2e2a4a",
  sectionDivider: "#1e1a30", successText: "#34d399",
};

const LIGHT = {
  page: "#f5f3ff", card: "#ffffff", cardBorder: "#ede9fe", divider: "#f3f4f6",
  heading: "#1e1b4b", subtext: "#6b7280", sectionLabel: "#6366f1",
  labelColor: "#4b5563", optionalColor: "#9ca3af", badgeBg: "#eef2ff",
  inputBg: "#ffffff", inputBorder: "#e5e7eb", inputText: "#111827",
  previewBg: "#faf5ff", previewBorder: "#ede9fe", previewText: "#1f2937",
  placeholderText: "#7c3aed", placeholderBg: "#ede9fe",
  resetBorder: "#e5e7eb", resetText: "#6b7280", resetBg: "white",
  hintText: "#9ca3af", toggleBg: "#ede9fe", toggleBorder: "#ddd6fe", toggleText: "#6366f1",
  dropdownBg: "#ffffff", dropdownBorder: "#e5e7eb", dropdownText: "#111827",
  descriptionBg: "#faf5ff", descriptionBorder: "#ede9fe", descriptionText: "#6b7280",
  dangerText: "#dc2626", dangerBorder: "#fecaca", dangerBg: "transparent",
  modalOverlay: "rgba(0,0,0,0.35)", modalBg: "#ffffff", modalBorder: "#ede9fe",
  textareaBg: "#faf5ff", fieldCardBg: "#faf5ff", fieldCardBorder: "#ede9fe",
  sectionDivider: "#f3f4f6", successText: "#16a34a",
};

function Copycat({ visible }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200, opacity: visible ? 1 : 0, transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.85)", transition: "opacity 0.35s ease, transform 0.35s ease", pointerEvents: "none" }}>
      <div style={{ fontSize: "2.4rem", lineHeight: 1, filter: "drop-shadow(0 2px 8px rgba(139,92,246,0.4))" }}>🐱</div>
      <div style={{ fontSize: "0.6rem", textAlign: "center", color: "#a78bfa", fontWeight: 700, letterSpacing: "0.05em", marginTop: 2 }}>copied!</div>
    </div>
  );
}

function MilestoneCelebration({ milestone }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!milestone) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, [milestone]);
  if (!milestone) return null;
  return (
    <div style={{ position: "fixed", bottom: 80, left: "50%", transform: `translateX(-50%) translateY(${visible ? "0" : "16px"})`, zIndex: 200, pointerEvents: "none", opacity: visible ? 1 : 0, transition: "opacity 0.4s ease, transform 0.4s ease" }}>
      <div style={{ background: "linear-gradient(135deg,#1e1a3a,#110e1e)", border: "1.5px solid #7c3aed", borderRadius: 14, padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 30px rgba(139,92,246,0.4)", whiteSpace: "nowrap" }}>
        <span style={{ fontSize: "1.6rem" }}>🐱</span>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#f0eeff", marginBottom: 1 }}>{milestone.count} {milestone.count === 1 ? "prompt" : "prompts"} copied!</div>
          <div style={{ fontSize: "0.7rem", color: "#b8b5e0" }}>{milestone.msg}</div>
        </div>
      </div>
    </div>
  );
}

function SearchableDropdown({ options, value, onChange, th }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const selected = options.find(o => o.id === value);
  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", marginBottom: "0.65rem" }}>
      <div onClick={() => { setOpen(o => !o); setQuery(""); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 9, border: `1.5px solid ${open ? "#7c3aed" : th.dropdownBorder}`, background: th.dropdownBg, color: th.dropdownText, padding: "10px 13px", fontSize: "0.9rem", cursor: "pointer", userSelect: "none", transition: "border-color 0.15s" }}>
        <span>{selected?.label || "Select…"}</span>
        <span style={{ fontSize: "0.6rem", color: th.optionalColor, marginLeft: 8 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, background: th.dropdownBg, border: `1.5px solid #7c3aed`, borderRadius: 9, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", overflow: "hidden" }}>
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${th.divider}` }}>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search prompts…"
              style={{ width: "100%", boxSizing: "border-box", borderRadius: 7, border: `1.5px solid ${th.inputBorder}`, background: th.inputBg, padding: "7px 10px", fontSize: "0.82rem", outline: "none", color: th.inputText, fontFamily: "inherit" }}
              onFocus={e => e.target.style.borderColor = "#7c3aed"} onBlur={e => e.target.style.borderColor = th.inputBorder} />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filtered.length === 0
              ? <div style={{ padding: "10px 13px", fontSize: "0.82rem", color: th.optionalColor }}>No prompts found</div>
              : filtered.map(o => (
                <div key={o.id} onClick={() => { onChange(o.id); setOpen(false); setQuery(""); }}
                  style={{ padding: "9px 13px", fontSize: "0.88rem", cursor: "pointer", color: o.id === value ? th.placeholderText : th.dropdownText, background: o.id === value ? th.placeholderBg : "transparent", fontWeight: o.id === value ? 600 : 400, transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = th.badgeBg}
                  onMouseLeave={e => e.currentTarget.style.background = o.id === value ? th.placeholderBg : "transparent"}>
                  {o.label}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function inputBase(th) {
  return { width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.inputBg, padding: "8px 11px", fontSize: "0.82rem", outline: "none", color: th.inputText, fontFamily: "inherit", transition: "border-color 0.15s" };
}

function PromptPreview({ template, fields, th }) {
  const rendered = renderTemplate(template, fields);
  const parts = rendered.split(/({{[^}]+}})/g);
  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${th.previewBorder}`, background: th.previewBg, padding: "12px 14px", fontSize: "0.78rem", fontFamily: "'Fira Mono','Courier New',monospace", lineHeight: 1.8, color: th.previewText, whiteSpace: "pre-wrap", minHeight: 80, overflow: "auto" }}>
      {parts.map((part, i) =>
        /^{{.+}}$/.test(part)
          ? <span key={i} style={{ color: th.placeholderText, background: th.placeholderBg, borderRadius: 4, padding: "1px 4px", fontWeight: 700 }}>{part}</span>
          : <span key={i}>{part}</span>
      )}
    </div>
  );
}

function Field({ fieldDef, value, onChange, th }) {
  const { label, required, hint, type } = fieldDef;
  const isTextarea = type === "textarea";
  const hasValue = (value || "").trim();
  const focus = e => e.target.style.borderColor = "#7c3aed";
  const blur = e => e.target.style.borderColor = th.inputBorder;
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem", fontWeight: 700, color: th.labelColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label}
          {required
            ? <span style={{ color: "#818cf8", background: th.badgeBg, borderRadius: 4, padding: "1px 6px", fontSize: "0.62rem" }}>REQUIRED</span>
            : <span style={{ color: th.optionalColor, fontWeight: 400, textTransform: "none", fontSize: "0.72rem", letterSpacing: 0 }}>optional</span>}
        </label>
        {hint && (
          <button onClick={() => onChange(hasValue ? "" : hint)}
            style={{ fontSize: "0.68rem", fontWeight: 600, color: hasValue ? th.dangerText : th.placeholderText, background: "none", border: "none", cursor: "pointer", padding: 0, opacity: 0.7 }}>
            {hasValue ? "Clear" : "Use default"}
          </button>
        )}
      </div>
      {isTextarea
        ? <textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={hint} rows={3}
            style={{ ...inputBase(th), fontFamily: "'Fira Mono','Courier New',monospace", fontSize: "0.8rem", lineHeight: 1.7, resize: "vertical", background: th.textareaBg }}
            onFocus={focus} onBlur={blur} />
        : <input value={value || ""} onChange={e => onChange(e.target.value)} placeholder={hint}
            style={{ ...inputBase(th), padding: "9px 13px", fontSize: "0.875rem" }}
            onFocus={focus} onBlur={blur} />}
    </div>
  );
}

function FieldRow({ th, fieldDef, onChange }) {
  return (
    <div style={{ background: th.fieldCardBg, border: `1px solid ${th.fieldCardBorder}`, borderRadius: 10, padding: "0.9rem", marginBottom: "0.6rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.6rem" }}>
        <span style={{ fontFamily: "'Fira Mono',monospace", fontSize: "0.72rem", color: th.placeholderText, background: th.placeholderBg, borderRadius: 4, padding: "2px 7px", fontWeight: 700 }}>{`{{${fieldDef.key}}}`}</span>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: th.subtext, cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={fieldDef.type === "textarea"} onChange={e => onChange({ ...fieldDef, type: e.target.checked ? "textarea" : "text" })} style={{ accentColor: "#7c3aed", width: 13, height: 13 }} />
          Multi-line
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: th.subtext, cursor: "pointer", marginLeft: 4, userSelect: "none" }}>
          <input type="checkbox" checked={fieldDef.required} onChange={e => onChange({ ...fieldDef, required: e.target.checked })} style={{ accentColor: "#7c3aed", width: 13, height: 13 }} />
          Required
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[["Display Label", "label", fieldDef.key, false], ["Default / Placeholder", "hint", "e.g. legacy/alerts", true]].map(([lbl, prop, ph, canMultiline]) => (
          <div key={prop}>
            <label style={{ display: "block", fontSize: "0.67rem", fontWeight: 700, color: th.labelColor, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>{lbl}</label>
            {canMultiline && fieldDef.type === "textarea"
              ? <textarea value={fieldDef[prop]} onChange={e => onChange({ ...fieldDef, [prop]: e.target.value })} placeholder={ph} rows={3}
                  style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.textareaBg, padding: "8px 11px", fontSize: "0.82rem", outline: "none", color: th.inputText, fontFamily: "'Fira Mono','Courier New',monospace", lineHeight: 1.6, resize: "vertical" }}
                  onFocus={e => e.target.style.borderColor = "#7c3aed"} onBlur={e => e.target.style.borderColor = th.inputBorder} />
              : <input value={fieldDef[prop]} onChange={e => onChange({ ...fieldDef, [prop]: e.target.value })} placeholder={ph}
                  style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.inputBg, padding: "8px 11px", fontSize: "0.82rem", outline: "none", color: th.inputText, fontFamily: "inherit" }}
                  onFocus={e => e.target.style.borderColor = "#7c3aed"} onBlur={e => e.target.style.borderColor = th.inputBorder} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PromptModal({ th, onClose, onSave, editing }) {
  const [label, setLabel] = useState(editing?.label || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [template, setTemplate] = useState(editing?.promptTemplate || "");
  const [fieldDefs, setFieldDefs] = useState(() => (editing?.fields || []).map(f => ({ ...f })));

  useEffect(() => {
    const keys = extractPlaceholders(template);
    setFieldDefs(prev => {
      const prevMap = Object.fromEntries(prev.map(f => [f.key, f]));
      return keys.map(k => prevMap[k] || { key: k, label: k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), required: false, hint: "", type: "text" });
    });
  }, [template]);

  const hasFields = fieldDefs.length > 0;
  const valid = label.trim() && template.trim();

  return (
    <div style={{ position: "fixed", inset: 0, background: th.modalOverlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
      <div style={{ background: th.modalBg, border: `1px solid ${th.modalBorder}`, borderRadius: 16, width: "100%", maxWidth: 680, boxShadow: "0 8px 40px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.1rem 1.5rem", borderBottom: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: th.heading }}>{editing ? "Edit Prompt" : "New Prompt"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: th.subtext, fontSize: "1.3rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "1.25rem 1.5rem", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem", marginBottom: "1.1rem" }}>
            {[["Name", label, setLabel, "e.g. PR Review Helper", true], ["Description", description, setDescription, "What does this prompt do?", false]].map(([lbl, val, setter, ph, req]) => (
              <div key={lbl}>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.68rem", fontWeight: 700, color: th.labelColor, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 5 }}>
                  {lbl} {req && <span style={{ color: "#818cf8", background: th.badgeBg, borderRadius: 4, padding: "1px 5px", fontSize: "0.6rem" }}>REQUIRED</span>}
                </label>
                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph}
                  style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.inputBg, padding: "8px 11px", fontSize: "0.82rem", outline: "none", color: th.inputText, fontFamily: "inherit" }}
                  onFocus={e => e.target.style.borderColor = "#7c3aed"} onBlur={e => e.target.style.borderColor = th.inputBorder} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: "1.1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.68rem", fontWeight: 700, color: th.labelColor, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 5 }}>
              Prompt Template <span style={{ color: "#818cf8", background: th.badgeBg, borderRadius: 4, padding: "1px 5px", fontSize: "0.6rem" }}>REQUIRED</span>
            </label>
            <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={9}
              placeholder={"Write your prompt here.\n\nUse {{FIELD}} for dynamic fields.\nWrap optional sections with {{#FIELD}}...{{/FIELD}}."}
              style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.textareaBg, padding: "9px 13px", fontSize: "0.78rem", fontFamily: "'Fira Mono','Courier New',monospace", outline: "none", color: th.inputText, lineHeight: 1.7, resize: "vertical" }}
              onFocus={e => e.target.style.borderColor = "#7c3aed"} onBlur={e => e.target.style.borderColor = th.inputBorder} />
            <p style={{ margin: "5px 0 0", fontSize: "0.7rem", color: th.hintText }}>
              <span style={{ color: th.placeholderText, fontFamily: "monospace" }}>{"{{FIELD}}"}</span> for fields · <span style={{ color: th.placeholderText, fontFamily: "monospace" }}>{"{{#FIELD}}...{{/FIELD}}"}</span> for optional blocks
            </p>
          </div>
          {hasFields && (
            <div style={{ marginBottom: "1.1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem", paddingBottom: "0.6rem", borderBottom: `1px solid ${th.sectionDivider}` }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: th.sectionLabel, letterSpacing: "0.07em", textTransform: "uppercase" }}>Auto-detected Fields</span>
                <span style={{ fontSize: "0.68rem", color: th.subtext }}>{fieldDefs.length} placeholder{fieldDefs.length !== 1 ? "s" : ""} found</span>
              </div>
              {fieldDefs.map((f, i) => (
                <FieldRow key={f.key} th={th} fieldDef={f} onChange={updated => setFieldDefs(prev => prev.map((x, j) => j === i ? updated : x))} />
              ))}
            </div>
          )}
          {template.trim() && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem", paddingBottom: "0.6rem", borderBottom: `1px solid ${th.sectionDivider}` }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: th.sectionLabel, letterSpacing: "0.07em", textTransform: "uppercase" }}>Live Preview</span>
              </div>
              <PromptPreview template={template} fields={{}} th={th} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "1rem 1.5rem", borderTop: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ fontSize: "0.8rem", fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: `1.5px solid ${th.resetBorder}`, background: th.resetBg, color: th.resetText, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => valid && onSave({ label: label.trim(), description: description.trim(), promptTemplate: template, fields: fieldDefs, hasFields })} disabled={!valid}
            style={{ fontSize: "0.8rem", fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", background: valid ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#4b4870", color: "white", cursor: valid ? "pointer" : "not-allowed", boxShadow: valid ? "0 0 10px rgba(139,92,246,0.3)" : "none" }}>
            {editing ? "Save changes" : "Add prompt"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportModal({ th, json, onClose }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    const ta = document.getElementById("export-ta");
    ta.focus(); ta.select();
    document.execCommand("copy");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: th.modalOverlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
      <div style={{ background: th.modalBg, border: `1px solid ${th.modalBorder}`, borderRadius: 16, width: "100%", maxWidth: 680, boxShadow: "0 8px 40px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.1rem 1.5rem", borderBottom: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: th.heading }}>Export Prompts</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: th.subtext, fontSize: "1.3rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "1.25rem 1.5rem", flex: 1, overflowY: "auto" }}>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: th.descriptionText }}>Copy this JSON and share it with your admin to add it as a built-in prompt.</p>
          <textarea id="export-ta" readOnly value={json} rows={16} onFocus={e => e.target.select()}
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.textareaBg, padding: "10px 13px", fontSize: "0.75rem", fontFamily: "'Fira Mono','Courier New',monospace", color: th.previewText, lineHeight: 1.6, resize: "vertical", outline: "none" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "1rem 1.5rem", borderTop: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ fontSize: "0.8rem", fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: `1.5px solid ${th.resetBorder}`, background: th.resetBg, color: th.resetText, cursor: "pointer" }}>Close</button>
          <button onClick={doCopy}
            style={{ fontSize: "0.8rem", fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", background: copied ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", cursor: "pointer", boxShadow: copied ? "0 0 10px rgba(16,185,129,0.35)" : "0 0 10px rgba(139,92,246,0.3)", transition: "all 0.2s" }}>
            {copied ? "✓ Copied!" : "Copy to clipboard"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ th, onClose, onImport }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleImport = async () => {
    setError(""); setSuccess("");
    try {
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) { setError("Invalid format — expected a JSON array."); return; }
      const result = await onImport(imported);
      if (result.error) { setError(result.error); return; }
      setSuccess(result.success);
      setTimeout(() => onClose(), 1500);
    } catch (_) {
      setError("Failed to parse JSON. Please check the format.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: th.modalOverlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
      <div style={{ background: th.modalBg, border: `1px solid ${th.modalBorder}`, borderRadius: 16, width: "100%", maxWidth: 680, boxShadow: "0 8px 40px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.1rem 1.5rem", borderBottom: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: th.heading }}>Import Prompts</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: th.subtext, fontSize: "1.3rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "1.25rem 1.5rem", flex: 1, overflowY: "auto" }}>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: th.descriptionText }}>Paste the exported JSON from a teammate below and click Import.</p>
          <textarea value={text} onChange={e => { setText(e.target.value); setError(""); setSuccess(""); }} rows={16}
            placeholder="Paste JSON here…"
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1.5px solid ${error ? th.dangerText : th.inputBorder}`, background: th.textareaBg, padding: "10px 13px", fontSize: "0.75rem", fontFamily: "'Fira Mono','Courier New',monospace", color: th.previewText, lineHeight: 1.6, resize: "vertical", outline: "none" }}
            onFocus={e => e.target.style.borderColor = error ? th.dangerText : "#7c3aed"} onBlur={e => e.target.style.borderColor = error ? th.dangerText : th.inputBorder} />
          {error && <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: th.dangerText }}>{error}</p>}
          {success && <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: th.successText }}>{success}</p>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "1rem 1.5rem", borderTop: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ fontSize: "0.8rem", fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: `1.5px solid ${th.resetBorder}`, background: th.resetBg, color: th.resetText, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleImport} disabled={!text.trim()}
            style={{ fontSize: "0.8rem", fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", background: text.trim() ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#4b4870", color: "white", cursor: text.trim() ? "pointer" : "not-allowed", boxShadow: text.trim() ? "0 0 10px rgba(139,92,246,0.3)" : "none" }}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordModal({ th, onClose, onSuccess }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);
  const attempt = () => {
    if (pwd === ADMIN_PASSWORD) { onSuccess(); }
    else { setError(true); setPwd(""); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: th.modalOverlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
      <div style={{ background: th.modalBg, border: `1px solid ${th.modalBorder}`, borderRadius: 16, width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.35)", padding: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700, color: th.heading }}>Admin Access</h2>
        <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: th.descriptionText }}>Enter the admin password to unlock edit features.</p>
        <input autoFocus type="password" value={pwd}
          onChange={e => { setPwd(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && attempt()}
          placeholder="Password"
          style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1.5px solid ${error ? th.dangerText : th.inputBorder}`, background: th.inputBg, padding: "9px 13px", fontSize: "0.82rem", outline: "none", color: th.inputText, fontFamily: "inherit", marginBottom: "0.5rem" }} />
        {error && <p style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", color: th.dangerText }}>Incorrect password.</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: "1rem" }}>
          <button onClick={onClose} style={{ fontSize: "0.8rem", fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: `1.5px solid ${th.resetBorder}`, background: th.resetBg, color: th.resetText, cursor: "pointer" }}>Cancel</button>
          <button onClick={attempt} style={{ fontSize: "0.8rem", fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", cursor: "pointer", boxShadow: "0 0 10px rgba(139,92,246,0.3)" }}>Unlock</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(true);
  const [customPrompts, setCustomPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promptTypeId, setPromptTypeId] = useState("replace-primereact");
  const [fields, setFields] = useState({});
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [copycatVisible, setCopycatVisible] = useState(false);
  const [copyCount, setCopyCount] = useState(0);
  const [milestone, setMilestone] = useState(null);
  const [exportJson, setExportJson] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const th = dark ? DARK : LIGHT;
  const allPrompts = [...DEFAULT_PROMPTS, ...customPrompts];
  const promptType = allPrompts.find(p => p.id === promptTypeId) || allPrompts[0];

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "input::placeholder, textarea::placeholder { opacity: 0.35 !important; }";
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [promptsRes, publicRes, countRes] = await Promise.all([
          window.storage.get("custom-prompts", false).catch(() => null),
          window.storage.get("public-prompts", true).catch(() => null),
          window.storage.get("copy-count", false).catch(() => null),
        ]);
        const existing = promptsRes?.value ? JSON.parse(promptsRes.value) : [];
        const migrated = publicRes?.value ? JSON.parse(publicRes.value) : [];
        const existingIds = new Set(existing.map(p => p.id));
        const merged = [...existing, ...migrated.filter(p => !existingIds.has(p.id))];
        if (merged.length > 0) {
          setCustomPrompts(merged);
          await window.storage.set("custom-prompts", JSON.stringify(merged), false).catch(() => {});
          if (migrated.length > 0) await window.storage.delete("public-prompts", true).catch(() => {});
        }
        if (countRes?.value) setCopyCount(parseInt(countRes.value, 10) || 0);
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const saveCustomPrompts = async updated => {
    setCustomPrompts(updated);
    try { await window.storage.set("custom-prompts", JSON.stringify(updated), false); } catch (_) {}
  };

  const handleAddOrEdit = async ({ label, description, promptTemplate, fields: fieldDefs, hasFields }) => {
    if (editing) {
      const updated = customPrompts.map(p => p.id === editing.id ? { ...p, label, description, promptTemplate, fields: fieldDefs, hasFields } : p);
      await saveCustomPrompts(updated);
      setPromptTypeId(editing.id);
    } else {
      const id = "custom-" + Date.now();
      await saveCustomPrompts([...customPrompts, { id, label, description, promptTemplate, fields: fieldDefs, hasFields, builtin: false }]);
      setPromptTypeId(id);
    }
    setShowModal(false);
    setEditing(null);
    setFields({});
  };

  const handleDelete = async id => {
    await saveCustomPrompts(customPrompts.filter(p => p.id !== id));
    setPromptTypeId("replace-primereact");
    setConfirmDelete(null);
  };

  const handleExport = () => {
    if (customPrompts.length === 0) return;
    setExportJson(JSON.stringify(customPrompts, null, 2));
  };

  const handleImport = async imported => {
    const existingIds = new Set(customPrompts.map(p => p.id));
    const newOnes = imported.filter(p => p.id && p.label && p.promptTemplate && !existingIds.has(p.id));
    const dupes = imported.length - newOnes.length;
    if (newOnes.length === 0) return { error: dupes > 0 ? "All prompts already exist in the catalog." : "No valid prompts found." };
    const merged = [...customPrompts, ...newOnes];
    await saveCustomPrompts(merged);
    setPromptTypeId(newOnes[newOnes.length - 1].id);
    return { success: `Imported ${newOnes.length} prompt${newOnes.length !== 1 ? "s" : ""}${dupes > 0 ? ` (${dupes} duplicate${dupes !== 1 ? "s" : ""} skipped)` : ""}.` };
  };

  const copy = async () => {
    const text = renderTemplate(promptType.promptTemplate || "", fields);
    const succeed = async () => {
      setCopied(true); setCopycatVisible(true);
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setCopycatVisible(false), 2200);
      const newCount = copyCount + 1;
      setCopyCount(newCount);
      try { await window.storage.set("copy-count", String(newCount), false); } catch (_) {}
      const hit = MILESTONES.find(m => m.count === newCount);
      if (hit) setMilestone(hit);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(succeed).catch(() => fallbackCopy(text, succeed));
    } else { fallbackCopy(text, succeed); }
  };

  const fallbackCopy = (text, onSuccess) => {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand("copy"); onSuccess(); } catch (_) {}
    document.body.removeChild(ta);
  };

  const cardStyle = {
    background: th.card, borderRadius: 16, padding: "1.5rem",
    boxShadow: dark ? "0 4px 24px rgba(0,0,0,0.4)" : "0 2px 12px rgba(99,102,241,0.08)",
    marginBottom: "1.25rem", border: `1px solid ${th.cardBorder}`, transition: "background 0.2s",
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: DARK.page, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ fontSize: "0.8rem", color: "#8a87b0" }}>Loading the catalog…</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", minHeight: "100vh", background: th.page, display: "flex", justifyContent: "center", padding: "2.5rem 1rem", transition: "background 0.2s" }}>
      <div style={{ width: "100%", maxWidth: 640 }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", boxShadow: dark ? "0 0 16px rgba(139,92,246,0.4)" : "0 2px 8px rgba(99,102,241,0.25)" }}>✨</div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: th.heading, margin: 0 }}>FE Team Prompt Catalog</h1>
            <span style={{ fontSize: "0.65rem", fontWeight: 600, color: th.optionalColor, alignSelf: "flex-end", marginBottom: 2 }}>v{VERSION}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isAdmin ? (
              <>
                <button onClick={handleExport} disabled={customPrompts.length === 0}
                  style={{ fontSize: "0.75rem", fontWeight: 600, padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${th.toggleBorder}`, background: th.toggleBg, color: customPrompts.length === 0 ? th.optionalColor : th.toggleText, cursor: customPrompts.length === 0 ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: customPrompts.length === 0 ? 0.5 : 1 }}>
                  ⬆ Export
                </button>
                <button onClick={() => setShowImport(true)}
                  style={{ fontSize: "0.75rem", fontWeight: 600, padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${th.toggleBorder}`, background: th.toggleBg, color: th.toggleText, cursor: "pointer", whiteSpace: "nowrap" }}>
                  ⬇ Import
                </button>
                <button onClick={() => setIsAdmin(false)}
                  style={{ fontSize: "0.75rem", fontWeight: 600, padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${th.toggleBorder}`, background: th.toggleBg, color: th.toggleText, cursor: "pointer", whiteSpace: "nowrap" }}>
                  🔓 Logout
                </button>
              </>
            ) : (
              <button onClick={() => setShowPasswordModal(true)}
                style={{ fontSize: "0.75rem", fontWeight: 600, padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${th.toggleBorder}`, background: th.toggleBg, color: th.toggleText, cursor: "pointer", whiteSpace: "nowrap" }}>
                🔑 Admin
              </button>
            )}
            <button onClick={() => setDark(d => !d)}
              style={{ fontSize: "0.75rem", fontWeight: 600, padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${th.toggleBorder}`, background: th.toggleBg, color: th.toggleText, cursor: "pointer" }}>
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>

        {/* Prompt selector */}
        <div style={cardStyle}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: th.sectionLabel, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Prompt Type</label>
          <SearchableDropdown options={allPrompts} value={promptTypeId} onChange={id => { setPromptTypeId(id); setCopied(false); setFields({}); }} th={th} />
          {isAdmin && (
            <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
              <button onClick={() => { setEditing(promptType); setShowModal(true); }} disabled={promptType.builtin}
                style={{ fontSize: "0.78rem", fontWeight: 600, padding: "6px 13px", borderRadius: 8, border: `1.5px solid ${th.resetBorder}`, background: th.resetBg, color: promptType.builtin ? th.optionalColor : th.resetText, cursor: promptType.builtin ? "not-allowed" : "pointer", opacity: promptType.builtin ? 0.5 : 1 }}>✏️ Edit</button>
              <button onClick={() => setConfirmDelete(promptType.id)} disabled={promptType.builtin}
                style={{ fontSize: "0.78rem", fontWeight: 600, padding: "6px 13px", borderRadius: 8, border: `1.5px solid ${th.dangerBorder}`, background: th.dangerBg, color: promptType.builtin ? th.optionalColor : th.dangerText, cursor: promptType.builtin ? "not-allowed" : "pointer", opacity: promptType.builtin ? 0.5 : 1 }}>🗑️ Delete</button>
              {promptType.builtin && <span style={{ fontSize: "0.7rem", color: th.optionalColor, alignSelf: "center" }}>Built-in prompt</span>}
              <button onClick={() => { setEditing(null); setShowModal(true); }}
                style={{ fontSize: "0.8rem", fontWeight: 700, padding: "7px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 0 10px rgba(139,92,246,0.3)", marginLeft: "auto" }}>
                + New
              </button>
            </div>
          )}
          <div style={{ borderRadius: 9, border: `1px solid ${th.descriptionBorder}`, background: th.descriptionBg, padding: "10px 13px" }}>
            <p style={{ margin: 0, fontSize: "0.8rem", color: th.descriptionText, lineHeight: 1.6 }}>{promptType.description || "No description."}</p>
          </div>
          {isAdmin && confirmDelete === promptType.id && (
            <div style={{ marginTop: "0.75rem", borderRadius: 9, border: `1px solid ${th.dangerBorder}`, padding: "10px 13px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: "0.8rem", color: th.dangerText }}>Delete "{promptType.label}"?</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setConfirmDelete(null)} style={{ fontSize: "0.72rem", fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: `1px solid ${th.resetBorder}`, background: th.resetBg, color: th.resetText, cursor: "pointer" }}>Cancel</button>
                <button onClick={() => handleDelete(promptType.id)} style={{ fontSize: "0.72rem", fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: "none", background: "#dc2626", color: "white", cursor: "pointer" }}>Delete</button>
              </div>
            </div>
          )}
        </div>

        {/* Fields */}
        {promptType.hasFields && promptType.fields?.length > 0 && (
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: `1px solid ${th.divider}` }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: th.sectionLabel, letterSpacing: "0.07em", textTransform: "uppercase" }}>Fields</span>
              <button onClick={() => setFields({})} style={{ fontSize: "0.75rem", fontWeight: 600, padding: "5px 13px", borderRadius: 7, border: `1.5px solid ${th.resetBorder}`, background: th.resetBg, color: th.resetText, cursor: "pointer" }}>Reset</button>
            </div>
            {promptType.fields.map(f => (
              <Field key={f.key} fieldDef={f} value={fields[f.key] || ""} onChange={v => setFields(prev => ({ ...prev, [f.key]: v }))} th={th} />
            ))}
          </div>
        )}

        {/* Output */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "1rem", borderBottom: `1px solid ${th.divider}` }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: th.sectionLabel, letterSpacing: "0.07em", textTransform: "uppercase" }}>Generated Prompt</span>
            <button onClick={copy} style={{ fontSize: "0.75rem", fontWeight: 600, padding: "5px 13px", borderRadius: 7, border: "none", cursor: "pointer", background: copied ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", boxShadow: copied ? "0 0 12px rgba(16,185,129,0.35)" : "0 0 12px rgba(139,92,246,0.35)", transition: "all 0.2s" }}>
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <PromptPreview template={promptType.promptTemplate || ""} fields={fields} th={th} />
          {promptType.hasFields && (
            <p style={{ fontSize: "0.72rem", color: th.hintText, marginTop: 8, marginBottom: 0 }}>
              Placeholders <span style={{ color: th.placeholderText }}>{"{{like this}}"}</span> will be replaced as you fill in the fields above.
            </p>
          )}
        </div>
      </div>

      <Copycat visible={copycatVisible} />
      <MilestoneCelebration milestone={milestone} />
      {showModal && <PromptModal th={th} editing={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSave={handleAddOrEdit} />}
      {exportJson && <ExportModal th={th} json={exportJson} onClose={() => setExportJson(null)} />}
      {showImport && <ImportModal th={th} onClose={() => setShowImport(false)} onImport={handleImport} />}
      {showPasswordModal && <PasswordModal th={th} onClose={() => setShowPasswordModal(false)} onSuccess={() => { setIsAdmin(true); setShowPasswordModal(false); }} />}
    </div>
  );
}
