import { useState, useRef, useCallback } from "react";

import * as pdfjsLib from "pdfjs-dist";

import pdfWorker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const COLORS = {
  bg: "#0d0f1a",
  panel: "#141727",
  card: "#1a1e30",
  border: "#252a40",
  accent: "#6c63ff",
  green: "#10b981",
  red: "#f43f5e",
  amber: "#f59e0b",
  teal: "#06b6d4",
  text: "#e2e8f0",
  muted: "#64748b",
  subtle: "#1e2438",
};

const CircularProgress = ({ value, size = 120, stroke = 10, color = COLORS.green }) => {
  const safeValue = isNaN(value) ? 0 : value;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (safeValue / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.border} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease" }} />
    </svg>
  );
};

const SkillTag = ({ skill, found }) => (
  <span style={{
    padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500,
    background: found ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)",
    color: found ? COLORS.green : COLORS.red,
    border: `1px solid ${found ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.25)"}`,
    display: "inline-block", margin: "3px",
  }}>{skill}</span>
);

const StatCard = ({ label, value, sub, color = COLORS.accent }) => (
  <div style={{
    background: COLORS.card, border: `1px solid ${COLORS.border}`,
    borderRadius: 12, padding: "16px 20px", flex: 1, minWidth: 0,
  }}>
    <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{sub}</div>}
  </div>
);

const NavItem = ({ icon, label, active, onClick }) => (
  <div onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
    borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
    background: active ? "rgba(108,99,255,0.15)" : "transparent",
    color: active ? COLORS.accent : COLORS.muted,
    border: active ? "1px solid rgba(108,99,255,0.3)" : "1px solid transparent",
    transition: "all 0.2s",
  }}>
    <span style={{ fontSize: 16 }}>{icon}</span> {label}
  </div>
);

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [jobDesc, setJobDesc] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [jdName, setJdName] = useState("");  // ← NEW
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const lastInputRef = useRef({ resume: "", job: "" });

  // ── Resume file reader ──────────────────────────────────────────────────────
  const readFile = async (file) => {
    setResumeName(file.name);
    try {
      if (file.type === "application/pdf") {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        let extracted = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          extracted += content.items.map(item => item.str).join(" ") + " ";
        }
        setResumeText(extracted);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => setResumeText(e.target.result);
        reader.readAsText(file);
      }
    } catch (err) {
      console.log("PDF ERROR:", err);
    }
  };

  // ── JD file reader (NEW) ────────────────────────────────────────────────────
  const readJDFile = async (file) => {
    setJdName(file.name);
    try {
      if (file.type === "application/pdf") {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        let extracted = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          extracted += content.items.map(item => item.str).join(" ") + " ";
        }
        setJobDesc(extracted);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => setJobDesc(e.target.result);
        reader.readAsText(file);
      }
    } catch (err) {
      console.log("JD FILE ERROR:", err);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, []);

  const calculateExperience = (text) => {
  const flat = text.replace(/\s+/g, " ");

  const START_RE = /\b(work experience|professional experience|employment history|work history|internships?|experience)\b/gi;
  const END_RE = /\b(education|academic|projects?|technical skills|skills|certifications?|achievements?|awards|languages|interests|hobbies|publications|references|declaration)\b/i;

  // 1. Find the experience section (first heading that actually has dates under it)
  const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
  const MON = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
  const DATE = `(?:(${MON})\\s*,?\\s*|(\\d{1,2})[\\/\\-])?((?:19|20)\\d{2})`;
  const RANGE_RE = new RegExp(
    `${DATE}\\s*(?:-|–|—|to)\\s*(?:(present|current|now|till date|ongoing)|${DATE})`,
    "gi"
  );

  let section = "";
  for (const m of flat.matchAll(START_RE)) {
    const from = m.index + m[0].length;
    const rest = flat.slice(from);
    const end = rest.search(END_RE);
    const candidate = end === -1 ? rest : rest.slice(0, end);
    if (new RegExp(RANGE_RE.source, "i").test(candidate)) {
      section = candidate;
      break;
    }
  }

  if (!section) return "0 Years";

  // 2. Convert each date range to month indexes
  const toMonth = (monName, monNum, year, isEnd) => {
    let mo;
    if (monName) mo = MONTHS[monName.slice(0, 3).toLowerCase()];
    else if (monNum) mo = Math.min(11, Math.max(0, Number(monNum) - 1));
    else mo = isEnd ? 11 : 0; // year only
    return Number(year) * 12 + mo;
  };

  const now = new Date();
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  const ranges = [];

  for (const m of section.matchAll(RANGE_RE)) {
    const start = toMonth(m[1], m[2], m[3], false);
    let end;
    if (m[4]) end = nowIdx;
    else end = Math.min(toMonth(m[5], m[6], m[7], true), nowIdx);
    if (end >= start) ranges.push([start, end]);
  }

  if (ranges.length === 0) return "0 Years";

  // 3. Merge overlapping ranges so parallel jobs aren't counted twice
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];
  for (const [s, e] of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }

  const totalMonths = merged.reduce((sum, [s, e]) => sum + (e - s + 1), 0);
  return `${(totalMonths / 12).toFixed(1)} Years`;
};




