import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, isSameMonth, isSameDay, parseISO,
} from "date-fns";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

// ─── Claude proxy ─────────────────────────────────────────────────────────────
async function callClaude(system, userPrompt) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 1500,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data.content?.[0]?.text || "";
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const G = "linear-gradient(135deg, #00d4aa 0%, #7c3aed 45%, #e91e8c 100%)";

// ─── Global CSS ───────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a0f; --s1: #13131a; --s2: #1a1a24; --s3: #22222f;
    --b: rgba(255,255,255,0.08); --t: #f0f0f8; --t2: rgba(240,240,248,0.6);
    --t3: rgba(240,240,248,0.35); --p: #7c3aed; --teal: #00d4aa; --pink: #e91e8c;
    --r: 16px; --rs: 10px; --nh: 68px;
  }
  html, body, #root { height: 100%; }
  body { background: var(--bg); color: var(--t); font-family: 'DM Sans', sans-serif; font-size: 15px; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  h1, h2, h3 { font-family: 'Syne', sans-serif; font-weight: 700; line-height: 1.2; }
  input { background: var(--s2); border: 1px solid var(--b); border-radius: var(--rs); color: var(--t); font-family: 'DM Sans', sans-serif; font-size: 15px; outline: none; padding: 12px 16px; width: 100%; transition: border-color 0.2s; -webkit-appearance: none; }
  input:focus { border-color: var(--p); box-shadow: 0 0 0 3px rgba(124,58,237,0.15); }
  input::placeholder { color: var(--t3); }
  button { cursor: pointer; font-family: 'DM Sans', sans-serif; border: none; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  .fu { animation: fadeUp 0.35s ease both; }
  .fi { animation: fadeIn 0.25s ease both; }
  .sx { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .sx::-webkit-scrollbar { display: none; }
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
      // create profile if missing
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
    setUser(null);
    setProfile(null);
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
  const navigate = (to) => {
    window.location.hash = to;
    setPath(to);
  };
  return { path, navigate };
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg) => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  const ToastContainer = () => (
    <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 9999, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} className="fu" style={{ background: "var(--s2)", border: "1px solid var(--b)", borderRadius: 50, padding: "11px 20px", fontSize: 13, fontWeight: 500, color: "var(--t)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", maxWidth: "90vw", textAlign: "center" }}>{t.msg}</div>
      ))}
    </div>
  );
  return { show, ToastContainer };
}

// ─── UI primitives ────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", size = "md", disabled, style: sx, type = "button", fullWidth }) {
  const pad = size === "sm" ? "8px 18px" : size === "lg" ? "15px 34px" : "11px 26px";
  const fs = size === "sm" ? 13 : 14;
  const v = {
    primary:   { background: G, color: "#fff", boxShadow: disabled ? "none" : "0 4px 18px rgba(124,58,237,0.35)" },
    secondary: { background: "var(--s2)", color: "var(--t)", border: "1px solid var(--b)" },
    ghost:     { background: "transparent", color: "var(--t2)" },
    danger:    { background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" },
    outline:   { background: "transparent", color: "var(--t)", border: "1px solid var(--b)" },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: pad, fontSize: fs, fontWeight: 600, borderRadius: 50, border: "none", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "opacity 0.2s", width: fullWidth ? "100%" : undefined, fontFamily: "'DM Sans',sans-serif", ...v[variant], ...sx }}>
      {children}
    </button>
  );
}

function Chip({ label, selected, onClick, icon }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 50, fontSize: 13, fontWeight: 500, border: `1.5px solid ${selected ? "var(--p)" : "var(--b)"}`, background: selected ? "rgba(124,58,237,0.18)" : "var(--s2)", color: selected ? "#c4b5fd" : "var(--t2)", cursor: "pointer", transition: "all 0.15s", fontFamily: "'DM Sans',sans-serif" }}>
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {label}
    </button>
  );
}

function Card({ children, style: sx, className, onClick }) {
  return <div className={className} onClick={onClick} style={{ background: "var(--s1)", border: "1px solid var(--b)", borderRadius: "var(--r)", ...sx }}>{children}</div>;
}

function Spinner({ size = 20 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", border: "2px solid var(--b)", borderTopColor: "var(--p)", animation: "spin 0.65s linear infinite", flexShrink: 0 }} />;
}

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{ width: 46, height: 26, borderRadius: 13, border: "none", background: value ? G : "var(--s3)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
    </button>
  );
}

