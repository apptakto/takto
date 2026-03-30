import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, isSameMonth, isSameDay, parseISO, differenceInDays,
} from "date-fns";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

// ─── Claude proxy ─────────────────────────────────────────────────────────────
async function callClaude(system, userPrompt, maxTokens = 2000) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: maxTokens,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data.content?.[0]?.text || "";
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const G = "linear-gradient(135deg, #00d4aa 0%, #7c3aed 45%, #e91e8c 100%)";
const TAKTO_PATH = "M180.622 16.0533C164.259 16.0533 157.243 22.6453 157.243 38.0266C157.243 53.408 164.259 60 180.622 60C196.985 60 204 53.408 204 38.0266C204 22.6453 196.985 16.0533 180.622 16.0533ZM180.622 49.0133C174.782 49.0133 172.27 45.7173 172.27 38.0266C172.27 30.336 174.773 27.04 180.622 27.04C186.471 27.04 188.974 30.336 188.974 38.0266C188.974 45.7173 186.471 49.0133 180.622 49.0133ZM144.504 16.8977H156.194V26.1955H144.504V43.9376C144.504 46.4709 146.173 48.1598 148.676 48.1598H156.194V59.1465H142.836C134.484 59.1465 129.478 54.0799 129.478 45.6265V26.1955H121.323L113.635 37.1822L129.496 59.1556H111.967L97.7747 38.4534V59.1556H82.7483V0H97.7747V35.8293L110.298 16.8977H129.478V5.91102H144.504V16.8977ZM58.7778 16.0533C44.7562 16.0533 38.7456 20.112 38.7456 29.5732H52.9377C52.9377 26.023 54.5256 24.5067 58.2844 24.5067C62.0433 24.5067 63.7926 26.2772 63.7926 30.4177V32.1065H57.9525C43.3388 32.1065 37.077 36.4195 37.077 46.4709C37.077 55.9322 41.5894 59.9909 52.1034 59.9909C58.5356 59.9909 62.2855 57.1217 63.7926 50.6931L67.1298 59.1465H78.819V32.1065C78.819 20.8656 72.8084 16.0533 58.7778 16.0533ZM63.7926 42.2488C63.7926 47.5696 61.7921 49.8577 57.1092 49.8577C53.6016 49.8577 52.1034 48.8408 52.1034 45.6356C52.1034 41.7494 54.3551 40.569 59.6211 40.569H63.7926V42.2579V42.2488ZM50.0939 12.6755H33.3989V59.1556H16.704V12.6755H0V0H50.0939V12.6755Z";

// ─── Global CSS ───────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a0f; --s1: #13131a; --s2: #1a1a24; --s3: #22222f;
    --b: rgba(255,255,255,0.08); --bh: rgba(255,255,255,0.14);
    --t: #f0f0f8; --t2: rgba(240,240,248,0.6); --t3: rgba(240,240,248,0.35);
    --p: #7c3aed; --teal: #00d4aa; --pink: #e91e8c;
    --r: 16px; --rs: 10px; --nh: 68px;
    --inter: 'Inter', sans-serif;
  }
  html, body, #root { height: 100%; }
  body { background: var(--bg); color: var(--t); font-family: var(--inter); font-size: 15px; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  h1, h2, h3 { font-family: 'Syne', sans-serif; font-weight: 700; line-height: 1.2; }
  input, textarea { background: var(--s2); border: 1px solid var(--b); border-radius: var(--rs); color: var(--t); font-family: var(--inter); font-size: 15px; outline: none; padding: 12px 16px; width: 100%; transition: border-color 0.2s, box-shadow 0.2s; -webkit-appearance: none; }
  input:focus, textarea:focus { border-color: var(--p); box-shadow: 0 0 0 3px rgba(124,58,237,0.15); }
  input::placeholder, textarea::placeholder { color: var(--t3); }
  button { cursor: pointer; font-family: var(--inter); border: none; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  .fu { animation: fadeUp 0.35s ease both; }
  .fi { animation: fadeIn 0.25s ease both; }
  .sd { animation: slideDown 0.2s ease both; }
  .sx { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .sx::-webkit-scrollbar { display: none; }
  .hover-lift { transition: transform 0.15s, box-shadow 0.15s; }
  .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
`;

function GlobalStyles() { return <style>{css}</style>; }

// ─── Auth context ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("niche,style,posting_frequency,notifications_enabled,onboarding_completed")
        .eq("user_id", uid)
        .maybeSingle();
      if (data) { setProfile(data); return data; }
      const { data: created } = await supabase
        .from("profiles")
        .upsert({ user_id: uid, onboarding_completed: false }, { onConflict: "user_id" })
        .select().maybeSingle();
      if (created) setProfile(created);
      return created;
    } catch (e) { console.error("fetchProfile:", e); return null; }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 5000);
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(t);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    }).catch(() => { clearTimeout(t); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) await fetchProfile(session.user.id);
      else setProfile(null);
      setLoading(false);
    });
    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, [fetchProfile]);

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch (e) {}
    setUser(null); setProfile(null);
    window.location.hash = "/auth";
  };

  return (
    <AuthCtx.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────
function useRoute() {
  const [path, setPath] = useState(() => window.location.hash.replace("#", "") || "/");
  useEffect(() => {
    const h = () => setPath(window.location.hash.replace("#", "") || "/");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const navigate = (to) => { window.location.hash = to; setPath(to); };
  return { path, navigate };
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "default") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  const ToastContainer = () => (
    <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 9999, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} className="fu" style={{
          background: t.type === "success" ? "rgba(52,211,153,0.15)" : "var(--s2)",
          border: `1px solid ${t.type === "success" ? "rgba(52,211,153,0.3)" : "var(--b)"}`,
          borderRadius: 50, padding: "11px 20px", fontSize: 13, fontWeight: 500,
          color: t.type === "success" ? "#34d399" : "var(--t)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", maxWidth: "90vw", textAlign: "center",
        }}>{t.msg}</div>
      ))}
    </div>
  );
  return { show, ToastContainer };
}

// ─── UI Primitives ────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", size = "md", disabled, style: sx, type = "button", fullWidth }) {
  const pad = size === "sm" ? "7px 16px" : size === "lg" ? "15px 34px" : "11px 24px";
  const fs = size === "sm" ? 13 : 14;
  const v = {
    primary:   { background: G, color: "#fff", boxShadow: disabled ? "none" : "0 4px 18px rgba(124,58,237,0.3)" },
    secondary: { background: "var(--s2)", color: "var(--t)", border: "1px solid var(--b)" },
    ghost:     { background: "transparent", color: "var(--t2)" },
    danger:    { background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" },
    outline:   { background: "transparent", color: "var(--t)", border: "1px solid var(--b)" },
    teal:      { background: "rgba(0,212,170,0.12)", color: "#00d4aa", border: "1px solid rgba(0,212,170,0.25)" },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
      padding: pad, fontSize: fs, fontWeight: 600, borderRadius: 50, border: "none",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      transition: "opacity 0.2s, transform 0.1s", width: fullWidth ? "100%" : undefined,
      fontFamily: "var(--inter)", ...v[variant], ...sx,
    }}>
      {children}
    </button>
  );
}

function Chip({ label, selected, onClick, icon, color }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "7px 14px", borderRadius: 50, fontSize: 13, fontWeight: 500,
      border: `1.5px solid ${selected ? (color || "var(--p)") : "var(--b)"}`,
      background: selected ? `${color ? color + "22" : "rgba(124,58,237,0.18)"}` : "var(--s2)",
      color: selected ? (color || "#c4b5fd") : "var(--t2)",
      cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--inter)",
    }}>
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {label}
    </button>
  );
}

function Card({ children, style: sx, className, onClick, hover }) {
  return (
    <div className={`${className || ""} ${hover ? "hover-lift" : ""}`} onClick={onClick} style={{
      background: "var(--s1)", border: "1px solid var(--b)",
      borderRadius: "var(--r)", cursor: onClick ? "pointer" : undefined, ...sx,
    }}>
      {children}
    </div>
  );
}

function Spinner({ size = 20, color }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${color || "var(--b)"}`, borderTopColor: color || "var(--p)", animation: "spin 0.65s linear infinite", flexShrink: 0 }} />;
}

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{ width: 46, height: 26, borderRadius: 13, border: "none", background: value ? G : "var(--s3)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
    </button>
  );
}

