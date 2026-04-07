import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
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

// ─── Design tokens — exact from Figma v2 ─────────────────────────────────────
const C = {
  bg:     "#f3f3f3",  // 5% grey
  white:  "#ffffff",
  dark:   "#17181e",  // dark blue
  grey:   "#7f7f7f",  // 50% grey
  grey20: "#cccccc",  // 20% grey
  grey10: "#e5e5e5",  // 10% grey
  green:  "#6dff8d",
  coral:  "#ff496b",
  blue:   "#0084ff",
};
const CARD_SHADOW = "0px 5px 0px 0px #17181e";
const SIDEBAR_SHADOW = "2px 0px 0px 2px #17181e";
const AI_GRADIENT = "linear-gradient(120deg, #64ffed 0%, #831db6 50%, #ff49d5 100%)";
// Takto logo SVG paths (viewBox 0 0 200 62)
const TAKTO_O  = "M197.009,26.344c-1.989-3.334-4.748-5.915-8.198-7.669-3.428-1.742-7.336-2.626-11.617-2.626s-8.191.883-11.618,2.626c-3.453,1.755-6.211,4.336-8.198,7.669-1.984,3.327-2.991,7.366-2.991,12.005v1.352c0,4.639,1.006,8.678,2.991,12.005,1.987,3.333,4.746,5.913,8.198,7.668,3.427,1.742,7.336,2.626,11.618,2.626s8.189-.883,11.617-2.626c3.451-1.755,6.209-4.335,8.198-7.668,1.985-3.33,2.992-7.369,2.992-12.005v-1.352c0-4.637-1.007-8.675-2.991-12.005h-.001ZM177.193,50.851c-3.064,0-5.522-.956-7.516-2.924-1.963-1.937-2.958-4.789-2.958-8.479v-.845c0-3.69.995-6.543,2.958-8.479,1.994-1.968,4.452-2.924,7.516-2.924,3.118,0,5.588.955,7.554,2.92,1.938,1.938,2.92,4.792,2.92,8.483v.845c0,3.689-.995,6.542-2.958,8.479-1.995,1.968-4.453,2.924-7.515,2.924h-.001Z";
const TAKTO_KT = "M140.302,17.232V4.223h-12.332v13.008h-17.356l-.252.281-13.601,15.177h-.298V0h-12.333v60.818h12.333v-16.641h.295l14.445,16.355.252.286h15.998l-1.313-1.419-19.48-21.042,10.164-10.652h11.146v22.807c0,3.092.95,5.609,2.824,7.482,1.873,1.873,4.333,2.823,7.313,2.823h12.67v-10.475h-8.954c-.939,0-1.52-.283-1.52-1.689v-20.949h11.488v-10.474h-11.488v.002Z";
const TAKTO_A  = "M76.205,50.343c-.939,0-1.521-.283-1.521-1.689v-15.627c0-5.47-1.719-9.721-5.108-12.635-3.354-2.882-7.944-4.343-13.643-4.343-3.706,0-6.904.578-9.505,1.718-2.615,1.145-4.736,2.672-6.304,4.538-1.556,1.848-2.704,3.921-3.411,6.16l-.25.791.786.264,9.799,3.294.904.304.192-.935c.356-1.73,1.124-3.157,2.284-4.241,1.127-1.054,2.922-1.588,5.336-1.588,2.454,0,4.24.554,5.309,1.647,1.088,1.114,1.618,2.509,1.618,4.266v1.52h-10.644c-3.245,0-6.178.518-8.72,1.539-2.592,1.043-4.65,2.62-6.118,4.687-1.477,2.079-2.226,4.673-2.226,7.711s.747,5.654,2.219,7.786c1.463,2.121,3.472,3.754,5.972,4.855,2.463,1.084,5.277,1.634,8.365,1.634,3.047,0,5.505-.456,7.304-1.356,1.803-.902,3.157-1.97,4.024-3.176.645-.899,1.109-1.661,1.405-2.31h.231c.183,1.616.962,2.949,2.324,3.97,1.495,1.121,3.399,1.689,5.659,1.689h7.94v-10.475h-4.223l.002.002ZM62.69,43.417c0,2.529-.832,4.49-2.544,5.997-1.72,1.514-3.99,2.281-6.748,2.281-2.044,0-3.599-.42-4.622-1.248-.983-.795-1.46-1.796-1.46-3.06,0-1.251.442-2.191,1.351-2.872.972-.729,2.364-1.098,4.139-1.098h9.884Z";
const TAKTO_T  = "47.303,11.826 47.303,10.981 47.303,.845 47.303,0 46.458,0 .845,0 0,0 0,.845 0,10.981 0,11.826 .845,11.826 17.232,11.826 17.232,59.973 17.232,60.818 18.077,60.818 29.227,60.818 30.072,60.818 30.072,59.973 30.072,11.826 46.458,11.826 47.303,11.826";

// ─── Global CSS ───────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { background: #f3f3f3; color: #17181e; font-family: 'Space Grotesk', sans-serif; font-size: 15px; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #cccccc; border-radius: 2px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  .fu { animation: fadeUp 0.25s ease both; }
  .fi { animation: fadeIn 0.2s ease both; }
`;
function GlobalStyles() { return <style>{css}</style>; }

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Ideas lifted here so they persist across screen navigation
  const [ideas, setIdeas] = useState([]);
  const [ideasLoaded, setIdeasLoaded] = useState(false);

  const fetchProfile = useCallback(async (uid) => {
    try {
      const { data } = await supabase.from("profiles")
        .select("niche,style,notifications_enabled,onboarding_completed")
        .eq("user_id", uid).maybeSingle();
      if (data) {
        // Ensure arrays are never null
        const normalised = {
          ...data,
          niche: data.niche || [],
          style: data.style || [],
        };
        setProfile(normalised);
        return normalised;
      }
      const { data: created } = await supabase.from("profiles")
        .upsert({ user_id: uid, onboarding_completed: false }, { onConflict: "user_id" })
        .select().maybeSingle();
      if (created) {
        const normalised = { ...created, niche: created.niche || [], style: created.style || [] };
        setProfile(normalised);
        return normalised;
      }
      return null;
    } catch { return null; }
  }, []);

  const fetchIdeas = useCallback(async (uid) => {
    if (!uid) return;
    try {
      const { data, error } = await supabase
        .from("content_ideas").select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (!error && data) { setIdeas(data); setIdeasLoaded(true); }
    } catch (_e) {}
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const refreshIdeas = useCallback(async () => {
    if (user) await fetchIdeas(user.id);
  }, [user, fetchIdeas]);

  useEffect(() => {
    // Safety timeout — never stay stuck loading
    const t = setTimeout(() => setLoading(false), 5000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(t);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([
          fetchProfile(session.user.id),
          fetchIdeas(session.user.id),
        ]).finally(() => setLoading(false));
      }
      else setLoading(false);
    }).catch(() => { clearTimeout(t); setLoading(false); });

    // Listen for auth changes — handle each event type explicitly
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null); setProfile(null); setIdeas([]); setIdeasLoaded(false);
        setLoading(false);
        return;
      }
      if (event === "TOKEN_REFRESHED") {
        // Token silently refreshed — just update user object, no need to re-fetch profile
        setUser(session?.user ?? null);
        return;
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setUser(session?.user ?? null);
        if (session?.user) {
          try { await fetchProfile(session.user.id); } catch (_e) {}
          try { await fetchIdeas(session.user.id); } catch (_e) {}
        } else {
          setProfile(null);
          setIdeas([]);
        }
        setLoading(false);
        return;
      }
      // Any other event — update user state
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, [fetchProfile]);

  const signOut = async () => {
    // Clear local state immediately so UI responds right away
    setUser(null);
    setProfile(null);
    // Then attempt server-side signout
    try { await supabase.auth.signOut({ scope: "local" }); } catch (_e) {}
    // Force navigation
    window.location.href = window.location.pathname + "#/auth";
  };

  return (
    <AuthCtx.Provider value={{ user, profile, loading, signOut, refreshProfile, ideas, setIdeas, ideasLoaded, refreshIdeas }}>
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
  const navigate = useCallback((to) => {
    window.location.hash = to;
    setPath(to);
  }, []);
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
        <div key={t.id} className="fu" style={{ background: C.dark, color: C.white, borderRadius: 6, padding: "10px 18px", fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", boxShadow: "0 4px 0 0 rgba(0,0,0,0.2)" }}>{t.msg}</div>
      ))}
    </div>
  );
  return { show, ToastContainer };
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function TaktoLogo({ size = 22 }) {
  // New SVG viewBox is 0 0 200 62
  const w = Math.round(size * (200 / 62));
  return (
    <svg width={w} height={size} viewBox="0 0 200 62" fill="none" style={{ display: "block" }}>
      <path d={TAKTO_O}  fill={C.dark} />
      <path d={TAKTO_KT} fill={C.dark} />
      <path d={TAKTO_A}  fill={C.dark} />
      <polygon points={TAKTO_T} fill={C.dark} />
    </svg>
  );
}

// Figma card: bg #f3f3f3, border 1px #17181e, border-radius 25px, box-shadow 0 5px 0 0 #17181e
function IdeaCard({ children, style: sx }) {
  return (
    <div style={{
      background: C.bg, border: `1px solid ${C.dark}`,
      borderRadius: 25, boxShadow: CARD_SHADOW, overflow: "hidden", ...sx,
    }}>
      {children}
    </div>
  );
}

// Auth card: bg white, same border/shadow
function AuthCard({ children }) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.dark}`,
      borderRadius: 25, boxShadow: CARD_SHADOW, overflow: "hidden",
      width: 500,
    }}>
      {children}
    </div>
  );
}

