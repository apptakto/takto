import { useState, useEffect, useCallback, createContext, useContext } from "react";
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
async function callClaude(system, userPrompt, maxTokens = 2000) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages: [{ role: "user", content: userPrompt }], max_tokens: maxTokens }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data.content?.[0]?.text || "";
}

// ─── Design tokens (Figma v2) ─────────────────────────────────────────────────
const C = {
  bg: "#f3f3f3",
  white: "#ffffff",
  dark: "#17181e",
  grey: "#7f7f7f",
  grey20: "#cccccc",
  green: "#6dff8d",
  coral: "#ff496b",
  blue: "#0084ff",
};
const CARD_SHADOW = "0px 5px 0px 0px #17181e";
const SIDEBAR_SHADOW = "2px 0px 0px 2px #17181e";
const TAKTO_PATH = "M180.622 16.0533C164.259 16.0533 157.243 22.6453 157.243 38.0266C157.243 53.408 164.259 60 180.622 60C196.985 60 204 53.408 204 38.0266C204 22.6453 196.985 16.0533 180.622 16.0533ZM180.622 49.0133C174.782 49.0133 172.27 45.7173 172.27 38.0266C172.27 30.336 174.773 27.04 180.622 27.04C186.471 27.04 188.974 30.336 188.974 38.0266C188.974 45.7173 186.471 49.0133 180.622 49.0133ZM144.504 16.8977H156.194V26.1955H144.504V43.9376C144.504 46.4709 146.173 48.1598 148.676 48.1598H156.194V59.1465H142.836C134.484 59.1465 129.478 54.0799 129.478 45.6265V26.1955H121.323L113.635 37.1822L129.496 59.1556H111.967L97.7747 38.4534V59.1556H82.7483V0H97.7747V35.8293L110.298 16.8977H129.478V5.91102H144.504V16.8977ZM58.7778 16.0533C44.7562 16.0533 38.7456 20.112 38.7456 29.5732H52.9377C52.9377 26.023 54.5256 24.5067 58.2844 24.5067C62.0433 24.5067 63.7926 26.2772 63.7926 30.4177V32.1065H57.9525C43.3388 32.1065 37.077 36.4195 37.077 46.4709C37.077 55.9322 41.5894 59.9909 52.1034 59.9909C58.5356 59.9909 62.2855 57.1217 63.7926 50.6931L67.1298 59.1465H78.819V32.1065C78.819 20.8656 72.8084 16.0533 58.7778 16.0533ZM63.7926 42.2488C63.7926 47.5696 61.7921 49.8577 57.1092 49.8577C53.6016 49.8577 52.1034 48.8408 52.1034 45.6356C52.1034 41.7494 54.3551 40.569 59.6211 40.569H63.7926V42.2579V42.2488ZM50.0939 12.6755H33.3989V59.1556H16.704V12.6755H0V0H50.0939V12.6755Z";
const AI_GRADIENT = "linear-gradient(120deg, #64ffed 0%, #831db6 50%, #ff49d5 100%)";

// ─── Global CSS ───────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --nh: 60px; }
  html, body, #root { height: 100%; }
  body { background: ${C.bg}; color: ${C.dark}; font-family: 'Space Grotesk', sans-serif; font-size: 15px; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  input { background: ${C.bg}; border: 1px solid ${C.dark}; border-radius: 6px; color: ${C.dark}; font-family: 'Space Grotesk', sans-serif; font-size: 15px; outline: none; padding: 12px 14px; width: 100%; transition: border-color 0.15s; -webkit-appearance: none; }
  input:focus { border-color: ${C.dark}; box-shadow: 0 2px 0 0 ${C.dark}; }
  input::placeholder { color: ${C.grey}; }
  button { cursor: pointer; font-family: 'Space Grotesk', sans-serif; border: none; }
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-thumb { background: ${C.grey20}; border-radius: 2px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  .fu { animation: fadeUp 0.25s ease both; }
  .fi { animation: fadeIn 0.2s ease both; }
  .sx { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .sx::-webkit-scrollbar { display: none; }
`;
function GlobalStyles() { return <style>{css}</style>; }

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid) => {
    try {
      const { data } = await supabase.from("profiles")
        .select("niche,style,notifications_enabled,onboarding_completed")
        .eq("user_id", uid).maybeSingle();
      if (data) { setProfile(data); return data; }
      const { data: created } = await supabase.from("profiles")
        .upsert({ user_id: uid, onboarding_completed: false }, { onConflict: "user_id" })
        .select().maybeSingle();
      if (created) setProfile(created);
      return created;
    } catch (e) { return null; }
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
  const show = useCallback((msg) => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);
  const ToastContainer = () => (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 6, zIndex: 9999, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} className="fu" style={{ background: C.dark, color: C.white, borderRadius: 6, padding: "10px 18px", fontSize: 14, fontWeight: 500, boxShadow: "0 4px 0 0 rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>{t.msg}</div>
      ))}
    </div>
  );
  return { show, ToastContainer };
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function TaktoLogo({ size = 22, dark = true }) {
  const w = Math.round(size * (204 / 60));
  return (
    <svg width={w} height={size} viewBox="0 0 204 60" fill="none" style={{ display: "block" }}>
      <path d={TAKTO_PATH} fill={dark ? C.dark : C.white} />
    </svg>
  );
}

// The signature card style from Figma
function Card({ children, style: sx, className }) {
  return (
    <div className={className} style={{
      background: C.bg, border: `1px solid ${C.dark}`,
      borderRadius: 25, boxShadow: CARD_SHADOW, overflow: "hidden", ...sx,
    }}>
      {children}
    </div>
  );
}

function Spinner({ size = 18, dark = true }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${dark ? C.grey20 : "rgba(255,255,255,0.3)"}`, borderTopColor: dark ? C.dark : C.white, animation: "spin 0.6s linear infinite", flexShrink: 0 }} />;
}