function Badge({ children, color = "#7c3aed", bg }) {
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 50, background: bg || `${color}20`, color, fontWeight: 600, border: `1px solid ${color}30`, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function TaktoLogo({ size = 26 }) {
  const w = size * (204 / 60);
  return (
    <div style={{ userSelect: "none", display: "inline-flex", alignItems: "center" }}>
      <svg width={w} height={size} viewBox="0 0 204 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d={TAKTO_PATH} fill="white" />
      </svg>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV = [
  { path: "/dashboard", label: "Ideas",    emoji: "💡" },
  { path: "/generate",  label: "Generate", emoji: "⚡" },
  { path: "/explore",   label: "Explore",  emoji: "🌍" },
  { path: "/calendar",  label: "Schedule", emoji: "📅" },
  { path: "/profile",   label: "Profile",  emoji: "👤" },
];

function NavIcon({ emoji, active, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "rgba(124,58,237,0.2)" : "transparent",
        border: active ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent",
        fontSize: 18, transition: "all 0.15s",
      }}>{emoji}</div>
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? "#c4b5fd" : "var(--t3)" }}>{label}</span>
    </div>
  );
}

function BottomNav({ path, navigate }) {
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, height: "var(--nh)",
      background: "rgba(10,10,15,0.97)", borderTop: "1px solid var(--b)",
      backdropFilter: "blur(24px)", display: "flex", alignItems: "center",
      justifyContent: "space-around", zIndex: 100,
      paddingBottom: "max(4px,env(safe-area-inset-bottom))",
    }}>
      {NAV.map(item => (
        <button key={item.path} onClick={() => navigate(item.path)} style={{ background: "none", border: "none", padding: "4px 6px" }}>
          <NavIcon emoji={item.emoji} active={path === item.path} label={item.label} />
        </button>
      ))}
    </nav>
  );
}

function Sidebar({ path, navigate, signOut, profile }) {
  return (
    <aside style={{ width: 220, flexShrink: 0, background: "var(--s1)", borderRight: "1px solid var(--b)", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: "22px 20px 16px" }}><TaktoLogo size={18} /></div>
      <nav style={{ flex: 1, padding: "4px 10px" }}>
        {NAV.map(item => {
          const active = path === item.path;
          return (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
              borderRadius: 11, marginBottom: 2, background: active ? "rgba(124,58,237,0.14)" : "transparent",
              border: "none", color: active ? "#c4b5fd" : "var(--t2)", fontSize: 14,
              fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "var(--inter)", textAlign: "left",
            }}>
              <span style={{ fontSize: 16 }}>{item.emoji}</span>
              {item.label}
              {active && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: G }} />}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "12px 10px", borderTop: "1px solid var(--b)" }}>
        {profile?.niche?.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6, padding: "0 4px" }}>
            {profile.niche.slice(0, 2).join(" · ")}
          </div>
        )}
        <button onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", borderRadius: 11, background: "transparent", border: "none", color: "var(--t3)", fontSize: 13, cursor: "pointer", fontFamily: "var(--inter)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