function Spinner({ size = 16 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${C.grey20}`, borderTopColor: C.dark, animation: "spin 0.6s linear infinite", flexShrink: 0 }} />;
}

// Chip from Figma: height 32px, border-radius 6px, padding 0 10px 1px 8px, font 18px Medium
// selected = solid color, unselected = 25% opacity
function Chip({ label, selected, onClick, color = C.green }) {
  // White text on blue (technique chips), dark text on green/coral
  const textColor = selected && color === C.blue ? C.white : C.dark;
  return (
    <button type="button" onClick={onClick} style={{
      height: 32, display: "inline-flex", alignItems: "center",
      padding: "0px 10px 1px 8px", borderRadius: 6,
      background: selected ? color : `${color}40`,
      color: textColor, border: "none", cursor: onClick ? "pointer" : "default",
      fontSize: 18, fontWeight: 500,
      fontFamily: "'Space Grotesk', sans-serif",
      whiteSpace: "nowrap", lineHeight: "normal",
    }}>
      {label}
    </button>
  );
}

// Small tag chip (grey, used on idea cards): height 20px
function Tag({ label }) {
  return (
    <span style={{
      height: 20, display: "inline-flex", alignItems: "center",
      padding: "0 6px", borderRadius: 6,
      background: C.grey10, color: C.dark,
      fontSize: 12, fontWeight: 500,
      fontFamily: "'Space Grotesk', sans-serif",
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

// ─── Nav & Shell ─────────────────────────────────────────────────────────────
const NAV = [
  { path: "/generate", label: "Generate" },
  { path: "/schedule", label: "Schedule" },
  { path: "/profile",  label: "Profile" },
];

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// Sidebar matches Figma exactly:
// 240px wide, bg #f3f3f3, box-shadow 2px 0 0 2px #17181e
// Logo at top-left, nav items at 32px SemiBold
// Active item: green pill bg, height 49px, border-radius 6px, left 30px
function Sidebar({ path, navigate }) {
  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: C.bg, boxShadow: SIDEBAR_SHADOW,
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0, zIndex: 10,
    }}>
      {/* Logo — top: ~47px, left: ~30px */}
      <div style={{ padding: "47px 0 0 30px" }}>
        <TaktoLogo size={22} />
      </div>

      {/* Nav — first item at ~top 124px from sidebar top */}
      <nav style={{ marginTop: 30, padding: "0 0 0 30px", flex: 1 }}>
        {NAV.map(item => {
          const active = path === item.path;
          return (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              display: "inline-block", textAlign: "left",
              padding: active ? "3px 10px" : "3px 10px",
              height: active ? 49 : undefined,
              lineHeight: active ? "43px" : "normal",
              background: active ? C.green : "transparent",
              border: "none", borderRadius: active ? 6 : 0,
              color: active ? C.dark : C.grey,
              fontSize: 32, fontWeight: 700,
              cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: 16, width: "auto",
              boxSizing: "border-box",
            }}>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Copyright */}
      <div style={{ padding: "0 0 24px 40px" }}>
        <p style={{ fontSize: 10, fontWeight: 500, color: C.grey }}>© 2026 Takto. All rights reserved.</p>
      </div>
    </aside>
  );
}

function BottomNav({ path, navigate }) {
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, height: 56,
      background: C.bg, borderTop: `2px solid ${C.dark}`,
      display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 100,
    }}>
      {NAV.map(item => {
        const active = path === item.path;
        return (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            background: active ? C.green : "transparent", border: "none",
            borderRadius: 6, padding: "4px 14px",
            fontSize: 16, fontWeight: active ? 700 : 500,
            color: active ? C.dark : C.grey,
            cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
          }}>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function AppShell({ children, path, navigate }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {!isMobile && <Sidebar path={path} navigate={navigate} />}
      <main style={{ flex: 1, overflow: "auto", paddingBottom: isMobile ? 56 : 0 }}>
        {children}
      </main>
      {isMobile && <BottomNav path={path} navigate={navigate} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH SCREEN — Pixel-perfect from Figma 50:2804
// Card: white, 500px wide, centered. Inputs: #f3f3f3, 50px tall, 18px.
// Sign in button: green, 132px wide centered, 49px tall, 26px SemiBold
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
        if (!data.session) setOk("Check your email to confirm.");
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

  const inputStyle = {
    background: C.bg, border: "none", borderRadius: 6,
    height: 50, padding: "0 18px", width: "100%",
    fontSize: 18, fontWeight: 500, color: C.grey,
    fontFamily: "'Space Grotesk', sans-serif", outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div className="fu" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Logo */}
        <TaktoLogo size={28} />

        {/* Tagline — 22px Medium */}
        <p style={{ fontSize: 22, fontWeight: 500, color: C.dark, marginTop: 16, marginBottom: 40 }}>
          No more creator's block.
        </p>

        {/* Card — white, 500px, border-radius 25px */}
        <AuthCard>
          <div style={{ padding: "36px 60px 36px" }}>
            {/* "Sign in" heading — 20px Medium, centered */}
            <p style={{ fontSize: 20, fontWeight: 500, color: C.dark, textAlign: "center", marginBottom: 28 }}>
              {mode === "forgot" ? "Reset password" : mode === "signup" ? "Sign up" : "Sign in"}
            </p>

            {mode !== "forgot" && (
              <>
                {/* Google button — #17181e, 50px tall, full width, border-radius 6 */}
                <button onClick={googleSignIn} disabled={busy} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  width: "100%", height: 50, background: C.dark, border: "none",
                  borderRadius: 6, color: C.bg, fontSize: 14, fontWeight: 500,
                  cursor: busy ? "not-allowed" : "pointer", marginBottom: 20,
                  fontFamily: "'Inter', sans-serif", opacity: busy ? 0.7 : 1,
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                {/* or divider */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1, height: 1, background: C.grey }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.grey }}>or</span>
                  <div style={{ flex: 1, height: 1, background: C.grey }} />
                </div>
              </>
            )}

            {/* Inputs */}
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="email" placeholder="Email address"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" style={inputStyle}
              />
              {mode !== "forgot" && (
                <input
                  type="password" placeholder="Password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={6} style={inputStyle}
                />
              )}

              {err && <p style={{ color: C.coral, fontSize: 13, fontWeight: 500 }}>{err}</p>}
              {ok  && <p style={{ color: "#22c55e", fontSize: 13, fontWeight: 500 }}>{ok}</p>}

              {/* Sign in button — green, 132px centered, 49px tall, 26px SemiBold */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                <button type="submit" disabled={busy} style={{
                  background: C.green, border: "none", borderRadius: 6,
                  height: 49, width: 132,
                  fontSize: 26, fontWeight: 700, color: C.dark,
                  cursor: busy ? "not-allowed" : "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: busy ? 0.7 : 1,
                }}>
                  {busy && <Spinner size={14} />}
                  {mode === "forgot" ? "Send link" : mode === "signup" ? "Sign up" : "Sign in"}
                </button>
              </div>
            </form>

            {/* Links — 20px Medium */}
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {mode !== "forgot" && (
                <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(""); setOk(""); }}
                  style={{ background: "none", border: "none", fontSize: 20, fontWeight: 500, color: C.dark, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
                  {mode === "signup" ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                </button>
              )}
              {mode === "login" && (
                <button onClick={() => { setMode("forgot"); setErr(""); setOk(""); }}
                  style={{ background: "none", border: "none", fontSize: 20, fontWeight: 500, color: C.grey, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
                  Forgot password?
                </button>
              )}
              {mode === "forgot" && (
                <button onClick={() => setMode("login")}
                  style={{ background: "none", border: "none", fontSize: 20, fontWeight: 500, color: C.grey, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
                  Back to sign in
                </button>
              )}
            </div>
          </div>
        </AuthCard>

        {/* Footer — 14px Medium grey */}
        <p style={{ fontSize: 14, fontWeight: 500, color: C.grey, marginTop: 20, textAlign: "center" }}>
          By signing in you agree to our Terms &amp; Privacy Policy
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING — Figma 64:2991
// ═══════════════════════════════════════════════════════════════════════════════
const NICHES = [
  "💄 Beauty & Makeup", "👗 Fashion & Style", "🌿 Health & Wellness", "✈️ Travel & Adventure",
  "🍳 Food & Cooking", "💰 Side Hustles", "📈 Personal Finance", "💻 Tech & Gadgets",
  "🎮 Gaming", "🎨 DIY & Crafts", "😂 Comedy & Memes", "🐾 Pet & Animals", "👨‍👩‍👧 Parenting & Family",
];
const STYLES = [
  "⭐ Personal Brand/Influencer", "🎭 Comedy/Skit", "📚 Tutorial/Educational",
  "🔥 Challenge/Trend", "🌸 Aesthetic/Mood-Based", "💰 Side Hustles",
  "📋 Review/Reaction", "📖 Storytime/Narration", "✨ Transformation/Glow-Up",
  "🎨 DIY & Crafts", "💪 Motivational/Inspirational", "🎯 Niche Hobbyist",
];

function OnboardingScreen({ navigate }) {
  const { user, refreshProfile } = useAuth();
  const [niches, setNiches] = useState([]);
  const [styles, setStyles] = useState([]);
  const [notifs, setNotifs] = useState(true);
  const [busy, setBusy] = useState(false);

  const toggle = (list, setList, val) =>
    setList(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val]);

  const addCustom = (setList) => {
    const v = prompt("Add custom:");
    if (v?.trim()) setList(p => [...p, v.trim()]);
  };

  const finish = async () => {
    if (!user) return;
    setBusy(true);
    await supabase.from("profiles").update({ niche: niches, style: styles, notifications_enabled: notifs, onboarding_completed: true }).eq("user_id", user.id);
    await refreshProfile();
    navigate("/generate");
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 40px 80px" }}>
      <div className="fu" style={{ width: "100%", maxWidth: 760, textAlign: "center" }}>
        <TaktoLogo size={22} />

        {/* Niche */}
        <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 20 }}>What's your niche?</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {NICHES.map(n => (
            <Chip key={n} label={n} selected={niches.includes(n)} onClick={() => toggle(niches, setNiches, n)} color={C.green} />
          ))}
          {niches.filter(n => !NICHES.includes(n)).map(n => (
            <Chip key={n} label={n} selected onClick={() => toggle(niches, setNiches, n)} color={C.green} />
          ))}
          <Chip label="Add new..." selected={false} onClick={() => addCustom(setNiches)} color={C.green} />
        </div>

        {/* Style */}
        <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 20 }}>What's your content style?</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {STYLES.map(s => (
            <Chip key={s} label={s} selected={styles.includes(s)} onClick={() => toggle(styles, setStyles, s)} color={C.green} />
          ))}
          {styles.filter(s => !STYLES.includes(s)).map(s => (
            <Chip key={s} label={s} selected onClick={() => toggle(styles, setStyles, s)} color={C.green} />
          ))}
          <Chip label="Add new..." selected={false} onClick={() => addCustom(setStyles)} color={C.green} />
        </div>

        {/* Notification card */}
        <div style={{ marginTop: 40 }}>
          <div style={{ background: C.bg, border: `1px solid ${C.dark}`, borderRadius: 25, boxShadow: CARD_SHADOW, padding: "22px 32px", display: "flex", alignItems: "center", gap: 20 }}>
            {/* Radio button visual */}
            <div onClick={() => setNotifs(p => !p)} style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${notifs ? C.green : C.grey}`, background: notifs ? C.green : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {notifs && <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.dark }} />}
            </div>
            <p style={{ fontSize: 18, fontWeight: 500 }}>Get reminded about posting?</p>
          </div>
        </div>

        {/* Continue button */}
        <div style={{ marginTop: 40, display: "flex", justifyContent: "center" }}>
          <button onClick={finish} disabled={busy} style={{
            background: C.green, border: "none", borderRadius: 6,
            height: 49, padding: "0 40px",
            fontSize: 26, fontWeight: 700, color: C.dark,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
            display: "flex", alignItems: "center", gap: 10,
            opacity: busy ? 0.7 : 1,
          }}>
            {busy && <Spinner size={14} />}
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE SCREEN — Figma 50:2605 (empty) + 50:2658 (with results)
// Top row: "Trending now •" coral 46px | "Generate Ideas ✦" gradient 46px right-aligned
// Post Technique: blue chips
// Cards: #f3f3f3, border 1px #17181e, radius 25px, shadow 0 5px 0 0 #17181e
// ═══════════════════════════════════════════════════════════════════════════════
const POST_TECHNIQUES = ["All of them", "Talking Heads", "POV B-Roll", "Day in my Life", "Story Narrative", "Split Screen Comparison", "Text Overlay Carousel"];
const TRENDING_HASHTAGS = ["#dayinmylife", "#hottake", "#unpopularopinion", "#getreadywithme", "#whatieatinaday", "#letmeshowyou", "#trieditsoyoudonthaveto", "#thingsthatjustmakesense", "#thingsnobodytellsyou"];