// const calculateExperience = (text) => {
//   const currentYear = new Date().getFullYear();

//   const experienceSection =
//     text.split("Projects")[0] || text;

//   const matches = [
//     ...experienceSection.matchAll(
//       /(20\d{2})\s*[-–]\s*(Present|20\d{2})/gi
//     ),
//   ];

//   if (matches.length === 0) {
//     return "< 1 Year";
//   }

//   let totalYears = 0;

//   matches.forEach((m) => {
//     const start = parseInt(m[1]);

//     const end =
//       m[2].toLowerCase() === "present"
//         ? currentYear
//         : parseInt(m[2]);

//     totalYears += Math.max(0, end - start);
//   });

//   return totalYears === 0
//     ? "< 1 Year"
//     : `${totalYears} Years`;
// };

  // ── Analyze ─────────────────────────────────────────────────────────────────
  const analyze = async () => {
    if (!resumeText || !jobDesc) return;

    // ← cache check: skip API if same inputs
    if (
      lastInputRef.current.resume === resumeText &&
      lastInputRef.current.job === jobDesc &&
      result
    ) return;

    lastInputRef.current = { resume: resumeText, job: jobDesc };

    setLoading(true);
    setResult(null);

    try {
      const cleanResume = resumeText
        .replace(/[^\x20-\x7E\n]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (cleanResume.length < 100) {
        throw new Error("Resume extraction failed");
      }

      const prompt = `
You are an ATS Resume Screening System.

Compare the resume with the job description.

Scoring Criteria:

Skills Match = 50%
Experience Match = 25%
Projects Match = 15%
Education Match = 10%

Score Rules:

90-100 → Excellent Match
75-89 → Strong Match
60-74 → Moderate Match
40-59 → Partial Match
0-39 → Weak Match

Important Rules:

- Do NOT give extremely low scores unless resume is completely unrelated.
- Missing 1-2 skills should reduce score slightly.
- Similar skills count as partial matches.
- Consider projects and experience positively.
- Data Analyst resumes with Python, SQL, Excel, Power BI should usually score 60+ for analyst roles.

Return ONLY JSON.

Schema:

{
"matchScore":0,
"status":"",
"recommendation":"",
"detectedSkills":[],
"missingSkills":[],
"summary":"",
"strengths":[],
"improvements":[],
"experience":"",
"totalSkillsRequired":0
}

JOB DESCRIPTION:

${jobDesc.slice(0, 4000)}

RESUME:

${cleanResume.slice(0, 6000)}
`;

      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const responseData = await res.json();

      const raw =
        responseData.content?.[0]?.text ||
        responseData.output ||
        JSON.stringify(responseData);

      const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : cleaned);

      parsed.matchScore = parseInt(parsed.matchScore) || 0;
      parsed.experience = calculateExperience(resumeText); // ← fixed: was experienceYears

      setResult(parsed);

      // add to history
      setHistory(prev => [{
        ...parsed,
        name: resumeName || "Candidate",
        date: new Date().toLocaleDateString(),
      }, ...prev]);

    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (s) =>
    s?.includes("Strong") ? COLORS.green :
    s?.includes("Good") ? COLORS.teal :
    s?.includes("Average") ? COLORS.amber : COLORS.red;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: COLORS.bg, fontFamily: "'Inter', system-ui, sans-serif", color: COLORS.text }}>
      {/* Sidebar */}
      <div style={{
        width: 220, background: COLORS.panel, borderRight: `1px solid ${COLORS.border}`,
        padding: "24px 12px", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px 20px", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #6c63ff, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>🤖</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>AI Resume</div>
            <div style={{ fontSize: 10, color: COLORS.muted }}>Screening System</div>
          </div>
        </div>

        <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1.5, padding: "4px 14px 8px" }}>Navigation</div>
        <NavItem icon="📊" label="Dashboard" active={tab === "dashboard"} onClick={() => setTab("dashboard")} />
        <NavItem icon="🕐" label="History" active={tab === "history"} onClick={() => setTab("history")} />

        <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1.5, padding: "16px 14px 8px" }}>Features</div>
        <NavItem icon="📄" label="Resume Parsing" />
        <NavItem icon="🔗" label="NLP Matching" />
        <NavItem icon="🎯" label="Skill Detection" />
        <NavItem icon="⭐" label="Recommendation" />
        <NavItem icon="📋" label="Candidate History" />
        <NavItem icon="📈" label="Analytics" />

        <div style={{
          marginTop: "auto", padding: 14,
          background: "linear-gradient(135deg, rgba(108,99,255,0.15), rgba(139,92,246,0.1))",
          borderRadius: 10, border: "1px solid rgba(108,99,255,0.25)", fontSize: 12,
        }}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>⭐</div>
          <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Build Smarter Hiring <span style={{ color: COLORS.accent }}>with AI</span></div>
          <div style={{ color: COLORS.muted, fontSize: 11 }}>Save time. Hire better. Make data-driven decisions.</div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: 28, overflowY: "auto" }}>
        {tab === "history" ? (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Candidate History</h1>
            <p style={{ color: COLORS.muted, marginBottom: 24 }}>Previously analyzed candidates</p>
            {history.length === 0 ? (
              <div style={{ color: COLORS.muted, textAlign: "center", padding: 60 }}>No candidates analyzed yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {history.map((h, i) => (
                  <div key={i} style={{
                    background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12,
                    padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
                  }}>
                    <div style={{ width: 48, height: 48, position: "relative" }}>
                      <CircularProgress value={h.matchScore} size={48} stroke={5} color={statusColor(h.status)} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: statusColor(h.status) }}>{h.matchScore}%</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{h.name}</div>
                      <div style={{ fontSize: 12, color: COLORS.muted }}>{h.date} · {h.detectedSkills?.length} skills · {h.experience}</div>
                    </div>
                    <div style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: `${statusColor(h.status)}22`, color: statusColor(h.status) }}>{h.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
                <span style={{ color: COLORS.teal }}>AI Resume Screening</span>
                <span style={{ color: COLORS.text }}> & </span>
                <span style={{ color: COLORS.accent }}>Candidate Ranking System</span>
              </h1>
              <p style={{ color: COLORS.muted, fontSize: 13, margin: "6px 0 0" }}>
                Upload Resume → Compare with Job Description → Analyze Candidate
              </p>
            </div>

            {/* Upload + JD Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

              {/* ── Resume Card ── */}
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>1. Upload Resume</div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`,
                    borderRadius: 10, padding: "20px", textAlign: "center", background: COLORS.subtle,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => document.getElementById("resumeUpload").click()}
                    style={{
                      background: "linear-gradient(135deg, #6c63ff, #8b5cf6)",
                      color: "#fff", border: "none", padding: "10px 18px",
                      borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600",
                      marginTop: "6px", boxShadow: "0 4px 15px rgba(108,99,255,0.3)", transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 6px 20px rgba(108,99,255,0.45)"; }}
                    onMouseLeave={(e) => { e.target.style.transform = "translateY(0px)"; e.target.style.boxShadow = "0 4px 15px rgba(108,99,255,0.3)"; }}
                  >
                    📁 Browse Resume
                  </button>
                  <input
                    id="resumeUpload" type="file" accept="*/*"
                    style={{ display: "none" }}
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) readFile(file); }}
                  />
                </div>

                {resumeName && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
                    borderRadius: 8, margin: "10px 0",
                  }}>
                    <span>📄</span>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{resumeName}</div>
                    <span style={{ color: COLORS.green }}>✓</span>
                  </div>
                )}

                <textarea
                  value={resumeText}
                  onChange={e => setResumeText(e.target.value)}
                  placeholder="Or paste resume text here (name, skills, experience, education)..."
                  style={{
                    width: "100%", height: 120, background: COLORS.subtle, border: `1px solid ${COLORS.border}`,
                    borderRadius: 8, padding: 10, color: COLORS.text, fontSize: 12, resize: "none", boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
                  {resumeText.length} characters
                </div>
              </div>

              {/* ── JD Card ── */}
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>2. Job Description</div>

                {/* JD file upload */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) readJDFile(file); }}
                  style={{
                    border: `2px dashed ${COLORS.border}`, borderRadius: 10,
                    padding: "12px", textAlign: "center", background: COLORS.subtle, marginBottom: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => document.getElementById("jdUpload").click()}
                    style={{
                      background: "linear-gradient(135deg, #6c63ff, #8b5cf6)",
                      color: "#fff", border: "none", padding: "8px 16px",
                      borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600",
                    }}
                    onMouseEnter={(e) => { e.target.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.target.style.transform = "translateY(0px)"; }}
                  >
                    📁 Browse JD File
                  </button>
                  <input
                    id="jdUpload" type="file" accept="*/*"
                    style={{ display: "none" }}
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) readJDFile(file); }}
                  />
                </div>

                {jdName && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
                    borderRadius: 8, marginBottom: 10,
                  }}>
                    <span>📄</span>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{jdName}</div>
                    <span style={{ color: COLORS.green }}>✓</span>
                  </div>
                )}

                {/* Manual paste still works */}
                <textarea
                  value={jobDesc}
                  onChange={e => setJobDesc(e.target.value)}
                  placeholder="Or paste job description here..."
                  style={{
                    width: "100%", height: 130, background: COLORS.subtle, border: `1px solid ${COLORS.border}`,
                    borderRadius: 8, padding: 12, color: COLORS.text, fontSize: 12, resize: "none",
                    boxSizing: "border-box", lineHeight: 1.6,
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>
                    Words: {jobDesc.split(/\s+/).filter(Boolean).length} | Chars: {jobDesc.length}
                  </div>
                  <button
                    onClick={analyze}
                    disabled={loading || !resumeText || !jobDesc}
                    style={{
                      background: loading || !resumeText || !jobDesc ? COLORS.border : "linear-gradient(135deg, #6c63ff, #8b5cf6)",
                      color: "#fff", border: "none", padding: "9px 20px", borderRadius: 8,
                      cursor: loading || !resumeText || !jobDesc ? "not-allowed" : "pointer",
                      fontWeight: 600, fontSize: 13,
                    }}>
                    {loading ? "⏳ Analyzing..." : "⚡ Analyze"}
                  </button>
                </div>
              </div>
            </div>

            {/* Error */}
            {result?.error && (
              <div style={{
                background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)",
                borderRadius: 8, padding: "12px 16px", color: COLORS.red, fontSize: 13, marginBottom: 16,
              }}>❌ {result.error}</div>
            )}

            {/* Results */}
            {result && !result.error && (
              <>
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <div style={{
                    background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20,
                    display: "flex", flexDirection: "column", alignItems: "center", minWidth: 160,
                  }}>
                    <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Match Score</div>
                    <div style={{ position: "relative", width: 100, height: 100 }}>
                      <CircularProgress value={result.matchScore} size={100} stroke={9} color={statusColor(result.status)} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: statusColor(result.status) }}>{result.matchScore}%</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: statusColor(result.status), marginTop: 8, fontWeight: 600 }}>
                      {result.matchScore >= 80 ? "Strong Match" : result.matchScore >= 60 ? "Good Match" : "Partial Match"}
                    </div>
                  </div>

                  <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <StatCard label="Skills Found" value={result.detectedSkills?.length || 0} sub={`Out of ${result.totalSkillsRequired || 10} Required`} color={COLORS.accent} />
                      <StatCard label="Missing Skills" value={result.missingSkills?.length || 0} sub="Skills to acquire" color={COLORS.red} />
                      <StatCard label="Experience" value={result.experience || "N/A"} sub="Calculated from Resume" color={COLORS.teal} />
                    </div>
                    <div style={{
                      background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12,
                      padding: "14px 20px", display: "flex", alignItems: "center", gap: 14,
                    }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: `${statusColor(result.status)}22`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                      }}>🛡️</div>
                      <div>
                        <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>Candidate Status</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: statusColor(result.status) }}>{result.status}</div>
                        <div style={{ fontSize: 12, color: COLORS.green }}>{result.recommendation}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>✅ Detected Skills</div>
                    <div style={{ display: "flex", flexWrap: "wrap" }}>
                      {result.detectedSkills?.map(s => <SkillTag key={s} skill={s} found={true} />)}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, margin: "16px 0 10px" }}>⚠️ Missing Skills</div>
                    <div style={{ display: "flex", flexWrap: "wrap" }}>
                      {result.missingSkills?.map(s => <SkillTag key={s} skill={s} found={false} />)}
                    </div>
                  </div>

                  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Skills Distribution</div>
                    {result.detectedSkills?.slice(0, 8).map((skill) => {
                      const bar = 55 + (skill.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 45);
                      return (
                        <div key={skill} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                            <span style={{ color: COLORS.muted }}>{skill}</span>
                            <span style={{ color: COLORS.text }}>{bar}%</span>
                          </div>
                          <div style={{ height: 5, background: COLORS.subtle, borderRadius: 3 }}>
                            <div style={{ width: `${bar}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.teal})`, borderRadius: 3 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📝 Resume Summary</div>
                    <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>{result.summary}</p>
                  </div>
                  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>💪 Key Strengths</div>
                    {result.strengths?.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <span style={{ color: COLORS.green }}>▶</span>
                        <span style={{ fontSize: 13, color: COLORS.muted }}>{s}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 13, fontWeight: 600, margin: "12px 0 8px", color: COLORS.amber }}>Areas to Improve</div>
                    {result.improvements?.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                        <span style={{ color: COLORS.amber }}>→</span>
                        <span style={{ fontSize: 13, color: COLORS.muted }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{
                  background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
                  borderRadius: 8, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ color: COLORS.green }}>✓</span>
                  <span style={{ fontSize: 13, color: COLORS.green }}>Analysis completed! Candidate added to history.</span>
                </div>
              </>
            )}

            {!result && !loading && (
              <div style={{
                background: COLORS.card, border: `1px dashed ${COLORS.border}`, borderRadius: 12,
                padding: 48, textAlign: "center",
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Ready to Analyze</div>
                <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>Upload or paste resume and job description, then click Analyze.</div>
              </div>
            )}

            {loading && (
              <div style={{
                background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12,
                padding: 48, textAlign: "center",
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
                <div style={{ fontWeight: 600, color: COLORS.accent, marginBottom: 6 }}>Analyzing Resume...</div>
                <div style={{ fontSize: 13, color: COLORS.muted }}>AI is extracting skills and generating insights...</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}