const TAKTO_PATH = "M180.622 16.0533C164.259 16.0533 157.243 22.6453 157.243 38.0266C157.243 53.408 164.259 60 180.622 60C196.985 60 204 53.408 204 38.0266C204 22.6453 196.985 16.0533 180.622 16.0533ZM180.622 49.0133C174.782 49.0133 172.27 45.7173 172.27 38.0266C172.27 30.336 174.773 27.04 180.622 27.04C186.471 27.04 188.974 30.336 188.974 38.0266C188.974 45.7173 186.471 49.0133 180.622 49.0133ZM144.504 16.8977H156.194V26.1955H144.504V43.9376C144.504 46.4709 146.173 48.1598 148.676 48.1598H156.194V59.1465H142.836C134.484 59.1465 129.478 54.0799 129.478 45.6265V26.1955H121.323L113.635 37.1822L129.496 59.1556H111.967L97.7747 38.4534V59.1556H82.7483V0H97.7747V35.8293L110.298 16.8977H129.478V5.91102H144.504V16.8977ZM58.7778 16.0533C44.7562 16.0533 38.7456 20.112 38.7456 29.5732H52.9377C52.9377 26.023 54.5256 24.5067 58.2844 24.5067C62.0433 24.5067 63.7926 26.2772 63.7926 30.4177V32.1065H57.9525C43.3388 32.1065 37.077 36.4195 37.077 46.4709C37.077 55.9322 41.5894 59.9909 52.1034 59.9909C58.5356 59.9909 62.2855 57.1217 63.7926 50.6931L67.1298 59.1465H78.819V32.1065C78.819 20.8656 72.8084 16.0533 58.7778 16.0533ZM63.7926 42.2488C63.7926 47.5696 61.7921 49.8577 57.1092 49.8577C53.6016 49.8577 52.1034 48.8408 52.1034 45.6356C52.1034 41.7494 54.3551 40.569 59.6211 40.569H63.7926V42.2579V42.2488ZM50.0939 12.6755H33.3989V59.1556H16.704V12.6755H0V0H50.0939V12.6755Z";