// Green CTA button (primary)
function GreenBtn({ children, onClick, disabled, sx, type = "button" }) {
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      background: disabled ? C.grey20 : C.green, color: C.dark,
      border: `1px solid ${disabled ? C.grey20 : C.dark}`, borderRadius: 6,
      padding: "10px 22px", fontSize: 18, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex",
      alignItems: "center", justifyContent: "center", gap: 8,
      fontFamily: "'Space Grotesk', sans-serif", transition: "opacity 0.15s", ...sx,
    }}>
      {children}
    </button>
  );
}

// Chip — used for niche/style/technique selections
function Chip({ label, selected, onClick, color = C.green, textDark = true }) {
  const bg = selected ? color : `${color}40`;
  const textColor = selected ? (textDark ? C.dark : C.white) : C.dark;
  return (
    <button type="button" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", height: 32, borderRadius: 6,
      background: bg, color: textColor,
      border: "none", cursor: "pointer",
      fontSize: 18, fontWeight: 500,
      fontFamily: "'Space Grotesk', sans-serif", transition: "all 0.12s",
      whiteSpace: "nowrap",
    }}>
      {label}
    </button>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{
      width: 44, height: 24, borderRadius: 12, border: `1px solid ${C.dark}`,
      background: value ? C.green : C.grey20,
      position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
    }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: C.dark, position: "absolute", top: 2, left: value ? 22 : 2, transition: "left 0.2s" }} />
    </button>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV = [
  { path: "/generate", label: "Generate" },
  { path: "/schedule", label: "Schedule" },
  { path: "/profile",  label: "Profile" },
];