function GenerateScreen() {
  const { user, profile, ideas, setIdeas, refreshIdeas } = useAuth();
  const [techniques, setTechniques] = useState(["All of them"]);
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [trendingOn, setTrendingOn] = useState(false);
  const [ideas, setIdeas] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState([]);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const toggleTech = (t) => {
    if (t === "All of them") { setTechniques(["All of them"]); return; }
    setTechniques(p => {
      const w = p.filter(x => x !== "All of them");
      return w.includes(t) ? (w.filter(x => x !== t).length ? w.filter(x => x !== t) : ["All of them"]) : [...w, t];
    });
  };

  const addCustomTech = () => {
    const v = prompt("Add custom technique:");
    if (v?.trim()) setTechniques(p => [...p.filter(x => x !== "All of them"), v.trim()]);
  };

  const generate = async () => {
    if (!profile) return;
    setGenerating(true); setGeneratedIdeas([]); setExpandedIdx(null); setSavedIds(new Set());
    try {
      const techCtx = techniques.includes("All of them") ? "any technique" : techniques.join(", ");
      const hashCtx = selectedHashtags.length > 0 ? `\nTrending hashtags to incorporate: ${selectedHashtags.join(", ")}` : "";
      const trendCtx = trendingOn ? "\nMake ideas trend-aware and optimised for viral reach." : "";
      const text = await callClaude(
        "You are Takto, a UGC content strategist. Return ONLY valid JSON, no markdown.",
        `Generate 6 ideas for:
- Niches: ${profile.niche?.join(", ")}
- Styles: ${profile.style?.join(", ")}
- Technique: ${techCtx}
${hashCtx}${trendCtx}

JSON: {"ideas":[{"title":"","hook":"","format":"","difficulty":"Easy|Medium|Hard","time_to_create":"15min|30min|1hr","why_it_works":""}]}`
        , 2000
      );
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setGeneratedIdeas(parsed.ideas || []);
    } catch (genErr) {
      console.error("Generate error:", genErr);
    }
    setGenerating(false);
  };

  const saveIdea = async (idea, idx) => {
    if (!user || savedIds.has(idx)) return;
    const { error } = await supabase.from("content_ideas").insert({
      user_id: user.id, title: idea.title,
      description: `Hook: "${idea.hook}" | Format: ${idea.format} | Why it works: ${idea.why_it_works}`,
      date_scheduled: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      difficulty: idea.difficulty || "Medium", status: "pending",
    });
    if (!error) { setSavedIds(p => new Set([...p, idx])); await refreshIdeas(); }
  };

  const saveAll = async () => {
    for (let i = 0; i < generatedIdeas.length; i++) await saveIdea(generatedIdeas[i], i);
    await refreshIdeas();
  };


  return (
    <div style={{ padding: "40px 40px 80px", maxWidth: 800, margin: "0 auto" }}>
      {/* Top row: Trending now • | Generate Ideas ✦ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <button onClick={() => { setTrendingOn(p => !p); if (trendingOn) setSelectedHashtags([]); }} style={{
          height: 46, padding: "0 16px", borderRadius: 6,
          background: trendingOn ? C.coral : C.coral,
          border: "none", color: C.white,
          fontSize: 24, fontWeight: 700,
          cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          Trending now {trendingOn ? "•" : "○"}
        </button>

        <button onClick={generate} disabled={generating} style={{
          height: 46, padding: "0 20px", borderRadius: 6,
          background: generating ? C.grey20 : AI_GRADIENT,
          border: "none", color: C.white,
          fontSize: 24, fontWeight: 700,
          cursor: generating ? "not-allowed" : "pointer",
          fontFamily: "'Space Grotesk', sans-serif",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {generating ? <Spinner size={16} /> : null}
          Generate Ideas {!generating && "✦"}
        </button>
      </div>

      {/* Trending hashtags */}
      {trendingOn && (
        <div className="fi" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TRENDING_HASHTAGS.map(h => (
              <Chip key={h} label={h}
                selected={selectedHashtags.includes(h)}
                onClick={() => setSelectedHashtags(p => p.includes(h) ? p.filter(x => x !== h) : [...p, h])}
                color={C.coral}
              />
            ))}
          </div>
        </div>
      )}

      {/* Post Technique — 24px SemiBold heading, blue chips */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 14 }}>Post Technique</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {POST_TECHNIQUES.map(t => (
            <Chip key={t} label={t}
              selected={techniques.includes(t)}
              onClick={() => toggleTech(t)}
              color={C.blue}
            />
          ))}
          <Chip label="Add new..." selected={false} onClick={addCustomTech} color={C.blue} />
        </div>
      </div>

      {/* Empty state placeholder */}
      {!generating && generatedIdeas.length === 0 && (
        <p style={{ fontSize: 22, fontWeight: 400, color: C.grey }}>
          Hit Generate to get 6 ideas tailored to your niche and style...
        </p>
      )}

      {/* Generating state */}
      {generating && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "16px 0" }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: C.dark, animation: "blink 1.2s ease infinite", animationDelay: `${i * 0.2}s` }} />)}
          <p style={{ fontSize: 18, color: C.grey, fontWeight: 500, marginLeft: 8 }}>Generating ideas...</p>
        </div>
      )}

      {/* Results */}
      {!generating && generatedIdeas.length > 0 && (
        <div className="fi">
          {/* "Saved ideas get scheduled automatically..." + Save All button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <p style={{ fontSize: 22, fontWeight: 400, color: C.grey }}>Saved ideas get scheduled automatically...</p>
            <button onClick={saveAll} style={{
              height: 36, padding: "0 12px", borderRadius: 6,
              background: C.green, border: `1px solid ${C.dark}`,
              fontSize: 16, fontWeight: 700, color: C.dark,
              cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              Save All +
            </button>
          </div>

          {/* Idea cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {generatedIdeas.map((idea, i) => {
              const isExpanded = expandedIdx === i;
              const isSaved = savedIds.has(i);
              return (
                <IdeaCard key={i} className="fu" style={{ animationDelay: `${i * 40}ms` }}>
                  {/* Collapsed row */}
                  <div style={{ padding: "20px 24px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title — 22px Medium */}
                      <p style={{ fontSize: 22, fontWeight: 500, marginBottom: 10 }}>{idea.title}</p>
                      {/* Tags row — grey chips, 20px tall, 10px font */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {idea.difficulty && <Tag label={`${idea.difficulty} · ${idea.time_to_create || ""}`} />}
                        {idea.format && <Tag label={idea.format} />}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                      {/* Save button — green, 46px tall, 110px wide with + icon */}
                      {!isSaved ? (
                        <button onClick={() => saveIdea(idea, i)} style={{
                          height: 36, padding: "0 12px", borderRadius: 6,
                          background: C.green, border: `1px solid ${C.dark}`,
                          fontSize: 16, fontWeight: 700, color: C.dark,
                          cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        }}>
                          Save +
                        </button>
                      ) : (
                        <div style={{ height: 36, width: 36, borderRadius: 6, background: C.green, border: `1px solid ${C.dark}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✓</div>
                      )}
                      {/* Expand chevron — ∨ down when closed, ∧ up when open */}
                      <button onClick={() => setExpandedIdx(isExpanded ? null : i)} style={{
                        background: "none", border: "none", cursor: "pointer", padding: "4px",
                        display: "flex", alignItems: "center",
                      }}>
                        <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                          {isExpanded
                            ? <><line x1="1" y1="10" x2="9" y2="2" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/><line x1="9" y1="2" x2="17" y2="10" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/></>
                            : <><line x1="1" y1="2" x2="9" y2="10" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/><line x1="9" y1="10" x2="17" y2="2" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/></>
                          }
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="fi" style={{ padding: "16px 24px 20px" }}>
                      {idea.hook && (
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>Hook</p>
                          <p style={{ fontSize: 14, fontWeight: 400, color: C.dark, lineHeight: 1.5 }}>{idea.hook}</p>
                        </div>
                      )}
                      {idea.why_it_works && (
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>Why it works</p>
                          <p style={{ fontSize: 14, fontWeight: 400, color: C.dark, lineHeight: 1.5 }}>{idea.why_it_works}</p>
                        </div>
                      )}
                    </div>
                  )}
                </IdeaCard>
              );
            })}
          </div>

          {/* Generate 6 more ideas... — 24px Bold underlined */}
          <div style={{ textAlign: "center" }}>
            <button onClick={generate} style={{
              background: "none", border: "none",
              fontSize: 24, fontWeight: 700, color: C.dark,
              textDecoration: "underline", cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Generate 6 more ideas...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function ScheduleScreen({ navigate }) {
  const { user, ideas, setIdeas, refreshIdeas } = useAuth();
  const [month, setMonth] = useState(new Date());
  const [dragId, setDragId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Refresh ideas when screen mounts (in case new ones were saved)
  useEffect(() => { if (user) refreshIdeas(); }, [user]);

  // Only show ideas that have been saved to the schedule
  const scheduledIdeas = ideas.filter(i => i.date_scheduled);

  const drop = async (ds) => {
    if (!dragId) return;
    await supabase.from("content_ideas").update({ date_scheduled: ds, status: "saved" }).eq("id", dragId);
    setIdeas(p => p.map(i => i.id === dragId ? { ...i, date_scheduled: ds, status: "saved" } : i));
    setDragId(null);
  };

  const deleteIdea = async (id) => {
    await supabase.from("content_ideas").delete().eq("id", id);
    setIdeas(p => p.filter(i => i.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  // Parse hook/format/difficulty/time from description field
  const parseDesc = (desc) => {
    if (!desc) return {};
    const hook = desc.match(/Hook: "([^"]+)"/)?.[1] || null;
    const format = desc.match(/Format: ([^|]+)/)?.[1]?.trim() || null;
    const why = desc.match(/Why it works: (.+)/)?.[1]?.trim() || null;
    return { hook, format, why };
  };

  // Calendar grid
  const days = [];
  let d = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  while (d <= endOfWeek(endOfMonth(month), { weekStartsOn: 1 })) { days.push(d); d = addDays(d, 1); }
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const selIdeas = selected ? scheduledIdeas.filter(i => i.date_scheduled === format(selected, "yyyy-MM-dd")) : [];

  return (
    <div style={{ padding: "36px 40px 80px", maxWidth: 800, margin: "0 auto" }}>

      {/* Month heading + nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>{format(month, "MMMM yyyy")}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => setMonth(subMonths(month, 1))} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <line x1="12" y1="3" x2="4" y2="10" stroke={C.grey} strokeWidth="2"/>
              <line x1="4" y1="10" x2="12" y2="17" stroke={C.grey} strokeWidth="2"/>
            </svg>
          </button>
          <button onClick={() => setMonth(new Date())} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, fontWeight: 500, color: C.grey, fontFamily: "'Space Grotesk', sans-serif" }}>Today</button>
          <button onClick={() => setMonth(addMonths(month, 1))} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <line x1="4" y1="3" x2="12" y2="10" stroke={C.grey} strokeWidth="2"/>
              <line x1="12" y1="10" x2="4" y2="17" stroke={C.grey} strokeWidth="2"/>
            </svg>
          </button>
        </div>
      </div>

      {scheduledIdeas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ fontSize: 22, fontWeight: 400, color: C.grey, marginBottom: 20 }}>No ideas scheduled yet</p>
          <button onClick={() => navigate("/generate")} style={{ height: 49, padding: "0 24px", borderRadius: 6, background: C.green, border: "none", fontSize: 24, fontWeight: 700, color: C.dark, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
            Generate Ideas →
          </button>
        </div>
      ) : (
        <>
          {/* Calendar grid — no background on header row */}
          <div style={{ width: "100%" }}>
            {/* Day headers — no background, just text */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day => (
                <div key={day} style={{ padding: "6px 12px 10px", fontSize: 18, fontWeight: 500, color: C.dark }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Week rows — fixed height 130px, no flex */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {week.map(day => {
                  const ds = format(day, "yyyy-MM-dd");
                  const dayIdeas = scheduledIdeas.filter(i => i.date_scheduled === ds);
                  const inMonth = isSameMonth(day, month);
                  const isSel = selected && isSameDay(day, selected);
                  return (
                    <div
                      key={ds}
                      onClick={() => { setSelected(isSel ? null : day); setExpandedId(null); }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => drop(ds)}
                      style={{
                        height: 130,
                        border: `1px solid ${C.grey20}`,
                        padding: "10px 10px 8px",
                        cursor: "pointer",
                        background: isSel ? `${C.green}15` : C.white,
                        display: "flex",
                        flexDirection: "column",
                        boxSizing: "border-box",
                        outline: isSel ? `2px solid ${C.dark}` : "none",
                        outlineOffset: -2,
                      }}
                    >
                      {/* Date number */}
                      <p style={{ fontSize: 24, fontWeight: 500, color: inMonth ? C.dark : C.grey20, lineHeight: 1, marginBottom: 6, flexShrink: 0 }}>
                        {format(day, "d")}
                      </p>

                      {/* Event chips — fill remaining space, overflow hidden */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, overflow: "hidden", flex: 1 }}>
                        {dayIdeas.slice(0, 3).map(idea => (
                          <div
                            key={idea.id}
                            draggable
                            onDragStart={e => { e.stopPropagation(); setDragId(idea.id); }}
                            onClick={e => e.stopPropagation()}
                            style={{
                              height: 26, borderRadius: 6, padding: "0 6px",
                              background: C.green,
                              fontSize: 12, fontWeight: 400, color: C.dark,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              cursor: "grab", display: "flex", alignItems: "center", flexShrink: 0,
                            }}
                          >
                            {idea.title.length > 16 ? idea.title.slice(0, 16) + "…" : idea.title}
                          </div>
                        ))}
                        {dayIdeas.length > 3 && (
                          <p style={{ fontSize: 10, color: C.grey, lineHeight: 1 }}>+{dayIdeas.length - 3}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Selected day detail */}
          {selected && (
            <div className="fi" style={{ marginTop: 24 }}>
              <p style={{ fontSize: 20, fontWeight: 500, color: C.grey, marginBottom: 14 }}>
                {format(selected, "EEE d MMMM yyyy")}
              </p>

              {selIdeas.length === 0 ? (
                <p style={{ fontSize: 16, color: C.grey }}>No ideas — drag one here to schedule it</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {selIdeas.map(idea => {
                    const isExpanded = expandedId === idea.id;
                    const parsed = parseDesc(idea.description);
                    return (
                      <IdeaCard key={idea.id}>
                        {/* Header row — always visible */}
                        <div style={{ padding: "20px 24px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 22, fontWeight: 500, marginBottom: 10 }}>{idea.title}</p>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {idea.difficulty && <Tag label={idea.difficulty} />}
                              {parsed.format && <Tag label={parsed.format} />}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                            {/* × removes from schedule */}
                            <button onClick={() => deleteIdea(idea.id)} style={{
                              width: 36, height: 36, borderRadius: 6,
                              background: C.bg, border: `1px solid ${C.dark}`,
                              fontSize: 20, color: C.dark, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'Space Grotesk', sans-serif",
                            }}>×</button>
                            {/* Expand chevron */}
                            <button onClick={() => setExpandedId(isExpanded ? null : idea.id)} style={{
                              background: "none", border: "none", cursor: "pointer", padding: "4px",
                              display: "flex", alignItems: "center",
                            }}>
                              <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                                {isExpanded
                                  ? <><line x1="1" y1="10" x2="9" y2="2" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/><line x1="9" y1="2" x2="17" y2="10" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/></>
                                  : <><line x1="1" y1="2" x2="9" y2="10" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/><line x1="9" y1="10" x2="17" y2="2" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/></>
                                }
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="fi" style={{ padding: "0 24px 20px" }}>
                            {parsed.hook && (
                              <div style={{ marginBottom: 12 }}>
                                <p style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>Hook</p>
                                <p style={{ fontSize: 14, fontWeight: 400, color: C.dark, lineHeight: 1.5 }}>{parsed.hook}</p>
                              </div>
                            )}
                            {parsed.why && (
                              <div>
                                <p style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>Why it works</p>
                                <p style={{ fontSize: 14, fontWeight: 400, color: C.dark, lineHeight: 1.5 }}>{parsed.why}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </IdeaCard>
                    );
                  })}
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
// PROFILE SCREEN — Figma 50:2389 (view) + 88:3235 (edit)
// "Creator Settings" 24px SemiBold
// Email: #e5e5e5 bg, border 1px #17181e, 46px tall, 24px SemiBold
// "Edit": 24px SemiBold grey underlined, right-aligned
// Section labels: 20px SemiBold grey
// Chips: height 32px, 18px Medium
// "Posting Reminder" label then "On/Off" 18px Medium
// "↙ Log out": 24px SemiBold grey underlined
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

  const toggle = (list, setList, val) =>
    setList(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val]);

  const addCustom = (setList) => {
    const v = prompt("Add custom:");
    if (v?.trim()) setList(p => [...p, v.trim()]);
  };

  // Section label — 20px SemiBold grey
  const SectionLabel = ({ children }) => (
    <p style={{ fontSize: 20, fontWeight: 700, color: C.grey, marginBottom: 12 }}>{children}</p>
  );

  return (
    <div style={{ padding: "36px 40px 80px", maxWidth: 800, margin: "0 auto" }}>
      <ToastContainer />

      {/* "Creator Settings" — 24px SemiBold */}
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32 }}>Creator Settings</h1>

      {/* Email + Edit row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
        <div style={{ background: C.grey10, border: `1px solid ${C.dark}`, borderRadius: 6, height: 46, padding: "0 18px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: C.dark }}>{user?.email}</span>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", fontSize: 24, fontWeight: 700, color: C.grey, textDecoration: "underline", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>Edit</button>
        ) : (
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", fontSize: 20, fontWeight: 500, color: C.grey, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ height: 46, padding: "0 20px", borderRadius: 6, background: C.green, border: "none", fontSize: 24, fontWeight: 700, color: C.dark, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'Space Grotesk', sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
              {saving && <Spinner size={14} />} Save
            </button>
          </div>
        )}
      </div>

      {/* Niche */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel>Niche</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {editing ? (
            <>
              {NICHES.map(n => <Chip key={n} label={n} selected={niches.includes(n)} onClick={() => toggle(niches, setNiches, n)} color={C.green} />)}
              {niches.filter(n => !NICHES.includes(n)).map(n => <Chip key={n} label={n} selected onClick={() => toggle(niches, setNiches, n)} color={C.green} />)}
              <Chip label="Add new..." selected={false} onClick={() => addCustom(setNiches)} color={C.green} />
            </>
          ) : (
            (profile?.niche || []).map(n => <Chip key={n} label={n} selected color={C.green} />)
          )}
        </div>
      </div>

      {/* Style */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel>Style</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {editing ? (
            <>
              {STYLES.map(s => <Chip key={s} label={s} selected={styles.includes(s)} onClick={() => toggle(styles, setStyles, s)} color={C.green} />)}
              {styles.filter(s => !STYLES.includes(s)).map(s => <Chip key={s} label={s} selected onClick={() => toggle(styles, setStyles, s)} color={C.green} />)}
              <Chip label="Add new..." selected={false} onClick={() => addCustom(setStyles)} color={C.green} />
            </>
          ) : (
            (profile?.style || []).map(s => <Chip key={s} label={s} selected color={C.green} />)
          )}
        </div>
      </div>

      {/* Posting Reminder */}
      <div style={{ marginBottom: 40 }}>
        <SectionLabel>Posting Reminder</SectionLabel>
        {editing ? (
          <button onClick={() => setNotifs(p => !p)} style={{ height: 32, padding: "0 10px 1px 8px", borderRadius: 6, background: notifs ? C.green : `${C.green}40`, border: "none", fontSize: 18, fontWeight: 500, color: C.dark, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
            {notifs ? "On" : "Off"}
          </button>
        ) : (
          <p style={{ fontSize: 18, fontWeight: 500, color: C.dark }}>{notifs ? "On" : "Off"}</p>
        )}
      </div>

      {/* ↙ Log out — 24px SemiBold grey underlined */}
      <button onClick={signOut} style={{ background: "none", border: "none", fontSize: 24, fontWeight: 700, color: C.grey, textDecoration: "underline", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
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
        <TaktoLogo size={24} />
        <Spinner size={22} />
        {(!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) && (
          <div style={{ padding: "12px 18px", border: `1px solid ${C.coral}`, borderRadius: 6, maxWidth: 360, textAlign: "center" }}>
            <p style={{ color: C.coral, fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Missing env vars</p>
            <p style={{ color: C.coral, fontSize: 12 }}>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel</p>
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

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error("App error:", err); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#f3f3f3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
          <svg width="120" height="37" viewBox="0 0 200 62" fill="none">
            <path d={TAKTO_O} fill="#17181e"/><path d={TAKTO_KT} fill="#17181e"/>
            <path d={TAKTO_A} fill="#17181e"/><polygon points={TAKTO_T} fill="#17181e"/>
          </svg>
          <p style={{ fontSize: 18, fontWeight: 500, color: "#7f7f7f" }}>Something went wrong.</p>
          <button onClick={() => window.location.reload()} style={{ height: 46, padding: "0 24px", background: "#6dff8d", border: "1px solid #17181e", borderRadius: 6, fontSize: 18, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <GlobalStyles />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
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

// ─── Design tokens — exact from Figma v2 ─────────────────────────────────────
const C = {
  bg:     "#f3f3f3",  // 5% grey
  white:  "#ffffff",
  dark:   "#17181e",  // dark blue
  grey:   "#7f7f7f",  // 50% grey
  grey20: "#cccccc",  // 20% grey
  grey10: "#e5e5e5",  // 10% grey
  green:  "#6dff8d",
  coral:  "#ff496b",
  blue:   "#0084ff",
};
const CARD_SHADOW = "0px 5px 0px 0px #17181e";
const SIDEBAR_SHADOW = "2px 0px 0px 2px #17181e";
const AI_GRADIENT = "linear-gradient(120deg, #64ffed 0%, #831db6 50%, #ff49d5 100%)";
// Takto logo SVG paths (viewBox 0 0 200 62)
const TAKTO_O  = "M197.009,26.344c-1.989-3.334-4.748-5.915-8.198-7.669-3.428-1.742-7.336-2.626-11.617-2.626s-8.191.883-11.618,2.626c-3.453,1.755-6.211,4.336-8.198,7.669-1.984,3.327-2.991,7.366-2.991,12.005v1.352c0,4.639,1.006,8.678,2.991,12.005,1.987,3.333,4.746,5.913,8.198,7.668,3.427,1.742,7.336,2.626,11.618,2.626s8.189-.883,11.617-2.626c3.451-1.755,6.209-4.335,8.198-7.668,1.985-3.33,2.992-7.369,2.992-12.005v-1.352c0-4.637-1.007-8.675-2.991-12.005h-.001ZM177.193,50.851c-3.064,0-5.522-.956-7.516-2.924-1.963-1.937-2.958-4.789-2.958-8.479v-.845c0-3.69.995-6.543,2.958-8.479,1.994-1.968,4.452-2.924,7.516-2.924,3.118,0,5.588.955,7.554,2.92,1.938,1.938,2.92,4.792,2.92,8.483v.845c0,3.689-.995,6.542-2.958,8.479-1.995,1.968-4.453,2.924-7.515,2.924h-.001Z";
const TAKTO_KT = "M140.302,17.232V4.223h-12.332v13.008h-17.356l-.252.281-13.601,15.177h-.298V0h-12.333v60.818h12.333v-16.641h.295l14.445,16.355.252.286h15.998l-1.313-1.419-19.48-21.042,10.164-10.652h11.146v22.807c0,3.092.95,5.609,2.824,7.482,1.873,1.873,4.333,2.823,7.313,2.823h12.67v-10.475h-8.954c-.939,0-1.52-.283-1.52-1.689v-20.949h11.488v-10.474h-11.488v.002Z";
const TAKTO_A  = "M76.205,50.343c-.939,0-1.521-.283-1.521-1.689v-15.627c0-5.47-1.719-9.721-5.108-12.635-3.354-2.882-7.944-4.343-13.643-4.343-3.706,0-6.904.578-9.505,1.718-2.615,1.145-4.736,2.672-6.304,4.538-1.556,1.848-2.704,3.921-3.411,6.16l-.25.791.786.264,9.799,3.294.904.304.192-.935c.356-1.73,1.124-3.157,2.284-4.241,1.127-1.054,2.922-1.588,5.336-1.588,2.454,0,4.24.554,5.309,1.647,1.088,1.114,1.618,2.509,1.618,4.266v1.52h-10.644c-3.245,0-6.178.518-8.72,1.539-2.592,1.043-4.65,2.62-6.118,4.687-1.477,2.079-2.226,4.673-2.226,7.711s.747,5.654,2.219,7.786c1.463,2.121,3.472,3.754,5.972,4.855,2.463,1.084,5.277,1.634,8.365,1.634,3.047,0,5.505-.456,7.304-1.356,1.803-.902,3.157-1.97,4.024-3.176.645-.899,1.109-1.661,1.405-2.31h.231c.183,1.616.962,2.949,2.324,3.97,1.495,1.121,3.399,1.689,5.659,1.689h7.94v-10.475h-4.223l.002.002ZM62.69,43.417c0,2.529-.832,4.49-2.544,5.997-1.72,1.514-3.99,2.281-6.748,2.281-2.044,0-3.599-.42-4.622-1.248-.983-.795-1.46-1.796-1.46-3.06,0-1.251.442-2.191,1.351-2.872.972-.729,2.364-1.098,4.139-1.098h9.884Z";
const TAKTO_T  = "47.303,11.826 47.303,10.981 47.303,.845 47.303,0 46.458,0 .845,0 0,0 0,.845 0,10.981 0,11.826 .845,11.826 17.232,11.826 17.232,59.973 17.232,60.818 18.077,60.818 29.227,60.818 30.072,60.818 30.072,59.973 30.072,11.826 46.458,11.826 47.303,11.826";

// ─── Global CSS ───────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { background: #f3f3f3; color: #17181e; font-family: 'Space Grotesk', sans-serif; font-size: 15px; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #cccccc; border-radius: 2px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  .fu { animation: fadeUp 0.25s ease both; }
  .fi { animation: fadeIn 0.2s ease both; }
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
    } catch { return null; }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    // Safety timeout — never stay stuck loading
    const t = setTimeout(() => setLoading(false), 5000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(t);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    }).catch(() => { clearTimeout(t); setLoading(false); });

    // Listen for auth changes — handle each event type explicitly
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        // User signed out or session expired — clear everything
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      if (event === "TOKEN_REFRESHED") {
        // Token silently refreshed — just update user object, no need to re-fetch profile
        setUser(session?.user ?? null);
        return;
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setUser(session?.user ?? null);
        if (session?.user) {
          try { await fetchProfile(session.user.id); } catch (_e) {}
        } else {
          setProfile(null);
        }
        setLoading(false);
        return;
      }
      // Any other event — update user state
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, [fetchProfile]);

  const signOut = async () => {
    // Clear local state immediately so UI responds right away
    setUser(null);
    setProfile(null);
    // Then attempt server-side signout
    try { await supabase.auth.signOut({ scope: "local" }); } catch (_e) {}
    // Force navigation
    window.location.href = window.location.pathname + "#/auth";
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
  const navigate = useCallback((to) => {
    window.location.hash = to;
    setPath(to);
  }, []);
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
        <div key={t.id} className="fu" style={{ background: C.dark, color: C.white, borderRadius: 6, padding: "10px 18px", fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", boxShadow: "0 4px 0 0 rgba(0,0,0,0.2)" }}>{t.msg}</div>
      ))}
    </div>
  );
  return { show, ToastContainer };
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function TaktoLogo({ size = 22 }) {
  // New SVG viewBox is 0 0 200 62
  const w = Math.round(size * (200 / 62));
  return (
    <svg width={w} height={size} viewBox="0 0 200 62" fill="none" style={{ display: "block" }}>
      <path d={TAKTO_O}  fill={C.dark} />
      <path d={TAKTO_KT} fill={C.dark} />
      <path d={TAKTO_A}  fill={C.dark} />
      <polygon points={TAKTO_T} fill={C.dark} />
    </svg>
  );
}

// Figma card: bg #f3f3f3, border 1px #17181e, border-radius 25px, box-shadow 0 5px 0 0 #17181e
function IdeaCard({ children, style: sx }) {
  return (
    <div style={{
      background: C.bg, border: `1px solid ${C.dark}`,
      borderRadius: 25, boxShadow: CARD_SHADOW, overflow: "hidden", ...sx,
    }}>
      {children}
    </div>
  );
}

// Auth card: bg white, same border/shadow
function AuthCard({ children }) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.dark}`,
      borderRadius: 25, boxShadow: CARD_SHADOW, overflow: "hidden",
      width: 500,
    }}>
      {children}
    </div>
  );
}

function Spinner({ size = 16 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${C.grey20}`, borderTopColor: C.dark, animation: "spin 0.6s linear infinite", flexShrink: 0 }} />;
}

// Chip from Figma: height 32px, border-radius 6px, padding 0 10px 1px 8px, font 18px Medium
// selected = solid color, unselected = 25% opacity
function Chip({ label, selected, onClick, color = C.green }) {
  // White text on blue (technique chips), dark text on green/coral
  const textColor = selected && color === C.blue ? C.white : C.dark;
  return (
    <button type="button" onClick={onClick} style={{
      height: 32, display: "inline-flex", alignItems: "center",
      padding: "0px 10px 1px 8px", borderRadius: 6,
      background: selected ? color : `${color}40`,
      color: textColor, border: "none", cursor: onClick ? "pointer" : "default",
      fontSize: 18, fontWeight: 500,
      fontFamily: "'Space Grotesk', sans-serif",
      whiteSpace: "nowrap", lineHeight: "normal",
    }}>
      {label}
    </button>
  );
}

// Small tag chip (grey, used on idea cards): height 20px
function Tag({ label }) {
  return (
    <span style={{
      height: 20, display: "inline-flex", alignItems: "center",
      padding: "0 6px", borderRadius: 6,
      background: C.grey10, color: C.dark,
      fontSize: 12, fontWeight: 500,
      fontFamily: "'Space Grotesk', sans-serif",
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

// ─── Nav & Shell ─────────────────────────────────────────────────────────────
const NAV = [
  { path: "/generate", label: "Generate" },
  { path: "/schedule", label: "Schedule" },
  { path: "/profile",  label: "Profile" },
];

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// Sidebar matches Figma exactly:
// 240px wide, bg #f3f3f3, box-shadow 2px 0 0 2px #17181e
// Logo at top-left, nav items at 32px SemiBold
// Active item: green pill bg, height 49px, border-radius 6px, left 30px
function Sidebar({ path, navigate }) {
  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: C.bg, boxShadow: SIDEBAR_SHADOW,
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0, zIndex: 10,
    }}>
      {/* Logo — top: ~47px, left: ~30px */}
      <div style={{ padding: "47px 0 0 30px" }}>
        <TaktoLogo size={22} />
      </div>

      {/* Nav — first item at ~top 124px from sidebar top */}
      <nav style={{ marginTop: 30, padding: "0 0 0 30px", flex: 1 }}>
        {NAV.map(item => {
          const active = path === item.path;
          return (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              display: "inline-block", textAlign: "left",
              padding: active ? "3px 10px" : "3px 10px",
              height: active ? 49 : undefined,
              lineHeight: active ? "43px" : "normal",
              background: active ? C.green : "transparent",
              border: "none", borderRadius: active ? 6 : 0,
              color: active ? C.dark : C.grey,
              fontSize: 32, fontWeight: 700,
              cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: 16, width: "auto",
              boxSizing: "border-box",
            }}>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Copyright */}
      <div style={{ padding: "0 0 24px 40px" }}>
        <p style={{ fontSize: 10, fontWeight: 500, color: C.grey }}>© 2026 Takto. All rights reserved.</p>
      </div>
    </aside>
  );
}

function BottomNav({ path, navigate }) {
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, height: 56,
      background: C.bg, borderTop: `2px solid ${C.dark}`,
      display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 100,
    }}>
      {NAV.map(item => {
        const active = path === item.path;
        return (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            background: active ? C.green : "transparent", border: "none",
            borderRadius: 6, padding: "4px 14px",
            fontSize: 16, fontWeight: active ? 700 : 500,
            color: active ? C.dark : C.grey,
            cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
          }}>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function AppShell({ children, path, navigate }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {!isMobile && <Sidebar path={path} navigate={navigate} />}
      <main style={{ flex: 1, overflow: "auto", paddingBottom: isMobile ? 56 : 0 }}>
        {children}
      </main>
      {isMobile && <BottomNav path={path} navigate={navigate} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH SCREEN — Pixel-perfect from Figma 50:2804
// Card: white, 500px wide, centered. Inputs: #f3f3f3, 50px tall, 18px.
// Sign in button: green, 132px wide centered, 49px tall, 26px SemiBold
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
        if (!data.session) setOk("Check your email to confirm.");
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

  const inputStyle = {
    background: C.bg, border: "none", borderRadius: 6,
    height: 50, padding: "0 18px", width: "100%",
    fontSize: 18, fontWeight: 500, color: C.grey,
    fontFamily: "'Space Grotesk', sans-serif", outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div className="fu" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Logo */}
        <TaktoLogo size={28} />

        {/* Tagline — 22px Medium */}
        <p style={{ fontSize: 22, fontWeight: 500, color: C.dark, marginTop: 16, marginBottom: 40 }}>
          No more creator's block.
        </p>

        {/* Card — white, 500px, border-radius 25px */}
        <AuthCard>
          <div style={{ padding: "36px 60px 36px" }}>
            {/* "Sign in" heading — 20px Medium, centered */}
            <p style={{ fontSize: 20, fontWeight: 500, color: C.dark, textAlign: "center", marginBottom: 28 }}>
              {mode === "forgot" ? "Reset password" : mode === "signup" ? "Sign up" : "Sign in"}
            </p>

            {mode !== "forgot" && (
              <>
                {/* Google button — #17181e, 50px tall, full width, border-radius 6 */}
                <button onClick={googleSignIn} disabled={busy} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  width: "100%", height: 50, background: C.dark, border: "none",
                  borderRadius: 6, color: C.bg, fontSize: 14, fontWeight: 500,
                  cursor: busy ? "not-allowed" : "pointer", marginBottom: 20,
                  fontFamily: "'Inter', sans-serif", opacity: busy ? 0.7 : 1,
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                {/* or divider */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1, height: 1, background: C.grey }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.grey }}>or</span>
                  <div style={{ flex: 1, height: 1, background: C.grey }} />
                </div>
              </>
            )}

            {/* Inputs */}
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="email" placeholder="Email address"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" style={inputStyle}
              />
              {mode !== "forgot" && (
                <input
                  type="password" placeholder="Password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={6} style={inputStyle}
                />
              )}

              {err && <p style={{ color: C.coral, fontSize: 13, fontWeight: 500 }}>{err}</p>}
              {ok  && <p style={{ color: "#22c55e", fontSize: 13, fontWeight: 500 }}>{ok}</p>}

              {/* Sign in button — green, 132px centered, 49px tall, 26px SemiBold */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                <button type="submit" disabled={busy} style={{
                  background: C.green, border: "none", borderRadius: 6,
                  height: 49, width: 132,
                  fontSize: 26, fontWeight: 700, color: C.dark,
                  cursor: busy ? "not-allowed" : "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: busy ? 0.7 : 1,
                }}>
                  {busy && <Spinner size={14} />}
                  {mode === "forgot" ? "Send link" : mode === "signup" ? "Sign up" : "Sign in"}
                </button>
              </div>
            </form>

            {/* Links — 20px Medium */}
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {mode !== "forgot" && (
                <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(""); setOk(""); }}
                  style={{ background: "none", border: "none", fontSize: 20, fontWeight: 500, color: C.dark, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
                  {mode === "signup" ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                </button>
              )}
              {mode === "login" && (
                <button onClick={() => { setMode("forgot"); setErr(""); setOk(""); }}
                  style={{ background: "none", border: "none", fontSize: 20, fontWeight: 500, color: C.grey, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
                  Forgot password?
                </button>
              )}
              {mode === "forgot" && (
                <button onClick={() => setMode("login")}
                  style={{ background: "none", border: "none", fontSize: 20, fontWeight: 500, color: C.grey, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
                  Back to sign in
                </button>
              )}
            </div>
          </div>
        </AuthCard>

        {/* Footer — 14px Medium grey */}
        <p style={{ fontSize: 14, fontWeight: 500, color: C.grey, marginTop: 20, textAlign: "center" }}>
          By signing in you agree to our Terms &amp; Privacy Policy
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING — Figma 64:2991
// ═══════════════════════════════════════════════════════════════════════════════
const NICHES = [
  "💄 Beauty & Makeup", "👗 Fashion & Style", "🌿 Health & Wellness", "✈️ Travel & Adventure",
  "🍳 Food & Cooking", "💰 Side Hustles", "📈 Personal Finance", "💻 Tech & Gadgets",
  "🎮 Gaming", "🎨 DIY & Crafts", "😂 Comedy & Memes", "🐾 Pet & Animals", "👨‍👩‍👧 Parenting & Family",
];
const STYLES = [
  "⭐ Personal Brand/Influencer", "🎭 Comedy/Skit", "📚 Tutorial/Educational",
  "🔥 Challenge/Trend", "🌸 Aesthetic/Mood-Based", "💰 Side Hustles",
  "📋 Review/Reaction", "📖 Storytime/Narration", "✨ Transformation/Glow-Up",
  "🎨 DIY & Crafts", "💪 Motivational/Inspirational", "🎯 Niche Hobbyist",
];

function OnboardingScreen({ navigate }) {
  const { user, refreshProfile } = useAuth();
  const [niches, setNiches] = useState([]);
  const [styles, setStyles] = useState([]);
  const [notifs, setNotifs] = useState(true);
  const [busy, setBusy] = useState(false);

  const toggle = (list, setList, val) =>
    setList(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val]);

  const addCustom = (setList) => {
    const v = prompt("Add custom:");
    if (v?.trim()) setList(p => [...p, v.trim()]);
  };

  const finish = async () => {
    if (!user) return;
    setBusy(true);
    await supabase.from("profiles").update({ niche: niches, style: styles, notifications_enabled: notifs, onboarding_completed: true }).eq("user_id", user.id);
    await refreshProfile();
    navigate("/generate");
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 40px 80px" }}>
      <div className="fu" style={{ width: "100%", maxWidth: 760, textAlign: "center" }}>
        <TaktoLogo size={22} />

        {/* Niche */}
        <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 20 }}>What's your niche?</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {NICHES.map(n => (
            <Chip key={n} label={n} selected={niches.includes(n)} onClick={() => toggle(niches, setNiches, n)} color={C.green} />
          ))}
          {niches.filter(n => !NICHES.includes(n)).map(n => (
            <Chip key={n} label={n} selected onClick={() => toggle(niches, setNiches, n)} color={C.green} />
          ))}
          <Chip label="Add new..." selected={false} onClick={() => addCustom(setNiches)} color={C.green} />
        </div>

        {/* Style */}
        <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 20 }}>What's your content style?</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {STYLES.map(s => (
            <Chip key={s} label={s} selected={styles.includes(s)} onClick={() => toggle(styles, setStyles, s)} color={C.green} />
          ))}
          {styles.filter(s => !STYLES.includes(s)).map(s => (
            <Chip key={s} label={s} selected onClick={() => toggle(styles, setStyles, s)} color={C.green} />
          ))}
          <Chip label="Add new..." selected={false} onClick={() => addCustom(setStyles)} color={C.green} />
        </div>

        {/* Notification card */}
        <div style={{ marginTop: 40 }}>
          <div style={{ background: C.bg, border: `1px solid ${C.dark}`, borderRadius: 25, boxShadow: CARD_SHADOW, padding: "22px 32px", display: "flex", alignItems: "center", gap: 20 }}>
            {/* Radio button visual */}
            <div onClick={() => setNotifs(p => !p)} style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${notifs ? C.green : C.grey}`, background: notifs ? C.green : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {notifs && <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.dark }} />}
            </div>
            <p style={{ fontSize: 18, fontWeight: 500 }}>Get reminded about posting?</p>
          </div>
        </div>

        {/* Continue button */}
        <div style={{ marginTop: 40, display: "flex", justifyContent: "center" }}>
          <button onClick={finish} disabled={busy} style={{
            background: C.green, border: "none", borderRadius: 6,
            height: 49, padding: "0 40px",
            fontSize: 26, fontWeight: 700, color: C.dark,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
            display: "flex", alignItems: "center", gap: 10,
            opacity: busy ? 0.7 : 1,
          }}>
            {busy && <Spinner size={14} />}
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE SCREEN — Figma 50:2605 (empty) + 50:2658 (with results)
// Top row: "Trending now •" coral 46px | "Generate Ideas ✦" gradient 46px right-aligned
// Post Technique: blue chips
// Cards: #f3f3f3, border 1px #17181e, radius 25px, shadow 0 5px 0 0 #17181e
// ═══════════════════════════════════════════════════════════════════════════════
const POST_TECHNIQUES = ["All of them", "Talking Heads", "POV B-Roll", "Day in my Life", "Story Narrative", "Split Screen Comparison", "Text Overlay Carousel"];
const TRENDING_HASHTAGS = ["#dayinmylife", "#hottake", "#unpopularopinion", "#getreadywithme", "#whatieatinaday", "#letmeshowyou", "#trieditsoyoudonthaveto", "#thingsthatjustmakesense", "#thingsnobodytellsyou"];

function GenerateScreen() {
  const { user, profile } = useAuth();
  const [techniques, setTechniques] = useState(["All of them"]);
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [trendingOn, setTrendingOn] = useState(false);
  const [ideas, setIdeas] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const toggleTech = (t) => {
    if (t === "All of them") { setTechniques(["All of them"]); return; }
    setTechniques(p => {
      const w = p.filter(x => x !== "All of them");
      return w.includes(t) ? (w.filter(x => x !== t).length ? w.filter(x => x !== t) : ["All of them"]) : [...w, t];
    });
  };

  const addCustomTech = () => {
    const v = prompt("Add custom technique:");
    if (v?.trim()) setTechniques(p => [...p.filter(x => x !== "All of them"), v.trim()]);
  };

  const generate = async () => {
    if (!profile) return;
    setGenerating(true); setIdeas([]); setExpandedIdx(null); setSavedIds(new Set());
    try {
      const techCtx = techniques.includes("All of them") ? "any technique" : techniques.join(", ");
      const hashCtx = selectedHashtags.length > 0 ? `\nTrending hashtags to incorporate: ${selectedHashtags.join(", ")}` : "";
      const trendCtx = trendingOn ? "\nMake ideas trend-aware and optimised for viral reach." : "";
      const text = await callClaude(
        "You are Takto, a UGC content strategist. Return ONLY valid JSON, no markdown.",
        `Generate 6 ideas for:
- Niches: ${profile.niche?.join(", ")}
- Styles: ${profile.style?.join(", ")}
- Technique: ${techCtx}
${hashCtx}${trendCtx}

JSON: {"ideas":[{"title":"","hook":"","format":"","difficulty":"Easy|Medium|Hard","time_to_create":"15min|30min|1hr","why_it_works":""}]}`
        , 2000
      );
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setIdeas(parsed.ideas || []);
    } catch (genErr) {
      console.error("Generate error:", genErr);
    }
    setGenerating(false);
  };

  const saveIdea = async (idea, idx) => {
    if (!user || savedIds.has(idx)) return;
    const { error } = await supabase.from("content_ideas").insert({
      user_id: user.id, title: idea.title,
      description: `Hook: "${idea.hook}" | Format: ${idea.format} | Why it works: ${idea.why_it_works}`,
      date_scheduled: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      difficulty: idea.difficulty || "Medium", status: "pending",
    });
    if (!error) { setSavedIds(p => new Set([...p, idx])); }
  };

  const saveAll = async () => {
    for (let i = 0; i < ideas.length; i++) await saveIdea(ideas[i], i);
  };


  return (
    <div style={{ padding: "40px 40px 80px", maxWidth: 800, margin: "0 auto" }}>
      {/* Top row: Trending now • | Generate Ideas ✦ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <button onClick={() => { setTrendingOn(p => !p); if (trendingOn) setSelectedHashtags([]); }} style={{
          height: 46, padding: "0 16px", borderRadius: 6,
          background: trendingOn ? C.coral : C.coral,
          border: "none", color: C.white,
          fontSize: 24, fontWeight: 700,
          cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          Trending now {trendingOn ? "•" : "○"}
        </button>

        <button onClick={generate} disabled={generating} style={{
          height: 46, padding: "0 20px", borderRadius: 6,
          background: generating ? C.grey20 : AI_GRADIENT,
          border: "none", color: C.white,
          fontSize: 24, fontWeight: 700,
          cursor: generating ? "not-allowed" : "pointer",
          fontFamily: "'Space Grotesk', sans-serif",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {generating ? <Spinner size={16} /> : null}
          Generate Ideas {!generating && "✦"}
        </button>
      </div>

      {/* Trending hashtags */}
      {trendingOn && (
        <div className="fi" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TRENDING_HASHTAGS.map(h => (
              <Chip key={h} label={h}
                selected={selectedHashtags.includes(h)}
                onClick={() => setSelectedHashtags(p => p.includes(h) ? p.filter(x => x !== h) : [...p, h])}
                color={C.coral}
              />
            ))}
          </div>
        </div>
      )}

      {/* Post Technique — 24px SemiBold heading, blue chips */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 14 }}>Post Technique</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {POST_TECHNIQUES.map(t => (
            <Chip key={t} label={t}
              selected={techniques.includes(t)}
              onClick={() => toggleTech(t)}
              color={C.blue}
            />
          ))}
          <Chip label="Add new..." selected={false} onClick={addCustomTech} color={C.blue} />
        </div>
      </div>

      {/* Empty state placeholder */}
      {!generating && ideas.length === 0 && (
        <p style={{ fontSize: 22, fontWeight: 400, color: C.grey }}>
          Hit Generate to get 6 ideas tailored to your niche and style...
        </p>
      )}

      {/* Generating state */}
      {generating && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "16px 0" }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: C.dark, animation: "blink 1.2s ease infinite", animationDelay: `${i * 0.2}s` }} />)}
          <p style={{ fontSize: 18, color: C.grey, fontWeight: 500, marginLeft: 8 }}>Generating ideas...</p>
        </div>
      )}

      {/* Results */}
      {!generating && ideas.length > 0 && (
        <div className="fi">
          {/* "Saved ideas get scheduled automatically..." + Save All button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <p style={{ fontSize: 22, fontWeight: 400, color: C.grey }}>Saved ideas get scheduled automatically...</p>
            <button onClick={saveAll} style={{
              height: 36, padding: "0 12px", borderRadius: 6,
              background: C.green, border: `1px solid ${C.dark}`,
              fontSize: 16, fontWeight: 700, color: C.dark,
              cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              Save All +
            </button>
          </div>

          {/* Idea cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {ideas.map((idea, i) => {
              const isExpanded = expandedIdx === i;
              const isSaved = savedIds.has(i);
              return (
                <IdeaCard key={i} className="fu" style={{ animationDelay: `${i * 40}ms` }}>
                  {/* Collapsed row */}
                  <div style={{ padding: "20px 24px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title — 22px Medium */}
                      <p style={{ fontSize: 22, fontWeight: 500, marginBottom: 10 }}>{idea.title}</p>
                      {/* Tags row — grey chips, 20px tall, 10px font */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {idea.difficulty && <Tag label={`${idea.difficulty} · ${idea.time_to_create || ""}`} />}
                        {idea.format && <Tag label={idea.format} />}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                      {/* Save button — green, 46px tall, 110px wide with + icon */}
                      {!isSaved ? (
                        <button onClick={() => saveIdea(idea, i)} style={{
                          height: 36, padding: "0 12px", borderRadius: 6,
                          background: C.green, border: `1px solid ${C.dark}`,
                          fontSize: 16, fontWeight: 700, color: C.dark,
                          cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        }}>
                          Save +
                        </button>
                      ) : (
                        <div style={{ height: 36, width: 36, borderRadius: 6, background: C.green, border: `1px solid ${C.dark}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✓</div>
                      )}
                      {/* Expand chevron — ∨ down when closed, ∧ up when open */}
                      <button onClick={() => setExpandedIdx(isExpanded ? null : i)} style={{
                        background: "none", border: "none", cursor: "pointer", padding: "4px",
                        display: "flex", alignItems: "center",
                      }}>
                        <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                          {isExpanded
                            ? <><line x1="1" y1="10" x2="9" y2="2" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/><line x1="9" y1="2" x2="17" y2="10" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/></>
                            : <><line x1="1" y1="2" x2="9" y2="10" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/><line x1="9" y1="10" x2="17" y2="2" stroke={C.dark} strokeWidth="2.5" strokeLinecap="round"/></>
                          }
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="fi" style={{ padding: "16px 24px 20px" }}>
                      {idea.hook && (
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>Hook</p>
                          <p style={{ fontSize: 14, fontWeight: 400, color: C.dark, lineHeight: 1.5 }}>{idea.hook}</p>
                        </div>
                      )}
                      {idea.why_it_works && (
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>Why it works</p>
                          <p style={{ fontSize: 14, fontWeight: 400, color: C.dark, lineHeight: 1.5 }}>{idea.why_it_works}</p>
                        </div>
                      )}
                    </div>
                  )}
                </IdeaCard>
              );
            })}
          </div>

          {/* Generate 6 more ideas... — 24px Bold underlined */}
          <div style={{ textAlign: "center" }}>
            <button onClick={generate} style={{
              background: "none", border: "none",
              fontSize: 24, fontWeight: 700, color: C.dark,
              textDecoration: "underline", cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Generate 6 more ideas...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE SCREEN — Figma 50:2422
// Full calendar grid, 1px #ccc borders, date top-left 24px Medium
// Green chips at bottom of cells, 26px tall
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
    if (selected) setSelected(null);
  };

  // Calendar grid
  const days = [];
  let d = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  while (d <= endOfWeek(endOfMonth(month), { weekStartsOn: 1 })) { days.push(d); d = addDays(d, 1); }
  const selIdeas = selected ? ideas.filter(i => i.date_scheduled === format(selected, "yyyy-MM-dd")) : [];
  // Split days into weeks
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div style={{ padding: "36px 40px 80px", maxWidth: 800, margin: "0 auto" }}>
      <ToastContainer />

      {/* Month heading + nav — "April 2026" 24px SemiBold, Today/arrows grey */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>{format(month, "MMMM yyyy")}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Left arrow */}
          <button onClick={() => setMonth(subMonths(month, 1))} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <line x1="12" y1="3" x2="4" y2="10" stroke={C.grey} strokeWidth="2"/>
              <line x1="4" y1="10" x2="12" y2="17" stroke={C.grey} strokeWidth="2"/>
            </svg>
          </button>
          <button onClick={() => setMonth(new Date())} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, fontWeight: 500, color: C.grey, fontFamily: "'Space Grotesk', sans-serif" }}>Today</button>
          {/* Right arrow */}
          <button onClick={() => setMonth(addMonths(month, 1))} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <line x1="4" y1="3" x2="12" y2="10" stroke={C.grey} strokeWidth="2"/>
              <line x1="12" y1="10" x2="4" y2="17" stroke={C.grey} strokeWidth="2"/>
            </svg>
          </button>
        </div>
      </div>

      {ideas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ fontSize: 22, fontWeight: 400, color: C.grey, marginBottom: 20 }}>No ideas scheduled yet</p>
          <button onClick={() => navigate("/generate")} style={{ height: 49, padding: "0 24px", borderRadius: 6, background: C.green, border: "none", fontSize: 24, fontWeight: 700, color: C.dark, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
            Generate Ideas →
          </button>
        </div>
      ) : (
        <>
          {/* Calendar */}
          <div style={{ width: "100%", border: `1px solid ${C.grey20}` }}>
            {/* Day headers — 18px Medium */}
            <div style={{ display: "flex" }}>
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day => (
                <div key={day} style={{ flex: 1, padding: 12, fontSize: 18, fontWeight: 500, color: C.dark }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Week rows — flex-[1_0_0], each row equal height */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", height: 160 }}>
                {week.map(day => {
                  const ds = format(day, "yyyy-MM-dd");
                  const dayIdeas = ideas.filter(i => i.date_scheduled === ds);
                  const inMonth = isSameMonth(day, month);
                  const isSel = selected && isSameDay(day, selected);
                  return (
                    <div
                      key={ds}
                      onClick={() => setSelected(isSel ? null : day)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => drop(ds)}
                      style={{
                        flex: 1, border: `1px solid ${C.grey20}`,
                        padding: 12, cursor: "pointer",
                        background: isSel ? `${C.green}20` : C.white,
                        display: "flex", flexDirection: "column",
                        justifyContent: "space-between",
                        outline: isSel ? `3px solid ${C.dark}` : "none",
                        outlineOffset: -3,
                      }}
                    >
                      {/* Date number — 24px Medium, grey if out-of-month */}
                      <p style={{ fontSize: 24, fontWeight: 500, color: inMonth ? C.dark : C.grey20, lineHeight: 1 }}>
                        {format(day, "d")}
                      </p>

                      {/* Event chips at bottom — green, 26px tall, 12px font */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {dayIdeas.slice(0, 4).map(idea => (
                          <div
                            key={idea.id}
                            draggable
                            onDragStart={e => { e.stopPropagation(); setDragId(idea.id); }}
                            onClick={e => e.stopPropagation()}
                            title={idea.title}
                            style={{
                              height: 26, borderRadius: 6, padding: "3px 6px",
                              background: idea.status === "used" ? C.grey20 : C.green,
                              fontSize: 12, fontWeight: 400, color: C.dark,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              cursor: "grab",
                            }}
                          >
                            {idea.title}
                          </div>
                        ))}
                        {dayIdeas.length > 4 && <p style={{ fontSize: 10, color: C.grey }}>+{dayIdeas.length - 4}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Selected day detail */}
          {selected && (
            <div className="fi" style={{ marginTop: 24 }}>
              {/* Date label — "Wed 8 April 2026" 20px Medium grey */}
              <p style={{ fontSize: 20, fontWeight: 500, color: C.grey, marginBottom: 14 }}>
                {format(selected, "EEE d MMMM yyyy")}
              </p>

              {selIdeas.length === 0 ? (
                <p style={{ fontSize: 16, color: C.grey }}>No ideas — drag one here to schedule it</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {selIdeas.map(idea => (
                    <IdeaCard key={idea.id} style={{ padding: "20px 24px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>{idea.title}</p>
                          {idea.description && (
                            <p style={{ fontSize: 14, fontWeight: 400, color: C.grey, lineHeight: 1.5, marginBottom: 8 }}>
                              {idea.description.length > 120 ? idea.description.slice(0, 120) + "…" : idea.description}
                            </p>
                          )}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {idea.difficulty && <Tag label={idea.difficulty} />}
                            <Tag label={idea.status || "pending"} />
                          </div>
                        </div>
                        {/* × delete and ✓ mark posted — 46px square green/grey */}
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          {idea.status !== "used" && (
                            <button onClick={() => markUsed(idea.id)} style={{ width: 46, height: 46, borderRadius: 6, background: C.green, border: `1px solid ${C.dark}`, cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</button>
                          )}
                          <button onClick={() => deleteIdea(idea.id)} style={{ width: 46, height: 46, borderRadius: 6, background: C.bg, border: `1px solid ${C.dark}`, cursor: "pointer", fontSize: 20, color: C.grey, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                        </div>
                      </div>
                    </IdeaCard>
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
// PROFILE SCREEN — Figma 50:2389 (view) + 88:3235 (edit)
// "Creator Settings" 24px SemiBold
// Email: #e5e5e5 bg, border 1px #17181e, 46px tall, 24px SemiBold
// "Edit": 24px SemiBold grey underlined, right-aligned
// Section labels: 20px SemiBold grey
// Chips: height 32px, 18px Medium
// "Posting Reminder" label then "On/Off" 18px Medium
// "↙ Log out": 24px SemiBold grey underlined
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

  const toggle = (list, setList, val) =>
    setList(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val]);

  const addCustom = (setList) => {
    const v = prompt("Add custom:");
    if (v?.trim()) setList(p => [...p, v.trim()]);
  };

  // Section label — 20px SemiBold grey
  const SectionLabel = ({ children }) => (
    <p style={{ fontSize: 20, fontWeight: 700, color: C.grey, marginBottom: 12 }}>{children}</p>
  );

  return (
    <div style={{ padding: "36px 40px 80px", maxWidth: 800, margin: "0 auto" }}>
      <ToastContainer />

      {/* "Creator Settings" — 24px SemiBold */}
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32 }}>Creator Settings</h1>

      {/* Email + Edit row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
        <div style={{ background: C.grey10, border: `1px solid ${C.dark}`, borderRadius: 6, height: 46, padding: "0 18px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: C.dark }}>{user?.email}</span>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", fontSize: 24, fontWeight: 700, color: C.grey, textDecoration: "underline", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>Edit</button>
        ) : (
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", fontSize: 20, fontWeight: 500, color: C.grey, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ height: 46, padding: "0 20px", borderRadius: 6, background: C.green, border: "none", fontSize: 24, fontWeight: 700, color: C.dark, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'Space Grotesk', sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
              {saving && <Spinner size={14} />} Save
            </button>
          </div>
        )}
      </div>

      {/* Niche */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel>Niche</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {editing ? (
            <>
              {NICHES.map(n => <Chip key={n} label={n} selected={niches.includes(n)} onClick={() => toggle(niches, setNiches, n)} color={C.green} />)}
              {niches.filter(n => !NICHES.includes(n)).map(n => <Chip key={n} label={n} selected onClick={() => toggle(niches, setNiches, n)} color={C.green} />)}
              <Chip label="Add new..." selected={false} onClick={() => addCustom(setNiches)} color={C.green} />
            </>
          ) : (
            (profile?.niche || []).map(n => <Chip key={n} label={n} selected color={C.green} />)
          )}
        </div>
      </div>

      {/* Style */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel>Style</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {editing ? (
            <>
              {STYLES.map(s => <Chip key={s} label={s} selected={styles.includes(s)} onClick={() => toggle(styles, setStyles, s)} color={C.green} />)}
              {styles.filter(s => !STYLES.includes(s)).map(s => <Chip key={s} label={s} selected onClick={() => toggle(styles, setStyles, s)} color={C.green} />)}
              <Chip label="Add new..." selected={false} onClick={() => addCustom(setStyles)} color={C.green} />
            </>
          ) : (
            (profile?.style || []).map(s => <Chip key={s} label={s} selected color={C.green} />)
          )}
        </div>
      </div>

      {/* Posting Reminder */}
      <div style={{ marginBottom: 40 }}>
        <SectionLabel>Posting Reminder</SectionLabel>
        {editing ? (
          <button onClick={() => setNotifs(p => !p)} style={{ height: 32, padding: "0 10px 1px 8px", borderRadius: 6, background: notifs ? C.green : `${C.green}40`, border: "none", fontSize: 18, fontWeight: 500, color: C.dark, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
            {notifs ? "On" : "Off"}
          </button>
        ) : (
          <p style={{ fontSize: 18, fontWeight: 500, color: C.dark }}>{notifs ? "On" : "Off"}</p>
        )}
      </div>

      {/* ↙ Log out — 24px SemiBold grey underlined */}
      <button onClick={signOut} style={{ background: "none", border: "none", fontSize: 24, fontWeight: 700, color: C.grey, textDecoration: "underline", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
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
        <TaktoLogo size={24} />
        <Spinner size={22} />
        {(!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) && (
          <div style={{ padding: "12px 18px", border: `1px solid ${C.coral}`, borderRadius: 6, maxWidth: 360, textAlign: "center" }}>
            <p style={{ color: C.coral, fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Missing env vars</p>
            <p style={{ color: C.coral, fontSize: 12 }}>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel</p>
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

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error("App error:", err); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#f3f3f3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
          <svg width="120" height="37" viewBox="0 0 200 62" fill="none">
            <path d={TAKTO_O} fill="#17181e"/><path d={TAKTO_KT} fill="#17181e"/>
            <path d={TAKTO_A} fill="#17181e"/><polygon points={TAKTO_T} fill="#17181e"/>
          </svg>
          <p style={{ fontSize: 18, fontWeight: 500, color: "#7f7f7f" }}>Something went wrong.</p>
          <button onClick={() => window.location.reload()} style={{ height: 46, padding: "0 24px", background: "#6dff8d", border: "1px solid #17181e", borderRadius: 6, fontSize: 18, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <GlobalStyles />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