function TaktoLogo({ size = 26 }) {
  // Scale the 204x60 SVG to desired size
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
  { path: "/explore",   label: "Explore",  icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?"url(#g)":"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><defs><linearGradient id="g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#00d4aa"/><stop offset="1" stopColor="#e91e8c"/></linearGradient></defs><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg> },
  { path: "/generate",  label: "Generate", icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?"url(#g2)":"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><defs><linearGradient id="g2" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#00d4aa"/><stop offset="1" stopColor="#e91e8c"/></linearGradient></defs><path d="M12 2l2.4 7.4L22 12l-7.6 2.6L12 22l-2.4-7.4L2 12l7.6-2.6L12 2z"/></svg> },
  { path: "/dashboard", label: "Ideas",    icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?"url(#g3)":"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><defs><linearGradient id="g3" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#00d4aa"/><stop offset="1" stopColor="#e91e8c"/></linearGradient></defs><path d="M9 21h6"/><path d="M12 3a6 6 0 0 1 6 6c0 2.2-1.2 4.1-3 5.2V17H9v-2.8C7.2 13.1 6 11.2 6 9a6 6 0 0 1 6-6z"/></svg> },
  { path: "/calendar",  label: "Schedule", icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?"url(#g4)":"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><defs><linearGradient id="g4" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#00d4aa"/><stop offset="1" stopColor="#e91e8c"/></linearGradient></defs><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { path: "/profile",   label: "Profile",  icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?"url(#g5)":"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><defs><linearGradient id="g5" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#00d4aa"/><stop offset="1" stopColor="#e91e8c"/></linearGradient></defs><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
];

function BottomNav({ path, navigate }) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "var(--nh)", background: "rgba(10,10,15,0.96)", borderTop: "1px solid var(--b)", backdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 100, paddingBottom: "max(4px,env(safe-area-inset-bottom))" }}>
      {NAV.map(item => {
        const active = path === item.path;
        return (
          <button key={item.path} onClick={() => navigate(item.path)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", color: active ? "var(--teal)" : "var(--t3)", fontSize: 10, fontWeight: active ? 600 : 400, padding: "8px 10px", minWidth: 52, fontFamily: "'DM Sans',sans-serif" }}>
            {item.icon(active)}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Sidebar({ path, navigate, signOut, profile }) {
  return (
    <aside style={{ width: 216, flexShrink: 0, background: "var(--s1)", borderRight: "1px solid var(--b)", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: "22px 18px 14px" }}><TaktoLogo size={20} /></div>
      <nav style={{ flex: 1, padding: "4px 10px" }}>
        {NAV.map(item => {
          const active = path === item.path;
          return (
            <button key={item.path} onClick={() => navigate(item.path)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "10px 12px", borderRadius: 11, marginBottom: 2, background: active ? "rgba(124,58,237,0.14)" : "transparent", border: "none", color: active ? "#c4b5fd" : "var(--t2)", fontSize: 14, fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", textAlign: "left" }}>
              {item.icon(active)}
              {item.label}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "12px 10px", borderTop: "1px solid var(--b)" }}>
        {profile?.niche?.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6, padding: "0 4px" }}>{profile.niche.slice(0, 2).join(" · ")}</div>
        )}
        <button onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", borderRadius: 11, background: "transparent", border: "none", color: "var(--t3)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
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
function AuthScreen({ navigate }) {
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

  // Figma-exact styles
  const font = "'Inter', sans-serif";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", position: "relative", overflow: "hidden" }}>
      {/* Background gradient blobs - matching Figma exactly */}
      <div style={{ position: "fixed", top: "-10%", right: "-5%", width: 520, height: 640, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(119,0,255,0.25) 0%, rgba(119,0,255,0.08) 50%, transparent 75%)", pointerEvents: "none", filter: "blur(40px)" }} />
      <div style={{ position: "fixed", bottom: "-15%", left: "-8%", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(0,180,220,0.2) 0%, rgba(0,180,220,0.06) 50%, transparent 75%)", pointerEvents: "none", filter: "blur(40px)" }} />
      <div style={{ position: "fixed", bottom: "5%", left: "15%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(192,0,128,0.15) 0%, transparent 70%)", pointerEvents: "none", filter: "blur(30px)" }} />

      <div className="fu" style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>
        {/* Logo — Takto wordmark SVG */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <svg width="153" height="45" viewBox="0 0 204 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M180.622 16.0533C164.259 16.0533 157.243 22.6453 157.243 38.0266C157.243 53.408 164.259 60 180.622 60C196.985 60 204 53.408 204 38.0266C204 22.6453 196.985 16.0533 180.622 16.0533ZM180.622 49.0133C174.782 49.0133 172.27 45.7173 172.27 38.0266C172.27 30.336 174.773 27.04 180.622 27.04C186.471 27.04 188.974 30.336 188.974 38.0266C188.974 45.7173 186.471 49.0133 180.622 49.0133ZM144.504 16.8977H156.194V26.1955H144.504V43.9376C144.504 46.4709 146.173 48.1598 148.676 48.1598H156.194V59.1465H142.836C134.484 59.1465 129.478 54.0799 129.478 45.6265V26.1955H121.323L113.635 37.1822L129.496 59.1556H111.967L97.7747 38.4534V59.1556H82.7483V0H97.7747V35.8293L110.298 16.8977H129.478V5.91102H144.504V16.8977ZM58.7778 16.0533C44.7562 16.0533 38.7456 20.112 38.7456 29.5732H52.9377C52.9377 26.023 54.5256 24.5067 58.2844 24.5067C62.0433 24.5067 63.7926 26.2772 63.7926 30.4177V32.1065H57.9525C43.3388 32.1065 37.077 36.4195 37.077 46.4709C37.077 55.9322 41.5894 59.9909 52.1034 59.9909C58.5356 59.9909 62.2855 57.1217 63.7926 50.6931L67.1298 59.1465H78.819V32.1065C78.819 20.8656 72.8084 16.0533 58.7778 16.0533ZM63.7926 42.2488C63.7926 47.5696 61.7921 49.8577 57.1092 49.8577C53.6016 49.8577 52.1034 48.8408 52.1034 45.6356C52.1034 41.7494 54.3551 40.569 59.6211 40.569H63.7926V42.2579V42.2488ZM50.0939 12.6755H33.3989V59.1556H16.704V12.6755H0V0H50.0939V12.6755Z" fill="white"/>
            </svg>
            <p style={{ fontFamily: font, fontWeight: 400, fontSize: 18, color: "rgba(255,255,255,0.8)", margin: 0 }}>No more creator's block.</p>
          </div>
        </div>

        {/* Card */}
        <div style={{ background: "#13131a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "32px 29px 28px", width: "100%" }}>

          {/* "Sign in" heading inside card */}
          <p style={{ fontFamily: font, fontWeight: 400, fontSize: 18, color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: 16, marginTop: 0 }}>
            {mode === "forgot" ? "Reset password" : mode === "signup" ? "Create account" : "Sign in"}
          </p>

          {mode !== "forgot" && (
            <>
              {/* Google button */}
              <button onClick={googleSignIn} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", height: 42, background: "#1a1a24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 50, color: "#f0f0f8", fontSize: 14, fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", marginBottom: 14, fontFamily: font, opacity: busy ? 0.6 : 1 }}>
                <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
                <span style={{ fontFamily: font, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
              </div>
            </>
          )}

          {/* Inputs */}
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email" placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
              style={{ height: 46, background: "#1a1a24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f8", fontFamily: font, fontSize: 15, fontWeight: 400, padding: "0 16px", outline: "none", width: "100%", boxSizing: "border-box" }}
            />
            {mode !== "forgot" && (
              <input
                type="password" placeholder="Password"
                value={password} onChange={e => setPassword(e.target.value)}
                required minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                style={{ height: 46, background: "#1a1a24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f8", fontFamily: font, fontSize: 15, fontWeight: 400, padding: "0 16px", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
            )}

            {err && <p style={{ fontFamily: font, color: "#f87171", fontSize: 13, margin: 0 }}>{err}</p>}
            {ok  && <p style={{ fontFamily: font, color: "#34d399", fontSize: 13, margin: 0 }}>{ok}</p>}

            {/* Sign In button */}
            <button
              type="submit" disabled={busy}
              style={{ height: 40, width: "100%", background: "linear-gradient(135deg, #00d4aa 0%, #7c3aed 45%, #e91e8c 100%)", border: "none", borderRadius: 50, color: "#fff", fontFamily: font, fontSize: 15, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 18px rgba(124,58,237,0.35)", marginTop: 4 }}
            >
              {busy && <Spinner size={14} />}
              {mode === "forgot" ? "Send Reset Link" : mode === "signup" ? "Sign Up" : "Sign In"}
            </button>
          </form>

          {/* Links */}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {mode !== "forgot" && (
              <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(""); setOk(""); }}
                style={{ background: "none", border: "none", fontFamily: font, fontSize: 15, color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: 0 }}>
                {mode === "signup" ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            )}
            {mode === "login" && (
              <button onClick={() => { setMode("forgot"); setErr(""); setOk(""); }}
                style={{ background: "none", border: "none", fontFamily: font, fontSize: 15, color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: 0 }}>
                Forgot password?
              </button>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("login")}
                style={{ background: "none", border: "none", fontFamily: font, fontSize: 15, color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: 0 }}>
                Back to sign in
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", fontFamily: font, fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 20 }}>
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

  const STEPS = ["Niche", "Style", "Frequency", "Notifications"];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px 80px" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, background: "var(--s2)", zIndex: 10 }}>
        <div style={{ height: "100%", width: `${((step + 1) / STEPS.length) * 100}%`, background: G, transition: "width 0.4s ease" }} />
      </div>
      <div className="fu" style={{ width: "100%", maxWidth: 520, paddingTop: 48 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <TaktoLogo size={22} />
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 18 }}>
            {STEPS.map((_, i) => <div key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 4, background: i <= step ? G : "var(--s3)", transition: "all 0.3s" }} />)}
          </div>
          <p style={{ color: "var(--t3)", fontSize: 12, marginTop: 8 }}>Step {step + 1} of {STEPS.length}</p>
        </div>

        {step === 0 && <div className="fi">
          <h1 style={{ fontSize: 26, textAlign: "center", marginBottom: 6 }}>What's your niche?</h1>
          <p style={{ color: "var(--t2)", textAlign: "center", marginBottom: 24, fontSize: 14 }}>Select all that apply</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>{NICHES.map(n => <Chip key={n.label} label={n.label} icon={n.icon} selected={niches.includes(n.label)} onClick={() => setNiches(p => p.includes(n.label) ? p.filter(x => x !== n.label) : [...p, n.label])} />)}</div>
          <div style={{ display: "flex", gap: 8 }}><input placeholder="Add custom niche..." value={customN} onChange={e => setCustomN(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustom(customN, niches, setNiches, setCustomN)} style={{ flex: 1 }} /><Btn onClick={() => addCustom(customN, niches, setNiches, setCustomN)} variant="secondary" size="sm">Add</Btn></div>
        </div>}

        {step === 1 && <div className="fi">
          <h1 style={{ fontSize: 26, textAlign: "center", marginBottom: 6 }}>Select your profile style</h1>
          <p style={{ color: "var(--t2)", textAlign: "center", marginBottom: 24, fontSize: 14 }}>How do you like to create content?</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>{STYLES.map(s => <Chip key={s.label} label={s.label} icon={s.icon} selected={styles.includes(s.label)} onClick={() => setStyles(p => p.includes(s.label) ? p.filter(x => x !== s.label) : [...p, s.label])} />)}</div>
          <div style={{ display: "flex", gap: 8 }}><input placeholder="Add custom style..." value={customS} onChange={e => setCustomS(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustom(customS, styles, setStyles, setCustomS)} style={{ flex: 1 }} /><Btn onClick={() => addCustom(customS, styles, setStyles, setCustomS)} variant="secondary" size="sm">Add</Btn></div>
        </div>}

        {step === 2 && <div className="fi">
          <h1 style={{ fontSize: 26, textAlign: "center", marginBottom: 6 }}>How often do you want to post?</h1>
          <p style={{ color: "var(--t2)", textAlign: "center", marginBottom: 24, fontSize: 14 }}>Takto generates ideas around your schedule</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FREQS.map(f => (
              <button key={f.value} onClick={() => setFreq(f.value)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: freq === f.value ? "rgba(124,58,237,0.14)" : "var(--s1)", border: `1.5px solid ${freq === f.value ? "var(--p)" : "var(--b)"}`, borderRadius: "var(--r)", cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans',sans-serif", color: "var(--t)" }}>
                <span style={{ fontSize: 20 }}>{f.icon}</span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</div><div style={{ fontSize: 12, color: "var(--t2)" }}>{f.desc}</div></div>
                {f.rec && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 50, background: G, color: "#fff", fontWeight: 600 }}>Recommended</span>}
                {freq === f.value && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
        </div>}

        {step === 3 && <div className="fi">
          <h1 style={{ fontSize: 26, textAlign: "center", marginBottom: 6 }}>Stay on track</h1>
          <p style={{ color: "var(--t2)", textAlign: "center", marginBottom: 24, fontSize: 14 }}>We'll remind you on your posting days</p>
          <Card style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div style={{ fontWeight: 600, marginBottom: 3 }}>Posting reminders</div><div style={{ fontSize: 13, color: "var(--t2)" }}>Get notified on scheduled post days</div></div>
              <Toggle value={notifs} onChange={setNotifs} />
            </div>
          </Card>
          <div style={{ padding: 18, background: "rgba(124,58,237,0.08)", borderRadius: "var(--r)", border: "1px solid rgba(124,58,237,0.18)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#c4b5fd" }}>Your setup</div>
            <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 2 }}>
              <div>🎯 {niches.slice(0, 3).join(", ")}{niches.length > 3 ? ` +${niches.length - 3}` : ""}</div>
              <div>🎨 {styles.slice(0, 2).join(", ")}{styles.length > 2 ? ` +${styles.length - 2}` : ""}</div>
              <div>📅 {freq}</div>
            </div>
          </div>
        </div>}

        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          {step > 0 && <Btn onClick={() => setStep(s => s - 1)} variant="secondary">Back</Btn>}
          {step < 3
            ? <Btn onClick={() => setStep(s => s + 1)} disabled={!canNext()} style={{ flex: 1 }}>Next</Btn>
            : <Btn onClick={finish} disabled={busy} style={{ flex: 1 }}>{busy && <Spinner size={14} />} Get Inspired ✨</Btn>
          }
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardScreen() {
  const { user, profile } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGen] = useState(false);
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
        `Generate 5 unique content ideas for:
- Niches: ${profile.niche?.join(", ")}
- Styles: ${profile.style?.join(", ")}
- Frequency: ${profile.posting_frequency}
- Dates: ${dates.join(", ")}
JSON: {"ideas":[{"title":"string","description":"string","date_scheduled":"YYYY-MM-DD","special_occasion":"string or null","difficulty":"Easy|Medium|Hard"}]}`
      );
      const { ideas: newIdeas } = JSON.parse(text.replace(/```json|```/g, "").trim());
      for (const idea of newIdeas) {
        await supabase.from("content_ideas").insert({ user_id: user.id, title: idea.title, description: idea.description, date_scheduled: idea.date_scheduled || null, special_occasion: idea.special_occasion || null, difficulty: idea.difficulty || "Medium", status: "pending" });
      }
      await fetchIdeas();
      show(`✨ ${newIdeas.length} new ideas generated!`);
    } catch (err) { show("Error: " + (err?.message || String(err))); }
    setGen(false);
  };

  const updateIdea = async (id, updates) => {
    await supabase.from("content_ideas").update(updates).eq("id", id);
    setIdeas(p => p.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const today = new Date();
  const hr = today.getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, i - 1));

  return (
    <div style={{ padding: "24px 20px 32px", maxWidth: 780, margin: "0 auto" }}>
      <ToastContainer />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 3 }}>{greeting} 👋</h1>
          <p style={{ color: "var(--t2)", fontSize: 13 }}>{profile?.niche?.slice(0, 2).join(" · ") || "Welcome back"}{profile?.posting_frequency ? " · " + profile.posting_frequency : ""}</p>
        </div>
        <Btn onClick={generate} disabled={generating}>
          {generating ? <Spinner size={14} /> : "✨"}
          {generating ? "Generating..." : "Get New Ideas"}
        </Btn>
      </div>

      <div className="sx" style={{ marginBottom: 26 }}>
        <div style={{ display: "flex", gap: 7, minWidth: "max-content" }}>
          {weekDays.map(day => {
            const ds = format(day, "yyyy-MM-dd");
            const has = ideas.some(i => i.date_scheduled === ds);
            const isToday = isSameDay(day, today);
            return (
              <div key={ds} style={{ width: 54, padding: "11px 8px", borderRadius: 12, textAlign: "center", background: isToday ? "rgba(124,58,237,0.14)" : "var(--s1)", border: `1px solid ${isToday ? "rgba(124,58,237,0.4)" : "var(--b)"}` }}>
                <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3 }}>{format(day, "EEE")}</div>
                <div style={{ fontSize: 15, fontWeight: isToday ? 700 : 400, color: isToday ? "#c4b5fd" : "var(--t)", marginBottom: 5 }}>{format(day, "d")}</div>
                <div style={{ width: 6, height: 6, borderRadius: "50%", margin: "0 auto", background: has ? G : "transparent" }} />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontSize: 17 }}>Content Ideas</h2>
        <span style={{ fontSize: 12, color: "var(--t3)" }}>{ideas.length} total</span>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={26} /></div>
      ) : ideas.length === 0 ? (
        <Card style={{ padding: 44, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✨</div>
          <h3 style={{ marginBottom: 8 }}>No ideas yet</h3>
          <p style={{ color: "var(--t2)", fontSize: 13, marginBottom: 20 }}>Hit "Get New Ideas" to generate your first batch.</p>
          <Btn onClick={generate} disabled={generating}>{generating ? <Spinner size={14} /> : null} Generate Ideas</Btn>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ideas.slice(0, 20).map((idea, i) => <IdeaCard key={idea.id} idea={idea} onUpdate={updateIdea} delay={i * 35} />)}
        </div>
      )}
    </div>
  );
}

function IdeaCard({ idea, onUpdate, delay = 0 }) {
  const SC = { pending: { bg: "rgba(251,191,36,0.1)", text: "#fbbf24", label: "Pending" }, saved: { bg: "rgba(96,165,250,0.1)", text: "#60a5fa", label: "Saved" }, used: { bg: "rgba(52,211,153,0.1)", text: "#34d399", label: "Used" } };
  const DC = { Easy: "#34d399", Medium: "#fbbf24", Hard: "#f87171" };
  const sc = SC[idea.status] || SC.pending;
  return (
    <Card className="fu" style={{ padding: 15, animationDelay: `${delay}ms` }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{idea.title}</div>
          {idea.description && <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5, marginBottom: 8 }}>{idea.description}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 50, background: sc.bg, color: sc.text, fontWeight: 500 }}>{sc.label}</span>
            {idea.difficulty && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 50, background: `${DC[idea.difficulty]}18`, color: DC[idea.difficulty], fontWeight: 500 }}>{idea.difficulty}</span>}
            {idea.date_scheduled && <span style={{ fontSize: 11, color: "var(--t3)" }}>📅 {format(parseISO(idea.date_scheduled), "MMM d")}</span>}
            {idea.special_occasion && <span style={{ fontSize: 11, color: "var(--t3)" }}>🎉 {idea.special_occasion}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {idea.status !== "saved" && <button onClick={() => onUpdate(idea.id, { status: "saved", date_scheduled: idea.date_scheduled || format(addDays(new Date(), 1), "yyyy-MM-dd") })} style={{ background: "var(--s2)", border: "1px solid var(--b)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", fontSize: 13 }} title="Save">📌</button>}
          {idea.status !== "used" && <button onClick={() => onUpdate(idea.id, { status: "used" })} style={{ background: "var(--s2)", border: "1px solid var(--b)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", fontSize: 13 }} title="Mark used">✓</button>}
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORE
// ═══════════════════════════════════════════════════════════════════════════════
const CREATORS = [
  { name: "GlowByLuna", handle: "@glowbyluna", niche: "Beauty & Makeup", followers: "1.2M", desc: "Skincare tutorials with clinical breakdowns and honest product reviews.", grad: "135deg,#f093fb,#f5576c" },
  { name: "FitWithSam", handle: "@fitwithsam", niche: "Fitness & Workouts", followers: "890K", desc: "60-second form guides and transformation content that actually delivers.", grad: "135deg,#4facfe,#00f2fe" },
  { name: "TechTara", handle: "@techtara", niche: "Tech & Gadgets", followers: "670K", desc: "Brutally honest gadget reviews. No sponsored bias, just real-world tests.", grad: "135deg,#43e97b,#38f9d7" },
  { name: "WanderNova", handle: "@wandernova", niche: "Travel & Adventure", followers: "540K", desc: "Hidden gems and budget travel hacks from 47 countries.", grad: "135deg,#fa709a,#fee140" },
  { name: "ChefMiko", handle: "@chefmiko", niche: "Food & Cooking", followers: "980K", desc: "Restaurant-quality techniques simplified for home cooks in under 3 mins.", grad: "135deg,#f6d365,#fda085" },
  { name: "StyleByAria", handle: "@stylebyaria", niche: "Fashion & Style", followers: "420K", desc: "Behind-the-scenes of styling, brand deals and the creative process.", grad: "135deg,#a18cd1,#fbc2eb" },
  { name: "GameOnMax", handle: "@gameonmax", niche: "Gaming", followers: "760K", desc: "Viral gaming commentary and the most relatable rage compilations online.", grad: "135deg,#84fab0,#8fd3f4" },
  { name: "HustleHannah", handle: "@hustlehannah", niche: "Side Hustles", followers: "550K", desc: "Practical side hustle breakdowns that actually make real money.", grad: "135deg,#30cfd0,#330867" },
  { name: "LifeWithJay", handle: "@lifewithjay", niche: "Health & Wellness", followers: "310K", desc: "Slow living, mindfulness rituals and morning routines for busy people.", grad: "135deg,#fccb90,#d57eeb" },
];
const NICHE_FILTERS = ["All", ...new Set(CREATORS.map(c => c.niche))];

function ExploreScreen() {
  const [filter, setFilter] = useState("All");
  const [saved, setSaved] = useState([]);
  const filtered = filter === "All" ? CREATORS : CREATORS.filter(c => c.niche === filter);
  return (
    <div style={{ padding: "24px 20px 32px" }}>
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 24, marginBottom: 3 }}>Explore</h1><p style={{ color: "var(--t2)", fontSize: 13 }}>Get inspired by creators aligned with your style</p></div>
      <div className="sx" style={{ marginBottom: 22, paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: 7, minWidth: "max-content" }}>
          {NICHE_FILTERS.map(n => <button key={n} onClick={() => setFilter(n)} style={{ padding: "7px 14px", borderRadius: 50, fontSize: 12, fontWeight: 500, background: filter === n ? G : "var(--s1)", border: `1px solid ${filter === n ? "transparent" : "var(--b)"}`, color: filter === n ? "#fff" : "var(--t2)", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Sans',sans-serif" }}>{n}</button>)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 14 }}>
        {filtered.map((c, i) => (
          <Card key={c.name} className="fu" style={{ overflow: "hidden", animationDelay: `${i * 45}ms` }}>
            <div style={{ height: 72, background: `linear-gradient(${c.grad})`, opacity: 0.75 }} />
            <div style={{ padding: "14px 16px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: -28, marginBottom: 10 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, border: "3px solid var(--s1)", background: `linear-gradient(${c.grad})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif" }}>{c.name[0]}</div>
                <button onClick={() => setSaved(p => p.includes(c.name) ? p.filter(x => x !== c.name) : [...p, c.name])} style={{ background: "var(--s2)", border: "1px solid var(--b)", borderRadius: 8, padding: 7, cursor: "pointer", marginTop: 28 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={saved.includes(c.name) ? "#e91e8c" : "none"} stroke={saved.includes(c.name) ? "#e91e8c" : "var(--t3)"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                </button>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 1 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 7 }}>{c.handle}</div>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 50, background: "var(--s2)", color: "var(--t2)", border: "1px solid var(--b)" }}>{c.niche}</span>
              <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, margin: "8px 0" }}>{c.desc}</p>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)" }}>{c.followers} followers</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE
// ═══════════════════════════════════════════════════════════════════════════════
const QUICK_PROMPTS = [
  "What content formats are going viral on TikTok right now?",
  "Give me 5 hook ideas for my next video",
  "What trending sounds should I be using?",
  "How do I repurpose one idea across 3 platforms?",
  "Give me a 2-week content calendar for my niche",
  "What special occasions are coming up I can create content around?",
];
const OCCASIONS = [
  { name: "Valentine's Day", date: "Feb 14", emoji: "💝" },
  { name: "Mother's Day", date: "May 11", emoji: "💐" },
  { name: "Summer Kickoff", date: "Jun 1", emoji: "☀️" },
  { name: "Back to School", date: "Sep", emoji: "📚" },
  { name: "Halloween", date: "Oct 31", emoji: "🎃" },
  { name: "Black Friday", date: "Nov 28", emoji: "🛍️" },
  { name: "Christmas", date: "Dec 25", emoji: "🎄" },
  { name: "New Year", date: "Jan 1", emoji: "🎆" },
];

function GenerateScreen() {
  const { profile } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("trending");
  const endRef = useRef(null);
  const { show, ToastContainer } = useToast();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const ask = async (q) => {
    const question = (q || input).trim();
    if (!question) return;
    setInput("");
    const next = [...msgs, { role: "user", content: question }];
    setMsgs(next);
    setBusy(true);
    try {
      const answer = await callClaude(
        `You are Takto's AI creative strategist helping a UGC content creator beat creative block. Creator: Niches: ${profile?.niche?.join(", ") || "general"} | Styles: ${profile?.style?.join(", ") || "mixed"} | Frequency: ${profile?.posting_frequency || "3x/week"}. Be specific, actionable and concise. Today: ${format(new Date(), "MMMM d, yyyy")}.`,
        question
      );
      setMsgs([...next, { role: "assistant", content: answer }]);
    } catch (err) { show("Error: " + (err?.message || String(err))); }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100svh" }}>
      <ToastContainer />
      <div style={{ padding: "22px 20px 14px", borderBottom: "1px solid var(--b)", flexShrink: 0 }}>
        <h1 style={{ fontSize: 24, marginBottom: 2 }}>Generate</h1>
        <p style={{ color: "var(--t2)", fontSize: 13 }}>AI-powered content inspiration</p>
      </div>

      {msgs.length === 0 ? (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", gap: 3, marginBottom: 18, background: "var(--s1)", padding: 3, borderRadius: 11, width: "fit-content" }}>
            {[["trending", "🔥 Trending"], ["occasions", "📅 Special Occasions"]].map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 500, background: tab === t ? "var(--s2)" : "transparent", border: "none", color: tab === t ? "var(--t)" : "var(--t3)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{l}</button>
            ))}
          </div>
          {tab === "trending"
            ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{QUICK_PROMPTS.map(p => <button key={p} onClick={() => ask(p)} style={{ textAlign: "left", padding: "13px 16px", background: "var(--s1)", border: "1px solid var(--b)", borderRadius: 12, color: "var(--t2)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{p}</button>)}</div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
                {OCCASIONS.map(o => <button key={o.name} onClick={() => ask(`Give me content ideas for ${o.name} that fit my ${profile?.niche?.join(" and ")} niche`)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "18px 10px", background: "var(--s1)", border: "1px solid var(--b)", borderRadius: 14, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", color: "var(--t)" }}><span style={{ fontSize: 26 }}>{o.emoji}</span><div style={{ fontSize: 12, fontWeight: 600 }}>{o.name}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>{o.date}</div></button>)}
              </div>
          }
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
              {m.role === "assistant" && <div style={{ width: 26, height: 26, borderRadius: 7, background: G, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><span style={{ fontSize: 11 }}>✨</span></div>}
              <div style={{ maxWidth: "82%", padding: "11px 15px", borderRadius: 16, fontSize: 13, lineHeight: 1.65, background: m.role === "user" ? "rgba(124,58,237,0.18)" : "var(--s1)", border: `1px solid ${m.role === "user" ? "rgba(124,58,237,0.3)" : "var(--b)"}`, borderBottomRightRadius: m.role === "user" ? 4 : 16, borderBottomLeftRadius: m.role === "assistant" ? 4 : 16, whiteSpace: "pre-wrap", color: "var(--t)" }}>{m.content}</div>
            </div>
          ))}
          {busy && <div style={{ display: "flex", gap: 8 }}><div style={{ width: 26, height: 26, borderRadius: 7, background: G, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 11 }}>✨</span></div><div style={{ display: "flex", gap: 4, padding: "11px 15px", background: "var(--s1)", borderRadius: 16, border: "1px solid var(--b)" }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--p)", animation: "blink 1.2s ease infinite", animationDelay: `${i * 0.2}s` }} />)}</div></div>}
          <div ref={endRef} />
        </div>
      )}

      <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--b)", flexShrink: 0, background: "var(--bg)", paddingBottom: "max(16px,env(safe-area-inset-bottom))" }}>
        {msgs.length > 0 && <button onClick={() => setMsgs([])} style={{ background: "none", border: "none", color: "var(--t3)", fontSize: 12, cursor: "pointer", marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>← New conversation</button>}
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="What's trending on TikTok..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && ask()} style={{ flex: 1 }} />
          <button onClick={() => ask()} disabled={!input.trim() || busy} style={{ width: 42, height: 42, borderRadius: 11, border: "none", flexShrink: 0, background: input.trim() && !busy ? G : "var(--s2)", cursor: input.trim() && !busy ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !busy ? "#fff" : "var(--t3)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
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
    show(`📅 Moved to ${format(parseISO(ds), "MMM d")}`);
    setDragId(null);
  };

  const days = [];
  let d = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  while (d <= endOfWeek(endOfMonth(month), { weekStartsOn: 1 })) { days.push(d); d = addDays(d, 1); }
  const selIdeas = selected ? ideas.filter(i => i.date_scheduled === format(selected, "yyyy-MM-dd")) : [];

  return (
    <div style={{ padding: "24px 20px 32px", maxWidth: 780, margin: "0 auto" }}>
      <ToastContainer />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        <div><h1 style={{ fontSize: 24, marginBottom: 3 }}>Schedule</h1><p style={{ color: "var(--t2)", fontSize: 13 }}>Drag ideas to reschedule them</p></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setMonth(subMonths(month, 1))} style={{ background: "var(--s1)", border: "1px solid var(--b)", borderRadius: 9, padding: "7px 11px", color: "var(--t)", cursor: "pointer", fontSize: 15 }}>‹</button>
          <span style={{ fontWeight: 600, minWidth: 126, textAlign: "center", fontSize: 14 }}>{format(month, "MMMM yyyy")}</span>
          <button onClick={() => setMonth(addMonths(month, 1))} style={{ background: "var(--s1)", border: "1px solid var(--b)", borderRadius: 9, padding: "7px 11px", color: "var(--t)", cursor: "pointer", fontSize: 15 }}>›</button>
        </div>
      </div>
      <Card>
        <div style={{ padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 3 }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, color: "var(--t3)", padding: "3px 0", fontWeight: 600 }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {days.map(day => {
              const ds = format(day, "yyyy-MM-dd");
              const dayIdeas = ideas.filter(i => i.date_scheduled === ds);
              const isToday = isSameDay(day, new Date());
              const isSel = selected && isSameDay(day, selected);
              const inMonth = isSameMonth(day, month);
              return (
                <div key={ds} onClick={() => setSelected(isSel ? null : day)} onDragOver={e => e.preventDefault()} onDrop={() => drop(ds)} style={{ minHeight: 56, borderRadius: 9, padding: 5, cursor: "pointer", background: isSel ? "rgba(124,58,237,0.18)" : isToday ? "rgba(124,58,237,0.07)" : "transparent", border: `1px solid ${isSel ? "var(--p)" : isToday ? "rgba(124,58,237,0.3)" : "var(--b)"}`, opacity: inMonth ? 1 : 0.28 }}>
                  <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? "#c4b5fd" : "var(--t2)", marginBottom: 3 }}>{format(day, "d")}</div>
                  {dayIdeas.slice(0, 2).map(idea => <div key={idea.id} draggable onDragStart={e => { e.stopPropagation(); setDragId(idea.id); }} onClick={e => e.stopPropagation()} style={{ fontSize: 8, padding: "2px 3px", borderRadius: 3, marginBottom: 2, background: G, color: "#fff", cursor: "grab", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{idea.title}</div>)}
                  {dayIdeas.length > 2 && <div style={{ fontSize: 8, color: "var(--t3)" }}>+{dayIdeas.length - 2}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      {selected && (
        <Card className="fu" style={{ marginTop: 14, padding: 18 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>{format(selected, "EEEE, MMMM d")} <span style={{ color: "var(--t3)", fontWeight: 400, fontSize: 13 }}>· {selIdeas.length > 0 ? `${selIdeas.length} idea${selIdeas.length > 1 ? "s" : ""}` : "Free day"}</span></h3>
          {selIdeas.length === 0
            ? <p style={{ color: "var(--t3)", fontSize: 13 }}>No ideas scheduled. Drag one here.</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{selIdeas.map(idea => <div key={idea.id} style={{ padding: "10px 12px", background: "var(--s2)", borderRadius: 10, border: "1px solid var(--b)" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{idea.title}</div>{idea.difficulty && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 3 }}>{idea.difficulty}</div>}</div>)}</div>
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

  // Always sync local edit state from profile when profile loads or changes
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
    show("Profile updated ✓");
    setSaving(false);
  };

  const lbl = (txt) => <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{txt}</div>;

  return (
    <div style={{ padding: "24px 20px 40px", maxWidth: 580, margin: "0 auto" }}>
      <ToastContainer />
      <h1 style={{ fontSize: 24, marginBottom: 22 }}>Profile</h1>

      <Card style={{ padding: 20, marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 54, height: 54, borderRadius: 16, background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif", flexShrink: 0 }}>{user?.email?.[0]?.toUpperCase()}</div>
        <div>
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
      <p style={{ textAlign: "center", fontSize: 11, color: "var(--t3)", marginTop: 14 }}>Takto · Made for creators ✨</p>
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
        <TaktoLogo size={28} />
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

  if (!user) return <AuthScreen navigate={navigate} />;
  if (profile && !profile.onboarding_completed) return <OnboardingScreen navigate={navigate} />;
  if (path === "/auth" || path === "/" || path === "/onboarding") { navigate("/dashboard"); return null; }

  const screens = { "/explore": <ExploreScreen />, "/generate": <GenerateScreen />, "/dashboard": <DashboardScreen />, "/calendar": <CalendarScreen />, "/profile": <ProfileScreen /> };
  return <AppShell path={path} navigate={navigate}>{screens[path] || <DashboardScreen />}</AppShell>;
}

export default function App() {
  return <><GlobalStyles /><AuthProvider><AppContent /></AuthProvider></>;
}