function Sidebar({ path, navigate, signOut }) {
  return (
    <aside style={{ width: 240, flexShrink: 0, background: C.bg, boxShadow: SIDEBAR_SHADOW, display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ padding: "36px 30px 28px" }}>
        <TaktoLogo size={22} dark={true} />
      </div>
      <nav style={{ flex: 1, padding: "0 20px" }}>
        {NAV.map(item => {
          const active = path === item.path;
          return (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: active ? "6px 10px" : "6px 10px",
              background: active ? C.green : "transparent",
              border: "none", borderRadius: active ? 6 : 0,
              color: active ? C.dark : C.grey,
              fontSize: 32, fontWeight: 700,
              cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: 8, lineHeight: "1.2",
            }}>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "16px 20px 24px", borderTop: `1px solid ${C.grey20}` }}>
        <button onClick={signOut} style={{ background: "none", border: "none", color: C.grey, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", textDecoration: "underline" }}>
          ↙ Log out
        </button>
        <p style={{ fontSize: 10, color: C.grey, marginTop: 8 }}>© 2026 Takto. All rights reserved.</p>
      </div>
    </aside>
  );
}

function BottomNav({ path, navigate }) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "var(--nh)", background: C.bg, borderTop: `2px solid ${C.dark}`, display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 100 }}>
      {NAV.map(item => {
        const active = path === item.path;
        return (
          <button key={item.path} onClick={() => navigate(item.path)} style={{ background: active ? C.green : "transparent", border: "none", borderRadius: 6, padding: "4px 14px", fontSize: 15, fontWeight: active ? 700 : 500, color: active ? C.dark : C.grey, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
            {item.label}
          </button>
        );
      })}
    </nav>
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
  const { signOut } = useAuth();
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {!isMobile && <Sidebar path={path} navigate={navigate} signOut={signOut} />}
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

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div className="fu" style={{ width: "100%", maxWidth: 500, textAlign: "center" }}>
        <TaktoLogo size={28} dark={true} />
        <p style={{ fontSize: 22, fontWeight: 500, color: C.dark, marginTop: 12, marginBottom: 32 }}>No more creator's block.</p>

        {/* Card */}
        <Card style={{ padding: "36px 40px 32px", textAlign: "left" }}>
          <p style={{ fontSize: 20, fontWeight: 500, textAlign: "center", marginBottom: 24 }}>
            {mode === "forgot" ? "Reset password" : mode === "signup" ? "Sign up" : "Sign in"}
          </p>

          {mode !== "forgot" && (
            <>
              {/* Google button */}
              <button onClick={googleSignIn} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", height: 50, background: C.dark, border: "none", borderRadius: 6, color: C.bg, fontSize: 14, fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", marginBottom: 16, fontFamily: "'Inter', sans-serif", opacity: busy ? 0.7 : 1 }}>
                <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: C.grey }} />
                <span style={{ fontSize: 12, color: C.grey }}>or</span>
                <div style={{ flex: 1, height: 1, background: C.grey }} />
              </div>
            </>
          )}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required style={{ background: C.bg }} />
            {mode !== "forgot" && <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={{ background: C.bg }} />}
            {err && <p style={{ color: C.coral, fontSize: 13 }}>{err}</p>}
            {ok  && <p style={{ color: "#22c55e", fontSize: 13 }}>{ok}</p>}
            <GreenBtn type="submit" disabled={busy} sx={{ marginTop: 4, width: "100%", fontSize: 26, padding: "10px" }}>
              {busy && <Spinner size={14} dark />}
              {mode === "forgot" ? "Send Reset Link" : mode === "signup" ? "Sign up" : "Sign in"}
            </GreenBtn>
          </form>

          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            {mode !== "forgot" && (
              <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(""); setOk(""); }}
                style={{ background: "none", border: "none", fontSize: 20, fontWeight: 500, color: C.dark, cursor: "pointer" }}>
                {mode === "signup" ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            )}
            {mode === "login" && (
              <button onClick={() => { setMode("forgot"); setErr(""); setOk(""); }}
                style={{ background: "none", border: "none", fontSize: 20, fontWeight: 500, color: C.grey, cursor: "pointer" }}>
                Forgot password?
              </button>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("login")}
                style={{ background: "none", border: "none", fontSize: 20, fontWeight: 500, color: C.grey, cursor: "pointer" }}>
                Back to sign in
              </button>
            )}
          </div>
        </Card>

        <p style={{ fontSize: 14, color: C.grey, marginTop: 16 }}>
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
  { label: "💄 Beauty & Makeup" }, { label: "👗 Fashion & Style" }, { label: "🌿 Health & Wellness" },
  { label: "✈️ Travel & Adventure" }, { label: "🍳 Food & Cooking" }, { label: "💰 Side Hustles" },
  { label: "📈 Personal Finance" }, { label: "💻 Tech & Gadgets" }, { label: "🎮 Gaming" },
  { label: "🎨 DIY & Crafts" }, { label: "😂 Comedy & Memes" }, { label: "🐾 Pet & Animals" },
  { label: "👨‍👩‍👧 Parenting & Family" },
];
const STYLES = [
  { label: "⭐ Personal Brand/Influencer" }, { label: "🎭 Comedy/Skit" }, { label: "📚 Tutorial/Educational" },
  { label: "🔥 Challenge/Trend" }, { label: "🌸 Aesthetic/Mood-Based" }, { label: "💰 Side Hustles" },
  { label: "📋 Review/Reaction" }, { label: "📖 Storytime/Narration" }, { label: "✨ Transformation/Glow-Up" },
  { label: "🎨 DIY & Crafts" }, { label: "💪 Motivational/Inspirational" }, { label: "🎯 Niche Hobbyist" },
];