function AppShell({ children, path, navigate }) {
  const { profile, signOut } = useAuth();
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {!isMobile && <Sidebar path={path} navigate={navigate} signOut={signOut} profile={profile} />}
      <main style={{ flex: 1, overflow: "auto", paddingBottom: isMobile ? "var(--nh)" : 0 }}>{children}</main>
      {isMobile && <BottomNav path={path} navigate={navigate} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setOk(""); setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}#/reset-password` });
        if (error) throw error;
        setOk("Reset link sent — check your email.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setOk("Account created! Check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const googleSignIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) setErr(error.message);
    setBusy(false);
  };

  const IF = "var(--inter)";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: "-10%", right: "-5%", width: 520, height: 640, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(119,0,255,0.22) 0%, rgba(119,0,255,0.06) 50%, transparent 75%)", pointerEvents: "none", filter: "blur(40px)" }} />
      <div style={{ position: "fixed", bottom: "-15%", left: "-8%", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,180,220,0.18) 0%, rgba(0,180,220,0.05) 50%, transparent 75%)", pointerEvents: "none", filter: "blur(40px)" }} />
      <div style={{ position: "fixed", bottom: "5%", left: "15%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(192,0,128,0.13) 0%, transparent 70%)", pointerEvents: "none", filter: "blur(30px)" }} />

      <div className="fu" style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <svg width="153" height="45" viewBox="0 0 204 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d={TAKTO_PATH} fill="white" />
            </svg>
            <p style={{ fontFamily: IF, fontWeight: 400, fontSize: 18, color: "rgba(255,255,255,0.8)", margin: 0 }}>No more creator's block.</p>
          </div>
        </div>

        <div style={{ background: "#13131a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "32px 29px 28px" }}>
          <p style={{ fontFamily: IF, fontWeight: 400, fontSize: 18, color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: 16, marginTop: 0 }}>
            {mode === "forgot" ? "Reset password" : mode === "signup" ? "Create account" : "Sign in"}
          </p>

          {mode !== "forgot" && (
            <>
              <button onClick={googleSignIn} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", height: 42, background: "#1a1a24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 50, color: "#f0f0f8", fontSize: 14, fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", marginBottom: 14, fontFamily: IF, opacity: busy ? 0.6 : 1 }}>
                <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
                <span style={{ fontFamily: IF, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
              </div>
            </>
          )}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
              style={{ height: 46, background: "#1a1a24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f8", fontFamily: IF, fontSize: 15, padding: "0 16px" }} />
            {mode !== "forgot" && (
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                style={{ height: 46, background: "#1a1a24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f8", fontFamily: IF, fontSize: 15, padding: "0 16px" }} />
            )}
            {err && <p style={{ fontFamily: IF, color: "#f87171", fontSize: 13, margin: 0 }}>{err}</p>}
            {ok  && <p style={{ fontFamily: IF, color: "#34d399", fontSize: 13, margin: 0 }}>{ok}</p>}
            <button type="submit" disabled={busy} style={{ height: 40, width: "100%", background: G, border: "none", borderRadius: 50, color: "#fff", fontFamily: IF, fontSize: 15, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 18px rgba(124,58,237,0.35)", marginTop: 4 }}>
              {busy && <Spinner size={14} />}
              {mode === "forgot" ? "Send Reset Link" : mode === "signup" ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {mode !== "forgot" && <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(""); setOk(""); }} style={{ background: "none", border: "none", fontFamily: IF, fontSize: 15, color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: 0 }}>{mode === "signup" ? "Already have an account? Sign in" : "Don't have an account? Sign up"}</button>}
            {mode === "login" && <button onClick={() => { setMode("forgot"); setErr(""); setOk(""); }} style={{ background: "none", border: "none", fontFamily: IF, fontSize: 15, color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: 0 }}>Forgot password?</button>}
            {mode === "forgot" && <button onClick={() => setMode("login")} style={{ background: "none", border: "none", fontFamily: IF, fontSize: 15, color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: 0 }}>Back to sign in</button>}
          </div>
        </div>

        <p style={{ textAlign: "center", fontFamily: IF, fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 20 }}>
          By signing in you agree to our Terms &amp; Privacy Policy
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════════
const NICHES = [
  { label: "Beauty & Makeup", icon: "💄" }, { label: "Fashion & Style", icon: "👗" },
  { label: "Fitness & Workouts", icon: "🏋️" }, { label: "Health & Wellness", icon: "🌿" },
  { label: "Travel & Adventure", icon: "✈️" }, { label: "Food & Cooking", icon: "🍳" },
  { label: "Side Hustles", icon: "💰" }, { label: "Personal Finance", icon: "📈" },
  { label: "Tech & Gadgets", icon: "💻" }, { label: "Gaming", icon: "🎮" },
  { label: "DIY & Crafts", icon: "🎨" }, { label: "Comedy & Memes", icon: "😂" },
  { label: "Pet & Animals", icon: "🐾" }, { label: "Parenting & Family", icon: "👨‍👩‍👧" },
];
const STYLES = [
  { label: "Personal Brand/Influencer", icon: "⭐" }, { label: "Comedy/Skit", icon: "🎭" },
  { label: "Tutorial/Educational", icon: "📚" }, { label: "Challenge/Trend", icon: "🔥" },
  { label: "Aesthetic/Mood-Based", icon: "🌸" }, { label: "Review/Reaction", icon: "📋" },
  { label: "Storytime/Narration", icon: "📖" }, { label: "Transformation/Glow-Up", icon: "✨" },
  { label: "Motivational/Inspirational", icon: "💪" }, { label: "Niche Hobbyist", icon: "🎯" },
];
const FREQS = [
  { value: "Once a week", label: "Once a week", desc: "Easy to maintain", icon: "🌱" },
  { value: "2x a week", label: "2x a week", desc: "Good for growth", icon: "📈" },
  { value: "3x a week", label: "3x a week", desc: "Recommended", icon: "⚡", rec: true },
  { value: "5x a week", label: "5x a week", desc: "Maximum growth", icon: "🚀" },
  { value: "Every day", label: "Every day", desc: "Full commitment", icon: "🏆" },
];

function OnboardingScreen({ navigate }) {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [niches, setNiches] = useState([]);
  const [styles, setStyles] = useState([]);
  const [freq, setFreq] = useState("3x a week");
  const [notifs, setNotifs] = useState(true);
  const [customN, setCustomN] = useState("");
  const [customS, setCustomS] = useState("");
  const [busy, setBusy] = useState(false);

  const addCustom = (val, list, setList, setVal) => {
    const t = val.trim();
    if (t && !list.includes(t)) setList(p => [...p, t]);
    setVal("");
  };
  const canNext = () => step === 0 ? niches.length > 0 : step === 1 ? styles.length > 0 : true;

  const finish = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ niche: niches, style: styles, posting_frequency: freq, notifications_enabled: notifs, onboarding_completed: true }).eq("user_id", user.id);
    if (!error) { await refreshProfile(); navigate("/dashboard"); }
    setBusy(false);
  };

  const STEPS = ["Niche", "Style", "Frequency", "You're set"];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px 80px", background: "var(--bg)" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, background: "var(--s2)", zIndex: 10 }}>
        <div style={{ height: "100%", width: `${((step + 1) / STEPS.length) * 100}%`, background: G, transition: "width 0.4s ease" }} />
      </div>
      <div className="fu" style={{ width: "100%", maxWidth: 540, paddingTop: 48 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <TaktoLogo size={20} />
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i <= step ? G : "var(--s3)", transition: "all 0.3s" }} />
              </div>
            ))}
          </div>
          <p style={{ color: "var(--t3)", fontSize: 12, marginTop: 10 }}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        </div>

        {step === 0 && <div className="fi">
          <h1 style={{ fontSize: 28, textAlign: "center", marginBottom: 6 }}>What's your niche?</h1>
          <p style={{ color: "var(--t2)", textAlign: "center", marginBottom: 24, fontSize: 14 }}>Select all that apply to your content</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {NICHES.map(n => <Chip key={n.label} label={n.label} icon={n.icon} selected={niches.includes(n.label)} onClick={() => setNiches(p => p.includes(n.label) ? p.filter(x => x !== n.label) : [...p, n.label])} />)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Add custom niche..." value={customN} onChange={e => setCustomN(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustom(customN, niches, setNiches, setCustomN)} style={{ flex: 1 }} />
            <Btn onClick={() => addCustom(customN, niches, setNiches, setCustomN)} variant="secondary" size="sm">Add</Btn>
          </div>
        </div>}

        {step === 1 && <div className="fi">
          <h1 style={{ fontSize: 28, textAlign: "center", marginBottom: 6 }}>Your content style</h1>
          <p style={{ color: "var(--t2)", textAlign: "center", marginBottom: 24, fontSize: 14 }}>How do you like to create?</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {STYLES.map(s => <Chip key={s.label} label={s.label} icon={s.icon} selected={styles.includes(s.label)} onClick={() => setStyles(p => p.includes(s.label) ? p.filter(x => x !== s.label) : [...p, s.label])} />)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Add custom style..." value={customS} onChange={e => setCustomS(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustom(customS, styles, setStyles, setCustomS)} style={{ flex: 1 }} />
            <Btn onClick={() => addCustom(customS, styles, setStyles, setCustomS)} variant="secondary" size="sm">Add</Btn>
          </div>
        </div>}

        {step === 2 && <div className="fi">
          <h1 style={{ fontSize: 28, textAlign: "center", marginBottom: 6 }}>Posting frequency</h1>
          <p style={{ color: "var(--t2)", textAlign: "center", marginBottom: 24, fontSize: 14 }}>Takto generates ideas around your schedule</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FREQS.map(f => (
              <button key={f.value} onClick={() => setFreq(f.value)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: freq === f.value ? "rgba(124,58,237,0.14)" : "var(--s1)", border: `1.5px solid ${freq === f.value ? "var(--p)" : "var(--b)"}`, borderRadius: "var(--r)", cursor: "pointer", textAlign: "left", fontFamily: "var(--inter)", color: "var(--t)", transition: "all 0.15s" }}>
                <span style={{ fontSize: 20 }}>{f.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontSize: 12, color: "var(--t2)" }}>{f.desc}</div>
                </div>
                {f.rec && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 50, background: G, color: "#fff", fontWeight: 600 }}>Recommended</span>}
                {freq === f.value && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
        </div>}

        {step === 3 && <div className="fi">
          <h1 style={{ fontSize: 28, textAlign: "center", marginBottom: 6 }}>You're all set 🎉</h1>
          <p style={{ color: "var(--t2)", textAlign: "center", marginBottom: 24, fontSize: 14 }}>Your Content OS is ready</p>
          <Card style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Posting reminders</div>
                <div style={{ fontSize: 13, color: "var(--t2)" }}>Get notified on your scheduled post days</div>
              </div>
              <Toggle value={notifs} onChange={setNotifs} />
            </div>
          </Card>
          <div style={{ padding: 20, background: "rgba(124,58,237,0.07)", borderRadius: "var(--r)", border: "1px solid rgba(124,58,237,0.15)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#c4b5fd", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Your Profile</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {niches.slice(0, 4).map(n => <Badge key={n} color="#7c3aed">{n}</Badge>)}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {styles.slice(0, 3).map(s => <Badge key={s} color="#00d4aa">{s}</Badge>)}
              </div>
              <div style={{ fontSize: 13, color: "var(--t2)" }}>📅 {freq}</div>
            </div>
          </div>
        </div>}

        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          {step > 0 && <Btn onClick={() => setStep(s => s - 1)} variant="secondary">← Back</Btn>}
          {step < 3
            ? <Btn onClick={() => setStep(s => s + 1)} disabled={!canNext()} style={{ flex: 1 }}>Continue →</Btn>
            : <Btn onClick={finish} disabled={busy} style={{ flex: 1 }}>{busy && <Spinner size={14} />} Launch my Content OS ✨</Btn>
          }
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD — Content OS Hub
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardScreen() {
  const { user, profile } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const { show, ToastContainer } = useToast();

  const fetchIdeas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("content_ideas").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setIdeas(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  const generate = async () => {
    if (!user || !profile) return;
    setGen(true);
    try {
      const dates = Array.from({ length: 5 }, (_, i) => format(addDays(new Date(), i + 1), "yyyy-MM-dd"));
      const text = await callClaude(
        "You are a creative content strategist for UGC creators. Return ONLY valid JSON — no markdown, no explanation.",
        `Generate 5 unique, actionable content ideas for:
- Niches: ${profile.niche?.join(", ")}
- Styles: ${profile.style?.join(", ")}
- Frequency: ${profile.posting_frequency}
- Dates: ${dates.join(", ")}

For each idea, include:
- title: catchy, specific title
- description: 2 sentence description
- hook: the first line/sentence to open the video (make it scroll-stopping)
- format: e.g. "Talking Head", "B-Roll Montage", "Carousel", "Duet", "Screen Record"
- time_to_create: "15 min" / "30 min" / "1-2 hrs" / "Half day"
- performance: "Quick Win" / "High Potential" / "Trending" / "Evergreen"
- date_scheduled: from the dates array
- special_occasion: string or null
- difficulty: "Easy" / "Medium" / "Hard"

JSON: {"ideas":[{"title":"","description":"","hook":"","format":"","time_to_create":"","performance":"","date_scheduled":"","special_occasion":null,"difficulty":""}]}`
      , 2500);
      const { ideas: newIdeas } = JSON.parse(text.replace(/```json|```/g, "").trim());
      for (const idea of newIdeas) {
        await supabase.from("content_ideas").insert({
          user_id: user.id, title: idea.title, description: idea.description,
          date_scheduled: idea.date_scheduled || null,
          special_occasion: idea.special_occasion || null,
          difficulty: idea.difficulty || "Medium", status: "pending",
          // Store extra fields in description as JSON suffix for now
          // (until schema migration adds columns)
        });
      }
      await fetchIdeas();
      show(`✨ ${newIdeas.length} execution cards ready!`, "success");
    } catch (err) { show("Error: " + (err?.message || String(err))); }
    setGen(false);
  };

  const updateIdea = async (id, updates) => {
    await supabase.from("content_ideas").update(updates).eq("id", id);
    setIdeas(p => p.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const saveToCalendar = async (idea) => {
    const d = idea.date_scheduled || format(addDays(new Date(), 1), "yyyy-MM-dd");
    await updateIdea(idea.id, { status: "saved", date_scheduled: d });
    show(`📅 Saved to ${format(parseISO(d), "MMM d")}`, "success");
  };

  const markUsed = async (idea) => {
    await updateIdea(idea.id, { status: "used" });
    show("✓ Marked as posted");
  };

  // Workflow bar logic
  const today = format(new Date(), "yyyy-MM-dd");
  const todayIdeas = ideas.filter(i => i.date_scheduled === today && i.status !== "used");
  const readyToPost = ideas.filter(i => i.status === "saved" && i.date_scheduled && i.date_scheduled <= today).length;
  const lastUsed = ideas.find(i => i.status === "used");
  const daysSincePost = lastUsed ? differenceInDays(new Date(), parseISO(lastUsed.date_scheduled || lastUsed.created_at)) : null;
  const pendingCount = ideas.filter(i => i.status === "pending").length;

  // Featured = first saved idea or first pending
  const featured = ideas.find(i => i.status === "saved") || ideas[0];
  const rest = ideas.filter(i => i.id !== featured?.id).slice(0, 12);

  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ padding: "24px 20px 32px", maxWidth: 820, margin: "0 auto" }}>
      <ToastContainer />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 3 }}>{greeting} 👋</h1>
          <p style={{ color: "var(--t2)", fontSize: 13 }}>{profile?.niche?.slice(0, 2).join(" · ") || "Welcome back"}{profile?.posting_frequency ? " · " + profile.posting_frequency : ""}</p>
        </div>
        <Btn onClick={generate} disabled={generating}>
          {generating ? <Spinner size={14} /> : "⚡"}
          {generating ? "Generating..." : "Get New Ideas"}
        </Btn>
      </div>

      {/* Daily Workflow Bar */}
      {ideas.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {readyToPost > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 50, fontSize: 13, fontWeight: 500, color: "#34d399" }}>
              ✅ {readyToPost} idea{readyToPost > 1 ? "s" : ""} ready to post today
            </div>
          )}
          {daysSincePost !== null && daysSincePost >= 2 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 50, fontSize: 13, fontWeight: 500, color: "#fbbf24" }}>
              ⚠️ You haven't posted in {daysSincePost} days
            </div>
          )}
          {pendingCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 50, fontSize: 13, fontWeight: 500, color: "#c4b5fd" }}>
              💡 {pendingCount} unused idea{pendingCount > 1 ? "s" : ""} waiting
            </div>
          )}
        </div>
      )}

      {/* Week strip */}
      <div className="sx" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 6, minWidth: "max-content" }}>
          {Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 1)).map(day => {
            const ds = format(day, "yyyy-MM-dd");
            const dayIdeas = ideas.filter(i => i.date_scheduled === ds);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={ds} style={{ width: 52, padding: "10px 6px", borderRadius: 12, textAlign: "center", background: isToday ? "rgba(124,58,237,0.14)" : "var(--s1)", border: `1px solid ${isToday ? "rgba(124,58,237,0.4)" : "var(--b)"}`, transition: "all 0.15s" }}>
                <div style={{ fontSize: 9, color: "var(--t3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{format(day, "EEE")}</div>
                <div style={{ fontSize: 16, fontWeight: isToday ? 700 : 400, color: isToday ? "#c4b5fd" : "var(--t)", marginBottom: 5 }}>{format(day, "d")}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
                  {dayIdeas.slice(0, 3).map((_, i) => (
                    <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: G }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={26} /></div>
      ) : ideas.length === 0 ? (
        <Card style={{ padding: 52, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <h3 style={{ marginBottom: 8, fontSize: 20 }}>Your Content OS is ready</h3>
          <p style={{ color: "var(--t2)", fontSize: 14, marginBottom: 24, maxWidth: 340, margin: "0 auto 24px" }}>
            Generate your first batch of execution-ready ideas, each with hooks, formats and time estimates.
          </p>
          <Btn onClick={generate} disabled={generating} size="lg">{generating ? <Spinner size={16} /> : "⚡"} Generate Ideas</Btn>
        </Card>
      ) : (
        <>
          {/* Featured idea */}
          {featured && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Featured</span>
                <Badge color="#e91e8c">🔥 Top Pick</Badge>
              </div>
              <ExecutionCard idea={featured} expanded={true} onSave={saveToCalendar} onMarkUsed={markUsed} featured />
            </div>
          )}

          {/* Rest of ideas */}
          {rest.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>All Ideas</span>
                  <span style={{ fontSize: 12, color: "var(--t3)" }}>{ideas.length} total</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rest.map((idea, i) => (
                  <ExecutionCard
                    key={idea.id} idea={idea}
                    expanded={expandedId === idea.id}
                    onToggle={() => setExpandedId(expandedId === idea.id ? null : idea.id)}
                    onSave={saveToCalendar} onMarkUsed={markUsed}
                    delay={i * 30}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// Execution Card — the core of the new Ideas screen
function ExecutionCard({ idea, expanded, onToggle, onSave, onMarkUsed, featured, delay = 0 }) {
  const STATUS = {
    pending: { color: "#fbbf24", label: "Pending" },
    saved:   { color: "#60a5fa", label: "Saved" },
    used:    { color: "#34d399", label: "Posted" },
  };
  const DIFF = { Easy: "#34d399", Medium: "#fbbf24", Hard: "#f87171" };
  const PERF = { "Quick Win": { color: "#34d399", icon: "⚡" }, "High Potential": { color: "#c4b5fd", icon: "🚀" }, "Trending": { color: "#e91e8c", icon: "🔥" }, "Evergreen": { color: "#60a5fa", icon: "🌲" } };

  const sc = STATUS[idea.status] || STATUS.pending;
  const perf = idea.performance ? PERF[idea.performance] : null;

  // Parse hook/format/time from description if stored there
  let hook = idea.hook || null;
  let fmt = idea.format || null;
  let timeToCreate = idea.time_to_create || null;
  let performance = idea.performance || null;

  return (
    <div className={`fu ${featured ? "" : "hover-lift"}`} style={{ animationDelay: `${delay}ms`, background: featured ? "var(--s1)" : "var(--s1)", border: featured ? "1px solid rgba(233,30,140,0.25)" : "1px solid var(--b)", borderRadius: "var(--r)", overflow: "hidden", boxShadow: featured ? "0 0 30px rgba(233,30,140,0.08)" : undefined }}>
      {featured && (
        <div style={{ height: 3, background: G }} />
      )}
      <div style={{ padding: featured ? "18px 20px" : "14px 16px" }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: featured ? 16 : 14, fontWeight: 600, color: "var(--t)" }}>{idea.title}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: expanded ? 14 : 0 }}>
              <Badge color={sc.color}>{sc.label}</Badge>
              {idea.difficulty && <Badge color={DIFF[idea.difficulty] || "#fbbf24"}>{idea.difficulty}</Badge>}
              {perf && <Badge color={perf.color}>{perf.icon} {idea.performance}</Badge>}
              {fmt && <Badge color="#94a3b8">{fmt}</Badge>}
              {timeToCreate && <Badge color="#64748b">⏱ {timeToCreate}</Badge>}
              {idea.date_scheduled && <span style={{ fontSize: 11, color: "var(--t3)", alignSelf: "center" }}>📅 {format(parseISO(idea.date_scheduled), "MMM d")}</span>}
              {idea.special_occasion && <span style={{ fontSize: 11, color: "var(--t3)", alignSelf: "center" }}>🎉 {idea.special_occasion}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
            {idea.status !== "used" && (
              <button onClick={() => onSave(idea)} title="Save to calendar" style={{ background: "var(--s2)", border: "1px solid var(--b)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "var(--t2)", transition: "all 0.15s" }}>📌</button>
            )}
            {idea.status !== "used" && (
              <button onClick={() => onMarkUsed(idea)} title="Mark as posted" style={{ background: "var(--s2)", border: "1px solid var(--b)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "var(--t2)", transition: "all 0.15s" }}>✓</button>
            )}
            {!featured && onToggle && (
              <button onClick={onToggle} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 16, padding: "4px 8px", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>›</button>
            )}
          </div>
        </div>

        {/* Expanded execution layer */}
        {(expanded || featured) && (
          <div className="sd" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {idea.description && (
              <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, margin: 0 }}>{idea.description}</p>
            )}
            {hook && (
              <div style={{ padding: "12px 14px", background: "rgba(124,58,237,0.08)", borderRadius: 10, border: "1px solid rgba(124,58,237,0.15)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#c4b5fd", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Hook</div>
                <p style={{ fontSize: 13, color: "var(--t)", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>"{hook}"</p>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {fmt && (
                <div style={{ flex: 1, minWidth: 120, padding: "10px 12px", background: "var(--s2)", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Format</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>🎬 {fmt}</div>
                </div>
              )}
              {timeToCreate && (
                <div style={{ flex: 1, minWidth: 120, padding: "10px 12px", background: "var(--s2)", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Time to create</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>⏱ {timeToCreate}</div>
                </div>
              )}
              {performance && (
                <div style={{ flex: 1, minWidth: 120, padding: "10px 12px", background: "var(--s2)", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Expected</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{PERF[performance]?.icon || "📊"} {performance}</div>
                </div>
              )}
            </div>
            {featured && idea.status !== "used" && (
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Btn onClick={() => onSave(idea)} variant="teal" size="sm">📌 Save to Schedule</Btn>
                <Btn onClick={() => onMarkUsed(idea)} variant="secondary" size="sm">✓ Mark as Posted</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE — Guided Generator (rebuilt from scratch)
// ═══════════════════════════════════════════════════════════════════════════════
const INTENTS = [
  { id: "viral",   label: "Viral Ideas",       desc: "Ideas optimised for maximum reach", icon: "🔥" },
  { id: "hooks",   label: "Hook Generator",    desc: "Scroll-stopping opening lines",     icon: "🎣" },
  { id: "plan",    label: "Content Plan",      desc: "Full 2-week posting calendar",      icon: "📅" },
  { id: "repurpose", label: "Repurpose Content", desc: "Turn one idea into many",          icon: "♻️" },
];

const OUTPUT_STYLES = [
  { id: "quick",    label: "Quick Ideas",       desc: "5 ideas, fast",          icon: "⚡" },
  { id: "detailed", label: "Detailed Breakdown", desc: "Full execution cards",   icon: "📋" },
  { id: "script",   label: "Script-Ready",      desc: "Full scripts to film",   icon: "🎬" },
];

function GenerateScreen() {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0); // 0=intent, 1=context, 2=style, 3=results
  const [intent, setIntent] = useState(null);
  const [outputStyle, setOutputStyle] = useState("detailed");
  const [customPrompt, setCustomPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [expandedIdx, setExpandedIdx] = useState(0);
  const [savedIds, setSavedIds] = useState([]);
  const { show, ToastContainer } = useToast();

  // Editable context (pre-filled from profile)
  const [editNiches, setEditNiches] = useState(profile?.niche?.join(", ") || "");
  const [editStyle, setEditStyle] = useState(profile?.style?.[0] || "");
  const [editPlatform, setEditPlatform] = useState("TikTok, Instagram");

  useEffect(() => {
    if (profile) {
      setEditNiches(profile.niche?.join(", ") || "");
      setEditStyle(profile.style?.[0] || "");
    }
  }, [profile]);

  const generate = async () => {
    setBusy(true);
    setResults([]);
    try {
      const intentLabel = INTENTS.find(i => i.id === intent)?.label || "content ideas";
      const styleLabel = OUTPUT_STYLES.find(s => s.id === outputStyle)?.label || "detailed";

      const systemPrompt = `You are Takto, an elite content strategist for UGC creators. You generate ${styleLabel.toLowerCase()} content strategies.
Return ONLY valid JSON. No markdown. No preamble.`;

      const userPrompt = intent === "hooks"
        ? `Generate 6 scroll-stopping hooks for a ${editNiches} creator on ${editPlatform}.
Style: ${editStyle}. Format: {"results":[{"hook":"","why":"why this works","format":"Talking Head / B-Roll etc","difficulty":"Easy|Medium|Hard"}]}`
        : intent === "repurpose"
        ? `Generate a repurposing strategy for a ${editNiches} creator.
Show how to turn ONE idea into 5 pieces of content across ${editPlatform}.
Format: {"results":[{"title":"","platform":"","format":"","hook":"","time_to_create":"","tip":""}]}`
        : `Generate 5 ${intentLabel.toLowerCase()} for:
- Niche: ${editNiches}
- Style: ${editStyle}
- Platforms: ${editPlatform}
- Output style: ${styleLabel}
${customPrompt ? `- Additional context: ${customPrompt}` : ""}

Format: {"results":[{"title":"","description":"","hook":"","format":"","time_to_create":"15 min|30 min|1-2 hrs","performance":"Quick Win|High Potential|Trending|Evergreen","difficulty":"Easy|Medium|Hard","tip":"one actionable tip to make this better"}]}`;

      const text = await callClaude(systemPrompt, userPrompt, 2500);
      const { results: parsed } = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResults(parsed || []);
      setStep(3);
      setExpandedIdx(0);
    } catch (err) { show("Error: " + (err?.message || String(err))); }
    setBusy(false);
  };

  const saveIdea = async (result) => {
    if (!user) return;
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    const { data } = await supabase.from("content_ideas").insert({
      user_id: user.id,
      title: result.title || result.hook,
      description: result.description || result.why || "",
      date_scheduled: tomorrow,
      difficulty: result.difficulty || "Medium",
      status: "saved",
    }).select().single();
    if (data) {
      setSavedIds(p => [...p, result.title || result.hook]);
      show("💡 Saved to Ideas tab!", "success");
    }
  };

  const reset = () => { setStep(0); setResults([]); setSavedIds([]); setIntent(null); };

  return (
    <div style={{ padding: "24px 20px 32px", maxWidth: 720, margin: "0 auto" }}>
      <ToastContainer />

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, marginBottom: 3 }}>Generate</h1>
        <p style={{ color: "var(--t2)", fontSize: 13 }}>Your guided content creation system</p>
      </div>

      {/* Progress steps */}
      {step < 3 && (
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
          {["Intent", "Context", "Style", "Output"].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : undefined }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: i <= step ? G : "var(--s2)", color: i <= step ? "#fff" : "var(--t3)", border: i === step ? "none" : `1px solid ${i < step ? "transparent" : "var(--b)"}` }}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 10, color: i === step ? "var(--t)" : "var(--t3)", fontWeight: i === step ? 600 : 400 }}>{s}</span>
              </div>
              {i < 3 && <div style={{ flex: 1, height: 1, background: i < step ? "var(--p)" : "var(--b)", margin: "0 4px", marginBottom: 16 }} />}
            </div>
          ))}
        </div>
      )}

      {/* Step 0: Intent */}
      {step === 0 && (
        <div className="fi">
          <h2 style={{ fontSize: 19, marginBottom: 6 }}>What do you want?</h2>
          <p style={{ color: "var(--t2)", fontSize: 14, marginBottom: 20 }}>Choose your generation goal</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginBottom: 20 }}>
            {INTENTS.map(item => (
              <button key={item.id} onClick={() => setIntent(item.id)} style={{
                display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", textAlign: "left",
                background: intent === item.id ? "rgba(124,58,237,0.12)" : "var(--s1)",
                border: `1.5px solid ${intent === item.id ? "var(--p)" : "var(--b)"}`,
                borderRadius: "var(--r)", cursor: "pointer", fontFamily: "var(--inter)", transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t)", marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: "var(--t2)" }}>{item.desc}</div>
                </div>
                {intent === item.id && <svg style={{ marginLeft: "auto", flexShrink: 0, marginTop: 2 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
          <Btn onClick={() => setStep(1)} disabled={!intent} fullWidth>Continue →</Btn>
        </div>
      )}

      {/* Step 1: Context */}
      {step === 1 && (
        <div className="fi">
          <h2 style={{ fontSize: 19, marginBottom: 6 }}>Your context</h2>
          <p style={{ color: "var(--t2)", fontSize: 14, marginBottom: 20 }}>Pre-filled from your profile — edit if needed</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Niches</label>
              <input value={editNiches} onChange={e => setEditNiches(e.target.value)} placeholder="e.g. Fitness, Health & Wellness" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Content Style</label>
              <input value={editStyle} onChange={e => setEditStyle(e.target.value)} placeholder="e.g. Tutorial/Educational" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Platforms</label>
              <input value={editPlatform} onChange={e => setEditPlatform(e.target.value)} placeholder="e.g. TikTok, Instagram, YouTube" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Additional context (optional)</label>
              <input value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="e.g. trending sounds, upcoming holiday..." />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setStep(0)} variant="secondary">← Back</Btn>
            <Btn onClick={() => setStep(2)} style={{ flex: 1 }}>Continue →</Btn>
          </div>
        </div>
      )}

      {/* Step 2: Output style */}
      {step === 2 && (
        <div className="fi">
          <h2 style={{ fontSize: 19, marginBottom: 6 }}>Output style</h2>
          <p style={{ color: "var(--t2)", fontSize: 14, marginBottom: 20 }}>How detailed do you want the results?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {OUTPUT_STYLES.map(s => (
              <button key={s.id} onClick={() => setOutputStyle(s.id)} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                background: outputStyle === s.id ? "rgba(124,58,237,0.12)" : "var(--s1)",
                border: `1.5px solid ${outputStyle === s.id ? "var(--p)" : "var(--b)"}`,
                borderRadius: "var(--r)", cursor: "pointer", textAlign: "left", fontFamily: "var(--inter)", color: "var(--t)", transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "var(--t2)" }}>{s.desc}</div>
                </div>
                {outputStyle === s.id && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setStep(1)} variant="secondary">← Back</Btn>
            <Btn onClick={generate} disabled={busy} style={{ flex: 1 }}>
              {busy ? <><Spinner size={14} /> Generating...</> : "✨ Generate"}
            </Btn>
          </div>
          {busy && (
            <div style={{ marginTop: 20, padding: 16, background: "var(--s1)", borderRadius: "var(--r)", border: "1px solid var(--b)", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 8 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--p)", animation: "blink 1.2s ease infinite", animationDelay: `${i*0.2}s` }} />)}
              </div>
              <p style={{ color: "var(--t2)", fontSize: 13 }}>Crafting your content strategy...</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && results.length > 0 && (
        <div className="fi">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 19, marginBottom: 2 }}>Your results ✨</h2>
              <p style={{ color: "var(--t2)", fontSize: 13 }}>{results.length} ideas generated · tap to expand</p>
            </div>
            <Btn onClick={reset} variant="secondary" size="sm">New Generation</Btn>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {results.map((result, i) => {
              const isExpanded = expandedIdx === i;
              const title = result.title || result.hook;
              const isSaved = savedIds.includes(title);
              const PERF = { "Quick Win": { color: "#34d399", icon: "⚡" }, "High Potential": { color: "#c4b5fd", icon: "🚀" }, "Trending": { color: "#e91e8c", icon: "🔥" }, "Evergreen": { color: "#60a5fa", icon: "🌲" } };
              const DIFF = { Easy: "#34d399", Medium: "#fbbf24", Hard: "#f87171" };

              return (
                <div key={i} className="fu" style={{ animationDelay: `${i * 60}ms`, background: "var(--s1)", border: `1px solid ${isExpanded ? "rgba(124,58,237,0.3)" : "var(--b)"}`, borderRadius: "var(--r)", overflow: "hidden", transition: "border-color 0.2s" }}>
                  {isExpanded && <div style={{ height: 2, background: G }} />}
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{title}</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {result.difficulty && <Badge color={DIFF[result.difficulty] || "#fbbf24"}>{result.difficulty}</Badge>}
                          {result.performance && <Badge color={PERF[result.performance]?.color || "#c4b5fd"}>{PERF[result.performance]?.icon} {result.performance}</Badge>}
                          {result.format && <Badge color="#64748b">{result.format}</Badge>}
                          {result.time_to_create && <Badge color="#475569">⏱ {result.time_to_create}</Badge>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {!isSaved && (
                          <button onClick={() => saveIdea(result)} style={{ background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#00d4aa", fontFamily: "var(--inter)", fontWeight: 500 }}>
                            + Save
                          </button>
                        )}
                        {isSaved && <Badge color="#34d399">✓ Saved</Badge>}
                        <button onClick={() => setExpandedIdx(isExpanded ? null : i)} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 18, padding: "2px 6px", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>›</button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="sd" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                        {result.description && <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, margin: 0 }}>{result.description}</p>}
                        {result.hook && (
                          <div style={{ padding: "12px 14px", background: "rgba(124,58,237,0.08)", borderRadius: 10, border: "1px solid rgba(124,58,237,0.15)" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#c4b5fd", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Hook</div>
                            <p style={{ fontSize: 13, color: "var(--t)", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>"{result.hook}"</p>
                          </div>
                        )}
                        {result.why && (
                          <div style={{ padding: "12px 14px", background: "rgba(0,212,170,0.06)", borderRadius: 10, border: "1px solid rgba(0,212,170,0.12)" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#00d4aa", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Why it works</div>
                            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5, margin: 0 }}>{result.why}</p>
                          </div>
                        )}
                        {result.tip && (
                          <div style={{ padding: "12px 14px", background: "rgba(233,30,140,0.06)", borderRadius: 10, border: "1px solid rgba(233,30,140,0.12)" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#e91e8c", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pro tip</div>
                            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5, margin: 0 }}>{result.tip}</p>
                          </div>
                        )}
                        {(result.platform || result.format) && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {result.platform && <div style={{ flex: 1, minWidth: 100, padding: "10px 12px", background: "var(--s2)", borderRadius: 10 }}><div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Platform</div><div style={{ fontSize: 13, fontWeight: 500 }}>📱 {result.platform}</div></div>}
                            {result.format && <div style={{ flex: 1, minWidth: 100, padding: "10px 12px", background: "var(--s2)", borderRadius: 10 }}><div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Format</div><div style={{ fontSize: 13, fontWeight: 500 }}>🎬 {result.format}</div></div>}
                            {result.time_to_create && <div style={{ flex: 1, minWidth: 100, padding: "10px 12px", background: "var(--s2)", borderRadius: 10 }}><div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Time</div><div style={{ fontSize: 13, fontWeight: 500 }}>⏱ {result.time_to_create}</div></div>}
                          </div>
                        )}
                        {!isSaved && (
                          <Btn onClick={() => saveIdea(result)} variant="teal" size="sm" style={{ alignSelf: "flex-start" }}>💡 Save to Ideas Tab</Btn>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, padding: 16, background: "var(--s1)", borderRadius: "var(--r)", border: "1px solid var(--b)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Save all to Ideas</div>
              <div style={{ fontSize: 12, color: "var(--t2)" }}>Add all {results.length} ideas to your Ideas tab at once</div>
            </div>
            <Btn onClick={() => results.forEach(r => !savedIds.includes(r.title || r.hook) && saveIdea(r))} variant="primary" size="sm">
              💾 Save All
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORE — Strategy Mining
// ═══════════════════════════════════════════════════════════════════════════════
const CREATORS = [
  { name: "GlowByLuna", handle: "@glowbyluna", niche: "Beauty & Makeup", followers: "1.2M", desc: "Skincare tutorials with clinical breakdowns and honest product reviews.", pattern: "3x weekly: 1 tutorial, 1 review, 1 trend reaction", why: "Builds trust through education — audience sees her as the expert friend", grad: "135deg,#f093fb,#f5576c", stealFormat: "Tutorial/Educational" },
  { name: "FitWithSam", handle: "@fitwithsam", niche: "Fitness & Workouts", followers: "890K", desc: "60-second form guides and transformation content that actually delivers.", pattern: "Before/after transformations + daily form tips + myth-busting", why: "Combines aspiration with education — people share because it validates their journey", grad: "135deg,#4facfe,#00f2fe", stealFormat: "Tutorial/Educational" },
  { name: "TechTara", handle: "@techtara", niche: "Tech & Gadgets", followers: "670K", desc: "Brutally honest gadget reviews with no sponsored bias.", pattern: "Unpacking + 48hr test + honest verdict format", why: "Authenticity in a sponsored world. Builds loyal audience who trust her word over ads", grad: "135deg,#43e97b,#38f9d7", stealFormat: "Review/Reaction" },
  { name: "WanderNova", handle: "@wandernova", niche: "Travel & Adventure", followers: "540K", desc: "Hidden gems and budget travel hacks from 47 countries.", pattern: "Hidden gem reveals + budget breakdowns + travel fails", why: "Exclusivity + aspiration. People share 'hidden gems' to look well-travelled", grad: "135deg,#fa709a,#fee140", stealFormat: "Storytime/Narration" },
  { name: "ChefMiko", handle: "@chefmiko", niche: "Food & Cooking", followers: "980K", desc: "Restaurant-quality techniques for home cooks under 3 mins.", pattern: "Pro technique simplified + visual transformation + taste reaction", why: "Instant gratification loop — watch, cook tonight, feel like a pro", grad: "135deg,#f6d365,#fda085", stealFormat: "Tutorial/Educational" },
  { name: "StyleByAria", handle: "@stylebyaria", niche: "Fashion & Style", followers: "420K", desc: "Behind-the-scenes of styling, brand deals and the creative process.", pattern: "BTS content + outfit builds + brand deal transparency", why: "Demystifies the 'perfect' influencer life — relatable authenticity wins", grad: "135deg,#a18cd1,#fbc2eb", stealFormat: "Personal Brand/Influencer" },
  { name: "GameOnMax", handle: "@gameonmax", niche: "Gaming", followers: "760K", desc: "Viral gaming commentary and relatable rage compilations.", pattern: "Rage clips + commentary + challenge duets", why: "Emotional peaks (rage, triumph) get shared — community tags friends in the chaos", grad: "135deg,#84fab0,#8fd3f4", stealFormat: "Comedy/Skit" },
  { name: "HustleHannah", handle: "@hustlehannah", niche: "Side Hustles", followers: "550K", desc: "Real side hustle breakdowns with actual income proof.", pattern: "Income reveal → how I did it → your first step", why: "Curiosity gap + aspiration. The income reveal hooks, the how-to retains", grad: "135deg,#30cfd0,#330867", stealFormat: "Tutorial/Educational" },
  { name: "LifeWithJay", handle: "@lifewithjay", niche: "Health & Wellness", followers: "310K", desc: "Slow living, mindfulness and morning routines for busy people.", pattern: "Morning routine POV + stress tip + mindset quote", why: "Wish fulfilment — people aspire to the calm life. Saves = bookmarks for future self", grad: "135deg,#fccb90,#d57eeb", stealFormat: "Aesthetic/Mood-Based" },
];

const NICHE_FILTERS = ["All", ...new Set(CREATORS.map(c => c.niche))];

function ExploreScreen() {
  const { user, profile } = useAuth();
  const [filter, setFilter] = useState("All");
  const [saved, setSaved] = useState([]);
  const [stealing, setStealing] = useState(null);
  const { show, ToastContainer } = useToast();

  const filtered = filter === "All" ? CREATORS : CREATORS.filter(c => c.niche === filter);

  const stealStrategy = async (creator) => {
    if (!user || !profile) return show("Sign in to use this feature");
    setStealing(creator.name);
    try {
      const text = await callClaude(
        "You are a content strategist. Return ONLY valid JSON.",
        `Generate 3 content ideas in the style of ${creator.name} (${creator.niche}) for a creator with:
- Niches: ${profile.niche?.join(", ")}
- Styles: ${profile.style?.join(", ")}
Content pattern to steal: "${creator.pattern}"
Why it works: "${creator.why}"

Adapt their strategy to the user's niche. JSON: {"ideas":[{"title":"","description":"","hook":"","format":"","difficulty":"Easy|Medium|Hard"}]}`
      );
      const { ideas } = JSON.parse(text.replace(/```json|```/g, "").trim());
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
      for (const idea of ideas) {
        await supabase.from("content_ideas").insert({
          user_id: user.id, title: idea.title, description: idea.description,
          date_scheduled: tomorrow, difficulty: idea.difficulty || "Medium", status: "pending",
        });
      }
      show(`🎯 Stole ${ideas.length} ideas from ${creator.name}'s strategy!`, "success");
    } catch (err) { show("Error: " + err.message); }
    setStealing(null);
  };

  return (
    <div style={{ padding: "24px 20px 32px" }}>
      <ToastContainer />
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, marginBottom: 3 }}>Explore</h1>
        <p style={{ color: "var(--t2)", fontSize: 13 }}>Mine successful creator strategies — then steal them for your niche</p>
      </div>

      <div className="sx" style={{ marginBottom: 22, paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: 7, minWidth: "max-content" }}>
          {NICHE_FILTERS.map(n => (
            <button key={n} onClick={() => setFilter(n)} style={{ padding: "7px 14px", borderRadius: 50, fontSize: 12, fontWeight: 500, background: filter === n ? G : "var(--s1)", border: `1px solid ${filter === n ? "transparent" : "var(--b)"}`, color: filter === n ? "#fff" : "var(--t2)", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--inter)" }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {filtered.map((c, i) => (
          <Card key={c.name} className="fu hover-lift" style={{ overflow: "hidden", animationDelay: `${i * 45}ms` }}>
            <div style={{ height: 6, background: `linear-gradient(${c.grad})` }} />
            <div style={{ padding: "16px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(${c.grad})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif", flexShrink: 0 }}>{c.name[0]}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)" }}>{c.handle} · {c.followers}</div>
                  </div>
                </div>
                <button onClick={() => setSaved(p => p.includes(c.name) ? p.filter(x => x !== c.name) : [...p, c.name])} style={{ background: "var(--s2)", border: "1px solid var(--b)", borderRadius: 8, padding: 7, cursor: "pointer" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={saved.includes(c.name) ? "#e91e8c" : "none"} stroke={saved.includes(c.name) ? "#e91e8c" : "var(--t3)"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </button>
              </div>

              {/* Niche badge */}
              <Badge color="#7c3aed" style={{ marginBottom: 10, display: "inline-block" }}>{c.niche}</Badge>

              {/* Why they grow */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Why they grow</div>
                <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, margin: 0 }}>{c.why}</p>
              </div>

              {/* Content pattern */}
              <div style={{ padding: "10px 12px", background: "var(--s2)", borderRadius: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Content Pattern</div>
                <p style={{ fontSize: 12, color: "var(--t)", lineHeight: 1.5, margin: 0 }}>{c.pattern}</p>
              </div>

              {/* Steal this format button */}
              <button
                onClick={() => stealStrategy(c)}
                disabled={stealing === c.name}
                style={{
                  width: "100%", padding: "10px 16px", background: G, border: "none",
                  borderRadius: 50, color: "#fff", fontSize: 13, fontWeight: 600,
                  cursor: stealing === c.name ? "not-allowed" : "pointer",
                  fontFamily: "var(--inter)", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6, opacity: stealing === c.name ? 0.7 : 1,
                  boxShadow: "0 2px 12px rgba(124,58,237,0.25)",
                }}
              >
                {stealing === c.name ? <><Spinner size={12} /> Generating...</> : "🎯 Steal This Strategy"}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════
function CalendarScreen() {
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date());
  const [ideas, setIdeas] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [selected, setSelected] = useState(null);
  const { show, ToastContainer } = useToast();

  const fetchIdeas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("content_ideas").select("id,title,status,date_scheduled,difficulty").eq("user_id", user.id).not("date_scheduled", "is", null);
    if (data) setIdeas(data);
  }, [user]);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  const drop = async (ds) => {
    if (!dragId) return;
    await supabase.from("content_ideas").update({ date_scheduled: ds }).eq("id", dragId);
    setIdeas(p => p.map(i => i.id === dragId ? { ...i, date_scheduled: ds } : i));
    show(`📅 Moved to ${format(parseISO(ds), "MMM d")}`, "success");
    setDragId(null);
  };

  const days = [];
  let d = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  while (d <= endOfWeek(endOfMonth(month), { weekStartsOn: 1 })) { days.push(d); d = addDays(d, 1); }
  const selIdeas = selected ? ideas.filter(i => i.date_scheduled === format(selected, "yyyy-MM-dd")) : [];
  const STATUS = { pending: "#fbbf24", saved: "#60a5fa", used: "#34d399" };

  return (
    <div style={{ padding: "24px 20px 32px", maxWidth: 820, margin: "0 auto" }}>
      <ToastContainer />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 3 }}>Schedule</h1>
          <p style={{ color: "var(--t2)", fontSize: 13 }}>Drag ideas to reschedule · click a day to see details</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setMonth(subMonths(month, 1))} style={{ background: "var(--s1)", border: "1px solid var(--b)", borderRadius: 9, padding: "7px 11px", color: "var(--t)", cursor: "pointer", fontSize: 15 }}>‹</button>
          <span style={{ fontWeight: 600, minWidth: 130, textAlign: "center", fontSize: 14 }}>{format(month, "MMMM yyyy")}</span>
          <button onClick={() => setMonth(addMonths(month, 1))} style={{ background: "var(--s1)", border: "1px solid var(--b)", borderRadius: 9, padding: "7px 11px", color: "var(--t)", cursor: "pointer", fontSize: 15 }}>›</button>
        </div>
      </div>

      <Card>
        <div style={{ padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, color: "var(--t3)", padding: "4px 0", fontWeight: 600 }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {days.map(day => {
              const ds = format(day, "yyyy-MM-dd");
              const dayIdeas = ideas.filter(i => i.date_scheduled === ds);
              const isToday = isSameDay(day, new Date());
              const isSel = selected && isSameDay(day, selected);
              const inMonth = isSameMonth(day, month);
              return (
                <div key={ds} onClick={() => setSelected(isSel ? null : day)} onDragOver={e => e.preventDefault()} onDrop={() => drop(ds)}
                  style={{ minHeight: 64, borderRadius: 10, padding: 6, cursor: "pointer", background: isSel ? "rgba(124,58,237,0.18)" : isToday ? "rgba(124,58,237,0.07)" : "transparent", border: `1px solid ${isSel ? "var(--p)" : isToday ? "rgba(124,58,237,0.3)" : "var(--b)"}`, opacity: inMonth ? 1 : 0.25, transition: "all 0.12s" }}>
                  <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? "#c4b5fd" : "var(--t2)", marginBottom: 4 }}>{format(day, "d")}</div>
                  {dayIdeas.slice(0, 3).map(idea => (
                    <div key={idea.id} draggable onDragStart={e => { e.stopPropagation(); setDragId(idea.id); }} onClick={e => e.stopPropagation()}
                      style={{ fontSize: 9, padding: "2px 4px", borderRadius: 4, marginBottom: 2, background: STATUS[idea.status] + "22", color: STATUS[idea.status], border: `1px solid ${STATUS[idea.status]}33`, cursor: "grab", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>
                      {idea.title}
                    </div>
                  ))}
                  {dayIdeas.length > 3 && <div style={{ fontSize: 8, color: "var(--t3)" }}>+{dayIdeas.length - 3}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {selected && (
        <Card className="fu" style={{ marginTop: 14, padding: 18 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>
            {format(selected, "EEEE, MMMM d")}
            <span style={{ color: "var(--t3)", fontWeight: 400, fontSize: 13 }}> · {selIdeas.length > 0 ? `${selIdeas.length} idea${selIdeas.length > 1 ? "s" : ""}` : "Free day"}</span>
          </h3>
          {selIdeas.length === 0
            ? <p style={{ color: "var(--t3)", fontSize: 13 }}>No ideas scheduled. Drag one here from another day.</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selIdeas.map(idea => (
                  <div key={idea.id} style={{ padding: "12px 14px", background: "var(--s2)", borderRadius: 10, border: "1px solid var(--b)", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS[idea.status] || "#fbbf24", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{idea.title}</div>{idea.difficulty && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{idea.difficulty}</div>}</div>
                    <Badge color={STATUS[idea.status] || "#fbbf24"}>{idea.status}</Badge>
                  </div>
                ))}
              </div>
          }
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════════════════════
function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [niches, setNiches] = useState([]);
  const [styles, setStyles] = useState([]);
  const [freq, setFreq] = useState("3x a week");
  const [notifs, setNotifs] = useState(true);
  const [saving, setSaving] = useState(false);
  const { show, ToastContainer } = useToast();

  useEffect(() => {
    if (profile) {
      setNiches(profile.niche || []);
      setStyles(profile.style || []);
      setFreq(profile.posting_frequency || "3x a week");
      setNotifs(profile.notifications_enabled ?? true);
    }
  }, [profile]);

  const save = async () => {
    setSaving(true);
    await supabase.from("profiles").update({ niche: niches, style: styles, posting_frequency: freq, notifications_enabled: notifs }).eq("user_id", user.id);
    await refreshProfile();
    setEditing(false);
    show("Profile updated ✓", "success");
    setSaving(false);
  };

  const lbl = (txt) => <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{txt}</div>;

  return (
    <div style={{ padding: "24px 20px 40px", maxWidth: 580, margin: "0 auto" }}>
      <ToastContainer />
      <h1 style={{ fontSize: 24, marginBottom: 22 }}>Profile</h1>

      <Card style={{ padding: 20, marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif", flexShrink: 0 }}>{user?.email?.[0]?.toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{user?.email}</div>
          <div style={{ fontSize: 12, color: "var(--t3)" }}>{profile?.posting_frequency || "—"} · {profile?.niche?.length || 0} niches</div>
        </div>
      </Card>

      <Card style={{ padding: 22, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 15 }}>Creator Settings</h2>
          {!editing
            ? <Btn onClick={() => setEditing(true)} variant="secondary" size="sm">Edit</Btn>
            : <div style={{ display: "flex", gap: 8 }}><Btn onClick={() => setEditing(false)} variant="ghost" size="sm">Cancel</Btn><Btn onClick={save} disabled={saving} size="sm">{saving && <Spinner size={12} />} Save</Btn></div>
          }
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            {lbl("Niches")}
            {editing
              ? <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{NICHES.map(n => <Chip key={n.label} label={n.label} icon={n.icon} selected={niches.includes(n.label)} onClick={() => setNiches(p => p.includes(n.label) ? p.filter(x => x !== n.label) : [...p, n.label])} />)}</div>
              : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(profile?.niche || []).map(n => <span key={n} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 50, background: "var(--s2)", color: "var(--t2)", border: "1px solid var(--b)" }}>{n}</span>)}</div>
            }
          </div>
          <div>
            {lbl("Content Styles")}
            {editing
              ? <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{STYLES.map(s => <Chip key={s.label} label={s.label} icon={s.icon} selected={styles.includes(s.label)} onClick={() => setStyles(p => p.includes(s.label) ? p.filter(x => x !== s.label) : [...p, s.label])} />)}</div>
              : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(profile?.style || []).map(s => <span key={s} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 50, background: "var(--s2)", color: "var(--t2)", border: "1px solid var(--b)" }}>{s}</span>)}</div>
            }
          </div>
          <div>
            {lbl("Posting Frequency")}
            {editing
              ? <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{FREQS.map(f => <Chip key={f.value} label={f.label} selected={freq === f.value} onClick={() => setFreq(f.value)} />)}</div>
              : <span style={{ fontSize: 13, color: "var(--t2)" }}>{profile?.posting_frequency || "—"}</span>
            }
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid var(--b)" }}>
            <div><div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>Posting reminders</div><div style={{ fontSize: 12, color: "var(--t3)" }}>Get notified on your posting days</div></div>
            <Toggle value={notifs} onChange={editing ? setNotifs : () => {}} />
          </div>
        </div>
      </Card>

      <Btn onClick={signOut} variant="danger" fullWidth>Sign Out</Btn>
      <p style={{ textAlign: "center", fontSize: 11, color: "var(--t3)", marginTop: 14 }}>Takto · Your Content OS ✨</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
function AppContent() {
  const { user, profile, loading } = useAuth();
  const { path, navigate } = useRoute();

  useEffect(() => {
    if (loading) return;
    if (!user) { if (path !== "/auth") navigate("/auth"); return; }
    if (profile && !profile.onboarding_completed && path !== "/onboarding") { navigate("/onboarding"); return; }
    if (profile?.onboarding_completed && (path === "/" || path === "/auth" || path === "/onboarding")) navigate("/dashboard");
  }, [user, profile, loading, path]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 20, padding: 24, textAlign: "center" }}>
        <TaktoLogo size={24} />
        <Spinner size={24} />
        {(!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) && (
          <div style={{ marginTop: 8, padding: "14px 20px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, maxWidth: 400 }}>
            <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Missing environment variables</p>
            <p style={{ color: "rgba(248,113,113,0.8)", fontSize: 12 }}>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.</p>
          </div>
        )}
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  if (profile && !profile.onboarding_completed) return <OnboardingScreen navigate={navigate} />;
  if (path === "/auth" || path === "/" || path === "/onboarding") { navigate("/dashboard"); return null; }

  const screens = {
    "/dashboard": <DashboardScreen />,
    "/generate":  <GenerateScreen />,
    "/explore":   <ExploreScreen />,
    "/calendar":  <CalendarScreen />,
    "/profile":   <ProfileScreen />,
  };
  return <AppShell path={path} navigate={navigate}>{screens[path] || <DashboardScreen />}</AppShell>;
}

export default function App() {
  return <><GlobalStyles /><AuthProvider><AppContent /></AuthProvider></>;
}