function OnboardingScreen({ navigate }) {
  const { user, refreshProfile } = useAuth();
  const [niches, setNiches] = useState([]);
  const [styles, setStyles] = useState([]);
  const [notifs, setNotifs] = useState(true);
  const [customN, setCustomN] = useState("");
  const [customS, setCustomS] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleNiche = (l) => setNiches(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]);
  const toggleStyle = (l) => setStyles(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]);
  const addCustomNiche = () => { if (customN.trim()) { toggleNiche(customN.trim()); setCustomN(""); } };
  const addCustomStyle = () => { if (customS.trim()) { toggleStyle(customS.trim()); setCustomS(""); } };

  const finish = async () => {
    if (!user) return;
    setBusy(true);
    await supabase.from("profiles").update({ niche: niches, style: styles, notifications_enabled: notifs, onboarding_completed: true }).eq("user_id", user.id);
    await refreshProfile();
    navigate("/generate");
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px 60px" }}>
      <div className="fu" style={{ width: "100%", maxWidth: 700, textAlign: "center" }}>
        <TaktoLogo size={22} dark={true} />

        {/* Niche section */}
        <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 20 }}>What's your niche?</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 8 }}>
          {NICHES.map(n => (
            <Chip key={n.label} label={n.label} selected={niches.includes(n.label)} onClick={() => toggleNiche(n.label)} color={C.green} />
          ))}
          {niches.filter(n => !NICHES.find(x => x.label === n)).map(n => (
            <Chip key={n} label={n} selected onClick={() => toggleNiche(n)} color={C.green} />
          ))}
          <button onClick={() => { const v = prompt("Add custom niche:"); if (v?.trim()) toggleNiche(v.trim()); }}
            style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", height: 32, borderRadius: 6, background: `${C.green}40`, color: C.grey, border: "none", cursor: "pointer", fontSize: 18, fontWeight: 500, fontFamily: "'Space Grotesk', sans-serif" }}>
            Add new...
          </button>
        </div>

        {/* Style section */}
        <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 36, marginBottom: 20 }}>What's your content style?</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 8 }}>
          {STYLES.map(s => (
            <Chip key={s.label} label={s.label} selected={styles.includes(s.label)} onClick={() => toggleStyle(s.label)} color={C.green} />
          ))}
          {styles.filter(s => !STYLES.find(x => x.label === s)).map(s => (
            <Chip key={s} label={s} selected onClick={() => toggleStyle(s)} color={C.green} />
          ))}
          <button onClick={() => { const v = prompt("Add custom style:"); if (v?.trim()) toggleStyle(v.trim()); }}
            style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", height: 32, borderRadius: 6, background: `${C.green}40`, color: C.grey, border: "none", cursor: "pointer", fontSize: 18, fontWeight: 500, fontFamily: "'Space Grotesk', sans-serif" }}>
            Add new...
          </button>
        </div>

        {/* Notification card */}
        <Card style={{ marginTop: 36, padding: "20px 28px", display: "flex", alignItems: "center", gap: 16, textAlign: "left" }}>
          <Toggle value={notifs} onChange={setNotifs} />
          <p style={{ fontSize: 18, fontWeight: 500 }}>Get reminded about posting?</p>
        </Card>

        {/* Continue button */}
        <GreenBtn onClick={finish} disabled={busy || (niches.length === 0 && styles.length === 0)} sx={{ marginTop: 32, fontSize: 26, padding: "12px 40px" }}>
          {busy && <Spinner size={14} dark />}
          Continue →
        </GreenBtn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
const POST_TECHNIQUES = ["All of them", "Talking Heads", "POV B-Roll", "Day in my Life", "Story Narrative", "Split Screen Comparison", "Text Overlay Carousel"];
const TRENDING_HASHTAGS = ["#dayinmylife", "#hottake", "#unpopularopinion", "#getreadywithme", "#whatieatinaday", "#letmeshowyou", "#trieditsoyoudonthaveto", "#thingsthatjustmakesense", "#thingsnobodytellsyou"];

function GenerateScreen() {
  const { user, profile } = useAuth();
  const [techniques, setTechniques] = useState(["All of them"]);
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [trendingMode, setTrendingMode] = useState(false);
  const [ideas, setIdeas] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const { show, ToastContainer } = useToast();

  const toggleTechnique = (t) => {
    if (t === "All of them") { setTechniques(["All of them"]); return; }
    setTechniques(p => {
      const without = p.filter(x => x !== "All of them");
      return without.includes(t) ? without.filter(x => x !== t) : [...without, t];
    });
  };

  const toggleHashtag = (h) => setSelectedHashtags(p => p.includes(h) ? p.filter(x => x !== h) : [...p, h]);

  const generate = async () => {
    if (!profile) return;
    setGenerating(true);
    setIdeas([]);
    setExpandedId(null);
    setSavedIds(new Set());
    try {
      const techContext = techniques.includes("All of them") ? "any post technique" : `these post techniques: ${techniques.join(", ")}`;
      const hashtagContext = selectedHashtags.length > 0 ? `\nTrending hashtags to incorporate: ${selectedHashtags.join(", ")}` : "";
      const trendContext = trendingMode ? "\nMake every idea trend-aware and optimised for maximum viral reach right now." : "";

      const text = await callClaude(
        "You are Takto, an expert UGC content strategist. Return ONLY valid JSON — no markdown, no explanation.",
        `Generate 6 content ideas for this creator:
- Niches: ${profile.niche?.join(", ")}
- Styles: ${profile.style?.join(", ")}
- Post technique: ${techContext}
${hashtagContext}${trendContext}

For each idea: title (punchy, specific), hook (exact first line to say/show), format (e.g. Talking Head / POV B-Roll), difficulty (Easy/Medium/Hard), time_to_create (e.g. 15min), why_it_works (one sentence).
JSON: {"ideas":[{"title":"","hook":"","format":"","difficulty":"","time_to_create":"","why_it_works":""}]}`
        , 2000
      );
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setIdeas(parsed.ideas || []);
      if (parsed.ideas?.length > 0) setExpandedId(0);
    } catch (err) { show("Error: " + (err?.message || "Something went wrong")); }
    setGenerating(false);
  };

  const saveIdea = async (idea, idx) => {
    if (!user || savedIds.has(idx)) return;
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    const { error } = await supabase.from("content_ideas").insert({
      user_id: user.id, title: idea.title,
      description: `Hook: "${idea.hook}" | Format: ${idea.format} | Why it works: ${idea.why_it_works}`,
      date_scheduled: tomorrow, difficulty: idea.difficulty || "Medium", status: "pending",
    });
    if (!error) { setSavedIds(p => new Set([...p, idx])); show("Saved to Schedule ✓"); }
  };

  const saveAll = async () => {
    for (let i = 0; i < ideas.length; i++) {
      if (!savedIds.has(i)) await saveIdea(ideas[i], i);
    }
    show("All ideas saved ✓");
  };

  return (
    <div style={{ padding: "40px 40px 60px", maxWidth: 960 }}>
      <ToastContainer />

      {/* Top row: Trending + Generate */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        {/* Trending now button */}
        <button onClick={() => setTrendingMode(p => !p)} style={{
          background: trendingMode ? C.coral : `${C.coral}40`,
          color: trendingMode ? C.white : C.dark,
          border: "none", borderRadius: 6, padding: "8px 18px",
          fontSize: 24, fontWeight: 700, cursor: "pointer",
          fontFamily: "'Space Grotesk', sans-serif",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          Trending now {trendingMode ? "•" : "○"}
        </button>

        {/* Generate Ideas button */}
        <button onClick={generate} disabled={generating} style={{
          background: generating ? C.grey20 : AI_GRADIENT,
          color: C.white, border: "none", borderRadius: 6,
          padding: "8px 20px", fontSize: 24, fontWeight: 700,
          cursor: generating ? "not-allowed" : "pointer",
          fontFamily: "'Space Grotesk', sans-serif",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {generating ? <Spinner size={16} dark={false} /> : null}
          Generate Ideas {!generating && "✦"}
        </button>
      </div>

      {/* Trending hashtags — shown when trendingMode on */}
      {trendingMode && (
        <div className="fi" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TRENDING_HASHTAGS.map(h => (
              <Chip key={h} label={h} selected={selectedHashtags.includes(h)} onClick={() => toggleHashtag(h)} color={C.coral} textDark={false} />
            ))}
          </div>
        </div>
      )}

      {/* Post Technique */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 14 }}>Post Technique</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {POST_TECHNIQUES.map(t => (
            <Chip key={t} label={t} selected={techniques.includes(t)} onClick={() => toggleTechnique(t)} color={C.blue} textDark={t === "All of them" && techniques.includes(t) ? false : true} />
          ))}
          <button onClick={() => { const v = prompt("Add custom technique:"); if (v?.trim()) { toggleTechnique(v.trim()); } }}
            style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", height: 32, borderRadius: 6, background: `${C.blue}40`, color: `${C.dark}80`, border: "none", cursor: "pointer", fontSize: 18, fontWeight: 500, fontFamily: "'Space Grotesk', sans-serif" }}>
            Add new...
          </button>
        </div>
      </div>

      {/* Empty / loading state */}
      {!generating && ideas.length === 0 && (
        <p style={{ fontSize: 24, color: C.grey, fontWeight: 500, paddingLeft: 4 }}>
          Hit Generate to get 6 ideas tailored to your niche and style...
        </p>
      )}

      {generating && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "20px 0" }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: C.dark, animation: "blink 1.2s ease infinite", animationDelay: `${i * 0.2}s` }} />)}
          <p style={{ fontSize: 18, color: C.grey, fontWeight: 500, marginLeft: 8 }}>Generating your ideas...</p>
        </div>
      )}

      {/* Results */}
      {!generating && ideas.length > 0 && (
        <div className="fi">
          <p style={{ fontSize: 24, color: C.grey, fontWeight: 500, marginBottom: 16 }}>
            Saved ideas get scheduled automatically...
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            {ideas.map((idea, i) => {
              const isExpanded = expandedId === i;
              const isSaved = savedIds.has(i);
              return (
                <Card key={i} className="fu" style={{ animationDelay: `${i * 40}ms` }}>
                  {/* Collapsed row */}
                  <div style={{ padding: "18px 24px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 22, fontWeight: 500, marginBottom: isExpanded ? 0 : 10 }}>{idea.title}</p>
                      {!isExpanded && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {idea.difficulty && <span style={{ background: C.grey20, borderRadius: 6, padding: "1px 8px", fontSize: 10, fontWeight: 500 }}>{idea.difficulty} · {idea.time_to_create}</span>}
                          {idea.format && <span style={{ background: C.grey20, borderRadius: 6, padding: "1px 8px", fontSize: 10, fontWeight: 500 }}>{idea.format}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                      {isSaved ? (
                        <span style={{ background: `${C.green}40`, border: `1px solid ${C.dark}`, borderRadius: 6, padding: "8px 14px", fontSize: 16, fontWeight: 700 }}>✓ Saved</span>
                      ) : (
                        <GreenBtn onClick={() => saveIdea(idea, i)} sx={{ padding: "8px 14px", fontSize: 16 }}>+ Save</GreenBtn>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : i)} style={{
                        background: "none", border: "none", fontSize: 20, color: C.dark, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s",
                      }}>›</button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="fi" style={{ padding: "0 24px 20px", borderTop: `1px solid ${C.grey20}`, paddingTop: 16 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                        {idea.difficulty && <span style={{ background: C.grey20, borderRadius: 6, padding: "2px 10px", fontSize: 10, fontWeight: 500 }}>{idea.difficulty} · {idea.time_to_create}</span>}
                        {idea.format && <span style={{ background: C.grey20, borderRadius: 6, padding: "2px 10px", fontSize: 10, fontWeight: 500 }}>{idea.format}</span>}
                      </div>
                      {idea.hook && (
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.coral, marginBottom: 3 }}>Hook</p>
                          <p style={{ fontSize: 14, color: C.dark, lineHeight: 1.5 }}>{idea.hook}</p>
                        </div>
                      )}
                      {idea.why_it_works && (
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.coral, marginBottom: 3 }}>Why it works</p>
                          <p style={{ fontSize: 14, color: C.dark, lineHeight: 1.5 }}>{idea.why_it_works}</p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Save All + Generate more */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <GreenBtn onClick={saveAll} sx={{ fontSize: 24, padding: "10px 20px" }}>+ Save All</GreenBtn>
            <button onClick={generate} style={{ background: "none", border: "none", fontSize: 24, fontWeight: 700, color: C.dark, cursor: "pointer", textDecoration: "underline", fontFamily: "'Space Grotesk', sans-serif" }}>
              Generate 6 more ideas...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE SCREEN — Calendar matching Figma exactly
// ═══════════════════════════════════════════════════════════════════════════════
function ScheduleScreen({ navigate }) {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [month, setMonth] = useState(new Date());
  const [dragId, setDragId] = useState(null);
  const [selected, setSelected] = useState(null);
  const { show, ToastContainer } = useToast();

  const fetchIdeas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("content_ideas").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setIdeas(data);
  }, [user]);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  const drop = async (ds) => {
    if (!dragId) return;
    await supabase.from("content_ideas").update({ date_scheduled: ds, status: "saved" }).eq("id", dragId);
    setIdeas(p => p.map(i => i.id === dragId ? { ...i, date_scheduled: ds, status: "saved" } : i));
    show(`Scheduled for ${format(parseISO(ds), "MMM d")} ✓`);
    setDragId(null);
  };

  const markUsed = async (id) => {
    await supabase.from("content_ideas").update({ status: "used" }).eq("id", id);
    setIdeas(p => p.map(i => i.id === id ? { ...i, status: "used" } : i));
    show("Marked as posted ✓");
  };

  const deleteIdea = async (id) => {
    await supabase.from("content_ideas").delete().eq("id", id);
    setIdeas(p => p.filter(i => i.id !== id));
  };

  // Calendar grid
  const days = [];
  let d = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  while (d <= endOfWeek(endOfMonth(month), { weekStartsOn: 1 })) { days.push(d); d = addDays(d, 1); }

  const selIdeas = selected ? ideas.filter(i => i.date_scheduled === format(selected, "yyyy-MM-dd")) : [];

  return (
    <div style={{ padding: "36px 40px 60px" }}>
      <ToastContainer />

      {/* Month header + nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>{format(month, "MMMM yyyy")}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => setMonth(subMonths(month, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: C.grey, fontSize: 20, display: "flex" }}>
            <svg width="16" height="20" viewBox="0 0 16 20"><line x1="12" y1="2" x2="4" y2="10" stroke={C.grey} strokeWidth="2"/><line x1="4" y1="10" x2="12" y2="18" stroke={C.grey} strokeWidth="2"/></svg>
          </button>
          <button onClick={() => setMonth(new Date())} style={{ background: "none", border: "none", cursor: "pointer", color: C.grey, fontSize: 24, fontWeight: 500, fontFamily: "'Space Grotesk', sans-serif" }}>Today</button>
          <button onClick={() => setMonth(addMonths(month, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: C.grey, fontSize: 20, display: "flex" }}>
            <svg width="16" height="20" viewBox="0 0 16 20"><line x1="4" y1="2" x2="12" y2="10" stroke={C.grey} strokeWidth="2"/><line x1="12" y1="10" x2="4" y2="18" stroke={C.grey} strokeWidth="2"/></svg>
          </button>
        </div>
      </div>

      {ideas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: 22, color: C.grey, fontWeight: 500, marginBottom: 20 }}>No ideas scheduled yet</p>
          <GreenBtn onClick={() => navigate("/generate")}>Generate Ideas →</GreenBtn>
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          <div style={{ width: "100%" }}>
            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                <div key={day} style={{ padding: 12, fontSize: 18, fontWeight: 500 }}>{day}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {days.map(day => {
                const ds = format(day, "yyyy-MM-dd");
                const dayIdeas = ideas.filter(i => i.date_scheduled === ds);
                const inMonth = isSameMonth(day, month);
                const isToday = isSameDay(day, new Date());
                const isSel = selected && isSameDay(day, selected);
                return (
                  <div
                    key={ds}
                    onClick={() => setSelected(isSel ? null : day)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => drop(ds)}
                    style={{
                      border: `1px solid ${isSel ? C.dark : C.grey20}`,
                      minHeight: 140, padding: 12,
                      cursor: "pointer",
                      background: isSel ? `${C.green}15` : isToday ? `${C.blue}08` : C.white,
                      boxShadow: isSel ? `inset 0 0 0 2px ${C.dark}` : undefined,
                      display: "flex", flexDirection: "column",
                      transition: "all 0.1s",
                    }}
                  >
                    <p style={{ fontSize: 24, fontWeight: 500, color: inMonth ? (isToday ? C.blue : C.dark) : C.grey20, marginBottom: "auto" }}>
                      {format(day, "d")}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                      {dayIdeas.slice(0, 4).map(idea => (
                        <div
                          key={idea.id}
                          draggable
                          onDragStart={e => { e.stopPropagation(); setDragId(idea.id); }}
                          onClick={e => e.stopPropagation()}
                          title={idea.title}
                          style={{
                            background: idea.status === "used" ? C.grey20 : C.green,
                            borderRadius: 6, padding: "3px 6px", fontSize: 12,
                            fontWeight: 400, color: C.dark,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            cursor: "grab",
                          }}
                        >
                          {idea.title}
                        </div>
                      ))}
                      {dayIdeas.length > 4 && <p style={{ fontSize: 10, color: C.grey }}>+{dayIdeas.length - 4} more</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selected && (
            <div className="fi" style={{ marginTop: 24 }}>
              <p style={{ fontSize: 20, fontWeight: 500, color: C.grey, marginBottom: 12 }}>
                {format(selected, "EEE d MMMM yyyy")}
              </p>
              {selIdeas.length === 0 ? (
                <p style={{ fontSize: 16, color: C.grey }}>No ideas on this day — drag one from another day here</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {selIdeas.map(idea => (
                    <Card key={idea.id} style={{ padding: "18px 24px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>{idea.title}</p>
                          {idea.description && <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.5, marginBottom: 8 }}>{idea.description.length > 120 ? idea.description.slice(0, 120) + "…" : idea.description}</p>}
                          <div style={{ display: "flex", gap: 6 }}>
                            {idea.difficulty && <span style={{ background: C.grey20, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 500 }}>{idea.difficulty}</span>}
                            <span style={{ background: idea.status === "used" ? C.grey20 : `${C.green}40`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 500 }}>{idea.status || "pending"}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          {idea.status !== "used" && (
                            <button onClick={() => markUsed(idea.id)} style={{ background: C.green, border: `1px solid ${C.dark}`, borderRadius: 6, width: 46, height: 46, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</button>
                          )}
                          <button onClick={() => { setSelected(null); deleteIdea(idea.id); }} style={{ background: C.bg, border: `1px solid ${C.dark}`, borderRadius: 6, width: 46, height: 46, cursor: "pointer", fontSize: 18, color: C.grey }}>×</button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [niches, setNiches] = useState([]);
  const [styles, setStyles] = useState([]);
  const [notifs, setNotifs] = useState(true);
  const [saving, setSaving] = useState(false);
  const { show, ToastContainer } = useToast();

  useEffect(() => {
    if (profile) {
      setNiches(profile.niche || []);
      setStyles(profile.style || []);
      setNotifs(profile.notifications_enabled ?? true);
    }
  }, [profile]);

  const save = async () => {
    setSaving(true);
    await supabase.from("profiles").update({ niche: niches, style: styles, notifications_enabled: notifs }).eq("user_id", user.id);
    await refreshProfile();
    setEditing(false);
    show("Saved ✓");
    setSaving(false);
  };

  const lbl = (t) => <p style={{ fontSize: 16, color: C.grey, fontWeight: 500, marginBottom: 10 }}>{t}</p>;

  return (
    <div style={{ padding: "36px 40px 60px", maxWidth: 700 }}>
      <ToastContainer />
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28 }}>Creator Settings</h1>

      {/* Email */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ background: C.white, border: `1px solid ${C.dark}`, borderRadius: 6, padding: "10px 16px", fontSize: 16, fontWeight: 500, color: C.dark }}>
          {user?.email}
        </div>
        {!editing
          ? <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", fontSize: 18, fontWeight: 500, color: C.dark, cursor: "pointer", textDecoration: "underline", fontFamily: "'Space Grotesk', sans-serif" }}>Edit</button>
          : <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", fontSize: 18, fontWeight: 500, color: C.grey, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>Cancel</button>
              <GreenBtn onClick={save} disabled={saving} sx={{ fontSize: 16, padding: "6px 16px" }}>{saving && <Spinner size={12} dark />} Save</GreenBtn>
            </div>
        }
      </div>

      {/* Niche */}
      <div style={{ marginBottom: 24 }}>
        {lbl("Niche")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {editing ? (
            <>
              {NICHES.map(n => <Chip key={n.label} label={n.label} selected={niches.includes(n.label)} onClick={() => setNiches(p => p.includes(n.label) ? p.filter(x => x !== n.label) : [...p, n.label])} color={C.green} />)}
              {niches.filter(n => !NICHES.find(x => x.label === n)).map(n => <Chip key={n} label={n} selected onClick={() => setNiches(p => p.filter(x => x !== n))} color={C.green} />)}
              <button onClick={() => { const v = prompt("Add custom niche:"); if (v?.trim()) setNiches(p => [...p, v.trim()]); }}
                style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", height: 32, borderRadius: 6, background: `${C.green}40`, color: C.grey, border: "none", cursor: "pointer", fontSize: 18, fontWeight: 500, fontFamily: "'Space Grotesk', sans-serif" }}>
                Add new...
              </button>
            </>
          ) : (
            (profile?.niche || []).map(n => <Chip key={n} label={n} selected onClick={() => {}} color={C.green} />)
          )}
        </div>
      </div>

      {/* Style */}
      <div style={{ marginBottom: 24 }}>
        {lbl("Style")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {editing ? (
            <>
              {STYLES.map(s => <Chip key={s.label} label={s.label} selected={styles.includes(s.label)} onClick={() => setStyles(p => p.includes(s.label) ? p.filter(x => x !== s.label) : [...p, s.label])} color={C.green} />)}
              {styles.filter(s => !STYLES.find(x => x.label === s)).map(s => <Chip key={s} label={s} selected onClick={() => setStyles(p => p.filter(x => x !== s))} color={C.green} />)}
              <button onClick={() => { const v = prompt("Add custom style:"); if (v?.trim()) setStyles(p => [...p, v.trim()]); }}
                style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", height: 32, borderRadius: 6, background: `${C.green}40`, color: C.grey, border: "none", cursor: "pointer", fontSize: 18, fontWeight: 500, fontFamily: "'Space Grotesk', sans-serif" }}>
                Add new...
              </button>
            </>
          ) : (
            (profile?.style || []).map(s => <Chip key={s} label={s} selected onClick={() => {}} color={C.green} />)
          )}
        </div>
      </div>

      {/* Posting Reminder */}
      <div style={{ marginBottom: 32 }}>
        {lbl("Posting Reminder")}
        {editing ? (
          <Toggle value={notifs} onChange={setNotifs} />
        ) : (
          <p style={{ fontSize: 16, fontWeight: 500 }}>{notifs ? "On" : "Off"}</p>
        )}
      </div>

      {/* Log out */}
      <button onClick={signOut} style={{ background: "none", border: "none", fontSize: 18, color: C.dark, cursor: "pointer", textDecoration: "underline", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500 }}>
        ↙ Log out
      </button>
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
    if (profile?.onboarding_completed && (path === "/" || path === "/auth" || path === "/onboarding")) navigate("/generate");
  }, [user, profile, loading, path]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 20, background: C.bg }}>
        <TaktoLogo size={24} dark={true} />
        <Spinner size={22} dark={true} />
        {(!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) && (
          <div style={{ padding: "12px 18px", background: `${C.coral}15`, border: `1px solid ${C.coral}`, borderRadius: 6, maxWidth: 360, textAlign: "center" }}>
            <p style={{ color: C.coral, fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Missing env vars</p>
            <p style={{ color: C.coral, fontSize: 12, opacity: 0.8 }}>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel</p>
          </div>
        )}
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  if (profile && !profile.onboarding_completed) return <OnboardingScreen navigate={navigate} />;
  if (path === "/auth" || path === "/" || path === "/onboarding") { navigate("/generate"); return null; }

  const screens = {
    "/generate": <GenerateScreen />,
    "/schedule": <ScheduleScreen navigate={navigate} />,
    "/profile":  <ProfileScreen />,
  };

  return (
    <AppShell path={path} navigate={navigate}>
      {screens[path] || <GenerateScreen />}
    </AppShell>
  );
}

export default function App() {
  return <><GlobalStyles /><AuthProvider><AppContent /></AuthProvider></>;
}
